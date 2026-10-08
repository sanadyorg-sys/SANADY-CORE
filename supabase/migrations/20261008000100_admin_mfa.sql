-- ════════════════════════════════════════════════════════════════════════════
-- SANADY · Administrator two-factor authentication, enforced in the database
--
-- A SANADY administrator's privileges now require a session verified with a
-- second factor (JWT claim aal = 'aal2'). A stolen password alone yields an
-- aal1 session: every admin policy and function then behaves as for a
-- regular user. The application guides administrators through TOTP
-- enrollment and verification (src/app/(public)/securite).
-- ════════════════════════════════════════════════════════════════════════════

create or replace function private.session_aal()
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'aal',
    ''
  );
$$;

create or replace function private.is_sanady_admin(p_user uuid default auth.uid())
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
  )
  -- When checking the CURRENT user, a second factor is mandatory.
  and (p_user is distinct from auth.uid() or private.session_aal() = 'aal2');
$$;

grant execute on function private.session_aal() to authenticated, service_role;
revoke execute on function private.session_aal() from public, anon;
