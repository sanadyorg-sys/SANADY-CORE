-- ════════════════════════════════════════════════════════════════════════════
-- SANADY · 0002 · Institutions, memberships, invitations, enrollment codes
-- ════════════════════════════════════════════════════════════════════════════

create type public.institution_type as enum (
  'ecole_primaire',
  'college',
  'lycee',
  'groupe_scolaire',
  'etablissement_superieur',
  'centre_formation',
  'direction_provinciale',
  'association',
  'autre'
);

create type public.membership_role    as enum ('admin', 'teacher');
create type public.membership_status  as enum ('active', 'revoked');
create type public.membership_source  as enum ('invitation', 'code', 'admin');
create type public.invitation_kind    as enum ('platform_admin', 'teacher', 'institution_admin', 'institution_teacher');

-- ─── Institutions ──────────────────────────────────────────────────────────
create table public.institutions (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (char_length(btrim(name)) between 2 and 200),
  identifier     text not null unique check (identifier ~ '^[A-Z0-9][A-Z0-9-]{1,39}$'),
  type           public.institution_type not null,
  city           text check (char_length(city) <= 120),
  contact_email  text not null check (contact_email = lower(contact_email) and contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  contact_phone  text check (char_length(contact_phone) <= 30),
  status         public.account_status not null default 'active',
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on column public.institutions.identifier is
  'Human-readable unique identifier, e.g. LYC-CASA-012 (uppercase letters, digits and dashes).';

create index institutions_name_idx on public.institutions (lower(name));

create trigger institutions_updated_at
  before update on public.institutions
  for each row execute function private.set_updated_at();

create trigger institutions_audit
  after insert or update or delete on public.institutions
  for each row execute function private.audit_row_change('name', 'id');

-- ─── Enrollment codes ──────────────────────────────────────────────────────
create table public.enrollment_codes (
  id              uuid primary key default gen_random_uuid(),
  institution_id  uuid not null references public.institutions (id) on delete cascade,
  code            text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$'),
  label           text check (char_length(label) <= 120),
  max_uses        integer not null check (max_uses between 1 and 5000),
  uses_count      integer not null default 0 check (uses_count >= 0),
  expires_at      timestamptz not null,
  revoked_at      timestamptz,
  revoked_by      uuid references public.profiles (id) on delete set null,
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  check (uses_count <= max_uses)
);

create index enrollment_codes_institution_idx on public.enrollment_codes (institution_id, created_at desc);

create trigger enrollment_codes_audit
  after insert or update on public.enrollment_codes
  for each row execute function private.audit_row_change('label', 'institution_id');

-- ─── Institution memberships ───────────────────────────────────────────────
-- Membership is independent from the personal account and from course
-- enrollment. Revoking a membership never deletes the teacher's own history.
create table public.institution_memberships (
  id                  uuid primary key default gen_random_uuid(),
  institution_id      uuid not null references public.institutions (id) on delete cascade,
  user_id             uuid not null references public.profiles (id) on delete cascade,
  role                public.membership_role not null,
  status              public.membership_status not null default 'active',
  source              public.membership_source not null,
  enrollment_code_id  uuid references public.enrollment_codes (id) on delete set null,
  consented_at        timestamptz,
  created_at          timestamptz not null default now(),
  revoked_at          timestamptz,
  revoked_by          uuid references public.profiles (id) on delete set null,
  unique (institution_id, user_id),
  -- A teacher must explicitly consent to share assigned-course progress.
  check (role <> 'teacher' or consented_at is not null),
  check ((status = 'revoked') = (revoked_at is not null))
);

create index memberships_user_idx        on public.institution_memberships (user_id) where status = 'active';
create index memberships_institution_idx on public.institution_memberships (institution_id, role) where status = 'active';

create trigger memberships_audit
  after insert or update or delete on public.institution_memberships
  for each row execute function private.audit_row_change('role', 'institution_id');

-- ─── Invitations ───────────────────────────────────────────────────────────
-- The raw token is NEVER stored: only its SHA-256 hash. The raw token exists
-- only in the e-mail link.
create table public.invitations (
  id                  uuid primary key default gen_random_uuid(),
  kind                public.invitation_kind not null,
  email               text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  institution_id      uuid references public.institutions (id) on delete cascade,
  enrollment_code_id  uuid references public.enrollment_codes (id) on delete set null,
  token_hash          text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  invited_by          uuid references public.profiles (id) on delete set null,
  expires_at          timestamptz not null,
  email_sent_at       timestamptz,
  accepted_at         timestamptz,
  accepted_by         uuid references public.profiles (id) on delete set null,
  revoked_at          timestamptz,
  revoked_by          uuid references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),
  check ((kind in ('institution_admin', 'institution_teacher')) = (institution_id is not null)),
  check (enrollment_code_id is null or kind = 'institution_teacher'),
  check (not (accepted_at is not null and revoked_at is not null))
);

-- At most one open invitation per (kind, e-mail, institution).
create unique index invitations_one_open_idx
  on public.invitations (kind, email, coalesce(institution_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where accepted_at is null and revoked_at is null;

create index invitations_institution_idx on public.invitations (institution_id, created_at desc);
create index invitations_email_idx       on public.invitations (email);

create trigger invitations_audit
  after insert or update on public.invitations
  for each row execute function private.audit_row_change('kind', 'institution_id');

-- ─── Helpers ───────────────────────────────────────────────────────────────
create function private.is_institution_admin(p_institution uuid, p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.institution_memberships m
      join public.institutions i on i.id = m.institution_id
      join public.profiles p     on p.id = m.user_id
     where m.institution_id = p_institution
       and m.user_id = p_user
       and m.role = 'admin'
       and m.status = 'active'
       and i.status = 'active'
       and p.status = 'active'
  );
$$;

create function private.is_institution_member(p_institution uuid, p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.institution_memberships m
     where m.institution_id = p_institution
       and m.user_id = p_user
       and m.status = 'active'
  );
$$;

-- Institutions administered by the current user (used to scope profile reads).
create function private.administered_institutions(p_user uuid default auth.uid())
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.institution_id
    from public.institution_memberships m
    join public.institutions i on i.id = m.institution_id
   where m.user_id = p_user
     and m.role = 'admin'
     and m.status = 'active'
     and i.status = 'active';
$$;
