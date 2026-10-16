-- ════════════════════════════════════════════════════════════════════════════
-- SANADY Enterprise — restore an earlier version of a custom course
-- (brief V3 §13: versions of the training content)
--
-- Each institutional approval freezes a copy of the course (training_versions).
-- The production team can now bring a frozen version back while a new version
-- is being prepared (project in design or production). The course is then
-- reviewed and approved again, as for any change.
--   • Snapshots now hold every field needed (lesson text, durations, video
--     provider, pages, quiz settings, explanations). Older snapshots are
--     completed from the course's own archived lessons.
--   • Lessons are REUSED when the same video or PDF is found in the course
--     (archived or not): employees' progress and history are kept. Nothing
--     is deleted: what the version does not contain is archived.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function private.course_snapshot(p_course uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'format', 2,
    'title', c.title, 'summary', c.summary, 'description', c.description, 'objectives', to_jsonb(c.objectives),
    'estimated_minutes', c.estimated_minutes, 'status', c.status,
    'modules', coalesce((
      select jsonb_agg(jsonb_build_object(
        'title', m.title, 'description', m.description,
        'lessons', coalesce((
          select jsonb_agg(jsonb_build_object('title', l.title, 'description', l.description, 'kind', l.kind, 'mandatory', l.is_mandatory,
                                              'estimated_minutes', l.estimated_minutes, 'video_provider', l.video_provider, 'video_ref', l.video_ref,
                                              'video_duration_seconds', l.video_duration_seconds, 'pdf_path', l.pdf_path, 'pdf_page_count', l.pdf_page_count,
                                              'completion_threshold', l.completion_threshold) order by l.position)
            from public.lessons l where l.module_id = m.id and l.archived_at is null), '[]'::jsonb),
        'quiz', (
          select jsonb_build_object('title', q.title, 'instructions', q.instructions, 'pass_threshold', q.pass_threshold, 'max_attempts', q.max_attempts,
            'shuffle_questions', q.shuffle_questions, 'shuffle_options', q.shuffle_options,
            'questions', coalesce((
              select jsonb_agg(jsonb_build_object('prompt', qu.prompt, 'kind', qu.kind, 'points', qu.points, 'explanation', qu.explanation,
                'options', (select jsonb_agg(jsonb_build_object('label', o.label, 'correct', o.is_correct) order by o.position)
                              from public.question_options o where o.question_id = qu.id)) order by qu.position)
                from public.questions qu where qu.quiz_id = q.id and qu.archived_at is null), '[]'::jsonb))
            from public.quizzes q where q.module_id = m.id)
      ) order by m.position)
        from public.modules m where m.course_id = c.id and m.archived_at is null), '[]'::jsonb)
  )
  from public.courses c where c.id = p_course;
$$;

create function public.restore_training_version(p_project uuid, p_version integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  p         public.training_projects;
  s         jsonb;
  v_now     timestamptz := now();
  v_mod     jsonb;
  v_les     jsonb;
  v_qu      jsonb;
  v_opt     jsonb;
  v_mi      integer := 0;
  v_li      integer;
  v_qi      integer;
  v_oi      integer;
  v_module  uuid;
  v_lesson  uuid;
  v_quiz    uuid;
  v_qid     uuid;
  v_src     public.lessons;
  v_used    uuid[] := '{}';
  v_mused   uuid[] := '{}';
  v_reused  integer := 0;
  v_created integer := 0;
  v_qcount  integer := 0;
begin
  perform private.require(private.can_manage_training(), 'forbidden');
  select * into p from public.training_projects where id = p_project for update;
  perform private.require(p.id is not null, 'not_found');
  perform private.require(p.course_id is not null and p.status in ('design', 'production'), 'invalid_transition');
  select snapshot into s from public.training_versions where project_id = p_project and version = p_version;
  perform private.require(s is not null, 'not_found');

  -- Course text.
  update public.courses
     set title = coalesce(s ->> 'title', title), summary = coalesce(s ->> 'summary', summary),
         description = coalesce(s ->> 'description', description),
         objectives = case when jsonb_typeof(s -> 'objectives') = 'array' then array(select jsonb_array_elements_text(s -> 'objectives')) else objectives end,
         estimated_minutes = case when s ? 'estimated_minutes' then (s ->> 'estimated_minutes')::integer else estimated_minutes end
   where id = p.course_id;

  -- Everything current is archived first; what the version contains comes back.
  update public.lessons set archived_at = v_now where course_id = p.course_id and archived_at is null;
  update public.modules set archived_at = v_now where course_id = p.course_id and archived_at is null;

  for v_mod in select value from jsonb_array_elements(s -> 'modules') loop
    -- Reuse a module of the course with the same title, else create it.
    select id into v_module from public.modules
     where course_id = p.course_id and title = v_mod ->> 'title' and not (id = any (v_mused))
     order by updated_at desc limit 1;
    if v_module is null then
      insert into public.modules (course_id, title, description, position)
      values (p.course_id, v_mod ->> 'title', coalesce(v_mod ->> 'description', ''), v_mi) returning id into v_module;
    else
      update public.modules set archived_at = null, position = v_mi, description = coalesce(v_mod ->> 'description', description) where id = v_module;
    end if;
    v_mused := v_mused || v_module;

    v_li := 0;
    for v_les in select value from jsonb_array_elements(v_mod -> 'lessons') loop
      -- The same video or PDF in this course (archived or not) keeps employees' progress.
      v_src := null;
      select * into v_src from public.lessons
       where course_id = p.course_id and kind::text = v_les ->> 'kind' and not (id = any (v_used))
         and ((v_les ->> 'video_ref' is not null and video_ref = v_les ->> 'video_ref')
           or (v_les ->> 'pdf_path' is not null and pdf_path = v_les ->> 'pdf_path')
           or (v_les ->> 'video_ref' is null and v_les ->> 'pdf_path' is null and title = v_les ->> 'title'))
       order by updated_at desc limit 1;
      if v_src.id is not null then
        update public.lessons
           set archived_at = null, module_id = v_module, position = v_li, title = v_les ->> 'title',
               description = coalesce(v_les ->> 'description', description),
               is_mandatory = coalesce((v_les ->> 'mandatory')::boolean, is_mandatory),
               estimated_minutes = case when v_les ? 'estimated_minutes' then (v_les ->> 'estimated_minutes')::integer else estimated_minutes end,
               completion_threshold = case when v_les ? 'completion_threshold' then (v_les ->> 'completion_threshold')::numeric else completion_threshold end
         where id = v_src.id;
        v_lesson := v_src.id;
        v_reused := v_reused + 1;
      else
        insert into public.lessons (module_id, course_id, title, description, kind, position, is_mandatory, estimated_minutes,
                                    video_provider, video_ref, video_duration_seconds, pdf_path, pdf_page_count, completion_threshold)
        values (v_module, p.course_id, v_les ->> 'title', coalesce(v_les ->> 'description', ''), (v_les ->> 'kind')::public.lesson_kind, v_li,
                coalesce((v_les ->> 'mandatory')::boolean, true), (v_les ->> 'estimated_minutes')::integer,
                case when v_les ->> 'kind' = 'video' then (coalesce(v_les ->> 'video_provider', 'storage'))::public.video_provider end,
                v_les ->> 'video_ref', (v_les ->> 'video_duration_seconds')::integer,
                v_les ->> 'pdf_path', (v_les ->> 'pdf_page_count')::integer, (v_les ->> 'completion_threshold')::numeric)
        returning id into v_lesson;
        v_created := v_created + 1;
      end if;
      v_used := v_used || v_lesson;
      v_li := v_li + 1;
    end loop;

    -- The module's evaluation: settings and questions as in the version.
    if v_mod -> 'quiz' is not null and jsonb_typeof(v_mod -> 'quiz') = 'object' then
      select id into v_quiz from public.quizzes where module_id = v_module;
      if v_quiz is null then
        insert into public.quizzes (module_id, course_id, title) values (v_module, p.course_id, coalesce(v_mod -> 'quiz' ->> 'title', 'Évaluation')) returning id into v_quiz;
      end if;
      update public.quizzes
         set title = coalesce(v_mod -> 'quiz' ->> 'title', title), instructions = coalesce(v_mod -> 'quiz' ->> 'instructions', instructions),
             pass_threshold = coalesce((v_mod -> 'quiz' ->> 'pass_threshold')::smallint, pass_threshold),
             max_attempts = coalesce((v_mod -> 'quiz' ->> 'max_attempts')::smallint, max_attempts),
             shuffle_questions = coalesce((v_mod -> 'quiz' ->> 'shuffle_questions')::boolean, shuffle_questions),
             shuffle_options = coalesce((v_mod -> 'quiz' ->> 'shuffle_options')::boolean, shuffle_options)
       where id = v_quiz;
      -- Questions are archived, never deleted (past attempts keep their answers).
      update public.questions set archived_at = v_now where quiz_id = v_quiz and archived_at is null;
      v_qi := 0;
      for v_qu in select value from jsonb_array_elements(coalesce(v_mod -> 'quiz' -> 'questions', '[]'::jsonb)) loop
        insert into public.questions (quiz_id, kind, prompt, points, explanation, position)
        values (v_quiz, (v_qu ->> 'kind')::public.question_kind, v_qu ->> 'prompt', coalesce((v_qu ->> 'points')::integer, 1),
                coalesce(v_qu ->> 'explanation', ''), v_qi)
        returning id into v_qid;
        v_oi := 0;
        for v_opt in select value from jsonb_array_elements(coalesce(v_qu -> 'options', '[]'::jsonb)) loop
          insert into public.question_options (question_id, label, is_correct, position)
          values (v_qid, v_opt ->> 'label', coalesce((v_opt ->> 'correct')::boolean, false), v_oi);
          v_oi := v_oi + 1;
        end loop;
        v_qi := v_qi + 1;
        v_qcount := v_qcount + 1;
      end loop;
    end if;
    v_mi := v_mi + 1;
  end loop;

  update public.training_projects set updated_at = now() where id = p_project;
  perform private.project_log(p_project, null, 'version_restored', 'Version ' || p_version);
  perform private.log_audit('training_version_restored', 'training_projects', p_project, null,
                            jsonb_build_object('version', p_version, 'reused', v_reused, 'created', v_created, 'questions', v_qcount));
  return jsonb_build_object('modules', v_mi, 'lessons_reused', v_reused, 'lessons_created', v_created, 'questions', v_qcount);
end;
$$;

revoke execute on function public.restore_training_version(uuid, integer) from public, anon;
grant execute on function public.restore_training_version(uuid, integer) to authenticated;
