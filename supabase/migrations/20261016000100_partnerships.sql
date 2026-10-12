-- ════════════════════════════════════════════════════════════════════════════
-- SANADY · Partenariats & Coopération — brief V2, phases 1 and 2
--   (brief: PLAN/partnership.md · plan: docs/partnerships/plan.md)
--
-- Organisations that want to support the Foundation (companies,
-- foundations, universities, NGOs…) send an application from the public
-- page /partenariats, around one of the Foundation's six fields of
-- intervention. The partnership team reviews it, turns it into an
-- organisation record and follows it through the pipeline, with notes and
-- follow-up tasks.
-- Not to be confused with schools (« établissements partenaires »).
--
-- Roles (platform_role, one per account, two-factor sessions only):
--   partnership_coordinator  reviews applications, records organisations,
--                            contacts, notes and tasks, moves the early steps
--   partnership_manager      same, and submits a partnership for
--                            institutional validation (recommendation)
-- Signing authority is NOT a role: an explicit grant (« approbateur
-- habilité ») recorded by a SANADY administrator for someone else, never
-- for themself. Only an approver, from a two-factor session, can validate
-- the agreement or reject a partnership under institutional validation.
--
-- New enum values are compared as text in this migration (an ALTER TYPE
-- value cannot be used as a constant in the same transaction).
-- ════════════════════════════════════════════════════════════════════════════

alter type public.platform_role add value if not exists 'partnership_coordinator';
alter type public.platform_role add value if not exists 'partnership_manager';

-- Ways an organisation contributes (brief V2 §5).
create type public.partnership_contribution as enum (
  'financier', 'equipement', 'expertise', 'technologie', 'services_educatifs', 'cooperation_institutionnelle'
);
create type public.partner_org_type as enum (
  'entreprise', 'fondation', 'universite', 'association', 'administration', 'organisation_internationale', 'autre'
);
create type public.partnership_application_status as enum (
  'received', 'under_review', 'accepted', 'declined', 'withdrawn', 'spam'
);
-- The eleven stages of brief V2 §7, then the two closed outcomes.
create type public.partner_pipeline_status as enum (
  'prospect', 'first_contact', 'interest_confirmed', 'proposal_received', 'evaluation', 'negotiation',
  'institutional_validation', 'agreement_signed', 'implementation', 'monitoring', 'renewal_or_closure',
  'rejected', 'withdrawn'
);

-- ─── Fields of intervention (the Foundation's six programmes, sanady.org) ──
-- Configurable without a migration (rename, reorder, deactivate). Public
-- descriptions come from verified sources in the code (src/lib/institution.ts).
create table public.intervention_fields (
  slug      text primary key check (slug ~ '^[a-z][a-z-]{2,40}$'),
  name      text not null check (char_length(btrim(name)) between 2 and 120),
  theme     text not null check (theme in ('apprentissage', 'avenir', 'eveil')),
  position  integer not null default 0,
  active    boolean not null default true
);
insert into public.intervention_fields (slug, name, theme, position) values
  ('soutien-scolaire',   'Soutien scolaire',                            'apprentissage', 1),
  ('formation-continue', 'Formation continue des enseignants',          'apprentissage', 2),
  ('orientation',        'Orientation scolaire et professionnelle',     'avenir',        3),
  ('bourses',            'Assistance aux bourses d’études supérieures', 'avenir',        4),
  ('parascolaire',       'Activités parascolaires',                     'eveil',         5),
  ('rehabilitation',     'Réhabilitation des écoles',                   'eveil',         6);

-- ─── Role helpers ──────────────────────────────────────────────────────────
-- Partnership staff: SANADY administrators and the two partnership roles,
-- always from a two-factor session (like administrators).
create function private.is_partnership_staff(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_sanady_admin(p_user)
      or (coalesce(private.platform_role(p_user) in ('partnership_coordinator', 'partnership_manager'), false)
          and (p_user is distinct from auth.uid() or private.session_aal() = 'aal2'));
$$;

create function private.is_partnership_manager(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.platform_role(p_user) = 'partnership_manager', false)
     and (p_user is distinct from auth.uid() or private.session_aal() = 'aal2');
$$;

-- ─── Approvers (explicit, audited grant) ───────────────────────────────────
create table public.partnership_signatories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  granted_by  uuid references public.profiles (id) on delete set null,
  granted_at  timestamptz not null default now(),
  revoked_by  uuid references public.profiles (id) on delete set null,
  revoked_at  timestamptz,
  check (granted_by is distinct from user_id)
);
create unique index partnership_signatories_active_idx on public.partnership_signatories (user_id) where revoked_at is null;

create function private.is_partnership_signatory(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
           select 1
             from public.partnership_signatories s
             join public.profiles p on p.id = s.user_id
            where s.user_id = p_user and s.revoked_at is null and p.status = 'active'
         )
     and (p_user is distinct from auth.uid() or private.session_aal() = 'aal2');
$$;

-- ─── Applications (from the public form) ───────────────────────────────────
create sequence public.partnership_reference_seq;

create table public.partnership_applications (
  id                  uuid primary key default gen_random_uuid(),
  reference           text not null unique,
  -- Organisation
  org_name            text not null check (char_length(btrim(org_name)) between 2 and 200),
  org_type            public.partner_org_type not null,
  country             text not null check (char_length(btrim(country)) between 2 and 80),
  city                text check (char_length(city) <= 100),
  website             text check (char_length(website) <= 300),
  sector              text check (char_length(sector) <= 150),
  org_description     text not null check (char_length(btrim(org_description)) between 20 and 2000),
  -- Contact person
  contact_name        text not null check (char_length(btrim(contact_name)) between 2 and 150),
  contact_title       text not null check (char_length(btrim(contact_title)) between 2 and 150),
  contact_email       text not null check (char_length(contact_email) <= 254 and contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  contact_phone       text check (char_length(contact_phone) <= 40),
  -- Partnership interest
  intervention_field  text not null references public.intervention_fields (slug),
  contribution_type   public.partnership_contribution not null,
  contribution        text not null check (char_length(btrim(contribution)) between 10 and 2000),
  cooperation         text not null check (char_length(btrim(cooperation)) between 30 and 4000),
  timeline            text check (char_length(timeline) <= 150),
  extra               text check (char_length(extra) <= 2000),
  consent_at          timestamptz not null,
  -- Handling
  status              public.partnership_application_status not null default 'received',
  organization_id     uuid,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index partnership_applications_status_idx on public.partnership_applications (status, created_at desc);
create index partnership_applications_email_idx on public.partnership_applications (lower(contact_email), created_at desc);

-- ─── Organisations and contacts (CRM) ──────────────────────────────────────
create table public.partner_organizations (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (char_length(btrim(name)) between 2 and 200),
  org_type       public.partner_org_type not null,
  country        text check (char_length(country) <= 80),
  city           text check (char_length(city) <= 100),
  website        text check (char_length(website) <= 300),
  sector         text check (char_length(sector) <= 150),
  description    text check (char_length(description) <= 2000),
  fields         text[] not null default '{}',
  contributions  public.partnership_contribution[] not null default '{}',
  status         public.partner_pipeline_status not null default 'prospect',
  assigned_to    uuid references public.profiles (id) on delete set null,
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index partner_organizations_status_idx on public.partner_organizations (status, updated_at desc);

alter table public.partnership_applications
  add constraint partnership_applications_org_fk foreign key (organization_id)
  references public.partner_organizations (id) on delete set null;

create table public.partner_contacts (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.partner_organizations (id) on delete cascade,
  full_name        text not null check (char_length(btrim(full_name)) between 2 and 150),
  job_title        text check (char_length(job_title) <= 150),
  email            text check (email is null or (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  phone            text check (char_length(phone) <= 40),
  is_primary       boolean not null default false,
  created_at       timestamptz not null default now()
);
create index partner_contacts_org_idx on public.partner_contacts (organization_id);
create unique index partner_contacts_primary_idx on public.partner_contacts (organization_id) where is_primary;

-- ─── Documents, notes, history, follow-up tasks ────────────────────────────
create table public.partnership_documents (
  id               uuid primary key default gen_random_uuid(),
  application_id   uuid references public.partnership_applications (id) on delete cascade,
  organization_id  uuid references public.partner_organizations (id) on delete cascade,
  storage_path     text not null unique check (char_length(storage_path) <= 400),
  file_name        text not null check (char_length(file_name) between 1 and 200),
  mime_type        text not null check (mime_type = 'application/pdf'),
  file_size        integer not null check (file_size between 1 and 10485760),
  uploaded_by      uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  check ((application_id is null) <> (organization_id is null))
);
create index partnership_documents_app_idx on public.partnership_documents (application_id);
create index partnership_documents_org_idx on public.partnership_documents (organization_id);

-- Internal notes (meetings, calls…): never shown outside the partnership team.
create table public.partnership_notes (
  id               uuid primary key default gen_random_uuid(),
  application_id   uuid references public.partnership_applications (id) on delete cascade,
  organization_id  uuid references public.partner_organizations (id) on delete cascade,
  body             text not null check (char_length(btrim(body)) between 1 and 4000),
  author_id        uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  check ((application_id is null) <> (organization_id is null))
);
create index partnership_notes_app_idx on public.partnership_notes (application_id, created_at desc);
create index partnership_notes_org_idx on public.partnership_notes (organization_id, created_at desc);

-- Append-only status history (no write grant; written by functions only).
create table public.partnership_status_history (
  id               uuid primary key default gen_random_uuid(),
  application_id   uuid references public.partnership_applications (id) on delete cascade,
  organization_id  uuid references public.partner_organizations (id) on delete cascade,
  from_status      text,
  to_status        text not null,
  note             text check (char_length(note) <= 1000),
  changed_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  check ((application_id is null) <> (organization_id is null))
);
create index partnership_status_history_app_idx on public.partnership_status_history (application_id, created_at);
create index partnership_status_history_org_idx on public.partnership_status_history (organization_id, created_at);

create table public.partnership_tasks (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.partner_organizations (id) on delete cascade,
  title            text not null check (char_length(btrim(title)) between 2 and 200),
  due_on           date,
  assigned_to      uuid references public.profiles (id) on delete set null,
  done_at          timestamptz,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now()
);
create index partnership_tasks_open_idx on public.partnership_tasks (due_on) where done_at is null;
create index partnership_tasks_org_idx on public.partnership_tasks (organization_id);

-- ─── Row level security ────────────────────────────────────────────────────
-- Fields of intervention are readable by signed-in users (the public pages
-- use the verified texts of the code; anon reads no table at all);
-- everything else is read by the partnership team only. Nobody writes directly: see the functions below.
alter table public.intervention_fields        enable row level security;
alter table public.partnership_applications   enable row level security;
alter table public.partner_organizations      enable row level security;
alter table public.partner_contacts           enable row level security;
alter table public.partnership_documents      enable row level security;
alter table public.partnership_notes          enable row level security;
alter table public.partnership_status_history enable row level security;
alter table public.partnership_tasks          enable row level security;
alter table public.partnership_signatories    enable row level security;

-- Supabase grants new tables to anon/authenticated by default: start from nothing.
revoke all on public.intervention_fields, public.partnership_applications, public.partner_organizations,
  public.partner_contacts, public.partnership_documents, public.partnership_notes,
  public.partnership_status_history, public.partnership_tasks, public.partnership_signatories
  from anon, authenticated;
revoke all on sequence public.partnership_reference_seq from anon, authenticated;

create policy intervention_fields_select        on public.intervention_fields        for select to authenticated using (true);
create policy partnership_applications_select   on public.partnership_applications   for select to authenticated using (private.is_partnership_staff());
create policy partner_organizations_select      on public.partner_organizations      for select to authenticated using (private.is_partnership_staff());
create policy partner_contacts_select           on public.partner_contacts           for select to authenticated using (private.is_partnership_staff());
create policy partnership_documents_select      on public.partnership_documents      for select to authenticated using (private.is_partnership_staff());
create policy partnership_notes_select          on public.partnership_notes          for select to authenticated using (private.is_partnership_staff());
create policy partnership_status_history_select on public.partnership_status_history for select to authenticated using (private.is_partnership_staff());
create policy partnership_tasks_select          on public.partnership_tasks          for select to authenticated using (private.is_partnership_staff());
create policy partnership_signatories_select    on public.partnership_signatories    for select to authenticated using (private.is_partnership_staff());

grant select on public.intervention_fields to authenticated;
grant select on public.partnership_applications, public.partner_organizations, public.partner_contacts,
  public.partnership_documents, public.partnership_notes, public.partnership_status_history,
  public.partnership_tasks, public.partnership_signatories to authenticated;

-- ─── Private storage for proposals (PDF only) ──────────────────────────────
-- incoming/<hour>-<uuid>/… : uploaded by the public through a single-use
-- signed link, verified and moved by the server on submission.
-- applications/<application id>/… : verified documents.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('partnerships', 'partnerships', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

create policy partnerships_read on storage.objects
  for select to authenticated
  using (bucket_id = 'partnerships' and private.is_partnership_staff());

-- ─── Internal helpers ──────────────────────────────────────────────────────
create function private.partnership_history(p_app uuid, p_org uuid, p_from text, p_to text, p_note text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.partnership_status_history (application_id, organization_id, from_status, to_status, note, changed_by)
  values (p_app, p_org, p_from, p_to, nullif(btrim(coalesce(p_note, '')), ''), auth.uid());
$$;

-- Only known fields of intervention; unknown values raise invalid_input.
create function private.partner_fields(p jsonb)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v text[] := coalesce((select array_agg(distinct x) from jsonb_array_elements_text(coalesce(p, '[]'::jsonb)) x), '{}');
begin
  perform private.require(not exists (select 1 from unnest(v) f where f not in (select slug from public.intervention_fields)), 'invalid_input');
  return v;
end;
$$;

create function private.partner_contributions(p jsonb)
returns public.partnership_contribution[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select array_agg(distinct x::public.partnership_contribution)
                     from jsonb_array_elements_text(coalesce(p, '[]'::jsonb)) x), '{}');
$$;

-- ─── Public submission (service role only, after rate limiting) ────────────
-- p_documents: [{ "path": "applications/<p_id>/…", "name": "…", "mime": "application/pdf", "size": 123 }]
-- The server action verifies each file and moves it under the new id first
-- (the id is generated by the caller so files can be moved before insert).
create function public.submit_partnership_application(p_id uuid, p jsonb, p_documents jsonb default '[]'::jsonb)
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
  -- Same organisation and e-mail within 10 minutes: a double submission.
  select a.reference into v_existing
    from public.partnership_applications a
   where lower(a.contact_email) = v_email
     and lower(btrim(a.org_name)) = lower(btrim(p ->> 'org_name'))
     and a.created_at > now() - interval '10 minutes'
   limit 1;
  if v_existing is not null then
    return v_existing;
  end if;

  perform private.require(jsonb_array_length(coalesce(p_documents, '[]'::jsonb)) <= 3, 'invalid_input');
  perform private.require(exists (select 1 from public.intervention_fields f where f.slug = p ->> 'intervention_field' and f.active), 'invalid_input');

  v_ref := 'PART-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.partnership_reference_seq')::text, 4, '0');

  insert into public.partnership_applications (
    id, reference, org_name, org_type, country, city, website, sector, org_description,
    contact_name, contact_title, contact_email, contact_phone,
    intervention_field, contribution_type, contribution, cooperation, timeline, extra, consent_at
  ) values (
    p_id, v_ref,
    btrim(p ->> 'org_name'), (p ->> 'org_type')::public.partner_org_type, btrim(p ->> 'country'),
    nullif(btrim(coalesce(p ->> 'city', '')), ''), nullif(btrim(coalesce(p ->> 'website', '')), ''),
    nullif(btrim(coalesce(p ->> 'sector', '')), ''), btrim(p ->> 'org_description'),
    btrim(p ->> 'contact_name'), btrim(p ->> 'contact_title'), v_email,
    nullif(btrim(coalesce(p ->> 'contact_phone', '')), ''),
    p ->> 'intervention_field', (p ->> 'contribution_type')::public.partnership_contribution,
    btrim(p ->> 'contribution'), btrim(p ->> 'cooperation'),
    nullif(btrim(coalesce(p ->> 'timeline', '')), ''), nullif(btrim(coalesce(p ->> 'extra', '')), ''), now()
  );

  for v_doc in select * from jsonb_array_elements(coalesce(p_documents, '[]'::jsonb)) loop
    perform private.require((v_doc ->> 'path') like 'applications/' || p_id::text || '/%', 'invalid_input');
    perform private.require(v_doc ->> 'mime' = 'application/pdf', 'invalid_input');
    insert into public.partnership_documents (application_id, storage_path, file_name, mime_type, file_size)
    values (p_id, v_doc ->> 'path', left(v_doc ->> 'name', 200), v_doc ->> 'mime', (v_doc ->> 'size')::integer);
  end loop;

  perform private.partnership_history(p_id, null, null, 'received', null);
  perform private.log_audit('partnership_application_received', 'partnership_applications', p_id, null,
                            jsonb_build_object('reference', v_ref, 'field', p ->> 'intervention_field'));
  return v_ref;
end;
$$;

-- ─── Staff: application status ─────────────────────────────────────────────
-- received → under_review | declined | spam | withdrawn
-- under_review → declined | withdrawn  (accepted only through create_partner_from_application)
-- declined | withdrawn → under_review  (reopen)
create function public.set_partnership_application_status(p_app uuid, p_status text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from text;
begin
  perform private.require(private.is_partnership_staff(), 'forbidden');
  select status::text into v_from from public.partnership_applications where id = p_app for update;
  perform private.require(v_from is not null, 'not_found');
  perform private.require(
    (v_from = 'received' and p_status in ('under_review', 'declined', 'spam', 'withdrawn'))
    or (v_from = 'under_review' and p_status in ('declined', 'withdrawn'))
    or (v_from in ('declined', 'withdrawn') and p_status = 'under_review'),
    'invalid_transition');

  update public.partnership_applications
     set status = p_status::public.partnership_application_status, updated_at = now()
   where id = p_app;
  perform private.partnership_history(p_app, null, v_from, p_status, p_note);
  perform private.log_audit('partnership_application_status', 'partnership_applications', p_app, null,
                            jsonb_build_object('from', v_from, 'to', p_status));
end;
$$;

-- Turn an application into an organisation record (+ primary contact).
create function public.create_partner_from_application(p_app uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  a     public.partnership_applications;
  v_org uuid;
begin
  perform private.require(private.is_partnership_staff(), 'forbidden');
  select * into a from public.partnership_applications where id = p_app for update;
  perform private.require(a.id is not null, 'not_found');
  perform private.require(a.status::text in ('received', 'under_review'), 'invalid_transition');

  insert into public.partner_organizations (name, org_type, country, city, website, sector, description,
                                            fields, contributions, status, assigned_to, created_by)
  values (a.org_name, a.org_type, a.country, a.city, a.website, a.sector, a.org_description,
          array[a.intervention_field], array[a.contribution_type], 'proposal_received', auth.uid(), auth.uid())
  returning id into v_org;

  insert into public.partner_contacts (organization_id, full_name, job_title, email, phone, is_primary)
  values (v_org, a.contact_name, a.contact_title, a.contact_email, a.contact_phone, true);

  update public.partnership_applications
     set status = 'accepted', organization_id = v_org, updated_at = now()
   where id = p_app;

  perform private.partnership_history(p_app, null, a.status::text, 'accepted', null);
  perform private.partnership_history(null, v_org, null, 'proposal_received', 'Créée depuis la candidature ' || a.reference);
  perform private.log_audit('partner_created_from_application', 'partner_organizations', v_org, null,
                            jsonb_build_object('application', a.reference));
  return v_org;
end;
$$;

-- ─── Staff: organisations and contacts ─────────────────────────────────────
create function public.save_partner_organization(p_id uuid, p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := p_id;
begin
  perform private.require(private.is_partnership_staff(), 'forbidden');
  if v_id is null then
    insert into public.partner_organizations (name, org_type, country, city, website, sector, description,
                                              fields, contributions, assigned_to, created_by)
    values (btrim(p ->> 'name'), (p ->> 'org_type')::public.partner_org_type,
            nullif(btrim(coalesce(p ->> 'country', '')), ''), nullif(btrim(coalesce(p ->> 'city', '')), ''),
            nullif(btrim(coalesce(p ->> 'website', '')), ''), nullif(btrim(coalesce(p ->> 'sector', '')), ''),
            nullif(btrim(coalesce(p ->> 'description', '')), ''),
            private.partner_fields(p -> 'fields'), private.partner_contributions(p -> 'contributions'),
            auth.uid(), auth.uid())
    returning id into v_id;
    perform private.partnership_history(null, v_id, null, 'prospect', null);
    perform private.log_audit('partner_created', 'partner_organizations', v_id, null, '{}'::jsonb);
  else
    update public.partner_organizations
       set name = btrim(p ->> 'name'),
           org_type = (p ->> 'org_type')::public.partner_org_type,
           country = nullif(btrim(coalesce(p ->> 'country', '')), ''),
           city = nullif(btrim(coalesce(p ->> 'city', '')), ''),
           website = nullif(btrim(coalesce(p ->> 'website', '')), ''),
           sector = nullif(btrim(coalesce(p ->> 'sector', '')), ''),
           description = nullif(btrim(coalesce(p ->> 'description', '')), ''),
           fields = private.partner_fields(p -> 'fields'),
           contributions = private.partner_contributions(p -> 'contributions'),
           updated_at = now()
     where id = v_id;
    perform private.require(found, 'not_found');
    perform private.log_audit('partner_updated', 'partner_organizations', v_id, null, '{}'::jsonb);
  end if;
  return v_id;
end;
$$;

-- Pipeline rules (brief V2 §7 and §10):
--   any staff     prospect … negotiation, withdrawn; rejected (before validation)
--   manager       institutional_validation (recommends, from evaluation or negotiation)
--   approver 2FA  agreement_signed or rejected (from institutional_validation)
--   any staff     implementation (from signed), monitoring (from implementation),
--                 renewal_or_closure (from implementation or monitoring)
-- Once a partnership is under validation or signed, the early steps are closed.
create function public.set_partner_status(p_org uuid, p_status text, p_note text default null)
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
  select status::text into v_from from public.partner_organizations where id = p_org for update;
  perform private.require(v_from is not null, 'not_found');
  perform private.require(p_status is distinct from v_from, 'invalid_transition');
  v_locked := v_from in ('institutional_validation', 'agreement_signed', 'implementation', 'monitoring', 'renewal_or_closure');

  if p_status in ('prospect', 'first_contact', 'interest_confirmed', 'proposal_received', 'evaluation', 'negotiation', 'withdrawn') then
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

create function public.save_partner_contact(p_id uuid, p_org uuid, p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id      uuid := p_id;
  v_primary boolean := coalesce((p ->> 'is_primary')::boolean, false);
begin
  perform private.require(private.is_partnership_staff(), 'forbidden');
  perform private.require(exists (select 1 from public.partner_organizations where id = p_org), 'not_found');
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

create function public.delete_partner_contact(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  perform private.require(private.is_partnership_staff(), 'forbidden');
  delete from public.partner_contacts where id = p_id returning organization_id into v_org;
  perform private.require(v_org is not null, 'not_found');
  perform private.log_audit('partner_contact_deleted', 'partner_organizations', v_org, null, '{}'::jsonb);
end;
$$;

create function public.add_partnership_note(p_application uuid, p_organization uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.require(private.is_partnership_staff(), 'forbidden');
  perform private.require((p_application is null) <> (p_organization is null), 'invalid_input');
  perform private.require(char_length(btrim(coalesce(p_body, ''))) between 1 and 4000, 'invalid_input');
  insert into public.partnership_notes (application_id, organization_id, body, author_id)
  values (p_application, p_organization, btrim(p_body), auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

-- ─── Staff: follow-up tasks ────────────────────────────────────────────────
create function public.save_partnership_task(p_id uuid, p_org uuid, p_title text, p_due_on date, p_assigned_to uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := p_id;
begin
  perform private.require(private.is_partnership_staff(), 'forbidden');
  perform private.require(char_length(btrim(coalesce(p_title, ''))) between 2 and 200, 'invalid_input');
  -- Tasks are assigned to partnership staff only.
  perform private.require(
    p_assigned_to is null
    or coalesce(private.platform_role(p_assigned_to) in ('sanady_admin', 'partnership_coordinator', 'partnership_manager'), false),
    'invalid_input');
  if v_id is null then
    perform private.require(exists (select 1 from public.partner_organizations where id = p_org), 'not_found');
    insert into public.partnership_tasks (organization_id, title, due_on, assigned_to, created_by)
    values (p_org, btrim(p_title), p_due_on, coalesce(p_assigned_to, auth.uid()), auth.uid())
    returning id into v_id;
  else
    update public.partnership_tasks
       set title = btrim(p_title), due_on = p_due_on, assigned_to = p_assigned_to
     where id = v_id and organization_id = p_org;
    perform private.require(found, 'not_found');
  end if;
  return v_id;
end;
$$;

create function public.set_partnership_task_done(p_id uuid, p_done boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require(private.is_partnership_staff(), 'forbidden');
  update public.partnership_tasks set done_at = case when p_done then now() end where id = p_id;
  perform private.require(found, 'not_found');
end;
$$;

-- ─── SANADY administrators: roles and approvers ────────────────────────────
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
  perform private.require(p_role is null or p_role in ('training_manager', 'trainer', 'partnership_coordinator', 'partnership_manager'), 'invalid_input');
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

-- An approver must be able to reach the partnership area (administrator or
-- partnership role) and is never appointed by themself.
create function public.set_partnership_signatory(p_user uuid, p_active boolean)
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
      coalesce(private.platform_role(p_user) in ('sanady_admin', 'partnership_coordinator', 'partnership_manager'), false),
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

-- ─── Retention ─────────────────────────────────────────────────────────────
-- Applications that did not lead to a partnership (declined, withdrawn,
-- spam) are deleted 24 months after their last change. The server removes
-- their files first (storage API), then calls this purge.
create function public.purge_partnership_applications(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from public.partnership_applications
   where id = any (p_ids)
     and status::text in ('declined', 'withdrawn', 'spam')
     and updated_at < now() - interval '24 months';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ─── Grants ────────────────────────────────────────────────────────────────
revoke execute on function
  public.submit_partnership_application(uuid, jsonb, jsonb),
  public.purge_partnership_applications(uuid[])
  from public, anon, authenticated;
grant execute on function
  public.submit_partnership_application(uuid, jsonb, jsonb),
  public.purge_partnership_applications(uuid[])
  to service_role;

revoke execute on function
  public.set_partnership_application_status(uuid, text, text),
  public.create_partner_from_application(uuid),
  public.save_partner_organization(uuid, jsonb),
  public.set_partner_status(uuid, text, text),
  public.save_partner_contact(uuid, uuid, jsonb),
  public.delete_partner_contact(uuid),
  public.add_partnership_note(uuid, uuid, text),
  public.save_partnership_task(uuid, uuid, text, date, uuid),
  public.set_partnership_task_done(uuid, boolean),
  public.set_partnership_signatory(uuid, boolean)
  from public, anon;
grant execute on function
  public.set_partnership_application_status(uuid, text, text),
  public.create_partner_from_application(uuid),
  public.save_partner_organization(uuid, jsonb),
  public.set_partner_status(uuid, text, text),
  public.save_partner_contact(uuid, uuid, jsonb),
  public.delete_partner_contact(uuid),
  public.add_partnership_note(uuid, uuid, text),
  public.save_partnership_task(uuid, uuid, text, date, uuid),
  public.set_partnership_task_done(uuid, boolean),
  public.set_partnership_signatory(uuid, boolean)
  to authenticated;

revoke execute on function
  private.is_partnership_staff(uuid),
  private.is_partnership_manager(uuid),
  private.is_partnership_signatory(uuid),
  private.partnership_history(uuid, uuid, text, text, text),
  private.partner_fields(jsonb),
  private.partner_contributions(jsonb)
  from public, anon, authenticated;
-- Helpers evaluated inside RLS policies (tables and storage).
grant execute on function
  private.is_partnership_staff(uuid),
  private.is_partnership_manager(uuid),
  private.is_partnership_signatory(uuid)
to authenticated;
