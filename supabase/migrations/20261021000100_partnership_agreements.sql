-- ════════════════════════════════════════════════════════════════════════════
-- SANADY · Partenariats & Coopération — brief V2, phase 4
--   Agreements (conventions), contributions, project milestones, renewals
--
-- Agreement: draft ⇄ internal review → approved (approver, 2FA) → signed
--   (recorded by an approver, with the signed PDF: the platform never
--   produces or simulates a signature) → active → completed → archived.
--   Its content is frozen once approved (back to draft = new approval).
-- Contribution (financial, material or expertise): pledged → committed →
--   delivered → verified (approver, with evidence), or cancelled. Pledged
--   money is never counted as received: totals are kept per stage.
-- Partnerships only: no commercial record (SANADY Enterprise) is mixed in.
-- ════════════════════════════════════════════════════════════════════════════

create type public.agreement_status as enum ('draft', 'internal_review', 'approved', 'signed', 'active', 'completed', 'archived');
create type public.contribution_kind as enum ('financial', 'material', 'expertise');
create type public.contribution_stage as enum ('pledged', 'committed', 'delivered', 'verified', 'cancelled');

create sequence public.agreement_reference_seq;

create table public.partnership_agreements (
  id                   uuid primary key default gen_random_uuid(),
  reference            text not null unique,
  organization_id      uuid not null references public.partner_organizations (id) on delete restrict,
  opportunity_id       uuid references public.partnership_opportunities (id) on delete set null,
  intervention_field   text not null references public.intervention_fields (slug),
  title                text not null check (char_length(btrim(title)) between 5 and 200),
  objectives           text not null check (char_length(btrim(objectives)) between 20 and 4000),
  responsibilities     text check (char_length(responsibilities) <= 4000),
  contributions_summary text check (char_length(contributions_summary) <= 4000),
  start_on             date,
  end_on               date,
  renewal_terms        text check (char_length(renewal_terms) <= 2000),
  renewal_notice_days  smallint not null default 60 check (renewal_notice_days between 0 and 365),
  status               public.agreement_status not null default 'draft',
  approved_by          uuid references public.profiles (id) on delete set null,
  approved_at          timestamptz,
  signed_on            date,
  signed_recorded_by   uuid references public.profiles (id) on delete set null,
  created_by           uuid references public.profiles (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  check (end_on is null or start_on is null or end_on >= start_on)
);
create index partnership_agreements_status_idx on public.partnership_agreements (status, updated_at desc);
create index partnership_agreements_org_idx on public.partnership_agreements (organization_id);

create table public.partnership_milestones (
  id            uuid primary key default gen_random_uuid(),
  agreement_id  uuid not null references public.partnership_agreements (id) on delete cascade,
  title         text not null check (char_length(btrim(title)) between 2 and 200),
  due_on        date not null,
  done_at       timestamptz,
  note          text check (char_length(note) <= 1000),
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);
create index partnership_milestones_agreement_idx on public.partnership_milestones (agreement_id, due_on);
create index partnership_milestones_open_idx on public.partnership_milestones (due_on) where done_at is null;

create table public.partnership_contributions (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references public.partner_organizations (id) on delete restrict,
  agreement_id           uuid references public.partnership_agreements (id) on delete set null,
  opportunity_id         uuid references public.partnership_opportunities (id) on delete set null,
  kind                   public.contribution_kind not null,
  description            text not null check (char_length(btrim(description)) between 5 and 2000),
  expected_on            date,
  -- Financial
  currency               text not null default 'MAD' check (currency in ('MAD', 'EUR', 'USD')),
  amount_pledged         numeric(12, 2) check (amount_pledged > 0),
  amount_received        numeric(12, 2) check (amount_received > 0),
  received_on            date,
  restricted_purpose     text check (char_length(restricted_purpose) <= 1000),
  -- Material
  item                   text check (char_length(item) <= 200),
  quantity               integer check (quantity > 0),
  estimated_value        numeric(12, 2) check (estimated_value > 0),
  recipient              text check (char_length(recipient) <= 200),
  -- Expertise
  expertise_category     text check (char_length(expertise_category) <= 200),
  hours_pledged          numeric(8, 1) check (hours_pledged > 0),
  hours_delivered        numeric(8, 1) check (hours_delivered > 0),
  supported_activities   text check (char_length(supported_activities) <= 2000),
  stage                  public.contribution_stage not null default 'pledged',
  verified_by            uuid references public.profiles (id) on delete set null,
  verified_at            timestamptz,
  created_by             uuid references public.profiles (id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  check (kind <> 'financial' or amount_pledged is not null),
  check (kind <> 'material' or item is not null),
  check (kind <> 'expertise' or expertise_category is not null)
);
create index partnership_contributions_org_idx on public.partnership_contributions (organization_id);
create index partnership_contributions_stage_idx on public.partnership_contributions (stage, updated_at desc);

-- Documents, history and notes also cover agreements and contributions.
alter table public.partnership_documents
  add column agreement_id uuid references public.partnership_agreements (id) on delete cascade,
  add column contribution_id uuid references public.partnership_contributions (id) on delete cascade,
  add column kind text not null default 'proposal' check (kind in ('proposal', 'draft', 'signed', 'supporting', 'evidence')),
  drop constraint partnership_documents_check,
  add constraint partnership_documents_one_target check (num_nonnulls(application_id, organization_id, agreement_id, contribution_id) = 1);
create index partnership_documents_agreement_idx on public.partnership_documents (agreement_id);
create index partnership_documents_contribution_idx on public.partnership_documents (contribution_id);

alter table public.partnership_status_history
  add column agreement_id uuid references public.partnership_agreements (id) on delete cascade,
  add column contribution_id uuid references public.partnership_contributions (id) on delete cascade,
  drop constraint partnership_status_history_one_target,
  add constraint partnership_status_history_one_target
    check (num_nonnulls(application_id, organization_id, need_id, opportunity_id, agreement_id, contribution_id) = 1);
create index partnership_status_history_agreement_idx on public.partnership_status_history (agreement_id, created_at);
create index partnership_status_history_contribution_idx on public.partnership_status_history (contribution_id, created_at);

-- ─── Row level security ────────────────────────────────────────────────────
alter table public.partnership_agreements    enable row level security;
alter table public.partnership_milestones    enable row level security;
alter table public.partnership_contributions enable row level security;
revoke all on public.partnership_agreements, public.partnership_milestones, public.partnership_contributions from anon, authenticated;
revoke all on sequence public.agreement_reference_seq from anon, authenticated;
create policy partnership_agreements_select    on public.partnership_agreements    for select to authenticated
  using (private.is_partnership_staff() or private.is_partnership_signatory());
create policy partnership_milestones_select    on public.partnership_milestones    for select to authenticated
  using (private.is_partnership_staff() or private.is_partnership_signatory());
create policy partnership_contributions_select on public.partnership_contributions for select to authenticated
  using (private.is_partnership_staff() or private.is_partnership_signatory());
grant select on public.partnership_agreements, public.partnership_milestones, public.partnership_contributions to authenticated;

-- Approvers read the documents and history of what they approve.
drop policy partnership_documents_select on public.partnership_documents;
create policy partnership_documents_select on public.partnership_documents for select to authenticated
  using (private.is_partnership_staff() or (private.is_partnership_signatory() and (agreement_id is not null or contribution_id is not null)));
drop policy partnerships_read on storage.objects;
create policy partnerships_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'partnerships'
    and (private.is_partnership_staff()
         or (private.is_partnership_signatory() and (name like 'agreements/%' or name like 'contributions/%')))
  );

-- ─── Helpers ───────────────────────────────────────────────────────────────
create function private.agreement_history(p_agreement uuid, p_contribution uuid, p_from text, p_to text, p_note text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.partnership_status_history (agreement_id, contribution_id, from_status, to_status, note, changed_by)
  values (p_agreement, p_contribution, p_from, p_to, nullif(btrim(coalesce(p_note, '')), ''), auth.uid());
$$;

-- ─── Agreements ────────────────────────────────────────────────────────────
create function public.save_partnership_agreement(p_id uuid, p_org uuid, p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id  uuid := p_id;
  v_ref text;
  v_st  text;
begin
  perform private.require(private.is_partnership_staff(), 'forbidden');
  -- Partnership agreements only for organisations followed as partners.
  perform private.require(exists (select 1 from public.partner_organizations where id = p_org and status is not null), 'not_found');
  perform private.require(
    nullif(p ->> 'opportunity_id', '') is null
    or exists (select 1 from public.partnership_opportunities where id = (p ->> 'opportunity_id')::uuid),
    'invalid_input');

  if v_id is null then
    v_ref := 'CONV-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.agreement_reference_seq')::text, 4, '0');
    insert into public.partnership_agreements (
      reference, organization_id, opportunity_id, intervention_field, title, objectives, responsibilities,
      contributions_summary, start_on, end_on, renewal_terms, renewal_notice_days, created_by)
    values (
      v_ref, p_org, nullif(p ->> 'opportunity_id', '')::uuid, p ->> 'intervention_field', btrim(p ->> 'title'),
      btrim(p ->> 'objectives'), nullif(btrim(coalesce(p ->> 'responsibilities', '')), ''),
      nullif(btrim(coalesce(p ->> 'contributions_summary', '')), ''), nullif(p ->> 'start_on', '')::date,
      nullif(p ->> 'end_on', '')::date, nullif(btrim(coalesce(p ->> 'renewal_terms', '')), ''),
      coalesce(nullif(p ->> 'renewal_notice_days', '')::smallint, 60), auth.uid())
    returning id into v_id;
    perform private.agreement_history(v_id, null, null, 'draft', null);
    perform private.log_audit('agreement_created', 'partnership_agreements', v_id, null, jsonb_build_object('reference', v_ref));
  else
    select status::text into v_st from public.partnership_agreements where id = v_id and organization_id = p_org for update;
    perform private.require(v_st is not null, 'not_found');
    -- Approved content is frozen; dates and renewal terms stay editable once signed.
    if v_st = 'draft' then
      update public.partnership_agreements
         set opportunity_id = nullif(p ->> 'opportunity_id', '')::uuid, intervention_field = p ->> 'intervention_field',
             title = btrim(p ->> 'title'), objectives = btrim(p ->> 'objectives'),
             responsibilities = nullif(btrim(coalesce(p ->> 'responsibilities', '')), ''),
             contributions_summary = nullif(btrim(coalesce(p ->> 'contributions_summary', '')), ''),
             start_on = nullif(p ->> 'start_on', '')::date, end_on = nullif(p ->> 'end_on', '')::date,
             renewal_terms = nullif(btrim(coalesce(p ->> 'renewal_terms', '')), ''),
             renewal_notice_days = coalesce(nullif(p ->> 'renewal_notice_days', '')::smallint, 60), updated_at = now()
       where id = v_id;
    else
      perform private.require(false, 'agreement_locked');
    end if;
  end if;
  return v_id;
end;
$$;

-- draft ⇄ internal_review, approved → draft (staff) · internal_review → approved
-- (approver) · approved → signed (approver, with signed PDF and date)
-- · signed → active → completed → archived (staff) · draft → archived (staff)
create function public.set_agreement_status(p_agreement uuid, p_status text, p jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a      public.partnership_agreements;
  v_note text := nullif(btrim(coalesce(p ->> 'note', '')), '');
  v_date date := nullif(p ->> 'signed_on', '')::date;
begin
  perform private.require(private.is_partnership_staff() or private.is_partnership_signatory(), 'forbidden');
  select * into a from public.partnership_agreements where id = p_agreement for update;
  perform private.require(a.id is not null, 'not_found');

  if (a.status::text, p_status) in (('draft', 'internal_review'), ('internal_review', 'draft'), ('approved', 'draft'),
                                    ('signed', 'active'), ('active', 'completed'), ('completed', 'archived'), ('draft', 'archived')) then
    perform private.require(private.is_partnership_staff(), 'forbidden');
    if p_status = 'active' then
      perform private.require(a.start_on is not null and a.end_on is not null, 'dates_required');
    end if;
  elsif (a.status::text, p_status) = ('internal_review', 'approved') then
    perform private.require(private.is_partnership_signatory(), 'forbidden');
  elsif (a.status::text, p_status) = ('approved', 'signed') then
    -- The signature itself happens outside the platform: an approver records
    -- it, with the date and the signed document.
    perform private.require(private.is_partnership_signatory(), 'forbidden');
    perform private.require(v_date is not null and v_date <= current_date, 'signed_date_required');
    perform private.require(
      exists (select 1 from public.partnership_documents d where d.agreement_id = a.id and d.kind = 'signed'), 'signed_document_required');
  else
    perform private.require(false, 'invalid_transition');
  end if;

  update public.partnership_agreements
     set status = p_status::public.agreement_status,
         approved_by = case when p_status = 'approved' then auth.uid() when p_status = 'draft' then null else approved_by end,
         approved_at = case when p_status = 'approved' then now() when p_status = 'draft' then null else approved_at end,
         signed_on = case when p_status = 'signed' then v_date else signed_on end,
         signed_recorded_by = case when p_status = 'signed' then auth.uid() else signed_recorded_by end,
         updated_at = now()
   where id = a.id;
  perform private.agreement_history(a.id, null, a.status::text, p_status, v_note);
  perform private.log_audit('agreement_status', 'partnership_agreements', a.id, null, jsonb_build_object('from', a.status::text, 'to', p_status));
end;
$$;

-- Documents of agreements and contributions, uploaded by the team (PDF
-- verified and moved by the server first).
create function public.add_partnership_document(p_agreement uuid, p_contribution uuid, p_kind text, p_path text, p_name text, p_size integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_st text;
begin
  perform private.require(private.is_partnership_staff() or private.is_partnership_signatory(), 'forbidden');
  perform private.require(num_nonnulls(p_agreement, p_contribution) = 1, 'invalid_input');
  if p_agreement is not null then
    perform private.require(p_kind in ('draft', 'signed', 'supporting'), 'invalid_input');
    perform private.require(p_path like 'agreements/' || p_agreement::text || '/%', 'invalid_input');
    select status::text into v_st from public.partnership_agreements where id = p_agreement;
    perform private.require(v_st is not null and v_st <> 'archived', 'not_found');
    -- A signed copy is added by an approver, once the agreement is approved.
    if p_kind = 'signed' then
      perform private.require(private.is_partnership_signatory(), 'forbidden');
      perform private.require(v_st in ('approved', 'signed', 'active'), 'invalid_transition');
    end if;
  else
    perform private.require(p_kind in ('evidence', 'supporting'), 'invalid_input');
    perform private.require(p_path like 'contributions/' || p_contribution::text || '/%', 'invalid_input');
    perform private.require(exists (select 1 from public.partnership_contributions where id = p_contribution and stage not in ('verified', 'cancelled')), 'contribution_locked');
  end if;
  insert into public.partnership_documents (agreement_id, contribution_id, kind, storage_path, file_name, mime_type, file_size, uploaded_by)
  values (p_agreement, p_contribution, p_kind, p_path, left(p_name, 200), 'application/pdf', p_size, auth.uid())
  returning id into v_id;
  perform private.log_audit('partnership_document_added', 'partnership_documents', v_id, null, jsonb_build_object('kind', p_kind));
  return v_id;
end;
$$;

-- Removes a document that is not a signed copy or verified evidence; returns
-- its storage path so the server deletes the file.
create function public.delete_partnership_document(p_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.partnership_documents;
begin
  perform private.require(private.is_partnership_staff(), 'forbidden');
  select * into d from public.partnership_documents where id = p_id;
  perform private.require(d.id is not null and (d.agreement_id is not null or d.contribution_id is not null), 'not_found');
  perform private.require(d.kind <> 'signed', 'document_locked');
  perform private.require(
    d.contribution_id is null or exists (select 1 from public.partnership_contributions c where c.id = d.contribution_id and c.stage not in ('verified', 'cancelled')),
    'document_locked');
  delete from public.partnership_documents where id = p_id;
  perform private.log_audit('partnership_document_deleted', 'partnership_documents', p_id, null, jsonb_build_object('kind', d.kind));
  return d.storage_path;
end;
$$;

-- ─── Milestones ────────────────────────────────────────────────────────────
create function public.save_partnership_milestone(p_id uuid, p_agreement uuid, p_title text, p_due_on date, p_note text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := p_id;
begin
  perform private.require(private.is_partnership_staff(), 'forbidden');
  perform private.require(char_length(btrim(coalesce(p_title, ''))) between 2 and 200 and p_due_on is not null, 'invalid_input');
  perform private.require(
    exists (select 1 from public.partnership_agreements where id = p_agreement and status not in ('completed', 'archived')), 'agreement_locked');
  if v_id is null then
    insert into public.partnership_milestones (agreement_id, title, due_on, note, created_by)
    values (p_agreement, btrim(p_title), p_due_on, nullif(btrim(coalesce(p_note, '')), ''), auth.uid())
    returning id into v_id;
  else
    update public.partnership_milestones set title = btrim(p_title), due_on = p_due_on, note = nullif(btrim(coalesce(p_note, '')), '')
     where id = v_id and agreement_id = p_agreement;
    perform private.require(found, 'not_found');
  end if;
  return v_id;
end;
$$;

create function public.set_partnership_milestone_done(p_id uuid, p_done boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require(private.is_partnership_staff(), 'forbidden');
  update public.partnership_milestones set done_at = case when p_done then now() end where id = p_id;
  perform private.require(found, 'not_found');
end;
$$;

-- ─── Contributions ─────────────────────────────────────────────────────────
create function public.save_partnership_contribution(p_id uuid, p_org uuid, p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id    uuid := p_id;
  v_agr   uuid := nullif(p ->> 'agreement_id', '')::uuid;
  v_stage text;
begin
  perform private.require(private.is_partnership_staff(), 'forbidden');
  perform private.require(exists (select 1 from public.partner_organizations where id = p_org and status is not null), 'not_found');
  perform private.require(v_agr is null or exists (select 1 from public.partnership_agreements where id = v_agr and organization_id = p_org), 'invalid_input');
  perform private.require(
    nullif(p ->> 'opportunity_id', '') is null or exists (select 1 from public.partnership_opportunities where id = (p ->> 'opportunity_id')::uuid),
    'invalid_input');

  if v_id is null then
    insert into public.partnership_contributions (
      organization_id, agreement_id, opportunity_id, kind, description, expected_on, currency, amount_pledged,
      restricted_purpose, item, quantity, estimated_value, recipient, expertise_category, hours_pledged, supported_activities, created_by)
    values (
      p_org, v_agr, nullif(p ->> 'opportunity_id', '')::uuid, (p ->> 'kind')::public.contribution_kind, btrim(p ->> 'description'),
      nullif(p ->> 'expected_on', '')::date, coalesce(nullif(p ->> 'currency', ''), 'MAD'), private.money(p ->> 'amount_pledged'),
      nullif(btrim(coalesce(p ->> 'restricted_purpose', '')), ''), nullif(btrim(coalesce(p ->> 'item', '')), ''),
      nullif(p ->> 'quantity', '')::integer, private.money(p ->> 'estimated_value'), nullif(btrim(coalesce(p ->> 'recipient', '')), ''),
      nullif(btrim(coalesce(p ->> 'expertise_category', '')), ''), private.money(p ->> 'hours_pledged'),
      nullif(btrim(coalesce(p ->> 'supported_activities', '')), ''), auth.uid())
    returning id into v_id;
    perform private.agreement_history(null, v_id, null, 'pledged', null);
    perform private.log_audit('contribution_recorded', 'partnership_contributions', v_id, null, jsonb_build_object('kind', p ->> 'kind'));
  else
    select stage::text into v_stage from public.partnership_contributions where id = v_id and organization_id = p_org for update;
    perform private.require(v_stage is not null, 'not_found');
    perform private.require(v_stage in ('pledged', 'committed'), 'contribution_locked');
    update public.partnership_contributions
       set agreement_id = v_agr, opportunity_id = nullif(p ->> 'opportunity_id', '')::uuid, description = btrim(p ->> 'description'),
           expected_on = nullif(p ->> 'expected_on', '')::date, currency = coalesce(nullif(p ->> 'currency', ''), 'MAD'),
           amount_pledged = private.money(p ->> 'amount_pledged'), restricted_purpose = nullif(btrim(coalesce(p ->> 'restricted_purpose', '')), ''),
           item = nullif(btrim(coalesce(p ->> 'item', '')), ''), quantity = nullif(p ->> 'quantity', '')::integer,
           estimated_value = private.money(p ->> 'estimated_value'), recipient = nullif(btrim(coalesce(p ->> 'recipient', '')), ''),
           expertise_category = nullif(btrim(coalesce(p ->> 'expertise_category', '')), ''), hours_pledged = private.money(p ->> 'hours_pledged'),
           supported_activities = nullif(btrim(coalesce(p ->> 'supported_activities', '')), ''), updated_at = now()
     where id = v_id;
  end if;
  return v_id;
end;
$$;

-- pledged → committed → delivered (staff) · delivered → verified (approver,
-- with evidence) · pledged/committed/delivered → cancelled (staff, reason)
create function public.set_contribution_stage(p_contribution uuid, p_stage text, p jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c      public.partnership_contributions;
  v_note text := nullif(btrim(coalesce(p ->> 'note', '')), '');
begin
  perform private.require(private.is_partnership_staff() or private.is_partnership_signatory(), 'forbidden');
  select * into c from public.partnership_contributions where id = p_contribution for update;
  perform private.require(c.id is not null, 'not_found');

  if (c.stage::text, p_stage) = ('pledged', 'committed') then
    perform private.require(private.is_partnership_staff(), 'forbidden');
  elsif (c.stage::text, p_stage) = ('committed', 'delivered') then
    perform private.require(private.is_partnership_staff(), 'forbidden');
    -- What was actually received, never the pledge.
    if c.kind = 'financial' then
      perform private.require(private.money(p ->> 'amount_received') is not null and nullif(p ->> 'received_on', '')::date <= current_date, 'delivery_details_required');
    elsif c.kind = 'expertise' then
      perform private.require(private.money(p ->> 'hours_delivered') is not null, 'delivery_details_required');
    else
      perform private.require(nullif(p ->> 'received_on', '')::date <= current_date, 'delivery_details_required');
    end if;
  elsif (c.stage::text, p_stage) = ('delivered', 'verified') then
    perform private.require(private.is_partnership_signatory(), 'forbidden');
    perform private.require(exists (select 1 from public.partnership_documents d where d.contribution_id = c.id and d.kind = 'evidence'), 'evidence_required');
  elsif c.stage::text in ('pledged', 'committed', 'delivered') and p_stage = 'cancelled' then
    perform private.require(private.is_partnership_staff(), 'forbidden');
    perform private.require(v_note is not null, 'comment_required');
  else
    perform private.require(false, 'invalid_transition');
  end if;

  update public.partnership_contributions
     set stage = p_stage::public.contribution_stage,
         amount_received = case when p_stage = 'delivered' and c.kind = 'financial' then private.money(p ->> 'amount_received') else amount_received end,
         received_on = case when p_stage = 'delivered' then nullif(p ->> 'received_on', '')::date else received_on end,
         hours_delivered = case when p_stage = 'delivered' and c.kind = 'expertise' then private.money(p ->> 'hours_delivered') else hours_delivered end,
         verified_by = case when p_stage = 'verified' then auth.uid() else verified_by end,
         verified_at = case when p_stage = 'verified' then now() else verified_at end,
         updated_at = now()
   where id = c.id;
  perform private.agreement_history(null, c.id, c.stage::text, p_stage, v_note);
  perform private.log_audit('contribution_stage', 'partnership_contributions', c.id, null, jsonb_build_object('from', c.stage::text, 'to', p_stage));
end;
$$;

-- Totals kept apart by stage and currency: a pledge is never money received.
create function public.contribution_totals(p_org uuid default null)
returns table (kind public.contribution_kind, currency text, stage public.contribution_stage, n bigint,
               pledged numeric, received numeric, hours_pledged numeric, hours_delivered numeric, estimated_value numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select c.kind, c.currency, c.stage, count(*), sum(c.amount_pledged), sum(c.amount_received),
         sum(c.hours_pledged), sum(c.hours_delivered), sum(c.estimated_value)
    from public.partnership_contributions c
   where (private.is_partnership_staff() or private.is_partnership_signatory())
     and (p_org is null or c.organization_id = p_org)
   group by c.kind, c.currency, c.stage
   order by c.kind, c.currency, c.stage;
$$;

-- ─── Reminders (in-app; one list, so nothing is notified twice) ────────────
create function public.partnership_watchlist()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when not (private.is_partnership_staff() or private.is_partnership_signatory()) then null else jsonb_build_object(
    'renewals', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'reference', a.reference, 'title', a.title, 'organization', o.name, 'end_on', a.end_on) order by a.end_on)
        from public.partnership_agreements a join public.partner_organizations o on o.id = a.organization_id
       where a.status in ('signed', 'active') and a.end_on is not null and a.end_on - a.renewal_notice_days <= current_date), '[]'::jsonb),
    'milestones', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'agreement_id', a.id, 'reference', a.reference, 'title', m.title, 'due_on', m.due_on) order by m.due_on)
        from public.partnership_milestones m join public.partnership_agreements a on a.id = m.agreement_id
       where m.done_at is null and m.due_on <= current_date + 14 and a.status not in ('completed', 'archived')), '[]'::jsonb),
    'contributions', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'organization', o.name, 'description', c.description, 'stage', c.stage, 'expected_on', c.expected_on) order by c.expected_on)
        from public.partnership_contributions c join public.partner_organizations o on o.id = c.organization_id
       where c.stage in ('pledged', 'committed') and c.expected_on is not null and c.expected_on < current_date), '[]'::jsonb),
    'approvals', (select count(*) from public.partnership_agreements where status = 'internal_review')
               + (select count(*) from public.partnership_contributions where stage = 'delivered')
  ) end;
$$;

-- ─── Grants ────────────────────────────────────────────────────────────────
revoke execute on function private.agreement_history(uuid, uuid, text, text, text) from public, anon;
revoke execute on function
  public.save_partnership_agreement(uuid, uuid, jsonb), public.set_agreement_status(uuid, text, jsonb),
  public.add_partnership_document(uuid, uuid, text, text, text, integer), public.delete_partnership_document(uuid),
  public.save_partnership_milestone(uuid, uuid, text, date, text), public.set_partnership_milestone_done(uuid, boolean),
  public.save_partnership_contribution(uuid, uuid, jsonb), public.set_contribution_stage(uuid, text, jsonb),
  public.contribution_totals(uuid), public.partnership_watchlist()
from public, anon;
grant execute on function
  public.save_partnership_agreement(uuid, uuid, jsonb), public.set_agreement_status(uuid, text, jsonb),
  public.add_partnership_document(uuid, uuid, text, text, text, integer), public.delete_partnership_document(uuid),
  public.save_partnership_milestone(uuid, uuid, text, date, text), public.set_partnership_milestone_done(uuid, boolean),
  public.save_partnership_contribution(uuid, uuid, jsonb), public.set_contribution_stage(uuid, text, jsonb),
  public.contribution_totals(uuid), public.partnership_watchlist()
to authenticated;
