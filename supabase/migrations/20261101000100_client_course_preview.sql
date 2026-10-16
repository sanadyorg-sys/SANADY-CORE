-- ════════════════════════════════════════════════════════════════════════════
-- SANADY Enterprise — the client previews the actual course (brief V3 §13:
-- client review of the content, not only the programme)
--
-- While a custom-training project awaits the client's review (or the final
-- approval), the company's administrators can open the draft course behind
-- it, read-only: modules, lessons with their videos, PDFs and attached
-- files, and the evaluation questions — never the correct answers. Nothing
-- is recorded (no progress, no attempt). These rules ADD read access for
-- that case only; the existing rules are unchanged.
-- ════════════════════════════════════════════════════════════════════════════

create function private.can_preview_course(p_course uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_course is not null and exists (
    select 1 from public.training_projects p
      join public.enterprise_tenants t on t.id = p.tenant_id
     where p.course_id = p_course
       and p.status in ('client_review', 'approval')
       and t.institution_id is not null
       and private.is_institution_admin(t.institution_id));
$$;
revoke execute on function private.can_preview_course(uuid) from public, anon;
grant execute on function private.can_preview_course(uuid) to authenticated;

-- Read-only access to the course structure (no answer table is opened).
create policy courses_client_preview on public.courses for select to authenticated using (private.can_preview_course(id));
create policy modules_client_preview on public.modules for select to authenticated using (private.can_preview_course(course_id));
create policy lessons_client_preview on public.lessons for select to authenticated using (private.can_preview_course(course_id));
create policy quizzes_client_preview on public.quizzes for select to authenticated using (private.can_preview_course(course_id));
create policy lesson_resources_client_preview on public.lesson_resources for select to authenticated
  using (exists (select 1 from public.lessons l where l.id = lesson_id and private.can_preview_course(l.course_id)));

-- Videos, PDFs and attached files of that course.
create policy course_media_client_preview on storage.objects for select to authenticated
  using (bucket_id = 'course-media' and private.can_preview_course(private.try_uuid((storage.foldername(name))[1])));

-- The preview: outline and questions, labels only (no correctness, no explanation).
create function public.client_course_preview(p_project uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_course uuid;
  v_title  text;
  v_status text;
begin
  select p.course_id, p.title, p.status::text into v_course, v_title, v_status from public.training_projects p where p.id = p_project;
  perform private.require(private.can_preview_course(v_course), 'forbidden');
  return jsonb_build_object(
    'project_id', p_project, 'project_title', v_title, 'status', v_status, 'course_id', v_course,
    'course_title', (select title from public.courses where id = v_course),
    'description', (select description from public.courses where id = v_course),
    'modules', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', m.id, 'title', m.title, 'description', nullif(m.description, ''),
               'lessons', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'title', l.title, 'kind', l.kind,
                                                                          'minutes', coalesce(l.estimated_minutes, ceil(l.video_duration_seconds / 60.0)::integer),
                                                                          'pages', l.pdf_page_count) order by l.position)
                                      from public.lessons l where l.module_id = m.id and l.archived_at is null), '[]'::jsonb),
               'quiz', (select jsonb_build_object('id', q.id, 'title', q.title,
                         'questions', coalesce((select jsonb_agg(jsonb_build_object('prompt', qu.prompt, 'kind', qu.kind,
                                                  'options', coalesce((select jsonb_agg(o.label order by o.position) from public.question_options o where o.question_id = qu.id), '[]'::jsonb))
                                                  order by qu.position)
                                                from public.questions qu where qu.quiz_id = q.id and qu.archived_at is null), '[]'::jsonb))
                          from public.quizzes q where q.module_id = m.id)
             ) order by m.position)
        from public.modules m where m.course_id = v_course and m.archived_at is null), '[]'::jsonb));
end;
$$;
revoke execute on function public.client_course_preview(uuid) from public, anon;
grant execute on function public.client_course_preview(uuid) to authenticated;

-- The company's project list now says when the content can be previewed.
drop function public.workspace_training_projects(uuid);
create function public.workspace_training_projects(p_institution uuid)
returns table (id uuid, reference text, title text, status public.training_project_status, version integer,
               objectives text, target_audience text, outline jsonb, client_review_required boolean, due_on date, can_preview boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.reference, p.title, p.status, p.version, p.objectives, p.target_audience,
         coalesce((select jsonb_agg(jsonb_build_object('title', o.title, 'description', o.description) order by o.position)
                     from public.training_outline o where o.project_id = p.id), '[]'::jsonb),
         p.client_review_required, p.due_on,
         private.can_preview_course(p.course_id)
    from public.training_projects p
    join public.enterprise_tenants t on t.id = p.tenant_id
   where t.institution_id = p_institution
     and private.is_institution_admin(p_institution)
     and p.status <> 'cancelled'
   order by p.updated_at desc;
$$;
revoke execute on function public.workspace_training_projects(uuid) from public, anon;
grant execute on function public.workspace_training_projects(uuid) to authenticated;
