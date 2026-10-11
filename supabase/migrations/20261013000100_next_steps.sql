-- ════════════════════════════════════════════════════════════════════════════
-- SANADY · Teacher dashboard: next step per course and due dates
--
-- For each unfinished course the signed-in teacher can access, the single
-- next thing to do, following the course rules (modules in order; a module
-- quiz opens once its mandatory lessons are completed):
--   lesson   — the first unfinished mandatory lesson of the first open module
--   quiz     — the module quiz is unlocked and not yet passed
--   blocked  — all attempts used without success: an administrator must
--              reset them (the teacher is told whom to contact)
-- plus the earliest due date set by an institution assignment, if any.
-- ════════════════════════════════════════════════════════════════════════════

create function public.learner_next_steps()
returns table (
  course_id       uuid,
  course_title    text,
  step_kind       text,
  lesson_id       uuid,
  quiz_id         uuid,
  item_title      text,
  module_title    text,
  module_position integer,
  attempts_used   integer,
  max_attempts    integer,
  due_on          date
)
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select e.course_id, c.title
      from public.enrollments e
      join public.courses c on c.id = e.course_id
     where e.user_id = auth.uid()
       and e.status = 'active'
       and private.has_course_access(e.course_id)
  ),
  -- Modules still to validate: a mandatory lesson is unfinished, or the quiz is not passed.
  open_modules as (
    select m.id, m.course_id, m.title, m.position,
           (select l.id from public.lessons l
             where l.module_id = m.id and l.archived_at is null and l.is_mandatory
               and not exists (select 1 from public.lesson_progress lp
                                where lp.lesson_id = l.id and lp.user_id = auth.uid() and lp.status = 'completed')
             order by l.position limit 1) as next_lesson,
           q.id as quiz_id, q.title as quiz_title, q.max_attempts,
           (select count(*)::integer from public.quiz_attempts a
             where a.quiz_id = q.id and a.user_id = auth.uid() and a.status = 'submitted' and a.voided_at is null) as used,
           exists (select 1 from public.quiz_attempts a
                    where a.quiz_id = q.id and a.user_id = auth.uid() and a.passed and a.voided_at is null) as passed
      from public.modules m
      join mine on mine.course_id = m.course_id
      left join public.quizzes q on q.module_id = m.id
     where m.archived_at is null
  ),
  first_open as (
    select distinct on (om.course_id) om.*
      from open_modules om
     where om.next_lesson is not null or (om.quiz_id is not null and not om.passed)
     order by om.course_id, om.position
  )
  select mine.course_id,
         mine.title,
         case
           when fo.next_lesson is not null then 'lesson'
           when fo.used >= fo.max_attempts then 'blocked'
           else 'quiz'
         end,
         fo.next_lesson,
         case when fo.next_lesson is null then fo.quiz_id end,
         case when fo.next_lesson is not null then (select l.title from public.lessons l where l.id = fo.next_lesson) else fo.quiz_title end,
         fo.title,
         fo.position + 1,
         fo.used,
         fo.max_attempts::integer,
         (select min(ca.due_on) from public.course_assignments ca
           where ca.user_id = auth.uid() and ca.course_id = mine.course_id and ca.revoked_at is null)
    from mine
    join first_open fo on fo.course_id = mine.course_id
   order by 11 nulls last, mine.title;
$$;

revoke execute on function public.learner_next_steps() from public, anon;
grant execute on function public.learner_next_steps() to authenticated;
