-- ════════════════════════════════════════════════════════════════════════════
-- SANADY Enterprise — brief V3 (PLAN/new-feature.md), phases E1 and E2
--   (plan: docs/enterprise/plan.md)
--
-- PROPOSED activity, not an official SANADY programme: pages stay hidden and
-- worded as proposals until the Foundation's governance approvals (plan §1).
-- No billing, no payment, no company workspace in these phases.
--
-- E1  Public requests for corporate training (sur mesure / plateforme /
--     solution complète / partenariat institutionnel), references ENT-YYYY-NNNN,
--     PDFs in the private « enterprise » bucket.
-- E2  Enterprise CRM on the SAME organisation record as the partnerships
--     (one organisation can be partner, client or both), with its own
--     pipeline, notes, tasks and history, and commercial proposals with
--     configurable lines (no fixed prices), approved by an approver.
--
-- Commercial and charitable records never share a table: partnership staff
-- do not see commercial data, enterprise staff do not see donations.
--
-- Roles (platform_role, 2FA): enterprise_manager (pipeline, requests,
-- proposals), production_manager (reads in E1-E2; training studio in E4).
-- Commercial commitments are approved only by an approver (explicit grant,
-- never self-granted); being an administrator does not confer it.
--
-- New enum values are compared as text in this migration.
-- ════════════════════════════════════════════════════════════════════════════

alter type public.platform_role add value if not exists 'enterprise_manager';
alter type public.platform_role add value if not exists 'production_manager';

create type public.enterprise_service as enum ('sur_mesure', 'plateforme', 'complete', 'partenariat');
create type public.enterprise_request_status as enum ('received', 'qualified', 'converted', 'declined', 'withdrawn', 'spam');
-- Enterprise service pipeline (brief V3 §7) + two closed outcomes.
create type public.enterprise_pipeline_status as enum (
  'lead', 'qualified', 'discovery', 'needs_assessment', 'proposal', 'negotiation',
  'institutional_approval', 'contract_signed', 'onboarding', 'active_service', 'renewal',
  'lost', 'withdrawn'
);
create type public.proposal_status as enum ('draft', 'internal_review', 'approved', 'sent', 'accepted', 'declined', 'expired');
-- Configurable line items (brief V3 §3): never hard-coded prices.
create type public.proposal_line_category as enum (
  'needs_analysis', 'instructional_design', 'content_development', 'video_production', 'assessment_design',
  'platform_access', 'employee_enrollment', 'technical_support', 'content_maintenance', 'setup_fee', 'other'
);

-- ─── Role helpers ──────────────────────────────────────────────────────────
create function private.is_enterprise_staff(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_sanady_admin(p_user)
      or (coalesce(private.platform_role(p_user) in ('enterprise_manager', 'production_manager'), false)
          and (p_user is distinct from auth.uid() or private.session_aal() = 'aal2'));
$$;

-- Who can change commercial records (production managers only read in E1-E2).
create function private.is_enterprise_manager(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_sanady_admin(p_user)
      or (coalesce(private.platform_role(p_user) = 'enterprise_manager', false)
          and (p_user is distinct from auth.uid() or private.session_aal() = 'aal2'));
$$;

-- ─── One organisation, two relationships ───────────────────────────────────
-- The partnership pipeline becomes optional: an organisation may be only an
-- enterprise client.
alter table public.partner_organizations
  alter column status drop not null,
  add column enterprise_status public.enterprise_pipeline_status,
  add column enterprise_services public.enterprise_service[] not null default '{}',
  add column enterprise_manager_id uuid references public.profiles (id) on delete set null,
  add column employee_count text check (char_length(employee_count) <= 40),
  add constraint partner_organizations_has_relationship check (status is not null or enterprise_status is not null);
create index partner_organizations_enterprise_idx on public.partner_organizations (enterprise_status, updated_at desc) where enterprise_status is not null;

-- Partnership staff see partnership organisations; enterprise staff see
-- enterprise clients; administrators see both.
drop policy partner_organizations_select on public.partner_organizations;
create policy partner_organizations_select on public.partner_organizations
  for select to authenticated
  using (
    (private.is_partnership_staff() and status is not null)
    or (private.is_enterprise_staff() and enterprise_status is not null)
    or private.is_sanady_admin()
  );

drop policy partner_contacts_select on public.partner_contacts;
create policy partner_contacts_select on public.partner_contacts
  for select to authenticated
  using (exists (select 1 from public.partner_organizations o where o.id = organization_id));

-- Partnership history of an enterprise-only organisation starts from nothing.
create or replace function public.set_partner_status(p_org uuid, p_status text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from   text;
  v_locked boolean;
begin
  perform private.require(private.is_partnership_staff() or private.is_partnership_signatory(), 'forbidden');
  perform private.require(exists (select 1 from public.partner_organizations where id = p_org), 'not_found');
  select status::text into v_from from public.partner_organizations where id = p_org for update;
  perform private.require(p_status is distinct from v_from, 'invalid_transition');
  v_locked := v_from in ('institutional_validation', 'agreement_signed', 'implementation', 'monitoring', 'renewal_or_closure');

  if v_from is null then
    -- Opening a partnership relationship with an existing client.
    perform private.require(private.is_partnership_staff() and p_status = 'prospect', 'invalid_transition');
  elsif p_status in ('prospect', 'first_contact', 'interest_confirmed', 'proposal_received', 'evaluation', 'negotiation', 'withdrawn') then
    perform private.require(private.is_partnership_staff(), 'forbidden');
    perform private.require(not v_locked, 'invalid_transition');
  elsif p_status = 'rejected' then
    if v_from = 'institutional_validation' then
      perform private.require(private.is_partnership_signatory(), 'forbidden');
    else
      perform private.require(private.is_partnership_staff(), 'forbidden');
      perform private.require(not v_locked, 'invalid_transition');
    end if;
  elsif p_status = 'institutional_validation' then
    perform private.require(private.is_partnership_manager(), 'forbidden');
    perform private.require(v_from in ('evaluation', 'negotiation'), 'invalid_transition');
  elsif p_status = 'agreement_signed' then
    perform private.require(private.is_partnership_signatory(), 'forbidden');
    perform private.require(v_from = 'institutional_validation', 'invalid_transition');
  elsif p_status = 'implementation' then
    perform private.require(private.is_partnership_staff(), 'forbidden');
    perform private.require(v_from = 'agreement_signed', 'invalid_transition');
  elsif p_status = 'monitoring' then
    perform private.require(private.is_partnership_staff(), 'forbidden');
    perform private.require(v_from = 'implementation', 'invalid_transition');
  elsif p_status = 'renewal_or_closure' then
    perform private.require(private.is_partnership_staff(), 'forbidden');
    perform private.require(v_from in ('implementation', 'monitoring'), 'invalid_transition');
  else
    perform private.require(false, 'invalid_input');
  end if;

  update public.partner_organizations
     set status = p_status::public.partner_pipeline_status, updated_at = now()
   where id = p_org;
  perform private.partnership_history(null, p_org, v_from, p_status, p_note);
  perform private.log_audit('partner_status', 'partner_organizations', p_org, null,
                            jsonb_build_object('from', v_from, 'to', p_status));
end;
$$;

-- Contacts are shared by both relationships.
create or replace function public.save_partner_contact(p_id uuid, p_org uuid, p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id      uuid := p_id;
  v_primary boolean := coalesce((p ->> 'is_primary')::boolean, false);
begin
  perform private.require(
    exists (
      select 1 from public.partner_organizations o
       where o.id = p_org
         and ((private.is_partnership_staff() and o.status is not null)
              or (private.is_enterprise_manager() and o.enterprise_status is not null))
    ),
    'forbidden');
  if v_primary then
    update public.partner_contacts set is_primary = false where organization_id = p_org and is_primary and id is distinct from v_id;
  end if;
  if v_id is null then
    insert into public.partner_contacts (organization_id, full_name, job_title, email, phone, is_primary)
    values (p_org, btrim(p ->> 'full_name'), nullif(btrim(coalesce(p ->> 'job_title', '')), ''),
            nullif(lower(btrim(coalesce(p ->> 'email', ''))), ''), nullif(btrim(coalesce(p ->> 'phone', '')), ''), v_primary)
    returning id into v_id;
  else
    update public.partner_contacts
       set full_name = btrim(p ->> 'full_name'),
           job_title = nullif(btrim(coalesce(p ->> 'job_title', '')), ''),
           email = nullif(lower(btrim(coalesce(p ->> 'email', ''))), ''),
           phone = nullif(btrim(coalesce(p ->> 'phone', '')), ''),
           is_primary = v_primary
     where id = v_id and organization_id = p_org;
    perform private.require(found, 'not_found');
  end if;
  update public.partner_organizations set updated_at = now() where id = p_org;
  perform private.log_audit('partner_contact_saved', 'partner_organizations', p_org, null, '{}'::jsonb);
  return v_id;
end;
$$;

-- ─── E1: enterprise requests (public form) ─────────────────────────────────
create sequence public.enterprise_reference_seq;
create sequence public.proposal_reference_seq;

create table public.enterprise_requests (
  id                 uuid primary key default gen_random_uuid(),
  reference          text not null unique,
  -- Organisation
  org_name           text not null check (char_length(btrim(org_name)) between 2 and 200),
  org_type           public.partner_org_type not null,
  country            text not null check (char_length(btrim(country)) between 2 and 80),
  city               text check (char_length(city) <= 100),
  website            text check (char_length(website) <= 300),
  sector             text check (char_length(sector) <= 150),
  employee_count     text not null check (employee_count in ('1-49', '50-249', '250-999', '1000+')),
  -- Contact
  contact_name       text not null check (char_length(btrim(contact_name)) between 2 and 150),
  contact_title      text not null check (char_length(btrim(contact_title)) between 2 and 150),
  contact_email      text not null check (char_length(contact_email) <= 254 and contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  contact_phone      text check (char_length(contact_phone) <= 40),
  -- Requested service and training needs
  service            public.enterprise_service not null,
  topic              text not null check (char_length(btrim(topic)) between 3 and 200),
  target_population  text not null check (char_length(btrim(target_population)) between 3 and 500),
  learner_count      integer check (learner_count between 1 and 1000000),
  outcomes           text not null check (char_length(btrim(outcomes)) between 20 and 3000),
  existing_content   text not null check (existing_content in ('none', 'partial', 'complete')),
  language           text not null check (language in ('fr', 'ar', 'en', 'multiple')),
  timeline           text check (char_length(timeline) <= 150),
  reporting          text check (char_length(reporting) <= 1000),
  accessibility      text check (char_length(accessibility) <= 1000),
  extra              text check (char_length(extra) <= 2000),
  consent_at         timestamptz not null,
  -- Handling
  status             public.enterprise_request_status not null default 'received',
  organization_id    uuid references public.partner_organizations (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index enterprise_requests_status_idx on public.enterprise_requests (status, created_at desc);
create index enterprise_requests_email_idx on public.enterprise_requests (lower(contact_email), created_at desc);

create table public.enterprise_documents (
  id               uuid primary key default gen_random_uuid(),
  request_id       uuid not null references public.enterprise_requests (id) on delete cascade,
  storage_path     text not null unique check (char_length(storage_path) <= 400),
  file_name        text not null check (char_length(file_name) between 1 and 200),
  mime_type        text not null check (mime_type = 'application/pdf'),
  file_size        integer not null check (file_size between 1 and 10485760),
  created_at       timestamptz not null default now()
);
create index enterprise_documents_request_idx on public.enterprise_documents (request_id);

-- ─── E2: proposals with configurable lines ─────────────────────────────────
create table public.enterprise_proposals (
  id               uuid primary key default gen_random_uuid(),
  reference        text not null unique,
  organization_id  uuid not null references public.partner_organizations (id) on delete cascade,
  request_id       uuid references public.enterprise_requests (id) on delete set null,
  title            text not null check (char_length(btrim(title)) between 5 and 200),
  service          public.enterprise_service not null,
  summary          text check (char_length(summary) <= 3000),
  currency         text not null default 'MAD' check (currency in ('MAD', 'EUR', 'USD')),
  valid_until      date,
  status           public.proposal_status not null default 'draft',
  approved_by      uuid references public.profiles (id) on delete set null,
  approved_at      timestamptz,
  sent_at          timestamptz,
  decided_at       timestamptz,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index enterprise_proposals_org_idx on public.enterprise_proposals (organization_id, created_at desc);

create table public.enterprise_proposal_lines (
  id           uuid primary key default gen_random_uuid(),
  proposal_id  uuid not null references public.enterprise_proposals (id) on delete cascade,
  category     public.proposal_line_category not null,
  label        text not null check (char_length(btrim(label)) between 2 and 200),
  quantity     numeric(12, 2) not null default 1 check (quantity > 0),
  unit         text check (char_length(unit) <= 40),
  unit_price   numeric(12, 2) not null check (unit_price >= 0),
  position     integer not null default 0,
  created_at   timestamptz not null default now()
);
create index enterprise_proposal_lines_idx on public.enterprise_proposal_lines (proposal_id, position);

-- ─── E2: notes, tasks, history (separate from the partnership ones) ────────
create table public.enterprise_notes (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid references public.partner_organizations (id) on delete cascade,
  request_id       uuid references public.enterprise_requests (id) on delete cascade,
  proposal_id      uuid references public.enterprise_proposals (id) on delete cascade,
  body             text not null check (char_length(btrim(body)) between 1 and 4000),
  author_id        uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  check (num_nonnulls(organization_id, request_id, proposal_id) = 1)
);
create index enterprise_notes_org_idx on public.enterprise_notes (organization_id, created_at desc);
create index enterprise_notes_request_idx on public.enterprise_notes (request_id, created_at desc);
create index enterprise_notes_proposal_idx on public.enterprise_notes (proposal_id, created_at desc);

create table public.enterprise_tasks (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.partner_organizations (id) on delete cascade,
  title            text not null check (char_length(btrim(title)) between 2 and 200),
  due_on           date,
  assigned_to      uuid references public.profiles (id) on delete set null,
  done_at          timestamptz,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now()
);
create index enterprise_tasks_open_idx on public.enterprise_tasks (due_on) where done_at is null;

create table public.enterprise_history (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid references public.partner_organizations (id) on delete cascade,
  request_id       uuid references public.enterprise_requests (id) on delete cascade,
  proposal_id      uuid references public.enterprise_proposals (id) on delete cascade,
  from_status      text,
  to_status        text not null,
  note             text check (char_length(note) <= 1000),
  changed_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  check (num_nonnulls(organization_id, request_id, proposal_id) = 1)
);
create index enterprise_history_org_idx on public.enterprise_history (organization_id, created_at);
create index enterprise_history_request_idx on public.enterprise_history (request_id, created_at);
create index enterprise_history_proposal_idx on public.enterprise_history (proposal_id, created_at);

-- ─── Row level security: enterprise staff only ─────────────────────────────
alter table public.enterprise_requests       enable row level security;
alter table public.enterprise_documents      enable row level security;
alter table public.enterprise_proposals      enable row level security;
alter table public.enterprise_proposal_lines enable row level security;
alter table public.enterprise_notes          enable row level security;
alter table public.enterprise_tasks          enable row level security;
alter table public.enterprise_history        enable row level security;

revoke all on public.enterprise_requests, public.enterprise_documents, public.enterprise_proposals,
  public.enterprise_proposal_lines, public.enterprise_notes, public.enterprise_tasks, public.enterprise_history
  from anon, authenticated;
revoke all on sequence public.enterprise_reference_seq, public.proposal_reference_seq from anon, authenticated;

create policy enterprise_requests_select       on public.enterprise_requests       for select to authenticated using (private.is_enterprise_staff());
create policy enterprise_documents_select      on public.enterprise_documents      for select to authenticated using (private.is_enterprise_staff());
create policy enterprise_proposals_select      on public.enterprise_proposals      for select to authenticated using (private.is_enterprise_staff());
create policy enterprise_proposal_lines_select on public.enterprise_proposal_lines for select to authenticated using (private.is_enterprise_staff());
create policy enterprise_notes_select          on public.enterprise_notes          for select to authenticated using (private.is_enterprise_staff());
create policy enterprise_tasks_select          on public.enterprise_tasks          for select to authenticated using (private.is_enterprise_staff());
create policy enterprise_history_select        on public.enterprise_history        for select to authenticated using (private.is_enterprise_staff());

grant select on public.enterprise_requests, public.enterprise_documents, public.enterprise_proposals,
  public.enterprise_proposal_lines, public.enterprise_notes, public.enterprise_tasks, public.enterprise_history
  to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('enterprise', 'enterprise', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

create policy enterprise_read on storage.objects
  for select to authenticated
  using (bucket_id = 'enterprise' and private.is_enterprise_staff());

-- ─── Internal helpers ──────────────────────────────────────────────────────
create function private.enterprise_log(p_org uuid, p_request uuid, p_proposal uuid, p_from text, p_to text, p_note text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.enterprise_history (organization_id, request_id, proposal_id, from_status, to_status, note, changed_by)
  values (p_org, p_request, p_proposal, p_from, p_to, nullif(btrim(coalesce(p_note, '')), ''), auth.uid());
$$;

-- ─── E1: public submission (service role only, after rate limiting) ────────
create function public.submit_enterprise_request(p_id uuid, p jsonb, p_documents jsonb default '[]'::jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ref      text;
  v_email    text := lower(btrim(p ->> 'contact_email'));
  v_existing text;
  v_doc      jsonb;
begin
  select r.reference into v_existing
    from public.enterprise_requests r
   where lower(r.contact_email) = v_email
     and lower(btrim(r.org_name)) = lower(btrim(p ->> 'org_name'))
     and r.created_at > now() - interval '10 minutes'
   limit 1;
  if v_existing is not null then
    return v_existing;
  end if;
  perform private.require(jsonb_array_length(coalesce(p_documents, '[]'::jsonb)) <= 3, 'invalid_input');

  v_ref := 'ENT-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.enterprise_reference_seq')::text, 4, '0');
  insert into public.enterprise_requests (
    id, reference, org_name, org_type, country, city, website, sector, employee_count,
    contact_name, contact_title, contact_email, contact_phone,
    service, topic, target_population, learner_count, outcomes, existing_content, language,
    timeline, reporting, accessibility, extra, consent_at
  ) values (
    p_id, v_ref, btrim(p ->> 'org_name'), (p ->> 'org_type')::public.partner_org_type, btrim(p ->> 'country'),
    nullif(btrim(coalesce(p ->> 'city', '')), ''), nullif(btrim(coalesce(p ->> 'website', '')), ''),
    nullif(btrim(coalesce(p ->> 'sector', '')), ''), p ->> 'employee_count',
    btrim(p ->> 'contact_name'), btrim(p ->> 'contact_title'), v_email, nullif(btrim(coalesce(p ->> 'contact_phone', '')), ''),
    (p ->> 'service')::public.enterprise_service, btrim(p ->> 'topic'), btrim(p ->> 'target_population'),
    nullif(p ->> 'learner_count', '')::integer, btrim(p ->> 'outcomes'), p ->> 'existing_content', p ->> 'language',
    nullif(btrim(coalesce(p ->> 'timeline', '')), ''), nullif(btrim(coalesce(p ->> 'reporting', '')), ''),
    nullif(btrim(coalesce(p ->> 'accessibility', '')), ''), nullif(btrim(coalesce(p ->> 'extra', '')), ''), now()
  );
  for v_doc in select * from jsonb_array_elements(coalesce(p_documents, '[]'::jsonb)) loop
    perform private.require((v_doc ->> 'path') like 'requests/' || p_id::text || '/%', 'invalid_input');
    perform private.require(v_doc ->> 'mime' = 'application/pdf', 'invalid_input');
    insert into public.enterprise_documents (request_id, storage_path, file_name, mime_type, file_size)
    values (p_id, v_doc ->> 'path', left(v_doc ->> 'name', 200), v_doc ->> 'mime', (v_doc ->> 'size')::integer);
  end loop;
  perform private.enterprise_log(null, p_id, null, null, 'received', null);
  perform private.log_audit('enterprise_request_received', 'enterprise_requests', p_id, null, jsonb_build_object('reference', v_ref, 'service', p ->> 'service'));
  return v_ref;
end;
$$;

-- received → qualified | declined | withdrawn | spam · qualified → declined | withdrawn
-- · declined | withdrawn → received (reopen) · converted only by create_enterprise_client
create function public.set_enterprise_request_status(p_request uuid, p_status text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from text;
begin
  perform private.require(private.is_enterprise_manager(), 'forbidden');
  select status::text into v_from from public.enterprise_requests where id = p_request for update;
  perform private.require(v_from is not null, 'not_found');
  perform private.require(
    (v_from = 'received' and p_status in ('qualified', 'declined', 'withdrawn', 'spam'))
    or (v_from = 'qualified' and p_status in ('declined', 'withdrawn'))
    or (v_from in ('declined', 'withdrawn') and p_status = 'received'),
    'invalid_transition');
  update public.enterprise_requests set status = p_status::public.enterprise_request_status, updated_at = now() where id = p_request;
  perform private.enterprise_log(null, p_request, null, v_from, p_status, p_note);
  perform private.log_audit('enterprise_request_status', 'enterprise_requests', p_request, null, jsonb_build_object('from', v_from, 'to', p_status));
end;
$$;

-- Creates the enterprise relationship: on an existing organisation (no
-- duplicate record) or on a new one, with the requester as contact.
create function public.create_enterprise_client(p_request uuid, p_organization uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  r     public.enterprise_requests;
  v_org uuid := p_organization;
begin
  perform private.require(private.is_enterprise_manager(), 'forbidden');
  select * into r from public.enterprise_requests where id = p_request for update;
  perform private.require(r.id is not null, 'not_found');
  perform private.require(r.status::text in ('received', 'qualified'), 'invalid_transition');

  if v_org is null then
    insert into public.partner_organizations (name, org_type, country, city, website, sector, employee_count,
                                              status, enterprise_status, enterprise_services, enterprise_manager_id, created_by)
    values (r.org_name, r.org_type, r.country, r.city, r.website, r.sector, r.employee_count,
            null, 'qualified', array[r.service], auth.uid(), auth.uid())
    returning id into v_org;
    perform private.log_audit('enterprise_client_created', 'partner_organizations', v_org, null, jsonb_build_object('request', r.reference));
  else
    perform private.require(exists (select 1 from public.partner_organizations where id = v_org and enterprise_status is null), 'already_exists');
    update public.partner_organizations
       set enterprise_status = 'qualified',
           enterprise_services = array[r.service],
           enterprise_manager_id = auth.uid(),
           employee_count = coalesce(employee_count, r.employee_count),
           updated_at = now()
     where id = v_org;
    perform private.log_audit('enterprise_client_linked', 'partner_organizations', v_org, null, jsonb_build_object('request', r.reference));
  end if;

  if not exists (select 1 from public.partner_contacts where organization_id = v_org and lower(email) = lower(r.contact_email)) then
    insert into public.partner_contacts (organization_id, full_name, job_title, email, phone, is_primary)
    values (v_org, r.contact_name, r.contact_title, r.contact_email, r.contact_phone,
            not exists (select 1 from public.partner_contacts where organization_id = v_org and is_primary));
  end if;

  update public.enterprise_requests set status = 'converted', organization_id = v_org, updated_at = now() where id = p_request;
  perform private.enterprise_log(null, p_request, null, r.status::text, 'converted', null);
  perform private.enterprise_log(v_org, null, null, null, 'qualified', 'Depuis la demande ' || r.reference);
  return v_org;
end;
$$;

-- A prospect identified by the team (or an existing partner becoming a client).
create function public.save_enterprise_client(p_org uuid, p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := p_org;
  v_services public.enterprise_service[] :=
    coalesce((select array_agg(distinct x::public.enterprise_service) from jsonb_array_elements_text(coalesce(p -> 'services', '[]'::jsonb)) x), '{}');
begin
  perform private.require(private.is_enterprise_manager(), 'forbidden');
  if v_id is null then
    insert into public.partner_organizations (name, org_type, country, city, website, sector, employee_count,
                                              status, enterprise_status, enterprise_services, enterprise_manager_id, created_by)
    values (btrim(p ->> 'name'), (p ->> 'org_type')::public.partner_org_type,
            nullif(btrim(coalesce(p ->> 'country', '')), ''), nullif(btrim(coalesce(p ->> 'city', '')), ''),
            nullif(btrim(coalesce(p ->> 'website', '')), ''), nullif(btrim(coalesce(p ->> 'sector', '')), ''),
            nullif(p ->> 'employee_count', ''), null, 'lead', v_services, auth.uid(), auth.uid())
    returning id into v_id;
    perform private.enterprise_log(v_id, null, null, null, 'lead', null);
    perform private.log_audit('enterprise_client_created', 'partner_organizations', v_id, null, '{}'::jsonb);
  else
    perform private.require(exists (select 1 from public.partner_organizations where id = v_id), 'not_found');
    update public.partner_organizations
       set enterprise_services = v_services,
           employee_count = nullif(p ->> 'employee_count', ''),
           enterprise_status = coalesce(enterprise_status, 'lead'),
           enterprise_manager_id = coalesce(nullif(p ->> 'manager_id', '')::uuid, enterprise_manager_id, auth.uid()),
           updated_at = now()
     where id = v_id;
    perform private.log_audit('enterprise_client_updated', 'partner_organizations', v_id, null, '{}'::jsonb);
  end if;
  return v_id;
end;
$$;

-- Enterprise pipeline (brief V3 §7). Free movement among the commercial
-- steps; « contract_signed » only by an approver from « institutional_approval »;
-- once signed, the early steps are closed.
create function public.set_enterprise_status(p_org uuid, p_status text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from   text;
  v_signed boolean;
begin
  perform private.require(private.is_enterprise_manager() or private.is_partnership_signatory(), 'forbidden');
  select enterprise_status::text into v_from from public.partner_organizations where id = p_org for update;
  perform private.require(v_from is not null, 'not_found');
  perform private.require(p_status is distinct from v_from, 'invalid_transition');
  v_signed := v_from in ('contract_signed', 'onboarding', 'active_service', 'renewal');

  if p_status in ('lead', 'qualified', 'discovery', 'needs_assessment', 'proposal', 'negotiation', 'institutional_approval', 'lost', 'withdrawn') then
    perform private.require(private.is_enterprise_manager(), 'forbidden');
    perform private.require(not v_signed, 'invalid_transition');
  elsif p_status = 'contract_signed' then
    perform private.require(private.is_partnership_signatory(), 'forbidden');
    perform private.require(v_from = 'institutional_approval', 'invalid_transition');
  elsif p_status = 'onboarding' then
    perform private.require(private.is_enterprise_manager(), 'forbidden');
    perform private.require(v_from = 'contract_signed', 'invalid_transition');
  elsif p_status = 'active_service' then
    perform private.require(private.is_enterprise_manager(), 'forbidden');
    perform private.require(v_from in ('onboarding', 'renewal'), 'invalid_transition');
  elsif p_status = 'renewal' then
    perform private.require(private.is_enterprise_manager(), 'forbidden');
    perform private.require(v_from = 'active_service', 'invalid_transition');
  else
    perform private.require(false, 'invalid_input');
  end if;

  update public.partner_organizations set enterprise_status = p_status::public.enterprise_pipeline_status, updated_at = now() where id = p_org;
  perform private.enterprise_log(p_org, null, null, v_from, p_status, p_note);
  perform private.log_audit('enterprise_status', 'partner_organizations', p_org, null, jsonb_build_object('from', v_from, 'to', p_status));
end;
$$;

-- ─── E2: proposals ─────────────────────────────────────────────────────────
create function public.save_enterprise_proposal(p_id uuid, p_org uuid, p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id     uuid := p_id;
  v_status text;
begin
  perform private.require(private.is_enterprise_manager(), 'forbidden');
  perform private.require(nullif(p ->> 'valid_until', '') is null or (p ->> 'valid_until')::date >= current_date, 'invalid_input');
  if v_id is null then
    perform private.require(exists (select 1 from public.partner_organizations where id = p_org and enterprise_status is not null), 'not_found');
    insert into public.enterprise_proposals (reference, organization_id, request_id, title, service, summary, currency, valid_until, created_by)
    values ('PROP-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.proposal_reference_seq')::text, 4, '0'),
            p_org, nullif(p ->> 'request_id', '')::uuid, btrim(p ->> 'title'), (p ->> 'service')::public.enterprise_service,
            nullif(btrim(coalesce(p ->> 'summary', '')), ''), coalesce(nullif(p ->> 'currency', ''), 'MAD'),
            nullif(p ->> 'valid_until', '')::date, auth.uid())
    returning id into v_id;
    perform private.enterprise_log(null, null, v_id, null, 'draft', null);
    perform private.log_audit('proposal_created', 'enterprise_proposals', v_id, null, '{}'::jsonb);
  else
    select status::text into v_status from public.enterprise_proposals where id = v_id for update;
    perform private.require(v_status is not null, 'not_found');
    -- What the approver approved is what is sent.
    perform private.require(v_status in ('draft', 'internal_review'), 'invalid_transition');
    update public.enterprise_proposals
       set title = btrim(p ->> 'title'),
           service = (p ->> 'service')::public.enterprise_service,
           summary = nullif(btrim(coalesce(p ->> 'summary', '')), ''),
           currency = coalesce(nullif(p ->> 'currency', ''), 'MAD'),
           valid_until = nullif(p ->> 'valid_until', '')::date,
           updated_at = now()
     where id = v_id;
  end if;
  return v_id;
end;
$$;

create function private.proposal_editable(p_proposal uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.enterprise_proposals where id = p_proposal and status::text in ('draft', 'internal_review'));
$$;

create function public.save_proposal_line(p_id uuid, p_proposal uuid, p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := p_id;
begin
  perform private.require(private.is_enterprise_manager(), 'forbidden');
  perform private.require(private.proposal_editable(p_proposal), 'invalid_transition');
  if v_id is null then
    insert into public.enterprise_proposal_lines (proposal_id, category, label, quantity, unit, unit_price, position)
    values (p_proposal, (p ->> 'category')::public.proposal_line_category, btrim(p ->> 'label'),
            coalesce(nullif(p ->> 'quantity', '')::numeric, 1), nullif(btrim(coalesce(p ->> 'unit', '')), ''),
            (p ->> 'unit_price')::numeric,
            coalesce((select max(position) + 1 from public.enterprise_proposal_lines where proposal_id = p_proposal), 0))
    returning id into v_id;
  else
    update public.enterprise_proposal_lines
       set category = (p ->> 'category')::public.proposal_line_category,
           label = btrim(p ->> 'label'),
           quantity = coalesce(nullif(p ->> 'quantity', '')::numeric, 1),
           unit = nullif(btrim(coalesce(p ->> 'unit', '')), ''),
           unit_price = (p ->> 'unit_price')::numeric
     where id = v_id and proposal_id = p_proposal;
    perform private.require(found, 'not_found');
  end if;
  update public.enterprise_proposals set updated_at = now() where id = p_proposal;
  return v_id;
end;
$$;

create function public.delete_proposal_line(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_proposal uuid;
begin
  perform private.require(private.is_enterprise_manager(), 'forbidden');
  select proposal_id into v_proposal from public.enterprise_proposal_lines where id = p_id;
  perform private.require(v_proposal is not null, 'not_found');
  perform private.require(private.proposal_editable(v_proposal), 'invalid_transition');
  delete from public.enterprise_proposal_lines where id = p_id;
end;
$$;

-- draft ⇄ internal_review (manager) · internal_review → approved (approver, 2FA)
-- · approved → draft (manager) · approved → sent (manager) · sent → accepted |
-- declined | expired (manager records the client's answer)
create function public.set_proposal_status(p_proposal uuid, p_status text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from text;
begin
  perform private.require(private.is_enterprise_manager() or private.is_partnership_signatory(), 'forbidden');
  select status::text into v_from from public.enterprise_proposals where id = p_proposal for update;
  perform private.require(v_from is not null, 'not_found');

  if (v_from, p_status) in (('draft', 'internal_review'), ('internal_review', 'draft'), ('approved', 'draft'), ('approved', 'sent'),
                            ('sent', 'accepted'), ('sent', 'declined'), ('sent', 'expired')) then
    perform private.require(private.is_enterprise_manager(), 'forbidden');
  elsif (v_from, p_status) = ('internal_review', 'approved') then
    perform private.require(private.is_partnership_signatory(), 'forbidden');
    perform private.require(exists (select 1 from public.enterprise_proposal_lines where proposal_id = p_proposal), 'invalid_input');
  else
    perform private.require(false, 'invalid_transition');
  end if;

  update public.enterprise_proposals
     set status = p_status::public.proposal_status,
         approved_by = case when p_status = 'approved' then auth.uid() when p_status = 'draft' then null else approved_by end,
         approved_at = case when p_status = 'approved' then now() when p_status = 'draft' then null else approved_at end,
         sent_at = case when p_status = 'sent' then now() else sent_at end,
         decided_at = case when p_status in ('accepted', 'declined', 'expired') then now() else decided_at end,
         updated_at = now()
   where id = p_proposal;
  perform private.enterprise_log(null, null, p_proposal, v_from, p_status, p_note);
  perform private.log_audit('proposal_status', 'enterprise_proposals', p_proposal, null, jsonb_build_object('from', v_from, 'to', p_status));
end;
$$;

-- ─── E2: notes and tasks ───────────────────────────────────────────────────
create function public.add_enterprise_note(p_org uuid, p_request uuid, p_proposal uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.require(private.is_enterprise_manager(), 'forbidden');
  perform private.require(num_nonnulls(p_org, p_request, p_proposal) = 1, 'invalid_input');
  perform private.require(char_length(btrim(coalesce(p_body, ''))) between 1 and 4000, 'invalid_input');
  insert into public.enterprise_notes (organization_id, request_id, proposal_id, body, author_id)
  values (p_org, p_request, p_proposal, btrim(p_body), auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

create function public.save_enterprise_task(p_org uuid, p_title text, p_due_on date, p_assigned_to uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.require(private.is_enterprise_manager(), 'forbidden');
  perform private.require(exists (select 1 from public.partner_organizations where id = p_org and enterprise_status is not null), 'not_found');
  perform private.require(char_length(btrim(coalesce(p_title, ''))) between 2 and 200, 'invalid_input');
  perform private.require(
    p_assigned_to is null
    or coalesce(private.platform_role(p_assigned_to) in ('sanady_admin', 'enterprise_manager', 'production_manager'), false),
    'invalid_input');
  insert into public.enterprise_tasks (organization_id, title, due_on, assigned_to, created_by)
  values (p_org, btrim(p_title), p_due_on, coalesce(p_assigned_to, auth.uid()), auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

create function public.set_enterprise_task_done(p_id uuid, p_done boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require(private.is_enterprise_manager(), 'forbidden');
  update public.enterprise_tasks set done_at = case when p_done then now() end where id = p_id;
  perform private.require(found, 'not_found');
end;
$$;

-- Avoid duplicates: enterprise managers may look up organisations by name
-- (name and whether it is a partner only — no partnership data).
create function public.find_organizations_for_enterprise(p_query text)
returns table (id uuid, name text, is_partner boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require(private.is_enterprise_manager(), 'forbidden');
  perform private.require(char_length(btrim(coalesce(p_query, ''))) >= 3, 'invalid_input');
  return query
    select o.id, o.name, o.status is not null
      from public.partner_organizations o
     where o.enterprise_status is null
       and exists (
         select 1 from regexp_split_to_table(lower(btrim(p_query)), '\s+') w
          where char_length(w) > 2 and lower(o.name) like '%' || w || '%'
       )
     order by o.name
     limit 10;
end;
$$;

-- ─── Retention (24 months after closure, like partnership applications) ────
create function public.purge_enterprise_requests(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from public.enterprise_requests
   where id = any (p_ids) and status::text in ('declined', 'withdrawn', 'spam') and updated_at < now() - interval '24 months';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ─── Roles: new platform roles; approvers may also be enterprise managers ──
create or replace function public.set_platform_role(p_user uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current text;
begin
  perform private.require(private.is_sanady_admin(), 'forbidden');
  perform private.require(p_user is distinct from auth.uid(), 'forbidden');
  perform private.require(p_role is null or p_role in ('training_manager', 'trainer', 'partnership_coordinator', 'partnership_manager',
                                                       'enterprise_manager', 'production_manager'), 'invalid_input');
  perform private.require(exists (select 1 from public.profiles where id = p_user and status = 'active'), 'account_unavailable');
  select role::text into v_current from public.platform_roles where user_id = p_user;
  perform private.require(v_current is distinct from 'sanady_admin', 'forbidden');

  if p_role is null then
    delete from public.platform_roles where user_id = p_user;
    delete from public.course_trainers where user_id = p_user;
  else
    insert into public.platform_roles (user_id, role, granted_by)
    values (p_user, p_role::public.platform_role, auth.uid())
    on conflict (user_id) do update set role = excluded.role, granted_by = excluded.granted_by, granted_at = now();
    if p_role <> 'trainer' then
      delete from public.course_trainers where user_id = p_user;
    end if;
  end if;
  perform private.log_audit(case when p_role is null then 'role_removed' else 'role_granted' end, 'platform_roles', p_user, null,
                            jsonb_build_object('role', coalesce(p_role, v_current)));
end;
$$;

create or replace function public.set_partnership_signatory(p_user uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require(private.is_sanady_admin(), 'forbidden');
  perform private.require(p_user is distinct from auth.uid(), 'forbidden');
  if p_active then
    perform private.require(
      coalesce(private.platform_role(p_user) in ('sanady_admin', 'partnership_coordinator', 'partnership_manager', 'enterprise_manager'), false),
      'invalid_input');
    perform private.require(not exists (select 1 from public.partnership_signatories where user_id = p_user and revoked_at is null), 'already_exists');
    insert into public.partnership_signatories (user_id, granted_by) values (p_user, auth.uid());
  else
    update public.partnership_signatories set revoked_at = now(), revoked_by = auth.uid()
     where user_id = p_user and revoked_at is null;
    perform private.require(found, 'not_found');
  end if;
  perform private.log_audit(case when p_active then 'signatory_granted' else 'signatory_revoked' end,
                            'partnership_signatories', p_user, null, '{}'::jsonb);
end;
$$;

-- Approvers who are enterprise managers must see the signatories list too.
drop policy partnership_signatories_select on public.partnership_signatories;
create policy partnership_signatories_select on public.partnership_signatories
  for select to authenticated
  using (private.is_partnership_staff() or private.is_enterprise_staff());

-- ─── Grants ────────────────────────────────────────────────────────────────
revoke execute on function
  public.submit_enterprise_request(uuid, jsonb, jsonb),
  public.purge_enterprise_requests(uuid[])
  from public, anon, authenticated;
grant execute on function
  public.submit_enterprise_request(uuid, jsonb, jsonb),
  public.purge_enterprise_requests(uuid[])
  to service_role;

revoke execute on function
  public.set_enterprise_request_status(uuid, text, text),
  public.create_enterprise_client(uuid, uuid),
  public.save_enterprise_client(uuid, jsonb),
  public.set_enterprise_status(uuid, text, text),
  public.save_enterprise_proposal(uuid, uuid, jsonb),
  public.save_proposal_line(uuid, uuid, jsonb),
  public.delete_proposal_line(uuid),
  public.set_proposal_status(uuid, text, text),
  public.add_enterprise_note(uuid, uuid, uuid, text),
  public.save_enterprise_task(uuid, text, date, uuid),
  public.set_enterprise_task_done(uuid, boolean),
  public.find_organizations_for_enterprise(text)
  from public, anon;
grant execute on function
  public.set_enterprise_request_status(uuid, text, text),
  public.create_enterprise_client(uuid, uuid),
  public.save_enterprise_client(uuid, jsonb),
  public.set_enterprise_status(uuid, text, text),
  public.save_enterprise_proposal(uuid, uuid, jsonb),
  public.save_proposal_line(uuid, uuid, jsonb),
  public.delete_proposal_line(uuid),
  public.set_proposal_status(uuid, text, text),
  public.add_enterprise_note(uuid, uuid, uuid, text),
  public.save_enterprise_task(uuid, text, date, uuid),
  public.set_enterprise_task_done(uuid, boolean),
  public.find_organizations_for_enterprise(text)
  to authenticated;

revoke execute on function
  private.is_enterprise_staff(uuid),
  private.is_enterprise_manager(uuid),
  private.enterprise_log(uuid, uuid, uuid, text, text, text),
  private.proposal_editable(uuid)
  from public, anon, authenticated;
grant execute on function
  private.is_enterprise_staff(uuid),
  private.is_enterprise_manager(uuid)
to authenticated;
