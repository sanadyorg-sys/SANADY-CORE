-- ════════════════════════════════════════════════════════════════════════════
-- Studio: the trainers of a project's course, for everyone who reads the
-- project (course_trainers itself stays readable by course staff and the
-- trainer concerned only). Found during the E4 end-to-end test: production
-- managers saw « no trainer » on projects that had one.
-- ════════════════════════════════════════════════════════════════════════════

create function public.project_trainers(p_project uuid)
returns table (id uuid, full_name text, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select pr.id, pr.full_name, pr.email
    from public.training_projects p
    join public.course_trainers ct on ct.course_id = p.course_id
    join public.profiles pr on pr.id = ct.user_id
   where p.id = p_project and private.can_read_training(p_project)
   order by coalesce(pr.full_name, pr.email);
$$;

revoke execute on function public.project_trainers(uuid) from public, anon;
grant execute on function public.project_trainers(uuid) to authenticated;
