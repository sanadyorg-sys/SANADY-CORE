-- ════════════════════════════════════════════════════════════════════════════
-- SANADY Enterprise — phase E3: company learning spaces (multi-tenant LMS)
--
-- A company workspace is an INSTITUTION of kind « enterprise » (brief V3 §8,
-- plan §4.1): courses, assignments, progress, quizzes, certificates, reports
-- and invitations are the existing ones. This migration adds:
--   • enterprise_tenants: the commercial side (plan, limits, contract dates,
--     provisioning checklist, offboarding), one per client organisation;
--   • provisioning in 10 steps (brief §9): only for a client whose contract
--     was signed by an approver, and only after an approver authorises it;
--   • seat limits and « active workspace » checks on every way in
--     (invitations, enrolment codes, memberships);
--   • company-private courses: never granted to another institution, never
--     listed publicly;
--   • departments for employees;
--   • SANADY-wide teacher statistics and the library exclude employees who
--     belong only to company workspaces (brief §8: tenants are isolated from
--     the teacher-training environment).
-- Isolation between companies is the existing institution isolation (RLS on
-- verified membership), now covered by cross-tenant tests.
-- ════════════════════════════════════════════════════════════════════════════

create type public.institution_kind as enum ('school', 'enterprise');
create type public.tenant_status as enum (
  'requested', 'authorized', 'provisioning', 'active', 'suspended', 'offboarding', 'closed', 'cancelled'
);
create type public.course_ownership as enum ('sanady', 'company', 'joint', 'licensed');

alter table public.institutions add column kind public.institution_kind not null default 'school';

-- ─── Company workspaces ────────────────────────────────────────────────────
create table public.enterprise_tenants (
  id                      uuid primary key default gen_random_uuid(),
  organization_id         uuid not null references public.partner_organizations (id) on delete restrict,
  institution_id          uuid unique references public.institutions (id) on delete restrict,
  proposal_id             uuid references public.enterprise_proposals (id) on delete set null,
  slug                    text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$'),
  display_name            text not null check (char_length(btrim(display_name)) between 2 and 200),
  service_plan            public.enterprise_service not null check (service_plan <> 'partenariat'),
  max_learners            integer not null check (max_learners between 1 and 100000),
  storage_allowance_gb    numeric(8, 2) check (storage_allowance_gb > 0),
  video_minutes_allowance integer check (video_minutes_allowance > 0),
  support_level           text check (char_length(support_level) <= 200),
  support_email           text check (support_email is null or (char_length(support_email) <= 254 and support_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  primary_contact_id      uuid references public.partner_contacts (id) on delete set null,
  contract_start_on       date,
  contract_end_on         date,
  certificate_kind        text not null default 'attestation' check (certificate_kind in ('attestation', 'certificat')),
  status                  public.tenant_status not null default 'requested',
  requested_by            uuid references public.profiles (id) on delete set null,
  authorized_by           uuid references public.profiles (id) on delete set null,
  authorized_at           timestamptz,
  provisioned_at          timestamptz,
  security_checked_by     uuid references public.profiles (id) on delete set null,
  security_checked_at     timestamptz,
  activated_at            timestamptz,
  offboarding_started_at  timestamptz,
  termination_note        text check (char_length(termination_note) <= 2000),
  export_authorized_by    uuid references public.profiles (id) on delete set null,
  export_authorized_at    timestamptz,
  deletion_due_on         date,
  closed_at               timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  check (contract_end_on is null or contract_start_on is null or contract_end_on >= contract_start_on),
  check ((institution_id is null) = (status in ('requested', 'authorized', 'cancelled')))
);
-- One open workspace per client organisation.
create unique index enterprise_tenants_one_open_idx on public.enterprise_tenants (organization_id)
  where status not in ('closed', 'cancelled');
create index enterprise_tenants_status_idx on public.enterprise_tenants (status, updated_at desc);

-- History of workspaces in the enterprise history.
alter table public.enterprise_history
  add column tenant_id uuid references public.enterprise_tenants (id) on delete cascade,
  drop constraint enterprise_history_check,
  add constraint enterprise_history_one_target check (num_nonnulls(organization_id, request_id, proposal_id, tenant_id) = 1);
create index enterprise_history_tenant_idx on public.enterprise_history (tenant_id, created_at);

-- ─── Departments (company workspaces) ──────────────────────────────────────
create table public.enterprise_departments (
  id              uuid primary key default gen_random_uuid(),
  institution_id  uuid not null references public.institutions (id) on delete cascade,
  name            text not null check (char_length(btrim(name)) between 2 and 120),
  created_at      timestamptz not null default now()
);
create unique index enterprise_departments_name_idx on public.enterprise_departments (institution_id, lower(name));

alter table public.institution_memberships
  add column department_id uuid references public.enterprise_departments (id) on delete set null;
alter table public.invitations
  add column department_id uuid references public.enterprise_departments (id) on delete set null;

-- ─── Course ownership and visibility (brief §11) ───────────────────────────
alter table public.courses
  add column ownership public.course_ownership not null default 'sanady',
  add column owner_institution_id uuid references public.institutions (id) on delete restrict,
  add column tenant_private boolean not null default false,
  add constraint courses_tenant_private_owner check (not tenant_private or owner_institution_id is not null),
  add constraint courses_tenant_private_unlisted check (not (tenant_private and public_listing)),
  add constraint courses_owner_ownership check ((ownership = 'sanady') = (owner_institution_id is null) or ownership in ('joint', 'licensed'));
create index courses_owner_idx on public.courses (owner_institution_id) where owner_institution_id is not null;

-- ─── Helpers ───────────────────────────────────────────────────────────────
create function private.is_enterprise_institution(p_institution uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.institutions where id = p_institution and kind = 'enterprise');
$$;

-- Employees who belong only to company workspaces: kept out of the SANADY
-- teacher statistics and of the teachers' library.
create function private.is_enterprise_only_user(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
           select 1 from public.institution_memberships m join public.institutions i on i.id = m.institution_id
            where m.user_id = p_user and m.status = 'active' and i.kind = 'enterprise'
         )
     and not exists (
           select 1 from public.institution_memberships m join public.institutions i on i.id = m.institution_id
            where m.user_id = p_user and m.status = 'active' and i.kind = 'school'
         )
     and not exists (select 1 from public.platform_roles r where r.user_id = p_user);
$$;

create function private.is_enterprise_course(p_course uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.courses c join public.institutions i on i.id = c.owner_institution_id
     where c.id = p_course and i.kind = 'enterprise'
  );
$$;

create function private.tenant_log(p_tenant uuid, p_from text, p_to text, p_note text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.enterprise_history (tenant_id, from_status, to_status, note, changed_by)
  values (p_tenant, p_from, p_to, nullif(btrim(coalesce(p_note, '')), ''), auth.uid());
$$;

-- Seats taken: active employees + open invitations (a sent invitation holds a seat).
create function private.tenant_seats_used(p_institution uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select ((select count(*) from public.institution_memberships
            where institution_id = p_institution and role = 'teacher' and status = 'active')
        + (select count(*) from public.invitations
            where institution_id = p_institution and kind = 'institution_teacher'
              and accepted_at is null and revoked_at is null and expires_at > now()))::integer;
$$;

-- ─── Guards on the existing tables ─────────────────────────────────────────
-- An institution's kind never changes; an enterprise workspace's status
-- follows its tenant record (changed only by the functions below).
create function private.guard_institution_kind()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.kind is distinct from old.kind then
    raise exception using errcode = 'P0001', message = 'invalid_input';
  end if;
  if tg_op = 'INSERT' and new.kind = 'enterprise' and coalesce(current_setting('sanady.tenant_sync', true), '') <> 'on' then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;
  if tg_op = 'UPDATE' and new.kind = 'enterprise' and new.status is distinct from old.status
     and coalesce(current_setting('sanady.tenant_sync', true), '') <> 'on' then
    raise exception using errcode = 'P0001', message = 'tenant_managed';
  end if;
  return new;
end;
$$;
create trigger institutions_kind_guard
  before insert or update on public.institutions
  for each row execute function private.guard_institution_kind();

-- New employees only in an active workspace, within its learner limit.
create function private.guard_enterprise_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.enterprise_tenants;
begin
  if new.status <> 'active' or not private.is_enterprise_institution(new.institution_id) then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'active' and old.role = new.role then
    return new;
  end if;
  select * into t from public.enterprise_tenants where institution_id = new.institution_id;
  if new.role = 'teacher' then
    perform private.require(t.status = 'active', 'tenant_inactive');
    perform private.require(
      (select count(*) from public.institution_memberships
        where institution_id = new.institution_id and role = 'teacher' and status = 'active' and id <> new.id) < t.max_learners,
      'tenant_full');
  else
    perform private.require(t.status in ('provisioning', 'active', 'suspended'), 'tenant_inactive');
  end if;
  return new;
end;
$$;
create trigger memberships_enterprise_guard
  before insert or update on public.institution_memberships
  for each row execute function private.guard_enterprise_membership();

create function private.guard_enterprise_invitation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.enterprise_tenants;
begin
  if new.institution_id is null or not private.is_enterprise_institution(new.institution_id) then
    return new;
  end if;
  select * into t from public.enterprise_tenants where institution_id = new.institution_id;
  if new.kind = 'institution_teacher' then
    perform private.require(t.status = 'active', 'tenant_inactive');
    perform private.require(private.tenant_seats_used(new.institution_id) < t.max_learners, 'tenant_full');
  else
    perform private.require(t.status in ('provisioning', 'active', 'suspended'), 'tenant_inactive');
  end if;
  perform private.require(
    new.department_id is null
    or exists (select 1 from public.enterprise_departments d where d.id = new.department_id and d.institution_id = new.institution_id),
    'invalid_input');
  return new;
end;
$$;
create trigger invitations_enterprise_guard
  before insert on public.invitations
  for each row execute function private.guard_enterprise_invitation();

-- The department chosen in the invitation follows the employee.
create function private.apply_invitation_department()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.accepted_at is not null and old.accepted_at is null and new.department_id is not null then
    update public.institution_memberships
       set department_id = new.department_id
     where institution_id = new.institution_id and user_id = new.accepted_by;
  end if;
  return new;
end;
$$;
create trigger invitations_department
  after update on public.invitations
  for each row execute function private.apply_invitation_department();

-- Enrolment codes of a company workspace only while it is active.
create function private.guard_enterprise_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.is_enterprise_institution(new.institution_id) then
    perform private.require(
      exists (select 1 from public.enterprise_tenants where institution_id = new.institution_id and status = 'active'),
      'tenant_inactive');
  end if;
  return new;
end;
$$;
create trigger enrollment_codes_enterprise_guard
  before insert on public.enrollment_codes
  for each row execute function private.guard_enterprise_code();

-- A company-private course is never granted to another institution or person
-- outside its owner workspace (brief §11: never across tenants).
create function private.guard_private_course_grant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.courses;
begin
  if new.revoked_at is not null then
    return new;
  end if;
  select * into c from public.courses where id = new.course_id;
  if c.tenant_private then
    if new.institution_id is not null then
      perform private.require(new.institution_id = c.owner_institution_id, 'course_private_to_tenant');
    else
      perform private.require(
        exists (select 1 from public.institution_memberships m
                 where m.user_id = new.user_id and m.institution_id = c.owner_institution_id and m.status = 'active'),
        'course_private_to_tenant');
    end if;
  end if;
  return new;
end;
$$;
create trigger course_permissions_private_guard
  before insert or update on public.course_permissions
  for each row execute function private.guard_private_course_grant();

-- Making a course private requires that it is granted to no one else.
create function private.guard_course_privacy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.owner_institution_id is not null then
    perform private.require(private.is_enterprise_institution(new.owner_institution_id), 'invalid_input');
  end if;
  if new.tenant_private and (tg_op = 'INSERT' or not old.tenant_private or new.owner_institution_id is distinct from old.owner_institution_id) then
    perform private.require(
      not exists (select 1 from public.course_permissions cp
                   where cp.course_id = new.id and cp.revoked_at is null
                     and (cp.institution_id is distinct from new.owner_institution_id or cp.user_id is not null)),
      'course_private_to_tenant');
  end if;
  return new;
end;
$$;
create trigger courses_privacy_guard
  before insert or update on public.courses
  for each row execute function private.guard_course_privacy();

-- ─── Row level security ────────────────────────────────────────────────────
alter table public.enterprise_tenants     enable row level security;
alter table public.enterprise_departments enable row level security;
revoke all on public.enterprise_tenants, public.enterprise_departments from anon, authenticated;

create policy enterprise_tenants_select on public.enterprise_tenants
  for select to authenticated
  using (private.is_enterprise_staff() or (institution_id is not null and private.is_institution_admin(institution_id)));
create policy enterprise_departments_select on public.enterprise_departments
  for select to authenticated
  using (private.is_sanady_admin() or institution_id in (select private.supervised_institutions()));
grant select on public.enterprise_tenants, public.enterprise_departments to authenticated;

-- The teachers' library is not part of company workspaces.
drop policy library_resources_select on public.library_resources;
create policy library_resources_select on public.library_resources
  for select to authenticated
  using (
    private.is_sanady_admin()
    or (status = 'published' and private.is_active_user() and not private.is_enterprise_only_user())
  );

-- ─── Provisioning (brief §9) ───────────────────────────────────────────────
create function private.tenant_values(p jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'display_name', btrim(coalesce(p ->> 'display_name', '')),
    'slug', lower(btrim(coalesce(p ->> 'slug', ''))),
    'service_plan', p ->> 'service_plan',
    'max_learners', nullif(p ->> 'max_learners', ''),
    'storage_allowance_gb', nullif(p ->> 'storage_allowance_gb', ''),
    'video_minutes_allowance', nullif(p ->> 'video_minutes_allowance', ''),
    'support_level', nullif(btrim(coalesce(p ->> 'support_level', '')), ''),
    'support_email', nullif(lower(btrim(coalesce(p ->> 'support_email', ''))), ''),
    'primary_contact_id', nullif(p ->> 'primary_contact_id', ''),
    'proposal_id', nullif(p ->> 'proposal_id', ''),
    'contract_start_on', nullif(p ->> 'contract_start_on', ''),
    'contract_end_on', nullif(p ->> 'contract_end_on', ''),
    'certificate_kind', coalesce(nullif(p ->> 'certificate_kind', ''), 'attestation')
  );
$$;

-- Step 1 (contract signed) is a precondition; creates the request (status requested).
create function public.save_enterprise_tenant(p_id uuid, p_org uuid, p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v   jsonb := private.tenant_values(p);
  t   public.enterprise_tenants;
  v_id uuid := p_id;
begin
  perform private.require(private.is_enterprise_manager(), 'forbidden');
  perform private.require(
    (v ->> 'primary_contact_id') is null
    or exists (select 1 from public.partner_contacts c where c.id = (v ->> 'primary_contact_id')::uuid and c.organization_id = p_org),
    'invalid_input');
  perform private.require(
    (v ->> 'proposal_id') is null
    or exists (select 1 from public.enterprise_proposals pr where pr.id = (v ->> 'proposal_id')::uuid
                and pr.organization_id = p_org and pr.status = 'accepted'),
    'invalid_input');

  if v_id is null then
    perform private.require(
      exists (select 1 from public.partner_organizations o where o.id = p_org
               and o.enterprise_status in ('contract_signed', 'onboarding', 'active_service', 'renewal')),
      'contract_not_signed');
    insert into public.enterprise_tenants (
      organization_id, proposal_id, slug, display_name, service_plan, max_learners, storage_allowance_gb,
      video_minutes_allowance, support_level, support_email, primary_contact_id, contract_start_on, contract_end_on,
      certificate_kind, requested_by)
    values (
      p_org, (v ->> 'proposal_id')::uuid, v ->> 'slug', v ->> 'display_name', (v ->> 'service_plan')::public.enterprise_service,
      (v ->> 'max_learners')::integer, (v ->> 'storage_allowance_gb')::numeric, (v ->> 'video_minutes_allowance')::integer,
      v ->> 'support_level', v ->> 'support_email', (v ->> 'primary_contact_id')::uuid,
      (v ->> 'contract_start_on')::date, (v ->> 'contract_end_on')::date, v ->> 'certificate_kind', auth.uid())
    returning id into v_id;
    perform private.tenant_log(v_id, null, 'requested', null);
    perform private.log_audit('tenant_requested', 'enterprise_tenants', v_id, null, jsonb_build_object('slug', v ->> 'slug'));
  else
    select * into t from public.enterprise_tenants where id = v_id and organization_id = p_org for update;
    perform private.require(t.id is not null, 'not_found');
    perform private.require(t.status not in ('closed', 'cancelled', 'offboarding'), 'invalid_transition');
    -- The address of the workspace is fixed once it exists.
    perform private.require(t.institution_id is null or v ->> 'slug' = t.slug, 'invalid_input');
    update public.enterprise_tenants
       set proposal_id = (v ->> 'proposal_id')::uuid, slug = v ->> 'slug', display_name = v ->> 'display_name',
           service_plan = (v ->> 'service_plan')::public.enterprise_service, max_learners = (v ->> 'max_learners')::integer,
           storage_allowance_gb = (v ->> 'storage_allowance_gb')::numeric,
           video_minutes_allowance = (v ->> 'video_minutes_allowance')::integer,
           support_level = v ->> 'support_level', support_email = v ->> 'support_email',
           primary_contact_id = (v ->> 'primary_contact_id')::uuid,
           contract_start_on = (v ->> 'contract_start_on')::date, contract_end_on = (v ->> 'contract_end_on')::date,
           certificate_kind = v ->> 'certificate_kind', updated_at = now()
     where id = v_id;
    if t.institution_id is not null then
      perform set_config('sanady.tenant_sync', 'on', true);
      update public.institutions set name = v ->> 'display_name' where id = t.institution_id;
      perform set_config('sanady.tenant_sync', '', true);
    end if;
    perform private.log_audit('tenant_saved', 'enterprise_tenants', v_id, t.institution_id,
                              jsonb_build_object('max_learners', v ->> 'max_learners'));
  end if;
  return v_id;
exception
  when unique_violation then
    raise exception using errcode = 'P0001', message = 'tenant_exists';
end;
$$;

-- Step 2: an approver authorises (or refuses) the creation of the workspace.
create function public.authorize_enterprise_tenant(p_tenant uuid, p_authorize boolean, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.enterprise_tenants;
  v_to text := case when p_authorize then 'authorized' else 'cancelled' end;
begin
  perform private.require(private.is_partnership_signatory(), 'forbidden');
  select * into t from public.enterprise_tenants where id = p_tenant for update;
  perform private.require(t.id is not null, 'not_found');
  perform private.require(t.status = 'requested', 'invalid_transition');
  update public.enterprise_tenants
     set status = v_to::public.tenant_status,
         authorized_by = case when p_authorize then auth.uid() end,
         authorized_at = case when p_authorize then now() end,
         updated_at = now()
   where id = p_tenant;
  perform private.tenant_log(p_tenant, 'requested', v_to, p_note);
  perform private.log_audit('tenant_' || v_to, 'enterprise_tenants', p_tenant, null, '{}'::jsonb);
end;
$$;

-- Step 3: the workspace (an institution of kind enterprise) is generated.
create function public.generate_enterprise_workspace(p_tenant uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  t      public.enterprise_tenants;
  v_inst uuid;
  v_mail text;
begin
  perform private.require(private.is_enterprise_manager(), 'forbidden');
  select * into t from public.enterprise_tenants where id = p_tenant for update;
  perform private.require(t.id is not null, 'not_found');
  perform private.require(t.status = 'authorized', 'invalid_transition');
  v_mail := coalesce(t.support_email,
                     (select lower(c.email) from public.partner_contacts c where c.id = t.primary_contact_id),
                     'entreprises@sanady.org');

  perform set_config('sanady.tenant_sync', 'on', true);
  insert into public.institutions (name, identifier, type, contact_email, status, kind, created_by)
  values (t.display_name, left('ENT-' || upper(t.slug), 40), 'autre', v_mail, 'active', 'enterprise', auth.uid())
  returning id into v_inst;
  perform set_config('sanady.tenant_sync', '', true);

  update public.enterprise_tenants
     set institution_id = v_inst, status = 'provisioning', provisioned_at = now(), updated_at = now()
   where id = p_tenant;
  perform private.tenant_log(p_tenant, 'authorized', 'provisioning', null);
  perform private.log_audit('tenant_provisioned', 'enterprise_tenants', p_tenant, v_inst, jsonb_build_object('slug', t.slug));
  return v_inst;
exception
  when unique_violation then
    raise exception using errcode = 'P0001', message = 'tenant_exists';
end;
$$;

-- Step 8: security checks, recorded by a SANADY administrator (platform side).
create function public.confirm_tenant_security(p_tenant uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require(private.is_sanady_admin(), 'forbidden');
  update public.enterprise_tenants
     set security_checked_by = auth.uid(), security_checked_at = now(), updated_at = now()
   where id = p_tenant and status in ('provisioning', 'active', 'suspended');
  perform private.require(found, 'invalid_transition');
  perform private.tenant_log(p_tenant, null, 'security_checked', null);
  perform private.log_audit('tenant_security_checked', 'enterprise_tenants', p_tenant, null, '{}'::jsonb);
end;
$$;

-- The ten steps, computed from the records (never ticked by hand, except the
-- security check which is a person's statement).
create function public.tenant_checklist(p_tenant uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  t public.enterprise_tenants;
  v_signed boolean;
begin
  perform private.require(private.is_enterprise_staff() or private.is_partnership_signatory(), 'forbidden');
  select * into t from public.enterprise_tenants where id = p_tenant;
  perform private.require(t.id is not null, 'not_found');
  select o.enterprise_status::text in ('contract_signed', 'onboarding', 'active_service', 'renewal')
    into v_signed from public.partner_organizations o where o.id = t.organization_id;

  return jsonb_build_object(
    'contract_signed', coalesce(v_signed, false) or t.activated_at is not null,
    'authorized', t.authorized_at is not null,
    'workspace', t.institution_id is not null,
    'admin_assigned', t.institution_id is not null and (
       exists (select 1 from public.institution_memberships m where m.institution_id = t.institution_id and m.role = 'admin' and m.status = 'active')
       or exists (select 1 from public.invitations i where i.institution_id = t.institution_id and i.kind = 'institution_admin'
                   and i.revoked_at is null and (i.accepted_at is not null or i.expires_at > now()))),
    'limits', t.max_learners > 0 and t.contract_start_on is not null and t.contract_end_on is not null,
    'catalog', t.institution_id is not null and exists (
       select 1 from public.course_permissions cp join public.courses c on c.id = cp.course_id
        where cp.institution_id = t.institution_id and cp.revoked_at is null and c.status = 'published'),
    'storage', t.storage_allowance_gb is not null,
    'security', t.security_checked_at is not null,
    'welcome_sent', t.institution_id is not null and (
       exists (select 1 from public.institution_memberships m where m.institution_id = t.institution_id and m.role = 'admin' and m.status = 'active')
       or exists (select 1 from public.invitations i where i.institution_id = t.institution_id and i.kind = 'institution_admin'
                   and i.revoked_at is null and i.email_sent_at is not null)),
    'active', t.status = 'active'
  );
end;
$$;

-- Steps 10 and after: activation, suspension, offboarding, closure (brief §20).
create function public.set_tenant_status(p_tenant uuid, p_status text, p jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t      public.enterprise_tenants;
  c      jsonb;
  v_note text := nullif(btrim(coalesce(p ->> 'note', '')), '');
begin
  perform private.require(private.is_enterprise_manager() or private.is_partnership_signatory(), 'forbidden');
  select * into t from public.enterprise_tenants where id = p_tenant for update;
  perform private.require(t.id is not null, 'not_found');

  if (t.status::text, p_status) in (('provisioning', 'active'), ('suspended', 'active')) then
    perform private.require(private.is_enterprise_manager(), 'forbidden');
    c := public.tenant_checklist(p_tenant);
    perform private.require(
      (c ->> 'contract_signed')::boolean and (c ->> 'authorized')::boolean and (c ->> 'admin_assigned')::boolean
      and (c ->> 'limits')::boolean and (c ->> 'catalog')::boolean and (c ->> 'storage')::boolean
      and (c ->> 'security')::boolean and (c ->> 'welcome_sent')::boolean,
      'checklist_incomplete');
    perform private.require(t.contract_end_on >= current_date, 'contract_expired');
  elsif (t.status::text, p_status) = ('active', 'suspended') then
    perform private.require(private.is_enterprise_manager(), 'forbidden');
  elsif t.status::text in ('active', 'suspended') and p_status = 'offboarding' then
    -- Step 1 of offboarding: the end of the contract is recorded.
    perform private.require(private.is_enterprise_manager(), 'forbidden');
    perform private.require(v_note is not null, 'invalid_input');
  elsif (t.status::text, p_status) = ('offboarding', 'closed') then
    perform private.require(private.is_enterprise_manager(), 'forbidden');
    -- Deletion is scheduled per the contract and the law, never immediate.
    perform private.require(t.deletion_due_on is not null and t.deletion_due_on > current_date, 'deletion_date_required');
  else
    perform private.require(false, 'invalid_transition');
  end if;

  update public.enterprise_tenants
     set status = p_status::public.tenant_status,
         activated_at = case when p_status = 'active' then coalesce(activated_at, now()) else activated_at end,
         offboarding_started_at = case when p_status = 'offboarding' then now() else offboarding_started_at end,
         termination_note = case when p_status = 'offboarding' then v_note else termination_note end,
         closed_at = case when p_status = 'closed' then now() else closed_at end,
         updated_at = now()
   where id = p_tenant;

  perform set_config('sanady.tenant_sync', 'on', true);
  -- Learning access follows the workspace: on when active, off when
  -- suspended or closed; offboarding keeps the current access (employees of
  -- an active workspace can finish and the company can export).
  update public.institutions
     set status = case when p_status = 'active' then 'active'::public.account_status
                       when p_status in ('suspended', 'closed') then 'suspended'::public.account_status
                       else status end
   where id = t.institution_id;
  perform set_config('sanady.tenant_sync', '', true);

  if p_status = 'offboarding' then
    -- No new employees: open invitations and enrolment codes are withdrawn.
    update public.invitations set revoked_at = now(), revoked_by = auth.uid()
     where institution_id = t.institution_id and accepted_at is null and revoked_at is null;
    update public.enrollment_codes set revoked_at = now(), revoked_by = auth.uid()
     where institution_id = t.institution_id and revoked_at is null;
  elsif p_status = 'closed' then
    -- Access revoked; records are kept until the scheduled deletion date.
    update public.institution_memberships set status = 'revoked', revoked_at = now(), revoked_by = auth.uid()
     where institution_id = t.institution_id and status = 'active';
  end if;

  perform private.tenant_log(p_tenant, t.status::text, p_status, v_note);
  perform private.log_audit('tenant_status', 'enterprise_tenants', p_tenant, t.institution_id,
                            jsonb_build_object('from', t.status::text, 'to', p_status));
end;
$$;

-- Offboarding steps 3 and 5: export authorised (approver) and deletion date.
create function public.authorize_tenant_export(p_tenant uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require(private.is_partnership_signatory(), 'forbidden');
  update public.enterprise_tenants
     set export_authorized_by = auth.uid(), export_authorized_at = now(), updated_at = now()
   where id = p_tenant and status = 'offboarding';
  perform private.require(found, 'invalid_transition');
  perform private.tenant_log(p_tenant, null, 'export_authorized', null);
  perform private.log_audit('tenant_export_authorized', 'enterprise_tenants', p_tenant, null, '{}'::jsonb);
end;
$$;

create function public.schedule_tenant_deletion(p_tenant uuid, p_date date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require(private.is_enterprise_manager(), 'forbidden');
  perform private.require(p_date > current_date, 'invalid_input');
  update public.enterprise_tenants set deletion_due_on = p_date, updated_at = now()
   where id = p_tenant and status in ('offboarding', 'closed');
  perform private.require(found, 'invalid_transition');
  perform private.tenant_log(p_tenant, null, 'deletion_scheduled', to_char(p_date, 'DD/MM/YYYY'));
  perform private.log_audit('tenant_deletion_scheduled', 'enterprise_tenants', p_tenant, null, jsonb_build_object('date', p_date));
end;
$$;

-- Step 4: the company administrator is invited by the enterprise team.
create function public.invite_tenant_admin(p_tenant uuid, p_email text, p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  t       public.enterprise_tenants;
  v_email text := lower(btrim(p_email));
  v_days  smallint;
  v_id    uuid;
begin
  perform private.require(private.is_enterprise_manager(), 'forbidden');
  perform private.require(v_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(v_email) <= 254, 'invalid_input');
  perform private.require(p_token_hash ~ '^[0-9a-f]{64}$', 'invalid_input');
  select * into t from public.enterprise_tenants where id = p_tenant;
  perform private.require(t.institution_id is not null and t.status in ('provisioning', 'active', 'suspended'), 'tenant_inactive');
  perform private.require(
    not exists (select 1 from public.institution_memberships m join public.profiles pr on pr.id = m.user_id
                 where m.institution_id = t.institution_id and pr.email = v_email and m.status = 'active' and m.role = 'admin'),
    'already_member');
  select invitation_validity_days into v_days from public.platform_settings where id;
  update public.invitations set revoked_at = now(), revoked_by = auth.uid()
   where kind = 'institution_admin' and email = v_email and institution_id = t.institution_id
     and accepted_at is null and revoked_at is null;
  insert into public.invitations (kind, email, institution_id, token_hash, invited_by, expires_at)
  values ('institution_admin', v_email, t.institution_id, p_token_hash, auth.uid(), now() + make_interval(days => v_days))
  returning id into v_id;
  perform private.tenant_log(p_tenant, null, 'admin_invited', v_email);
  return v_id;
end;
$$;

-- What the enterprise team sees of a workspace: counts only, never names.
create function public.tenant_usage(p_tenant uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  t public.enterprise_tenants;
begin
  perform private.require(private.is_enterprise_staff() or private.is_partnership_signatory(), 'forbidden');
  select * into t from public.enterprise_tenants where id = p_tenant;
  perform private.require(t.id is not null, 'not_found');
  if t.institution_id is null then
    return jsonb_build_object('employees', 0, 'invited', 0, 'admins', 0, 'courses', 0, 'active_30d', 0, 'completions', 0, 'certificates', 0);
  end if;
  return jsonb_build_object(
    'employees', (select count(*) from public.institution_memberships where institution_id = t.institution_id and role = 'teacher' and status = 'active'),
    'invited', (select count(*) from public.invitations where institution_id = t.institution_id and kind = 'institution_teacher'
                 and accepted_at is null and revoked_at is null and expires_at > now()),
    'admins', (select count(*) from public.institution_memberships where institution_id = t.institution_id and role = 'admin' and status = 'active'),
    'admin_invitations', coalesce((
       select jsonb_agg(jsonb_build_object('id', i.id, 'email', i.email, 'sent', i.email_sent_at is not null,
                                           'accepted', i.accepted_at is not null, 'expires_at', i.expires_at) order by i.created_at desc)
         from public.invitations i
        where i.institution_id = t.institution_id and i.kind = 'institution_admin' and i.revoked_at is null), '[]'::jsonb),
    'courses', (select count(*) from public.course_permissions where institution_id = t.institution_id and revoked_at is null),
    'private_courses', (select count(*) from public.courses where owner_institution_id = t.institution_id),
    'active_30d', (select count(distinct e.user_id) from public.learning_events e
                    join public.course_assignments ca on ca.user_id = e.user_id and ca.course_id = e.course_id
                                                     and ca.institution_id = t.institution_id and ca.revoked_at is null
                   where e.occurred_at >= now() - interval '30 days'
                     and e.event_type::text not in ('enrolled', 'quiz_attempts_reset', 'certificate_issued')),
    'completions', (select count(*) from public.course_assignments ca
                     join public.enrollments en on en.user_id = ca.user_id and en.course_id = ca.course_id
                    where ca.institution_id = t.institution_id and ca.revoked_at is null and en.completed_at is not null),
    'certificates', (select count(*) from public.course_assignments ca
                      join public.certificates ct on ct.user_id = ca.user_id and ct.course_id = ca.course_id and ct.revoked_at is null
                     where ca.institution_id = t.institution_id and ca.revoked_at is null)
  );
end;
$$;

-- ─── Departments (company administrators) ──────────────────────────────────
create function public.save_department(p_id uuid, p_institution uuid, p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := p_id;
begin
  perform private.require(private.is_enterprise_institution(p_institution), 'invalid_input');
  perform private.require(private.is_sanady_admin() or private.is_institution_admin(p_institution), 'forbidden');
  perform private.require(char_length(btrim(coalesce(p_name, ''))) between 2 and 120, 'invalid_input');
  if v_id is null then
    insert into public.enterprise_departments (institution_id, name) values (p_institution, btrim(p_name)) returning id into v_id;
  else
    update public.enterprise_departments set name = btrim(p_name) where id = v_id and institution_id = p_institution;
    perform private.require(found, 'not_found');
  end if;
  return v_id;
exception
  when unique_violation then
    raise exception using errcode = 'P0001', message = 'department_exists';
end;
$$;

create function public.delete_department(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inst uuid;
begin
  select institution_id into v_inst from public.enterprise_departments where id = p_id;
  perform private.require(v_inst is not null, 'not_found');
  perform private.require(private.is_sanady_admin() or private.is_institution_admin(v_inst), 'forbidden');
  delete from public.enterprise_departments where id = p_id;
end;
$$;

create function public.set_member_department(p_institution uuid, p_user uuid, p_department uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require(private.is_sanady_admin() or private.is_institution_admin(p_institution), 'forbidden');
  perform private.require(
    p_department is null
    or exists (select 1 from public.enterprise_departments d where d.id = p_department and d.institution_id = p_institution),
    'invalid_input');
  update public.institution_memberships set department_id = p_department
   where institution_id = p_institution and user_id = p_user and status = 'active';
  perform private.require(found, 'not_found');
end;
$$;

-- The department an invited employee will join (set right after the invitation).
create function public.set_invitation_department(p_invitation uuid, p_department uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inst uuid;
begin
  select institution_id into v_inst from public.invitations
   where id = p_invitation and accepted_at is null and revoked_at is null;
  perform private.require(v_inst is not null, 'not_found');
  perform private.require(private.is_sanady_admin() or private.is_institution_admin(v_inst), 'forbidden');
  perform private.require(
    p_department is null
    or exists (select 1 from public.enterprise_departments d where d.id = p_department and d.institution_id = v_inst),
    'invalid_input');
  update public.invitations set department_id = p_department where id = p_invitation;
end;
$$;

-- ─── Course ownership (training managers and SANADY administrators) ────────
create function public.set_course_ownership(p_course uuid, p_ownership text, p_owner uuid, p_private boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require(private.is_course_staff(), 'forbidden');
  perform private.require(p_ownership in ('sanady', 'company', 'joint', 'licensed'), 'invalid_input');
  perform private.require(p_owner is null or private.is_enterprise_institution(p_owner), 'invalid_input');
  perform private.require(not coalesce(p_private, false) or p_owner is not null, 'invalid_input');
  update public.courses
     set ownership = p_ownership::public.course_ownership,
         owner_institution_id = p_owner,
         tenant_private = coalesce(p_private, false),
         public_listing = case when coalesce(p_private, false) then false else public_listing end
   where id = p_course;
  perform private.require(found, 'not_found');
  perform private.log_audit('course_ownership', 'courses', p_course, p_owner,
                            jsonb_build_object('ownership', p_ownership, 'private', coalesce(p_private, false)));
end;
$$;

-- Workspaces a training manager can choose as owner (names only).
create function public.enterprise_workspaces()
returns table (institution_id uuid, name text, status public.tenant_status)
language sql
stable
security definer
set search_path = ''
as $$
  select t.institution_id, t.display_name, t.status
    from public.enterprise_tenants t
   where t.institution_id is not null
     and (private.is_course_staff() or private.is_enterprise_staff())
   order by t.display_name;
$$;

-- Certificate wording for a company workspace (title of the PDF).
create function public.certificate_style(p_certificate uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('kind', t.certificate_kind, 'organization', t.display_name)
    from public.certificates ct
    join public.courses c on c.id = ct.course_id
    join public.enterprise_tenants t on t.institution_id = c.owner_institution_id
   where ct.id = p_certificate
     and (ct.user_id = auth.uid() or private.is_sanady_admin()
          or c.owner_institution_id in (select private.supervised_institutions()));
$$;

-- ─── Grants ────────────────────────────────────────────────────────────────
revoke execute on function
  private.is_enterprise_institution(uuid), private.is_enterprise_only_user(uuid), private.is_enterprise_course(uuid),
  private.tenant_log(uuid, text, text, text), private.tenant_seats_used(uuid), private.tenant_values(jsonb),
  private.guard_institution_kind(), private.guard_enterprise_membership(), private.guard_enterprise_invitation(),
  private.apply_invitation_department(), private.guard_enterprise_code(), private.guard_private_course_grant(),
  private.guard_course_privacy()
from public, anon;
grant execute on function private.is_enterprise_only_user(uuid), private.is_enterprise_institution(uuid) to authenticated;

revoke execute on function
  public.save_enterprise_tenant(uuid, uuid, jsonb), public.authorize_enterprise_tenant(uuid, boolean, text),
  public.generate_enterprise_workspace(uuid), public.confirm_tenant_security(uuid), public.tenant_checklist(uuid),
  public.set_tenant_status(uuid, text, jsonb), public.authorize_tenant_export(uuid), public.schedule_tenant_deletion(uuid, date),
  public.invite_tenant_admin(uuid, text, text), public.tenant_usage(uuid), public.save_department(uuid, uuid, text),
  public.delete_department(uuid), public.set_member_department(uuid, uuid, uuid), public.set_invitation_department(uuid, uuid),
  public.set_course_ownership(uuid, text, uuid, boolean), public.enterprise_workspaces(), public.certificate_style(uuid)
from public, anon;
grant execute on function
  public.save_enterprise_tenant(uuid, uuid, jsonb), public.authorize_enterprise_tenant(uuid, boolean, text),
  public.generate_enterprise_workspace(uuid), public.confirm_tenant_security(uuid), public.tenant_checklist(uuid),
  public.set_tenant_status(uuid, text, jsonb), public.authorize_tenant_export(uuid), public.schedule_tenant_deletion(uuid, date),
  public.invite_tenant_admin(uuid, text, text), public.tenant_usage(uuid), public.save_department(uuid, uuid, text),
  public.delete_department(uuid), public.set_member_department(uuid, uuid, uuid), public.set_invitation_department(uuid, uuid),
  public.set_course_ownership(uuid, text, uuid, boolean), public.enterprise_workspaces(), public.certificate_style(uuid)
to authenticated;

-- ─── SANADY-wide statistics: teachers only (brief §8, plan R3) ─────────────
-- Same functions as in 20261014000100_roles.sql, with employees who belong
-- only to company workspaces, company-owned courses and company workspaces
-- left out. Company figures are in each workspace's own report.
create or replace function public.admin_report(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_from timestamptz;
  v_to   timestamptz;
begin
  perform private.require(private.is_course_staff(), 'forbidden');
  select b.v_from, b.v_to into v_from, v_to from private.period_bounds(p_from, p_to) b;

  return jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'kpis', (
      select jsonb_build_object(
        'teachers', (select count(*) from public.profiles p
                      where p.status = 'active' and not exists (select 1 from public.platform_roles r where r.user_id = p.id)
                        and not private.is_enterprise_only_user(p.id)),
        'new_teachers', (select count(*) from public.profiles p
                          where p.created_at >= v_from and p.created_at < v_to
                            and not exists (select 1 from public.platform_roles r where r.user_id = p.id)
                            and not private.is_enterprise_only_user(p.id)),
        'active_teachers', (select count(distinct e.user_id) from public.learning_events e
                             where e.occurred_at >= v_from and e.occurred_at < v_to and e.event_type::text not in ('enrolled', 'quiz_attempts_reset', 'certificate_issued')
                               and not private.is_enterprise_only_user(e.user_id)),
        'institutions', (select count(*) from public.institutions where status = 'active' and kind = 'school'),
        'published_courses', (select count(*) from public.courses c where c.status = 'published' and not private.is_enterprise_course(c.id)),
        'active_enrollments', (select count(*) from public.enrollments en where en.status = 'active' and not private.is_enterprise_only_user(en.user_id) and not private.is_enterprise_course(en.course_id)),
        'completions', (select count(*) from public.enrollments en where en.completed_at >= v_from and en.completed_at < v_to
                          and not private.is_enterprise_only_user(en.user_id) and not private.is_enterprise_course(en.course_id)),
        'completion_rate', (select round(count(*) filter (where status = 'completed')::numeric
                                         / nullif(count(*) filter (where started_at is not null), 0), 4)
                              from public.enrollments en where not private.is_enterprise_only_user(en.user_id) and not private.is_enterprise_course(en.course_id)),
        'attempts', a.n,
        'average_score', a.avg_score,
        'pass_rate', a.pass_rate,
        'certificates', (select count(*) from public.certificates ct
                          where ct.issued_at >= v_from and ct.issued_at < v_to and ct.revoked_at is null
                            and not private.is_enterprise_only_user(ct.user_id) and not private.is_enterprise_course(ct.course_id))
      )
      from (
        select count(*) as n,
               round(avg(score_percent), 1) as avg_score,
               round(count(*) filter (where passed)::numeric / nullif(count(*), 0), 4) as pass_rate
          from public.quiz_attempts qa
         where qa.status = 'submitted' and qa.voided_at is null and qa.submitted_at >= v_from and qa.submitted_at < v_to
           and not private.is_enterprise_only_user(qa.user_id) and not private.is_enterprise_course(qa.course_id)
      ) a
    ),
    'weekly', coalesce((
      select jsonb_agg(jsonb_build_object(
               'week', w::date,
               'active_teachers', (select count(distinct e.user_id) from public.learning_events e
                                    where e.occurred_at >= greatest(w, v_from) and e.occurred_at < least(w + interval '7 days', v_to) and e.event_type::text not in ('enrolled', 'quiz_attempts_reset', 'certificate_issued')
                                      and not private.is_enterprise_only_user(e.user_id)),
               'completions', (select count(*) from public.enrollments en
                                where en.completed_at >= greatest(w, v_from) and en.completed_at < least(w + interval '7 days', v_to)
                                  and not private.is_enterprise_only_user(en.user_id) and not private.is_enterprise_course(en.course_id)),
               'certificates', (select count(*) from public.certificates c
                                 where c.issued_at >= greatest(w, v_from) and c.issued_at < least(w + interval '7 days', v_to)
                                   and c.revoked_at is null and not private.is_enterprise_only_user(c.user_id) and not private.is_enterprise_course(c.course_id))
             ) order by w)
        from generate_series(date_trunc('week', v_from), v_to - interval '1 second', interval '7 days') w
    ), '[]'::jsonb),
    'courses', coalesce((
      select jsonb_agg(row_to_json(x)::jsonb order by x.title)
        from (
          select c.id, c.title, c.status,
                 count(en.id) as enrolled,
                 count(en.started_at) as started,
                 count(en.completed_at) as completed,
                 round(count(en.completed_at)::numeric / nullif(count(en.started_at), 0), 4) as completion_rate,
                 (select count(distinct e.user_id) from public.learning_events e
                   where e.course_id = c.id and e.occurred_at >= v_from and e.occurred_at < v_to and e.event_type::text not in ('enrolled', 'quiz_attempts_reset', 'certificate_issued')
                     and not private.is_enterprise_only_user(e.user_id)) as active_in_period,
                 (select round(avg(qa.score_percent), 1) from public.quiz_attempts qa
                   where qa.course_id = c.id and qa.status = 'submitted' and qa.voided_at is null
                     and qa.submitted_at >= v_from and qa.submitted_at < v_to and not private.is_enterprise_only_user(qa.user_id)) as average_score,
                 (select count(*) from public.certificates ct where ct.course_id = c.id and ct.revoked_at is null and not private.is_enterprise_only_user(ct.user_id)) as certificates
            from public.courses c
            left join public.enrollments en on en.course_id = c.id and not private.is_enterprise_only_user(en.user_id)
           where c.status <> 'draft' and not private.is_enterprise_course(c.id)
           group by c.id
        ) x
    ), '[]'::jsonb),
    'institutions', coalesce((
      select jsonb_agg(row_to_json(x)::jsonb order by x.name)
        from (
          select i.id, i.name, i.city,
                 (select count(*) from public.institution_memberships m
                   where m.institution_id = i.id and m.role = 'teacher' and m.status = 'active') as teachers,
                 count(ca.id) as assignments,
                 count(en.completed_at) as completed,
                 round(count(en.completed_at)::numeric / nullif(count(ca.id), 0), 4) as completion_rate,
                 (select count(distinct e.user_id)
                    from public.learning_events e
                    join public.course_assignments ca2 on ca2.user_id = e.user_id and ca2.course_id = e.course_id
                                                     and ca2.institution_id = i.id and ca2.revoked_at is null
                   where e.occurred_at >= v_from and e.occurred_at < v_to and e.event_type::text not in ('enrolled', 'quiz_attempts_reset', 'certificate_issued')) as active_in_period,
                 count(ct.id) as certificates
            from public.institutions i
            left join public.course_assignments ca
                   on ca.institution_id = i.id and ca.revoked_at is null
                  and exists (select 1 from public.institution_memberships m
                               where m.institution_id = i.id and m.user_id = ca.user_id and m.role = 'teacher' and m.status = 'active')
            left join public.enrollments en on en.user_id = ca.user_id and en.course_id = ca.course_id
            left join public.certificates ct on ct.user_id = ca.user_id and ct.course_id = ca.course_id and ct.revoked_at is null
           where i.status = 'active' and i.kind = 'school'
           group by i.id
        ) x
    ), '[]'::jsonb),
    'quizzes', coalesce((
      select jsonb_agg(row_to_json(x)::jsonb order by x.course_title, x.module_position)
        from (
          select q.id, q.title, c.title as course_title, m.position + 1 as module_position,
                 count(distinct qa.user_id) as learners,
                 count(*) as attempts,
                 round(avg(qa.score_percent), 1) as average_score,
                 round(count(distinct qa.user_id) filter (where qa.passed)::numeric / nullif(count(distinct qa.user_id), 0), 4) as pass_rate,
                 round(count(*) filter (where qa.attempt_number = 1 and qa.passed)::numeric
                       / nullif(count(*) filter (where qa.attempt_number = 1), 0), 4) as first_attempt_pass_rate
            from public.quiz_attempts qa
            join public.quizzes q on q.id = qa.quiz_id
            join public.modules m on m.id = q.module_id
            join public.courses c on c.id = q.course_id
           where qa.status = 'submitted' and qa.voided_at is null
             and qa.submitted_at >= v_from and qa.submitted_at < v_to
             and not private.is_enterprise_only_user(qa.user_id) and not private.is_enterprise_course(c.id)
           group by q.id, c.title, m.position
        ) x
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.platform_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_days smallint;
begin
  perform private.require(private.is_course_staff(), 'forbidden');
  select inactivity_threshold_days into v_days from public.platform_settings where id;

  return jsonb_build_object(
    'institutions', (select count(*) from public.institutions where status = 'active' and kind = 'school'),
    'teachers', (select count(*) from public.profiles p
                  where p.status = 'active'
                    and not exists (select 1 from public.platform_roles r where r.user_id = p.id)
                    and not private.is_enterprise_only_user(p.id)),
    'active_learners', (select count(distinct user_id) from public.enrollments
                         where last_activity_at >= now() - make_interval(days => v_days)
                           and not private.is_enterprise_only_user(user_id)),
    'inactivity_threshold_days', v_days,
    'published_courses', (select count(*) from public.courses c where c.status = 'published' and not private.is_enterprise_course(c.id)),
    'draft_courses', (select count(*) from public.courses where status = 'draft'),
    'enrollments', (select count(*) from public.enrollments where not private.is_enterprise_only_user(user_id)),
    'completed_enrollments', (select count(*) from public.enrollments where status = 'completed' and not private.is_enterprise_only_user(user_id)),
    'certificates', (select count(*) from public.certificates where revoked_at is null and not private.is_enterprise_only_user(user_id)),
    'pending_invitations', (select count(*) from public.invitations
                             where accepted_at is null and revoked_at is null and expires_at > now()),
    'exhausted_attempts', (
      select count(*) from (
        select a.quiz_id, a.user_id
          from public.quiz_attempts a
         where a.voided_at is null and a.status = 'submitted'
         group by a.quiz_id, a.user_id
        having count(*) >= min(a.max_attempts) and not bool_or(a.passed)
      ) s
    )
  );
end;
$$;
