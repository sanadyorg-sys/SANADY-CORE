-- ════════════════════════════════════════════════════════════════════════════
-- SANADY Enterprise — phase E5: commercial contracts, usage, renewals
--   (brief V3 §16–17; PROPOSED activity: nothing is billed or charged)
--
-- Contract: built from an accepted proposal (its lines are copied), draft ⇄
--   internal review → approved (approver, 2FA) → signed (an approver records
--   the signature with the signed PDF and date — never simulated) → active
--   → renewal → active, or closed.
-- Usage: monthly readings per company workspace (active and enrolled
--   learners, completions, storage of the company's own course files),
--   compared with the contract limits; an overage is flagged for the team
--   to review — never charged automatically.
-- ════════════════════════════════════════════════════════════════════════════

create type public.contract_status as enum ('draft', 'internal_review', 'approved', 'signed', 'active', 'renewal', 'closed');

create sequence public.contract_reference_seq;

create table public.enterprise_contracts (
  id                      uuid primary key default gen_random_uuid(),
  reference               text not null unique,
  organization_id         uuid not null references public.partner_organizations (id) on delete restrict,
  proposal_id             uuid unique references public.enterprise_proposals (id) on delete set null,
  tenant_id               uuid references public.enterprise_tenants (id) on delete set null,
  title                   text not null check (char_length(btrim(title)) between 5 and 200),
  service                 public.enterprise_service not null check (service <> 'partenariat'),
  pricing_model           text not null check (pricing_model in ('annual_subscription', 'monthly_subscription', 'per_active_learner',
                                                                 'per_enrolled_learner', 'fixed_fee', 'mixed')),
  currency                text not null default 'MAD' check (currency in ('MAD', 'EUR', 'USD')),
  start_on                date,
  end_on                  date,
  renewal_terms           text check (char_length(renewal_terms) <= 2000),
  renewal_notice_days     smallint not null default 60 check (renewal_notice_days between 0 and 365),
  learner_limit           integer check (learner_limit > 0),
  storage_limit_gb        numeric(8, 2) check (storage_limit_gb > 0),
  video_minutes_limit     integer check (video_minutes_limit > 0),
  support_commitments     text check (char_length(support_commitments) <= 2000),
  data_ownership          text check (char_length(data_ownership) <= 2000),
  content_ownership       text check (char_length(content_ownership) <= 2000),
  termination_provisions  text check (char_length(termination_provisions) <= 2000),
  status                  public.contract_status not null default 'draft',
  approved_by             uuid references public.profiles (id) on delete set null,
  approved_at             timestamptz,
  signed_on               date,
  signed_recorded_by      uuid references public.profiles (id) on delete set null,
  closed_at               timestamptz,
  created_by              uuid references public.profiles (id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  check (end_on is null or start_on is null or end_on >= start_on)
);
create index enterprise_contracts_org_idx on public.enterprise_contracts (organization_id);
create index enterprise_contracts_status_idx on public.enterprise_contracts (status, updated_at desc);

create table public.enterprise_contract_lines (
  id           uuid primary key default gen_random_uuid(),
  contract_id  uuid not null references public.enterprise_contracts (id) on delete cascade,
  category     public.proposal_line_category not null,
  label        text not null check (char_length(btrim(label)) between 2 and 200),
  quantity     numeric(12, 2) not null default 1 check (quantity > 0),
  unit         text check (char_length(unit) <= 40),
  unit_price   numeric(12, 2) not null check (unit_price >= 0),
  position     integer not null default 0
);
create index enterprise_contract_lines_idx on public.enterprise_contract_lines (contract_id, position);

-- Contract documents in the private « enterprise » bucket.
alter table public.enterprise_documents
  alter column request_id drop not null,
  add column contract_id uuid references public.enterprise_contracts (id) on delete cascade,
  add column kind text not null default 'request' check (kind in ('request', 'draft', 'signed', 'supporting')),
  add column uploaded_by uuid references public.profiles (id) on delete set null,
  add constraint enterprise_documents_one_target check (num_nonnulls(request_id, contract_id) = 1);
create index enterprise_documents_contract_idx on public.enterprise_documents (contract_id);

alter table public.enterprise_history
  add column contract_id uuid references public.enterprise_contracts (id) on delete cascade,
  drop constraint enterprise_history_one_target,
  add constraint enterprise_history_one_target check (num_nonnulls(organization_id, request_id, proposal_id, tenant_id, project_id, contract_id) = 1);
create index enterprise_history_contract_idx on public.enterprise_history (contract_id, created_at);

create table public.enterprise_usage_records (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.enterprise_tenants (id) on delete cascade,
  period             date not null check (extract(day from period) = 1),
  active_learners    integer not null default 0,
  enrolled_learners  integer not null default 0,
  completions        integer not null default 0,
  storage_mb         numeric(12, 2) not null default 0,
  learner_limit      integer,
  storage_limit_gb   numeric(8, 2),
  overage            boolean not null default false,
  review_note        text check (char_length(review_note) <= 1000),
  reviewed_by        uuid references public.profiles (id) on delete set null,
  reviewed_at        timestamptz,
  recorded_by        uuid references public.profiles (id) on delete set null,
  recorded_at        timestamptz not null default now(),
  unique (tenant_id, period)
);

-- ─── Row level security ────────────────────────────────────────────────────
alter table public.enterprise_contracts      enable row level security;
alter table public.enterprise_contract_lines enable row level security;
alter table public.enterprise_usage_records  enable row level security;
revoke all on public.enterprise_contracts, public.enterprise_contract_lines, public.enterprise_usage_records from anon, authenticated;
revoke all on sequence public.contract_reference_seq from anon, authenticated;
create policy enterprise_contracts_select      on public.enterprise_contracts      for select to authenticated using (private.is_enterprise_staff() or private.is_partnership_signatory());
create policy enterprise_contract_lines_select on public.enterprise_contract_lines for select to authenticated using (private.is_enterprise_staff() or private.is_partnership_signatory());
create policy enterprise_usage_records_select  on public.enterprise_usage_records  for select to authenticated using (private.is_enterprise_staff());
grant select on public.enterprise_contracts, public.enterprise_contract_lines, public.enterprise_usage_records to authenticated;

-- Approvers read the documents of contracts they approve.
drop policy enterprise_documents_select on public.enterprise_documents;
create policy enterprise_documents_select on public.enterprise_documents for select to authenticated
  using (private.is_enterprise_staff() or (contract_id is not null and private.is_partnership_signatory()));
create policy enterprise_contracts_read on storage.objects
  for select to authenticated
  using (bucket_id = 'enterprise' and name like 'contracts/%' and private.is_partnership_signatory());

-- ─── Helpers ───────────────────────────────────────────────────────────────
create function private.contract_log(p_contract uuid, p_from text, p_to text, p_note text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.enterprise_history (contract_id, from_status, to_status, note, changed_by)
  values (p_contract, p_from, p_to, nullif(btrim(coalesce(p_note, '')), ''), auth.uid());
$$;

create function private.contract_values(p jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'title', btrim(coalesce(p ->> 'title', '')),
    'pricing_model', p ->> 'pricing_model',
    'currency', coalesce(nullif(p ->> 'currency', ''), 'MAD'),
    'start_on', nullif(p ->> 'start_on', ''),
    'end_on', nullif(p ->> 'end_on', ''),
    'renewal_terms', nullif(btrim(coalesce(p ->> 'renewal_terms', '')), ''),
    'renewal_notice_days', coalesce(nullif(p ->> 'renewal_notice_days', ''), '60'),
    'learner_limit', nullif(p ->> 'learner_limit', ''),
    'storage_limit_gb', nullif(p ->> 'storage_limit_gb', ''),
    'video_minutes_limit', nullif(p ->> 'video_minutes_limit', ''),
    'support_commitments', nullif(btrim(coalesce(p ->> 'support_commitments', '')), ''),
    'data_ownership', nullif(btrim(coalesce(p ->> 'data_ownership', '')), ''),
    'content_ownership', nullif(btrim(coalesce(p ->> 'content_ownership', '')), ''),
    'termination_provisions', nullif(btrim(coalesce(p ->> 'termination_provisions', '')), ''),
    'tenant_id', nullif(p ->> 'tenant_id', '')
  );
$$;

-- ─── Contracts ─────────────────────────────────────────────────────────────
-- Created from an accepted proposal: its lines are copied (never re-typed).
create function public.create_contract_from_proposal(p_proposal uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  pr   public.enterprise_proposals;
  v_id uuid;
begin
  perform private.require(private.is_enterprise_manager(), 'forbidden');
  select * into pr from public.enterprise_proposals where id = p_proposal;
  perform private.require(pr.id is not null, 'not_found');
  perform private.require(pr.status = 'accepted', 'proposal_not_accepted');
  perform private.require(pr.service <> 'partenariat', 'invalid_input');
  perform private.require(not exists (select 1 from public.enterprise_contracts where proposal_id = pr.id), 'already_exists');
  insert into public.enterprise_contracts (reference, organization_id, proposal_id, title, service, pricing_model, currency, created_by)
  values ('CTR-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.contract_reference_seq')::text, 4, '0'),
          pr.organization_id, pr.id, pr.title, pr.service, 'fixed_fee', pr.currency, auth.uid())
  returning id into v_id;
  insert into public.enterprise_contract_lines (contract_id, category, label, quantity, unit, unit_price, position)
  select v_id, l.category, l.label, l.quantity, l.unit, l.unit_price, l.position
    from public.enterprise_proposal_lines l where l.proposal_id = pr.id;
  perform private.contract_log(v_id, null, 'draft', pr.reference);
  perform private.log_audit('contract_created', 'enterprise_contracts', v_id, null, jsonb_build_object('proposal', pr.reference));
  return v_id;
end;
$$;

-- Terms are edited in draft; once active or in renewal, only the dates and
-- renewal terms change (a renewal), the rest stays as signed.
create function public.save_enterprise_contract(p_id uuid, p jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.enterprise_contracts;
  v jsonb := private.contract_values(p);
begin
  perform private.require(private.is_enterprise_manager(), 'forbidden');
  select * into c from public.enterprise_contracts where id = p_id for update;
  perform private.require(c.id is not null, 'not_found');
  perform private.require(
    (v ->> 'tenant_id') is null
    or exists (select 1 from public.enterprise_tenants t where t.id = (v ->> 'tenant_id')::uuid and t.organization_id = c.organization_id),
    'invalid_input');
  if c.status = 'draft' then
    update public.enterprise_contracts
       set title = v ->> 'title', pricing_model = v ->> 'pricing_model', currency = v ->> 'currency',
           start_on = (v ->> 'start_on')::date, end_on = (v ->> 'end_on')::date, renewal_terms = v ->> 'renewal_terms',
           renewal_notice_days = (v ->> 'renewal_notice_days')::smallint, learner_limit = (v ->> 'learner_limit')::integer,
           storage_limit_gb = (v ->> 'storage_limit_gb')::numeric, video_minutes_limit = (v ->> 'video_minutes_limit')::integer,
           support_commitments = v ->> 'support_commitments', data_ownership = v ->> 'data_ownership',
           content_ownership = v ->> 'content_ownership', termination_provisions = v ->> 'termination_provisions',
           tenant_id = (v ->> 'tenant_id')::uuid, updated_at = now()
     where id = p_id;
  elsif c.status = 'renewal' then
    perform private.require((v ->> 'end_on') is not null and (v ->> 'end_on')::date >= coalesce(c.end_on, current_date), 'invalid_input');
    update public.enterprise_contracts
       set end_on = (v ->> 'end_on')::date, renewal_terms = v ->> 'renewal_terms', tenant_id = coalesce((v ->> 'tenant_id')::uuid, tenant_id), updated_at = now()
     where id = p_id;
    perform private.contract_log(p_id, null, 'renewal_terms', 'Nouvelle échéance : ' || to_char((v ->> 'end_on')::date, 'DD/MM/YYYY'));
  elsif c.status in ('signed', 'active') then
    -- Only the workspace link can change on a signed contract.
    update public.enterprise_contracts set tenant_id = (v ->> 'tenant_id')::uuid, updated_at = now() where id = p_id;
  else
    perform private.require(false, 'contract_locked');
  end if;
end;
$$;

create function public.save_contract_line(p_id uuid, p_contract uuid, p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := p_id;
begin
  perform private.require(private.is_enterprise_manager(), 'forbidden');
  perform private.require(exists (select 1 from public.enterprise_contracts where id = p_contract and status = 'draft'), 'contract_locked');
  if v_id is null then
    insert into public.enterprise_contract_lines (contract_id, category, label, quantity, unit, unit_price, position)
    values (p_contract, (p ->> 'category')::public.proposal_line_category, btrim(p ->> 'label'), private.money(p ->> 'quantity'),
            nullif(btrim(coalesce(p ->> 'unit', '')), ''), private.money(p ->> 'unit_price'),
            coalesce((select max(position) + 1 from public.enterprise_contract_lines where contract_id = p_contract), 0))
    returning id into v_id;
  else
    update public.enterprise_contract_lines
       set category = (p ->> 'category')::public.proposal_line_category, label = btrim(p ->> 'label'),
           quantity = private.money(p ->> 'quantity'), unit = nullif(btrim(coalesce(p ->> 'unit', '')), ''), unit_price = private.money(p ->> 'unit_price')
     where id = v_id and contract_id = p_contract;
    perform private.require(found, 'not_found');
  end if;
  return v_id;
end;
$$;

create function public.delete_contract_line(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require(private.is_enterprise_manager(), 'forbidden');
  delete from public.enterprise_contract_lines l using public.enterprise_contracts c
   where l.id = p_id and c.id = l.contract_id and c.status = 'draft';
  perform private.require(found, 'contract_locked');
end;
$$;

create function public.set_contract_status(p_contract uuid, p_status text, p jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c      public.enterprise_contracts;
  v_note text := nullif(btrim(coalesce(p ->> 'note', '')), '');
  v_date date := nullif(p ->> 'signed_on', '')::date;
begin
  perform private.require(private.is_enterprise_manager() or private.is_partnership_signatory(), 'forbidden');
  select * into c from public.enterprise_contracts where id = p_contract for update;
  perform private.require(c.id is not null, 'not_found');

  if (c.status::text, p_status) = ('draft', 'internal_review') then
    perform private.require(private.is_enterprise_manager(), 'forbidden');
    perform private.require(c.start_on is not null and c.end_on is not null, 'dates_required');
    perform private.require(exists (select 1 from public.enterprise_contract_lines where contract_id = c.id), 'lines_required');
  elsif (c.status::text, p_status) in (('internal_review', 'draft'), ('approved', 'draft')) then
    perform private.require(private.is_enterprise_manager(), 'forbidden');
  elsif (c.status::text, p_status) = ('internal_review', 'approved') then
    perform private.require(private.is_partnership_signatory(), 'forbidden');
  elsif (c.status::text, p_status) = ('approved', 'signed') then
    perform private.require(private.is_partnership_signatory(), 'forbidden');
    perform private.require(v_date is not null and v_date <= current_date, 'signed_date_required');
    perform private.require(exists (select 1 from public.enterprise_documents d where d.contract_id = c.id and d.kind = 'signed'), 'signed_document_required');
  elsif (c.status::text, p_status) in (('signed', 'active'), ('active', 'renewal')) then
    perform private.require(private.is_enterprise_manager(), 'forbidden');
  elsif (c.status::text, p_status) = ('renewal', 'active') then
    perform private.require(private.is_enterprise_manager(), 'forbidden');
    perform private.require(c.end_on >= current_date, 'contract_expired');
  elsif c.status::text in ('signed', 'active', 'renewal') and p_status = 'closed' then
    perform private.require(private.is_enterprise_manager(), 'forbidden');
    perform private.require(v_note is not null, 'comment_required');
  else
    perform private.require(false, 'invalid_transition');
  end if;

  update public.enterprise_contracts
     set status = p_status::public.contract_status,
         approved_by = case when p_status = 'approved' then auth.uid() when p_status = 'draft' then null else approved_by end,
         approved_at = case when p_status = 'approved' then now() when p_status = 'draft' then null else approved_at end,
         signed_on = case when p_status = 'signed' then v_date else signed_on end,
         signed_recorded_by = case when p_status = 'signed' then auth.uid() else signed_recorded_by end,
         closed_at = case when p_status = 'closed' then now() else closed_at end,
         updated_at = now()
   where id = c.id;
  perform private.contract_log(c.id, c.status::text, p_status, v_note);
  perform private.log_audit('contract_status', 'enterprise_contracts', c.id, null, jsonb_build_object('from', c.status::text, 'to', p_status));
end;
$$;

-- The workspace takes the limits and dates of its signed contract.
create function public.apply_contract_to_tenant(p_contract uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.enterprise_contracts;
begin
  perform private.require(private.is_enterprise_manager(), 'forbidden');
  select * into c from public.enterprise_contracts where id = p_contract;
  perform private.require(c.id is not null and c.tenant_id is not null, 'not_found');
  perform private.require(c.status in ('signed', 'active', 'renewal'), 'invalid_transition');
  update public.enterprise_tenants
     set max_learners = coalesce(c.learner_limit, max_learners),
         storage_allowance_gb = coalesce(c.storage_limit_gb, storage_allowance_gb),
         video_minutes_allowance = coalesce(c.video_minutes_limit, video_minutes_allowance),
         contract_start_on = coalesce(c.start_on, contract_start_on),
         contract_end_on = coalesce(c.end_on, contract_end_on),
         updated_at = now()
   where id = c.tenant_id and status not in ('closed', 'cancelled');
  perform private.require(found, 'tenant_inactive');
  perform private.contract_log(c.id, null, 'applied_to_tenant', null);
end;
$$;

create function public.add_contract_document(p_contract uuid, p_kind text, p_path text, p_name text, p_size integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_st text;
  v_id uuid;
begin
  perform private.require(private.is_enterprise_manager() or private.is_partnership_signatory(), 'forbidden');
  perform private.require(p_kind in ('draft', 'signed', 'supporting'), 'invalid_input');
  perform private.require(p_path like 'contracts/' || p_contract::text || '/%', 'invalid_input');
  select status::text into v_st from public.enterprise_contracts where id = p_contract;
  perform private.require(v_st is not null and v_st <> 'closed', 'not_found');
  if p_kind = 'signed' then
    perform private.require(private.is_partnership_signatory(), 'forbidden');
    perform private.require(v_st in ('approved', 'signed', 'active', 'renewal'), 'invalid_transition');
  end if;
  insert into public.enterprise_documents (contract_id, kind, storage_path, file_name, mime_type, file_size, uploaded_by)
  values (p_contract, p_kind, p_path, left(p_name, 200), 'application/pdf', p_size, auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

-- ─── Usage (brief §17) ─────────────────────────────────────────────────────
-- Measured from the records: learners active in the month (their own
-- learning activity in courses the workspace assigned), employees enrolled,
-- completions, and storage of the company's own course files.
create function private.measure_tenant_usage(p_tenant uuid, p_period date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with t as (select * from public.enterprise_tenants where id = p_tenant),
       bounds as (select p_period::timestamptz as v_from, (p_period + interval '1 month')::timestamptz as v_to)
  select jsonb_build_object(
    'active_learners', (select count(distinct e.user_id) from public.learning_events e, bounds b, t
                         join public.course_assignments ca on ca.institution_id = t.institution_id and ca.revoked_at is null
                        where e.user_id = ca.user_id and e.course_id = ca.course_id
                          and e.occurred_at >= b.v_from and e.occurred_at < b.v_to
                          and e.event_type::text not in ('enrolled', 'quiz_attempts_reset', 'certificate_issued')),
    'enrolled_learners', (select count(*) from public.institution_memberships m, t
                           where m.institution_id = t.institution_id and m.role = 'teacher' and m.status = 'active'),
    'completions', (select count(*) from public.enrollments en, bounds b, t
                     join public.course_assignments ca on ca.institution_id = t.institution_id and ca.revoked_at is null
                    where en.user_id = ca.user_id and en.course_id = ca.course_id
                      and en.completed_at >= b.v_from and en.completed_at < b.v_to),
    'storage_mb', round(coalesce((select sum((o.metadata ->> 'size')::bigint) from storage.objects o, t
                                   where o.bucket_id = 'course-media'
                                     and (storage.foldername(o.name))[1] in (select c.id::text from public.courses c where c.owner_institution_id = t.institution_id)), 0)
                        / 1048576.0, 2)
  );
$$;

create function public.tenant_usage_now(p_tenant uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require(private.is_enterprise_staff(), 'forbidden');
  return private.measure_tenant_usage(p_tenant, date_trunc('month', current_date)::date);
end;
$$;

-- Records (or refreshes) the reading of a month and flags overages against
-- the limits of the workspace's active contract.
create function public.record_tenant_usage(p_tenant uuid, p_period date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  t      public.enterprise_tenants;
  c      public.enterprise_contracts;
  u      jsonb;
  v_per  date := date_trunc('month', p_period)::date;
  v_lim  integer;
  v_sto  numeric;
  v_over boolean;
begin
  perform private.require(private.is_enterprise_manager(), 'forbidden');
  select * into t from public.enterprise_tenants where id = p_tenant;
  perform private.require(t.id is not null and t.institution_id is not null, 'not_found');
  perform private.require(v_per <= date_trunc('month', current_date)::date, 'invalid_input');
  select * into c from public.enterprise_contracts
   where tenant_id = p_tenant and status in ('signed', 'active', 'renewal') order by start_on desc nulls last limit 1;
  u := private.measure_tenant_usage(p_tenant, v_per);
  v_lim := coalesce(c.learner_limit, t.max_learners);
  v_sto := coalesce(c.storage_limit_gb, t.storage_allowance_gb);
  v_over := (case when c.pricing_model = 'per_active_learner' then (u ->> 'active_learners')::integer else (u ->> 'enrolled_learners')::integer end) > coalesce(v_lim, 2147483647)
            or (u ->> 'storage_mb')::numeric > coalesce(v_sto * 1024, 1e15);
  insert into public.enterprise_usage_records (tenant_id, period, active_learners, enrolled_learners, completions, storage_mb,
                                               learner_limit, storage_limit_gb, overage, recorded_by)
  values (p_tenant, v_per, (u ->> 'active_learners')::integer, (u ->> 'enrolled_learners')::integer, (u ->> 'completions')::integer,
          (u ->> 'storage_mb')::numeric, v_lim, v_sto, v_over, auth.uid())
  on conflict (tenant_id, period) do update
     set active_learners = excluded.active_learners, enrolled_learners = excluded.enrolled_learners, completions = excluded.completions,
         storage_mb = excluded.storage_mb, learner_limit = excluded.learner_limit, storage_limit_gb = excluded.storage_limit_gb,
         overage = excluded.overage, recorded_by = excluded.recorded_by, recorded_at = now(),
         reviewed_by = null, reviewed_at = null, review_note = null;
  return u || jsonb_build_object('overage', v_over, 'learner_limit', v_lim, 'storage_limit_gb', v_sto);
end;
$$;

-- An overage is reviewed by a person: nothing is charged automatically.
create function public.review_usage_overage(p_record uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require(private.is_enterprise_manager(), 'forbidden');
  perform private.require(char_length(btrim(coalesce(p_note, ''))) >= 5, 'comment_required');
  update public.enterprise_usage_records
     set review_note = btrim(p_note), reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_record and overage;
  perform private.require(found, 'not_found');
end;
$$;

-- Contracts to renew and overages to review (enterprise team).
create function public.enterprise_watchlist()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when not (private.is_enterprise_staff() or private.is_partnership_signatory()) then null else jsonb_build_object(
    'renewals', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'reference', c.reference, 'title', c.title, 'organization', o.name, 'end_on', c.end_on) order by c.end_on)
        from public.enterprise_contracts c join public.partner_organizations o on o.id = c.organization_id
       where c.status in ('signed', 'active') and c.end_on is not null and c.end_on - c.renewal_notice_days <= current_date), '[]'::jsonb),
    'overages', coalesce((
      select jsonb_agg(jsonb_build_object('id', u.id, 'tenant_id', u.tenant_id, 'tenant', t.display_name, 'period', u.period) order by u.period desc)
        from public.enterprise_usage_records u join public.enterprise_tenants t on t.id = u.tenant_id
       where u.overage and u.reviewed_at is null), '[]'::jsonb),
    'approvals', (select count(*) from public.enterprise_contracts where status = 'internal_review')
  ) end;
$$;

-- ─── Grants ────────────────────────────────────────────────────────────────
revoke execute on function private.contract_log(uuid, text, text, text), private.contract_values(jsonb), private.measure_tenant_usage(uuid, date)
  from public, anon;
revoke execute on function
  public.create_contract_from_proposal(uuid), public.save_enterprise_contract(uuid, jsonb), public.save_contract_line(uuid, uuid, jsonb),
  public.delete_contract_line(uuid), public.set_contract_status(uuid, text, jsonb), public.apply_contract_to_tenant(uuid),
  public.add_contract_document(uuid, text, text, text, integer), public.tenant_usage_now(uuid), public.record_tenant_usage(uuid, date),
  public.review_usage_overage(uuid, text), public.enterprise_watchlist()
from public, anon;
grant execute on function
  public.create_contract_from_proposal(uuid), public.save_enterprise_contract(uuid, jsonb), public.save_contract_line(uuid, uuid, jsonb),
  public.delete_contract_line(uuid), public.set_contract_status(uuid, text, jsonb), public.apply_contract_to_tenant(uuid),
  public.add_contract_document(uuid, text, text, text, integer), public.tenant_usage_now(uuid), public.record_tenant_usage(uuid, date),
  public.review_usage_overage(uuid, text), public.enterprise_watchlist()
to authenticated;

-- The server reads contract document paths (the retention purge rule of
-- 20261019000200 applies to these tables too).
grant select on public.enterprise_documents to service_role;
