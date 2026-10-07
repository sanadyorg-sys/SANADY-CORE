-- ════════════════════════════════════════════════════════════════════════════
-- SANADY · 0001 · Foundation
-- Profiles, platform roles, platform settings, audit log, rate limiting and
-- the shared helper functions used by every Row Level Security policy.
--
-- Conventions
--   * Every table uses UUID primary keys (gen_random_uuid()).
--   * Internal helpers live in the `private` schema, which is NOT exposed by
--     the Supabase Data API. Callable RPCs live in `public`.
--   * SECURITY DEFINER functions always pin `search_path = ''` and use fully
--     qualified names to prevent search-path hijacking.
-- ════════════════════════════════════════════════════════════════════════════

create schema if not exists private;
grant usage on schema private to authenticated, service_role;

-- ─── Enumerations ───────────────────────────────────────────────────────────
create type public.account_status as enum ('active', 'suspended');
create type public.platform_role  as enum ('sanady_admin');

-- ─── Generic trigger: maintain updated_at ──────────────────────────────────
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ─── Profiles (1:1 with auth.users) ────────────────────────────────────────
create table public.profiles (
  id                       uuid primary key references auth.users (id) on delete cascade,
  email                    text not null unique check (email = lower(email)),
  first_name               text not null default '' check (char_length(first_name) <= 100),
  last_name                text not null default '' check (char_length(last_name) <= 100),
  full_name                text generated always as (btrim(first_name || ' ' || last_name)) stored,
  job_title                text check (char_length(job_title) <= 150),
  subject_area             text check (char_length(subject_area) <= 150),
  phone                    text check (char_length(phone) <= 30),
  status                   public.account_status not null default 'active',
  privacy_acknowledged_at  timestamptz,
  onboarded_at             timestamptz,
  last_seen_at             timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

comment on table public.profiles is
  'One personal account per person. Institutional membership is stored separately and never owns the profile.';

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- Create the profile automatically when Supabase Auth creates a user.
create function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, first_name, last_name)
  values (
    new.id,
    lower(new.email),
    coalesce(left(new.raw_user_meta_data ->> 'first_name', 100), ''),
    coalesce(left(new.raw_user_meta_data ->> 'last_name', 100), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_auth_user();

create function private.handle_auth_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = lower(new.email) where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function private.handle_auth_user_email_change();

-- ─── Platform roles ────────────────────────────────────────────────────────
create table public.platform_roles (
  user_id     uuid primary key references public.profiles (id) on delete cascade,
  role        public.platform_role not null default 'sanady_admin',
  granted_by  uuid references public.profiles (id) on delete set null,
  granted_at  timestamptz not null default now()
);

-- ─── Platform settings (typed singleton) ───────────────────────────────────
create table public.platform_settings (
  id                            boolean primary key default true check (id),
  inactivity_threshold_days     smallint not null default 14 check (inactivity_threshold_days between 3 and 180),
  invitation_validity_days      smallint not null default 7  check (invitation_validity_days between 1 and 30),
  certificate_issuer_name       text not null default 'SANADY' check (char_length(certificate_issuer_name) between 2 and 120),
  certificate_signatory_name    text check (char_length(certificate_signatory_name) <= 120),
  certificate_signatory_title   text check (char_length(certificate_signatory_title) <= 120),
  support_email                 text check (support_email = lower(support_email)),
  updated_by                    uuid references public.profiles (id) on delete set null,
  updated_at                    timestamptz not null default now()
);

insert into public.platform_settings (id) values (true);

create trigger platform_settings_updated_at
  before update on public.platform_settings
  for each row execute function private.set_updated_at();

-- ─── Audit log (append-only) ───────────────────────────────────────────────
create table public.audit_logs (
  id              uuid primary key default gen_random_uuid(),
  actor_id        uuid references public.profiles (id) on delete set null,
  action          text not null check (char_length(action) <= 80),
  entity_type     text not null check (char_length(entity_type) <= 60),
  entity_id       uuid,
  institution_id  uuid,
  details         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index audit_logs_created_at_idx   on public.audit_logs (created_at desc);
create index audit_logs_entity_idx       on public.audit_logs (entity_type, entity_id);
create index audit_logs_actor_idx        on public.audit_logs (actor_id, created_at desc);
create index audit_logs_institution_idx  on public.audit_logs (institution_id, created_at desc) where institution_id is not null;

create function private.log_audit(
  p_action          text,
  p_entity_type     text,
  p_entity_id       uuid,
  p_institution_id  uuid default null,
  p_details         jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, institution_id, details)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, p_institution_id, coalesce(p_details, '{}'::jsonb));
$$;

-- Generic row-change audit trigger. Records WHAT changed (column names and a
-- human label), never full row contents, to keep personal data out of logs.
-- tg_argv[0] = column used as human-readable label (optional)
-- tg_argv[1] = column holding the institution id (optional)
create function private.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row       jsonb;
  v_old       jsonb;
  v_changed   jsonb;
  v_label_col text := nullif(tg_argv[0], '');
  v_inst_col  text := nullif(tg_argv[1], '');
  v_details   jsonb;
begin
  if tg_op = 'DELETE' then
    v_row := to_jsonb(old);
  else
    v_row := to_jsonb(new);
  end if;

  if tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    select coalesce(jsonb_agg(n.key order by n.key), '[]'::jsonb)
      into v_changed
      from jsonb_each(v_row) as n
     where n.key not in ('updated_at')
       and n.value is distinct from (v_old -> n.key);
    if v_changed = '[]'::jsonb then
      return new;
    end if;
    v_details := jsonb_build_object('changed', v_changed);
  else
    v_details := '{}'::jsonb;
  end if;

  if v_label_col is not null and v_row ? v_label_col then
    v_details := v_details || jsonb_build_object('label', left(v_row ->> v_label_col, 200));
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, institution_id, details)
  values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    private.try_uuid(v_row ->> 'id'),
    case when v_inst_col is not null then private.try_uuid(v_row ->> v_inst_col) end,
    v_details
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- ─── Rate limiting (fixed window, works across serverless instances) ───────
create table private.rate_limits (
  key               text primary key,
  window_started_at timestamptz not null,
  hits              integer not null
);

create function public.consume_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hits integer;
begin
  insert into private.rate_limits as rl (key, window_started_at, hits)
  values (p_key, now(), 1)
  on conflict (key) do update
    set hits = case
                 when rl.window_started_at < now() - make_interval(secs => p_window_seconds) then 1
                 else rl.hits + 1
               end,
        window_started_at = case
                 when rl.window_started_at < now() - make_interval(secs => p_window_seconds) then now()
                 else rl.window_started_at
               end
  returning hits into v_hits;

  return v_hits <= p_limit;
end;
$$;

comment on function public.consume_rate_limit is
  'Server-side only (service role). Returns false once p_limit hits are exceeded within the window.';

-- ─── Identity helpers used by RLS policies ─────────────────────────────────
create function private.is_active_user(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p where p.id = p_user and p.status = 'active'
  );
$$;

create function private.is_sanady_admin(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.platform_roles pr
      join public.profiles p on p.id = pr.user_id
     where pr.user_id = p_user
       and pr.role = 'sanady_admin'
       and p.status = 'active'
  );
$$;

-- Raises a uniform permission error. Messages are stable codes that the
-- application maps to French copy; they never leak internal details.
create function private.require(p_condition boolean, p_code text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_condition is not true then
    raise exception using errcode = 'P0001', message = p_code;
  end if;
end;
$$;

-- Safe UUID parse (returns NULL instead of raising), used by storage policies.
create function private.try_uuid(p_text text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return p_text::uuid;
exception when others then
  return null;
end;
$$;

-- ─── Audit triggers for foundation tables ──────────────────────────────────
create trigger platform_roles_audit
  after insert or update or delete on public.platform_roles
  for each row execute function private.audit_row_change('role');

create trigger platform_settings_audit
  after update on public.platform_settings
  for each row execute function private.audit_row_change();
