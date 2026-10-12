-- ════════════════════════════════════════════════════════════════════════════
-- Partnership and enterprise staff can see the names of other staff members
-- (accounts holding a platform role), so that histories and approvals show
-- who decided. Teachers' profiles stay invisible to them.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function private.can_view_profile(p_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_profile = auth.uid()
      or private.is_course_staff()
      or exists (
           select 1 from public.institution_memberships m
            where m.user_id = p_profile
              and m.status = 'active'
              and m.institution_id in (select private.supervised_institutions())
         )
      or exists (
           select 1
             from public.enrollments e
             join public.course_trainers ct on ct.course_id = e.course_id and ct.user_id = auth.uid()
            where e.user_id = p_profile
              and private.platform_role() = 'trainer'
         )
      or (
           (private.is_partnership_staff() or private.is_enterprise_staff())
           and exists (select 1 from public.platform_roles pr where pr.user_id = p_profile)
         );
$$;
