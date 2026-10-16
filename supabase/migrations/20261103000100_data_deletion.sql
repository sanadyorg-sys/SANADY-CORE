-- ════════════════════════════════════════════════════════════════════════════
-- SANADY Enterprise — deletion of a company space's data, and automatic
-- monthly usage readings
--
-- Nothing is ever deleted automatically or silently. After the end of the
-- contract (offboarding → export authorised → deletion date → space closed):
--   1. the enterprise manager PROPOSES the deletion;
--   2. the organisation is WARNED in writing (recorded: date, recipient);
--   3. its DATA IS HANDED OVER first (recorded: date, how) — or it declined;
--   4. anyone may put the deletion ON HOLD (renewal, dispute, legal request);
--   5. a SECOND PERSON — an approver or SANADY administrator, never the one
--      who proposed it — CONFIRMS it once the date has come, with no unpaid
--      invoice and no running contract;
--   6. it still can be CANCELLED for 30 days; only then is it carried out;
--   7. a DELETION CERTIFICATE remains (what, when, who) — no personal data.
-- Kept: the organisation, contracts, invoices and payments (accounting),
-- monthly usage figures (totals, no names) and the history.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.enterprise_tenants add column data_deleted_at timestamptz;
-- A space whose data was deleted no longer has an institution.
do $$
declare r record;
begin
  for r in select conname from pg_constraint
            where conrelid = 'public.enterprise_tenants'::regclass and contype = 'c'
              and pg_get_constraintdef(oid) like '%institution_id IS NULL%' loop
    execute format('alter table public.enterprise_tenants drop constraint %I', r.conname);
  end loop;
end $$;
alter table public.enterprise_tenants add constraint enterprise_tenants_institution_by_status
  check (((institution_id is null) = (status in ('requested', 'authorized', 'cancelled'))) or (data_deleted_at is not null and institution_id is null));

create table public.data_deletions (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.enterprise_tenants (id) on delete restrict,
  status            text not null default 'proposed' check (status in ('proposed', 'confirmed', 'cancelled', 'executed')),
  reason            text not null check (char_length(btrim(reason)) between 5 and 1000),
  proposed_by       uuid references public.profiles (id) on delete set null,
  proposed_at       timestamptz not null default now(),
  notice_sent_on    date,
  notice_recipient  text check (char_length(notice_recipient) <= 300),
  data_delivered_on date,
  delivery_method   text check (char_length(delivery_method) <= 500),
  hold_reason       text check (char_length(hold_reason) <= 1000),
  held_by           uuid references public.profiles (id) on delete set null,
  held_at           timestamptz,
  confirmed_by      uuid references public.profiles (id) on delete set null,
  confirmed_at      timestamptz,
  confirm_reason    text check (char_length(confirm_reason) <= 1000),
  execute_after     timestamptz,
  cancelled_by      uuid references public.profiles (id) on delete set null,
  cancelled_at      timestamptz,
  cancel_reason     text check (char_length(cancel_reason) <= 1000),
  executed_at       timestamptz,
  certificate       jsonb,
  updated_at        timestamptz not null default now()
);
-- One deletion in progress per company space.
create unique index data_deletions_open_idx on public.data_deletions (tenant_id) where status in ('proposed', 'confirmed');

alter table public.data_deletions enable row level security;
revoke all on public.data_deletions from anon, authenticated;
create policy data_deletions_select on public.data_deletions for select to authenticated
  using (private.is_enterprise_staff() or private.is_partnership_signatory());
grant select on public.data_deletions to authenticated;
grant select, update on public.data_deletions to service_role;

create function private.deletion_log(p_tenant uuid, p_to text, p_note text)
returns void
language sql
security definer
set search_path = ''
as $$
  select private.tenant_log(p_tenant, null, p_to, p_note);
$$;

-- What still prevents the deletion (empty when it may be confirmed).
create function private.deletion_blockers(d public.data_deletions)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select array_remove(array[
    case when d.notice_sent_on is null then 'notice' end,
    case when d.data_delivered_on is null then 'delivery' end,
    case when d.hold_reason is not null then 'hold' end,
    case when coalesce((select deletion_due_on from public.enterprise_tenants where id = d.tenant_id), 'infinity'::date) > current_date then 'date' end,
    case when exists (select 1 from public.enterprise_tenants where id = d.tenant_id and status <> 'closed') then 'not_closed' end,
    case when exists (select 1 from public.enterprise_contracts c where c.tenant_id = d.tenant_id and c.status in ('signed', 'active', 'renewal')) then 'contract' end,
    case when exists (
      select 1 from public.enterprise_invoices i
        join public.enterprise_contracts c on c.id = i.contract_id
        join public.enterprise_tenants t on t.organization_id = c.organization_id
       where t.id = d.tenant_id and i.cancelled_at is null
         and i.amount > coalesce((select sum(pm.amount) from public.enterprise_payments pm where pm.invoice_id = i.id), 0)) then 'unpaid' end
  ], null);
$$;

create function public.propose_data_deletion(p_tenant uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  t    public.enterprise_tenants;
  v_id uuid;
begin
  perform private.require(private.is_enterprise_manager(), 'forbidden');
  select * into t from public.enterprise_tenants where id = p_tenant for update;
  perform private.require(t.id is not null, 'not_found');
  perform private.require(t.status = 'closed' and t.data_deleted_at is null, 'invalid_transition');
  perform private.require(t.export_authorized_at is not null and t.deletion_due_on is not null, 'deletion_prerequisites');
  insert into public.data_deletions (tenant_id, reason, proposed_by) values (p_tenant, btrim(p_reason), auth.uid()) returning id into v_id;
  perform private.deletion_log(p_tenant, 'deletion_proposed', p_reason);
  perform private.log_audit('data_deletion_proposed', 'enterprise_tenants', p_tenant, t.institution_id, '{}'::jsonb);
  return v_id;
end;
$$;

-- Steps recorded by the team: notice sent, data handed over (or declined).
create function public.record_deletion_step(p_deletion uuid, p_step text, p jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.data_deletions;
begin
  perform private.require(private.is_enterprise_manager(), 'forbidden');
  select * into d from public.data_deletions where id = p_deletion for update;
  perform private.require(d.id is not null, 'not_found');
  perform private.require(d.status = 'proposed', 'invalid_transition');
  if p_step = 'notice' then
    perform private.require(char_length(btrim(coalesce(p ->> 'recipient', ''))) >= 3 and (p ->> 'date')::date <= current_date, 'invalid_input');
    update public.data_deletions set notice_sent_on = (p ->> 'date')::date, notice_recipient = btrim(p ->> 'recipient'), updated_at = now() where id = d.id;
    perform private.deletion_log(d.tenant_id, 'deletion_notice_sent', btrim(p ->> 'recipient'));
  elsif p_step = 'delivery' then
    perform private.require(char_length(btrim(coalesce(p ->> 'method', ''))) >= 5 and (p ->> 'date')::date <= current_date, 'invalid_input');
    update public.data_deletions set data_delivered_on = (p ->> 'date')::date, delivery_method = btrim(p ->> 'method'), updated_at = now() where id = d.id;
    perform private.deletion_log(d.tenant_id, 'deletion_data_delivered', btrim(p ->> 'method'));
  else
    perform private.require(false, 'invalid_input');
  end if;
end;
$$;

-- Hold (with a reason) or release — the team or an approver, at any time before execution.
create function public.set_deletion_hold(p_deletion uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.data_deletions;
begin
  perform private.require(private.is_enterprise_manager() or private.is_partnership_signatory() or private.is_sanady_admin(), 'forbidden');
  select * into d from public.data_deletions where id = p_deletion for update;
  perform private.require(d.id is not null, 'not_found');
  perform private.require(d.status in ('proposed', 'confirmed'), 'invalid_transition');
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    update public.data_deletions set hold_reason = null, held_by = null, held_at = null, updated_at = now() where id = d.id;
    perform private.deletion_log(d.tenant_id, 'deletion_hold_lifted', null);
  else
    perform private.require(char_length(btrim(p_reason)) >= 5, 'comment_required');
    update public.data_deletions set hold_reason = btrim(p_reason), held_by = auth.uid(), held_at = now(), updated_at = now() where id = d.id;
    perform private.deletion_log(d.tenant_id, 'deletion_on_hold', btrim(p_reason));
  end if;
end;
$$;

-- A second person confirms; 30 days remain to cancel before execution.
create function public.confirm_data_deletion(p_deletion uuid, p_reason text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  d        public.data_deletions;
  v_after  timestamptz := now() + interval '30 days';
  v_block  text[];
begin
  perform private.require(private.is_partnership_signatory() or private.is_sanady_admin(), 'forbidden');
  select * into d from public.data_deletions where id = p_deletion for update;
  perform private.require(d.id is not null, 'not_found');
  perform private.require(d.status = 'proposed', 'invalid_transition');
  perform private.require(d.proposed_by is distinct from auth.uid(), 'four_eyes');
  perform private.require(char_length(btrim(coalesce(p_reason, ''))) >= 5, 'comment_required');
  v_block := private.deletion_blockers(d);
  perform private.require(cardinality(v_block) = 0, 'deletion_blocked');
  update public.data_deletions set status = 'confirmed', confirmed_by = auth.uid(), confirmed_at = now(), confirm_reason = btrim(p_reason),
         execute_after = v_after, updated_at = now() where id = d.id;
  perform private.deletion_log(d.tenant_id, 'deletion_confirmed', 'Exécution après le ' || to_char(v_after at time zone 'Africa/Casablanca', 'DD/MM/YYYY'));
  perform private.log_audit('data_deletion_confirmed', 'enterprise_tenants', d.tenant_id, null, jsonb_build_object('execute_after', v_after));
  return v_after;
end;
$$;

create function public.cancel_data_deletion(p_deletion uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.data_deletions;
begin
  perform private.require(private.is_enterprise_manager() or private.is_partnership_signatory() or private.is_sanady_admin(), 'forbidden');
  perform private.require(char_length(btrim(coalesce(p_reason, ''))) >= 5, 'comment_required');
  select * into d from public.data_deletions where id = p_deletion for update;
  perform private.require(d.id is not null, 'not_found');
  perform private.require(d.status in ('proposed', 'confirmed'), 'invalid_transition');
  update public.data_deletions set status = 'cancelled', cancelled_by = auth.uid(), cancelled_at = now(), cancel_reason = btrim(p_reason), updated_at = now() where id = d.id;
  perform private.deletion_log(d.tenant_id, 'deletion_cancelled', btrim(p_reason));
  perform private.log_audit('data_deletion_cancelled', 'enterprise_tenants', d.tenant_id, null, '{}'::jsonb);
end;
$$;

-- ─── Execution (server only, after the 30 days) ────────────────────────────
-- Returns, per deletion carried out, the storage files to remove.
create function public.execute_due_deletions()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d        public.data_deletions;
  t        public.enterprise_tenants;
  v_inst   uuid;
  v_users  uuid[];
  v_others uuid[];
  v_courses uuid[];
  v_files  text[];
  v_out    jsonb := '[]'::jsonb;
  v_cert   jsonb;
  v_n      record;
begin
  for d in select * from public.data_deletions
            where status = 'confirmed' and execute_after <= now() and hold_reason is null
            for update skip locked loop
    -- Re-checked at the last moment: nothing has changed since the confirmation.
    if cardinality(private.deletion_blockers(d)) > 0 then
      continue;
    end if;
    select * into t from public.enterprise_tenants where id = d.tenant_id;
    v_inst := t.institution_id;
    v_courses := array(select id from public.courses where owner_institution_id = v_inst);
    -- Accounts that exist only for this company (no other institution, no SANADY role, no partner access).
    v_users := array(
      select m.user_id from public.institution_memberships m
       where m.institution_id = v_inst
         and not exists (select 1 from public.institution_memberships o where o.user_id = m.user_id and o.institution_id <> v_inst)
         and not exists (select 1 from public.platform_roles r where r.user_id = m.user_id)
         and not exists (select 1 from public.partner_portal_members pm where pm.user_id = m.user_id));
    v_others := array(select user_id from public.institution_memberships where institution_id = v_inst and not (user_id = any (v_users)));
    v_files := array(select name from storage.objects where bucket_id = 'course-media' and split_part(name, '/', 1) = any (array(select c::text from unnest(v_courses) c)));
    select
      cardinality(v_users) as accounts,
      cardinality(v_others) as memberships,
      cardinality(v_courses) as courses,
      cardinality(v_files) + case when t.logo_path is null then 0 else 1 end as files,
      (select count(*) from public.enterprise_support_requests where tenant_id = t.id) as support
      into v_n;

    -- The company's own courses: everyone's records on them, then the courses.
    delete from public.learning_events where course_id = any (v_courses);
    delete from public.quiz_attempts where course_id = any (v_courses);
    delete from public.video_progress where lesson_id in (select id from public.lessons where course_id = any (v_courses));
    delete from public.document_progress where lesson_id in (select id from public.lessons where course_id = any (v_courses));
    delete from public.lesson_progress where course_id = any (v_courses);
    delete from public.certificates where course_id = any (v_courses);
    delete from public.enrollments where course_id = any (v_courses);
    update public.training_projects set course_id = null where course_id = any (v_courses);
    delete from public.courses where id = any (v_courses);
    -- Support, rules, files, the space itself.
    delete from public.enterprise_support_requests where tenant_id = t.id;
    delete from public.enterprise_assessment_policies where tenant_id = t.id;
    perform set_config('sanady.tenant_sync', 'on', true);
    update public.enterprise_tenants set institution_id = null, logo_path = null, data_deleted_at = now(), updated_at = now() where id = t.id;
    if v_inst is not null then
      delete from public.institutions where id = v_inst;
    end if;
    perform set_config('sanady.tenant_sync', '', true);
    -- Accounts that existed only for this company (their own data follows).
    delete from auth.users where id = any (v_users);

    v_cert := jsonb_build_object(
      'organisation', (select name from public.partner_organizations where id = t.organization_id),
      'space', t.display_name, 'executed_at', now(),
      'proposed_at', d.proposed_at, 'proposed_by', (select coalesce(nullif(full_name, ''), email) from public.profiles where id = d.proposed_by),
      'confirmed_at', d.confirmed_at, 'confirmed_by', (select coalesce(nullif(full_name, ''), email) from public.profiles where id = d.confirmed_by),
      'notice_sent_on', d.notice_sent_on, 'data_delivered_on', d.data_delivered_on, 'delivery_method', d.delivery_method,
      'deleted', jsonb_build_object('accounts', v_n.accounts, 'memberships', v_n.memberships, 'courses', v_n.courses,
                                    'files', v_n.files, 'support_requests', v_n.support),
      'kept', 'Organisation, contrats, factures et paiements (comptabilité), relevés d’utilisation (totaux sans nom), historique.');
    update public.data_deletions set status = 'executed', executed_at = now(), certificate = v_cert, updated_at = now() where id = d.id;
    perform private.deletion_log(t.id, 'deletion_executed', null);
    perform private.log_audit('data_deletion_executed', 'enterprise_tenants', t.id, null, v_cert -> 'deleted');
    v_out := v_out || jsonb_build_object('deletion_id', d.id, 'files', to_jsonb(v_files), 'logo', t.logo_path);
  end loop;
  return v_out;
end;
$$;

-- ─── Monthly usage readings, recorded automatically (server only) ─────────
create function public.auto_record_usage()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  t      public.enterprise_tenants;
  c      public.enterprise_contracts;
  u      jsonb;
  v_per  date := (date_trunc('month', current_date) - interval '1 month')::date;
  v_lim  integer;
  v_sto  numeric;
  v_n    integer := 0;
begin
  for t in select * from public.enterprise_tenants
            where institution_id is not null and status in ('active', 'suspended', 'offboarding')
              and coalesce(activated_at, created_at) < date_trunc('month', current_date)
              and not exists (select 1 from public.enterprise_usage_records r where r.tenant_id = enterprise_tenants.id and r.period = v_per) loop
    select * into c from public.enterprise_contracts
     where tenant_id = t.id and status in ('signed', 'active', 'renewal') order by start_on desc nulls last limit 1;
    u := private.measure_tenant_usage(t.id, v_per);
    v_lim := coalesce(c.learner_limit, t.max_learners);
    v_sto := coalesce(c.storage_limit_gb, t.storage_allowance_gb);
    insert into public.enterprise_usage_records (tenant_id, period, active_learners, enrolled_learners, completions, storage_mb,
                                                 learner_limit, storage_limit_gb, overage, recorded_by)
    values (t.id, v_per, (u ->> 'active_learners')::integer, (u ->> 'enrolled_learners')::integer, (u ->> 'completions')::integer,
            (u ->> 'storage_mb')::numeric, v_lim, v_sto,
            (case when c.pricing_model = 'per_active_learner' then (u ->> 'active_learners')::integer else (u ->> 'enrolled_learners')::integer end) > coalesce(v_lim, 2147483647)
              or (u ->> 'storage_mb')::numeric > coalesce(v_sto * 1024, 1e15),
            null)
    on conflict (tenant_id, period) do nothing;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

-- « À surveiller »: deletion dates within 30 days and deletions in progress.
create or replace function public.enterprise_watchlist()
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
    'approvals', (select count(*) from public.enterprise_contracts where status = 'internal_review'),
    'support_waiting', case when private.is_enterprise_staff() then
      (select count(*) from public.enterprise_support_requests where status in ('open', 'in_progress')) else 0 end,
    'support_urgent', case when private.is_enterprise_staff() then
      (select count(*) from public.enterprise_support_requests where priority = 'urgent' and first_response_at is null and status <> 'closed') else 0 end,
    'deletions', coalesce((
      select jsonb_agg(jsonb_build_object('tenant_id', t.id, 'tenant', t.display_name, 'due_on', t.deletion_due_on,
                                          'status', d.status, 'execute_after', d.execute_after, 'on_hold', d.hold_reason is not null) order by t.deletion_due_on)
        from public.enterprise_tenants t
        left join public.data_deletions d on d.tenant_id = t.id and d.status in ('proposed', 'confirmed')
       where t.data_deleted_at is null and t.deletion_due_on is not null
         and (d.id is not null or t.deletion_due_on <= current_date + 30)), '[]'::jsonb)
  ) end;
$$;

revoke execute on function private.deletion_blockers(public.data_deletions), private.deletion_log(uuid, text, text) from public, anon, authenticated;
revoke execute on function
  public.propose_data_deletion(uuid, text), public.record_deletion_step(uuid, text, jsonb), public.set_deletion_hold(uuid, text),
  public.confirm_data_deletion(uuid, text), public.cancel_data_deletion(uuid, text)
from public, anon;
grant execute on function
  public.propose_data_deletion(uuid, text), public.record_deletion_step(uuid, text, jsonb), public.set_deletion_hold(uuid, text),
  public.confirm_data_deletion(uuid, text), public.cancel_data_deletion(uuid, text)
to authenticated;
-- Carried out by the server only (scheduled job), never by a person's session.
revoke execute on function public.execute_due_deletions(), public.auto_record_usage() from public, anon, authenticated;
grant execute on function public.execute_due_deletions(), public.auto_record_usage() to service_role;

-- Blockers, readable by the team (to explain what is missing).
create function public.deletion_blockers(p_deletion uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.is_enterprise_staff() or private.is_partnership_signatory() then private.deletion_blockers(d) end
    from public.data_deletions d where d.id = p_deletion;
$$;
revoke execute on function public.deletion_blockers(uuid) from public, anon;
grant execute on function public.deletion_blockers(uuid) to authenticated;
