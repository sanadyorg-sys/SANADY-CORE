-- ════════════════════════════════════════════════════════════════════════════
-- SANADY · Quiz options: true/false questions, shuffled questions and answers
--
-- true_false: exactly two options (« Vrai », « Faux »), one correct; graded
-- like a single-answer question (no change to grading).
-- shuffle_questions: random question order, drawn once per attempt and
-- stored in quiz_attempts.question_ids (stable across reloads, auditable).
-- shuffle_options: answer order derived from md5(attempt id, option id) —
-- stable within an attempt, different between attempts. Never applied to
-- true/false questions (« Vrai » stays first).
-- ════════════════════════════════════════════════════════════════════════════

alter type public.question_kind add value if not exists 'true_false';

alter table public.quizzes
  add column shuffle_questions boolean not null default false,
  add column shuffle_options   boolean not null default false;

-- Enum literals are compared as text: a value added by ALTER TYPE cannot be
-- used as an enum constant in the same transaction.

create or replace function public.validate_course(p_course uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_issues jsonb := '[]'::jsonb;
  v_course public.courses;
begin
  perform private.require(private.is_sanady_admin(), 'forbidden');
  select * into v_course from public.courses where id = p_course;
  perform private.require(found, 'not_found');

  if char_length(btrim(v_course.description)) < 20 then
    v_issues := v_issues || jsonb_build_object('code', 'course_description_missing');
  end if;
  if cardinality(v_course.objectives) = 0 then
    v_issues := v_issues || jsonb_build_object('code', 'course_objectives_missing');
  end if;
  if v_course.category_id is null then
    v_issues := v_issues || jsonb_build_object('code', 'course_category_missing');
  end if;

  if not exists (select 1 from public.modules m where m.course_id = p_course and m.archived_at is null) then
    v_issues := v_issues || jsonb_build_object('code', 'course_no_modules');
  end if;

  select v_issues || coalesce(jsonb_agg(jsonb_build_object('code', 'module_no_lessons', 'module_id', m.id, 'label', m.title)), '[]'::jsonb)
    into v_issues
    from public.modules m
   where m.course_id = p_course and m.archived_at is null
     and not exists (select 1 from public.lessons l where l.module_id = m.id and l.archived_at is null);

  select v_issues || coalesce(jsonb_agg(jsonb_build_object('code', 'module_no_quiz', 'module_id', m.id, 'label', m.title)), '[]'::jsonb)
    into v_issues
    from public.modules m
   where m.course_id = p_course and m.archived_at is null
     and not exists (
       select 1 from public.quizzes q
        where q.module_id = m.id
          and exists (select 1 from public.questions qu where qu.quiz_id = q.id and qu.archived_at is null)
     );

  select v_issues || coalesce(jsonb_agg(jsonb_build_object('code', 'lesson_no_content', 'lesson_id', l.id, 'label', l.title)), '[]'::jsonb)
    into v_issues
    from public.lessons l
    join public.modules m on m.id = l.module_id and m.archived_at is null
   where l.course_id = p_course and l.archived_at is null
     and (
       (l.kind = 'video' and (l.video_provider is null or l.video_ref is null))
       or (l.kind = 'pdf' and (l.pdf_path is null or l.pdf_page_count is null))
     );

  select v_issues || coalesce(jsonb_agg(jsonb_build_object('code', 'question_invalid', 'question_id', qu.id, 'label', left(qu.prompt, 80))), '[]'::jsonb)
    into v_issues
    from public.questions qu
    join public.quizzes q on q.id = qu.quiz_id and q.course_id = p_course
    join public.modules m on m.id = q.module_id and m.archived_at is null
   where qu.archived_at is null
     and (
       (select count(*) from public.question_options o where o.question_id = qu.id) < 2
       or (qu.kind::text in ('single', 'true_false') and (select count(*) from public.question_options o where o.question_id = qu.id and o.is_correct) <> 1)
       or (qu.kind::text = 'true_false' and (select count(*) from public.question_options o where o.question_id = qu.id) <> 2)
       or (qu.kind = 'multiple' and (select count(*) from public.question_options o where o.question_id = qu.id and o.is_correct) < 1)
     );

  return v_issues;
end;
$$;

create or replace function public.save_question(
  p_quiz         uuid,
  p_question     uuid,
  p_kind         public.question_kind,
  p_prompt       text,
  p_explanation  text,
  p_points       smallint,
  p_options      jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id       uuid := p_question;
  v_correct  integer;
  v_count    integer;
  v_opt      jsonb;
  v_pos      integer := 0;
  v_keep     uuid[] := '{}';
  v_opt_id   uuid;
begin
  perform private.require(private.is_sanady_admin(), 'forbidden');
  perform private.require(jsonb_typeof(p_options) = 'array', 'invalid_options');

  v_count := jsonb_array_length(p_options);
  select count(*) into v_correct from jsonb_array_elements(p_options) e where (e ->> 'is_correct')::boolean;

  perform private.require(v_count between 2 and 10, 'question_options_count');
  perform private.require(p_kind::text <> 'true_false' or v_count = 2, 'question_options_count');
  perform private.require(
    (p_kind::text in ('single', 'true_false') and v_correct = 1) or (p_kind = 'multiple' and v_correct >= 1),
    'question_correct_count'
  );

  if v_id is null then
    insert into public.questions (quiz_id, kind, prompt, explanation, points, position)
    values (
      p_quiz, p_kind, btrim(p_prompt), btrim(coalesce(p_explanation, '')), p_points,
      coalesce((select max(position) + 1 from public.questions where quiz_id = p_quiz and archived_at is null), 0)
    )
    returning id into v_id;
  else
    update public.questions
       set kind = p_kind, prompt = btrim(p_prompt), explanation = btrim(coalesce(p_explanation, '')), points = p_points
     where id = v_id and quiz_id = p_quiz;
    perform private.require(found, 'not_found');
  end if;

  for v_opt in select * from jsonb_array_elements(p_options) loop
    v_opt_id := private.try_uuid(v_opt ->> 'id');
    if v_opt_id is not null and exists (select 1 from public.question_options where id = v_opt_id and question_id = v_id) then
      update public.question_options
         set label = btrim(v_opt ->> 'label'), is_correct = coalesce((v_opt ->> 'is_correct')::boolean, false), position = v_pos
       where id = v_opt_id;
    else
      insert into public.question_options (question_id, label, is_correct, position)
      values (v_id, btrim(v_opt ->> 'label'), coalesce((v_opt ->> 'is_correct')::boolean, false), v_pos)
      returning id into v_opt_id;
    end if;
    v_keep := v_keep || v_opt_id;
    v_pos := v_pos + 1;
  end loop;

  delete from public.question_options where question_id = v_id and not (id = any(v_keep));
  return v_id;
end;
$$;

create or replace function public.start_quiz_attempt(p_quiz uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_quiz     public.quizzes;
  v_attempt  public.quiz_attempts;
  v_used     integer;
  v_qids     uuid[];
begin
  perform private.require(v_uid is not null, 'not_authenticated');
  select * into v_quiz from public.quizzes where id = p_quiz;
  perform private.require(found, 'not_found');
  perform private.require(
    exists (select 1 from public.modules m where m.id = v_quiz.module_id and m.archived_at is null),
    'not_found'
  );
  perform private.require(private.has_course_access(v_quiz.course_id), 'course_access_denied');

  -- Serialize concurrent starts for this learner and quiz.
  perform pg_advisory_xact_lock(hashtextextended(p_quiz::text || ':' || v_uid::text, 0));

  perform private.require(
    not exists (select 1 from public.quiz_attempts
                 where quiz_id = p_quiz and user_id = v_uid and passed and voided_at is null),
    'quiz_already_passed'
  );

  select * into v_attempt from public.quiz_attempts
   where quiz_id = p_quiz and user_id = v_uid and status = 'in_progress' and voided_at is null;

  if not found then
    perform private.require(private.module_lessons_complete(v_uid, v_quiz.module_id), 'quiz_locked');

    select count(*) into v_used from public.quiz_attempts
     where quiz_id = p_quiz and user_id = v_uid and voided_at is null;
    perform private.require(v_used < v_quiz.max_attempts, 'attempts_exhausted');

    -- Order is fixed once per attempt (stored), so reloading keeps it.
    select coalesce(array_agg(id order by case when v_quiz.shuffle_questions then random() end, position, created_at), '{}') into v_qids
      from public.questions where quiz_id = p_quiz and archived_at is null;
    perform private.require(cardinality(v_qids) > 0, 'quiz_empty');

    insert into public.quiz_attempts (quiz_id, user_id, course_id, attempt_number, pass_threshold, max_attempts, question_ids)
    values (p_quiz, v_uid, v_quiz.course_id, v_used + 1, v_quiz.pass_threshold, v_quiz.max_attempts, v_qids)
    returning * into v_attempt;

    perform private.touch_enrollment(v_uid, v_quiz.course_id);
    perform private.record_event(v_uid, v_quiz.course_id, 'quiz_started', null, p_quiz,
      jsonb_build_object('attempt_number', v_attempt.attempt_number));
  end if;

  -- Questions and options WITHOUT any correctness information.
  return jsonb_build_object(
    'attempt_id', v_attempt.id,
    'attempt_number', v_attempt.attempt_number,
    'max_attempts', v_attempt.max_attempts,
    'pass_threshold', v_attempt.pass_threshold,
    'started_at', v_attempt.started_at,
    'questions', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'id', q.id,
                 'kind', q.kind,
                 'prompt', q.prompt,
                 'points', q.points,
                 'options', coalesce((
                   -- Shuffled options use a per-attempt deterministic order.
                   select jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label)
                                    order by case when v_quiz.shuffle_options and q.kind::text <> 'true_false'
                                                  then md5(v_attempt.id::text || o.id::text) end,
                                             o.position)
                     from public.question_options o where o.question_id = q.id
                 ), '[]'::jsonb)
               ) order by ord.n)
        from unnest(v_attempt.question_ids) with ordinality as ord(id, n)
        join public.questions q on q.id = ord.id
    ), '[]'::jsonb)
  );
end;
$$;
