-- ════════════════════════════════════════════════════════════════════════════
-- SANADY Enterprise — support requests (brief V3: « Support requests »,
-- « Support levels », « Support workload », « Technical incidents »)
--
-- A company administrator opens a request for their company space and
-- follows the conversation. The SANADY Enterprise team (enterprise and
-- production managers, administrators) answers, assigns, writes internal
-- notes the company never sees, and moves the request along:
--   open → in_progress ⇄ waiting_client → resolved → closed
-- A company reply on a request waiting for it, or on a resolved request,
-- puts it back « in progress ». Employees do not open requests: their
-- administrator does. Workload figures are real counts, never estimates.
-- ════════════════════════════════════════════════════════════════════════════

create type public.support_status as enum ('open', 'in_progress', 'waiting_client', 'resolved', 'closed');

create sequence public.support_reference_seq;

create table public.enterprise_support_requests (
  id                 uuid primary key default gen_random_uuid(),
  reference          text not null unique,
  institution_id     uuid not null references public.institutions (id) on delete restrict,
  tenant_id          uuid not null references public.enterprise_tenants (id) on delete restrict,
  category           text not null check (category in ('access', 'technical', 'incident', 'content', 'training_request', 'billing', 'other')),
  priority           text not null default 'normal' check (priority in ('normal', 'urgent')),
  subject            text not null check (char_length(btrim(subject)) between 5 and 200),
  status             public.support_status not null default 'open',
  opened_by          uuid references public.profiles (id) on delete set null,
  assigned_to        uuid references public.profiles (id) on delete set null,
  first_response_at  timestamptz,
  resolved_at        timestamptz,
  closed_at          timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index enterprise_support_requests_inst_idx on public.enterprise_support_requests (institution_id, created_at desc);
create index enterprise_support_requests_status_idx on public.enterprise_support_requests (status, priority);

create table public.enterprise_support_messages (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.enterprise_support_requests (id) on delete cascade,
  author_id   uuid references public.profiles (id) on delete set null,
  from_team   boolean not null,
  internal    boolean not null default false check (not internal or from_team),
  body        text not null check (char_length(btrim(body)) between 2 and 6000),
  created_at  timestamptz not null default now()
);
create index enterprise_support_messages_req_idx on public.enterprise_support_messages (request_id, created_at);

-- ─── Access ────────────────────────────────────────────────────────────────
create function private.is_support_client(p_institution uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_institution_admin(p_institution)
     and exists (select 1 from public.institutions where id = p_institution and kind = 'enterprise');
$$;

alter table public.enterprise_support_requests enable row level security;
alter table public.enterprise_support_messages enable row level security;
revoke all on public.enterprise_support_requests, public.enterprise_support_messages from anon, authenticated;
revoke all on sequence public.support_reference_seq from anon, authenticated;
create policy enterprise_support_requests_select on public.enterprise_support_requests for select to authenticated
  using (private.is_enterprise_staff() or private.is_support_client(institution_id));
create policy enterprise_support_messages_select on public.enterprise_support_messages for select to authenticated
  using (private.is_enterprise_staff()
         or (not internal and exists (select 1 from public.enterprise_support_requests r
                                       where r.id = request_id and private.is_support_client(r.institution_id))));
grant select on public.enterprise_support_requests, public.enterprise_support_messages to authenticated;

-- ─── Company side ──────────────────────────────────────────────────────────
create function public.open_support_request(p_institution uuid, p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_id     uuid;
begin
  perform private.require(private.is_support_client(p_institution), 'forbidden');
  select id into v_tenant from public.enterprise_tenants
   where institution_id = p_institution and status in ('active', 'suspended', 'offboarding');
  perform private.require(v_tenant is not null, 'support_unavailable');
  perform private.require(char_length(btrim(coalesce(p ->> 'body', ''))) between 10 and 6000, 'invalid_input');
  -- A safeguard against mistakes and abuse: twenty requests a day per person.
  perform private.require((select count(*) from public.enterprise_support_requests
                            where opened_by = auth.uid() and created_at > now() - interval '1 day') < 20, 'rate_limited');
  insert into public.enterprise_support_requests (reference, institution_id, tenant_id, category, priority, subject, opened_by)
  values ('SUP-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.support_reference_seq')::text, 4, '0'),
          p_institution, v_tenant, p ->> 'category', coalesce(nullif(p ->> 'priority', ''), 'normal'), btrim(p ->> 'subject'), auth.uid())
  returning id into v_id;
  insert into public.enterprise_support_messages (request_id, author_id, from_team, body) values (v_id, auth.uid(), false, btrim(p ->> 'body'));
  perform private.log_audit('support_opened', 'enterprise_support_requests', v_id, p_institution, jsonb_build_object('category', p ->> 'category', 'priority', p ->> 'priority'));
  return v_id;
end;
$$;

-- ─── Both sides: messages ──────────────────────────────────────────────────
create function public.post_support_message(p_request uuid, p_body text, p_internal boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r      public.enterprise_support_requests;
  v_team boolean := private.is_enterprise_staff();
begin
  select * into r from public.enterprise_support_requests where id = p_request for update;
  perform private.require(r.id is not null, 'not_found');
  perform private.require(v_team or private.is_support_client(r.institution_id), 'forbidden');
  perform private.require(not coalesce(p_internal, false) or v_team, 'forbidden');
  perform private.require(r.status <> 'closed', 'support_closed');
  perform private.require(char_length(btrim(coalesce(p_body, ''))) between 2 and 6000, 'invalid_input');
  insert into public.enterprise_support_messages (request_id, author_id, from_team, internal, body)
  values (p_request, auth.uid(), v_team, coalesce(p_internal, false), btrim(p_body));
  if v_team and not coalesce(p_internal, false) then
    update public.enterprise_support_requests
       set first_response_at = coalesce(first_response_at, now()),
           status = case when status = 'open' then 'in_progress'::public.support_status else status end,
           updated_at = now()
     where id = p_request;
  elsif not v_team then
    -- The company answers or comes back: the request needs the team again.
    update public.enterprise_support_requests
       set status = case when status in ('waiting_client', 'resolved') then 'in_progress'::public.support_status else status end,
           resolved_at = case when status = 'resolved' then null else resolved_at end,
           updated_at = now()
     where id = p_request;
  else
    update public.enterprise_support_requests set updated_at = now() where id = p_request;
  end if;
end;
$$;

-- Team: in_progress, waiting_client, resolved, closed (from resolved).
-- Company: closed (any time), or reopen a resolved request.
create function public.set_support_status(p_request uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r      public.enterprise_support_requests;
  v_team boolean := private.is_enterprise_staff();
begin
  select * into r from public.enterprise_support_requests where id = p_request for update;
  perform private.require(r.id is not null, 'not_found');
  perform private.require(v_team or private.is_support_client(r.institution_id), 'forbidden');
  perform private.require(r.status <> 'closed', 'support_closed');
  if v_team then
    perform private.require(p_status in ('in_progress', 'waiting_client', 'resolved', 'closed') and p_status <> r.status::text, 'invalid_transition');
    perform private.require(p_status <> 'closed' or r.status = 'resolved', 'invalid_transition');
  else
    perform private.require(p_status = 'closed' or (p_status = 'in_progress' and r.status = 'resolved'), 'invalid_transition');
  end if;
  update public.enterprise_support_requests
     set status = p_status::public.support_status,
         resolved_at = case when p_status = 'resolved' then now() when p_status = 'in_progress' then null else resolved_at end,
         closed_at = case when p_status = 'closed' then now() end,
         updated_at = now()
   where id = p_request;
  perform private.log_audit('support_status', 'enterprise_support_requests', p_request, r.institution_id, jsonb_build_object('from', r.status, 'to', p_status));
end;
$$;

-- ─── Team only ─────────────────────────────────────────────────────────────
create function public.assign_support_request(p_request uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require(private.is_enterprise_staff(), 'forbidden');
  perform private.require(p_user is null or private.is_enterprise_staff(p_user), 'invalid_input');
  update public.enterprise_support_requests set assigned_to = p_user, updated_at = now() where id = p_request;
  perform private.require(found, 'not_found');
end;
$$;

create function public.support_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require(private.is_enterprise_staff(), 'forbidden');
  return jsonb_build_object(
    'open', (select count(*) from public.enterprise_support_requests where status in ('open', 'in_progress')),
    'waiting_client', (select count(*) from public.enterprise_support_requests where status = 'waiting_client'),
    'urgent_unanswered', (select count(*) from public.enterprise_support_requests where priority = 'urgent' and first_response_at is null and status <> 'closed'),
    'last_30_days', (select count(*) from public.enterprise_support_requests where created_at > now() - interval '30 days'),
    'incidents_90_days', (select count(*) from public.enterprise_support_requests where category = 'incident' and created_at > now() - interval '90 days'),
    'resolved_90_days', (select count(*) from public.enterprise_support_requests where resolved_at > now() - interval '90 days'),
    -- Median time to the first answer, in hours, over the last 90 days (real figures only).
    'median_first_response_hours', (
      select round((percentile_cont(0.5) within group (order by extract(epoch from first_response_at - created_at)) / 3600)::numeric, 1)
        from public.enterprise_support_requests where first_response_at is not null and created_at > now() - interval '90 days'),
    'by_tenant', coalesce((
      select jsonb_agg(jsonb_build_object('tenant_id', t.id, 'tenant', t.display_name, 'open', x.open, 'total', x.total) order by x.open desc, t.display_name)
        from (select tenant_id, count(*) filter (where status not in ('resolved', 'closed')) open, count(*) total
                from public.enterprise_support_requests where created_at > now() - interval '90 days' group by tenant_id) x
        join public.enterprise_tenants t on t.id = x.tenant_id), '[]'::jsonb));
end;
$$;

-- « À surveiller » on the Enterprise inbox now includes support.
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
      (select count(*) from public.enterprise_support_requests where priority = 'urgent' and first_response_at is null and status <> 'closed') else 0 end
  ) end;
$$;

revoke execute on function private.is_support_client(uuid) from public, anon;
grant execute on function private.is_support_client(uuid) to authenticated;
revoke execute on function
  public.open_support_request(uuid, jsonb), public.post_support_message(uuid, text, boolean), public.set_support_status(uuid, text),
  public.assign_support_request(uuid, uuid), public.support_overview()
from public, anon;
grant execute on function
  public.open_support_request(uuid, jsonb), public.post_support_message(uuid, text, boolean), public.set_support_status(uuid, text),
  public.assign_support_request(uuid, uuid), public.support_overview()
to authenticated;
