-- ════════════════════════════════════════════════════════════════════════════
-- SANADY · Roles: training managers, trainers, institution supervisors,
--         course review workflow
--
-- Platform roles (one per account):
--   sanady_admin      everything (unchanged)
--   training_manager  all courses (author, approve, publish), learner
--                     progress and reports; no institutions, users or
--                     settings. Two-factor sessions only, like admins.
--   trainer           authors only the courses assigned to them, while in
--                     draft; submits them for review; follows the learners
--                     of those courses. Cannot publish.
-- Institution role:
--   supervisor        read-only view of one institution (teachers,
--                     progress, results, certificates, reports).
-- Course workflow: draft → review (submitted) → published (approved), or
-- back to draft with a reviewer comment.
--
-- New enum values are compared as text in this migration: a value added by
-- ALTER TYPE cannot be used as an enum constant in the same transaction.
-- ════════════════════════════════════════════════════════════════════════════

alter type public.platform_role add value if not exists 'training_manager';
alter type public.platform_role add value if not exists 'trainer';
alter type public.membership_role add value if not exists 'supervisor';
alter type public.invitation_kind add value if not exists 'institution_supervisor';
alter type public.course_status add value if not exists 'review';

-- Institution invitations (now including supervisors) name their institution.
alter table public.invitations drop constraint invitations_check;
alter table public.invitations add constraint invitations_institution_check
  check ((kind::text in ('institution_admin', 'institution_teacher', 'institution_supervisor')) = (institution_id is not null));

-- ─── Review workflow columns ───────────────────────────────────────────────
alter table public.courses
  add column submitted_at    timestamptz,
  add column submitted_by    uuid references public.profiles (id) on delete set null,
  add column review_comment  text check (char_length(review_comment) <= 2000),
  add column reviewed_at     timestamptz,
  add column reviewed_by     uuid references public.profiles (id) on delete set null;

-- ─── Course trainers ───────────────────────────────────────────────────────
create table public.course_trainers (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null references public.courses (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  assigned_by  uuid references public.profiles (id) on delete set null,
  assigned_at  timestamptz not null default now(),
  unique (course_id, user_id)
);
create index course_trainers_user_idx on public.course_trainers (user_id);

create trigger course_trainers_audit
  after insert or delete on public.course_trainers
  for each row execute function private.audit_row_change('course_id');

-- ─── Role helpers ──────────────────────────────────────────────────────────
create function private.platform_role(p_user uuid default auth.uid())
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select pr.role::text
    from public.platform_roles pr
    join public.profiles p on p.id = pr.user_id
   where pr.user_id = p_user and p.status = 'active';
$$;

-- Like administrators, training managers act only from a two-factor session.
create function private.is_training_manager(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.platform_role(p_user) = 'training_manager', false)
     and (p_user is distinct from auth.uid() or private.session_aal() = 'aal2');
$$;

create function private.is_course_staff(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_sanady_admin(p_user) or private.is_training_manager(p_user);
$$;

create function private.is_course_trainer(p_course uuid, p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.platform_role(p_user) = 'trainer', false)
     and exists (select 1 from public.course_trainers ct where ct.course_id = p_course and ct.user_id = p_user);
$$;

-- Read the course as its author (all statuses, correct answers included).
create function private.can_author_course(p_course uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_course_staff() or private.is_course_trainer(p_course);
$$;

-- Change the course content: staff always; its trainers only while in draft.
create function private.can_edit_course(p_course uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_course_staff()
      or (private.is_course_trainer(p_course)
          and exists (select 1 from public.courses c where c.id = p_course and c.status::text = 'draft'));
$$;

create function private.can_supervise_institution(p_institution uuid, p_user uuid default auth.uid())
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
       and m.role::text in ('admin', 'supervisor')
       and m.status = 'active'
       and i.status = 'active'
       and p.status = 'active'
  );
$$;

create function private.supervised_institutions(p_user uuid default auth.uid())
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
     and m.role::text in ('admin', 'supervisor')
     and m.status = 'active'
     and i.status = 'active';
$$;

-- ─── Visibility helpers (redefined) ────────────────────────────────────────
create or replace function private.can_view_course(p_course uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_author_course(p_course)
      or exists (select 1 from public.enrollments e where e.course_id = p_course and e.user_id = auth.uid())
      or private.has_course_access(p_course)
      or (
        exists (select 1 from public.courses c where c.id = p_course and c.status = 'published')
        and private.institution_admin_has_course(p_course)
      );
$$;

create or replace function private.can_view_course_content(p_course uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_author_course(p_course)
      or private.has_course_access(p_course)
      or private.institution_admin_has_course(p_course);
$$;

-- Courses authorized for an institution the caller administers or supervises.
create or replace function private.institution_admin_has_course(p_course uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.course_permissions cp
     where cp.course_id = p_course
       and cp.revoked_at is null
       and cp.institution_id in (select private.supervised_institutions())
  );
$$;

-- Learner progress in a course: the institution that assigned it (its
-- administrators and supervisors), training managers, and the course's
-- trainers. Personal learning in other courses stays private.
create or replace function private.can_view_learner_course(p_learner uuid, p_course uuid, p_viewer uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
           select 1
             from public.course_assignments ca
             join public.institution_memberships m
               on m.institution_id = ca.institution_id
              and m.user_id = ca.user_id
              and m.status = 'active'
              and m.role = 'teacher'
            where ca.user_id = p_learner
              and ca.course_id = p_course
              and ca.revoked_at is null
              and private.can_supervise_institution(ca.institution_id, p_viewer)
         )
      or private.is_training_manager(p_viewer)
      or private.is_course_trainer(p_course, p_viewer);
$$;

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
         );
$$;

-- ─── Course updates: only staff change status, listing and review fields ───
create function private.courses_role_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Server maintenance (no user session) and staff are not restricted here;
  -- RLS already limits who may update the row at all.
  if auth.uid() is null or private.is_course_staff() then
    return new;
  end if;
  if current_setting('sanady.course_review', true) = 'on' then
    return new;
  end if;
  if new.status is distinct from old.status
     or new.public_listing is distinct from old.public_listing
     or new.submitted_at is distinct from old.submitted_at
     or new.submitted_by is distinct from old.submitted_by
     or new.review_comment is distinct from old.review_comment
     or new.reviewed_at is distinct from old.reviewed_at
     or new.reviewed_by is distinct from old.reviewed_by then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;
  return new;
end;
$$;

create trigger courses_role_guard
  before update on public.courses
  for each row execute function private.courses_role_guard();

-- ─── Policies (course content) ─────────────────────────────────────────────
drop policy categories_write on public.course_categories;
create policy categories_write on public.course_categories
  for all to authenticated
  using (private.is_course_staff()) with check (private.is_course_staff());

drop policy courses_insert on public.courses;
drop policy courses_update on public.courses;
drop policy courses_delete on public.courses;
create policy courses_insert on public.courses
  for insert to authenticated with check (private.is_course_staff());
create policy courses_update on public.courses
  for update to authenticated
  using (private.can_edit_course(id)) with check (private.can_author_course(id));
create policy courses_delete on public.courses
  for delete to authenticated using (private.is_course_staff() and status = 'draft');

drop policy modules_select on public.modules;
drop policy modules_write on public.modules;
create policy modules_select on public.modules
  for select to authenticated
  using (private.can_author_course(course_id) or (archived_at is null and private.can_view_course_content(course_id)));
create policy modules_write on public.modules
  for all to authenticated
  using (private.can_edit_course(course_id)) with check (private.can_edit_course(course_id));

drop policy lessons_select on public.lessons;
drop policy lessons_write on public.lessons;
create policy lessons_select on public.lessons
  for select to authenticated
  using (private.can_author_course(course_id) or (archived_at is null and private.can_view_course_content(course_id)));
create policy lessons_write on public.lessons
  for all to authenticated
  using (private.can_edit_course(course_id)) with check (private.can_edit_course(course_id));

drop policy lesson_resources_write on public.lesson_resources;
create policy lesson_resources_write on public.lesson_resources
  for all to authenticated
  using (exists (select 1 from public.lessons l where l.id = lesson_id and private.can_edit_course(l.course_id)))
  with check (exists (select 1 from public.lessons l where l.id = lesson_id and private.can_edit_course(l.course_id)));

drop policy quizzes_select on public.quizzes;
drop policy quizzes_write on public.quizzes;
create policy quizzes_select on public.quizzes
  for select to authenticated
  using (private.can_author_course(course_id) or private.can_view_course_content(course_id));
create policy quizzes_write on public.quizzes
  for all to authenticated
  using (private.can_edit_course(course_id)) with check (private.can_edit_course(course_id));

-- Questions and options (with correctness): authors of the course only.
-- Learners receive questions exclusively through start_quiz_attempt().
drop policy questions_admin on public.questions;
create policy questions_author_select on public.questions
  for select to authenticated
  using (private.can_author_course((select q.course_id from public.quizzes q where q.id = quiz_id)));
create policy questions_author_update on public.questions
  for update to authenticated
  using (private.can_edit_course((select q.course_id from public.quizzes q where q.id = quiz_id)))
  with check (private.can_edit_course((select q.course_id from public.quizzes q where q.id = quiz_id)));

drop policy question_options_admin on public.question_options;
create policy question_options_author_select on public.question_options
  for select to authenticated
  using (private.can_author_course((
    select q.course_id from public.questions qu join public.quizzes q on q.id = qu.quiz_id where qu.id = question_id
  )));

-- ─── Course trainers table ─────────────────────────────────────────────────
alter table public.course_trainers enable row level security;
create policy course_trainers_select on public.course_trainers
  for select to authenticated
  using (private.is_course_staff() or user_id = (select auth.uid()));
grant select on public.course_trainers to authenticated;
-- Writes via assign_course_trainer / remove_course_trainer only.

-- ─── Policies (institutions: supervisors read) ─────────────────────────────
drop policy memberships_select on public.institution_memberships;
create policy memberships_select on public.institution_memberships
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.is_sanady_admin()
    or private.can_supervise_institution(institution_id)
  );

drop policy course_assignments_select on public.course_assignments;
create policy course_assignments_select on public.course_assignments
  for select to authenticated
  using (
    private.is_course_staff()
    or user_id = (select auth.uid())
    or private.can_supervise_institution(institution_id)
  );

drop policy course_permissions_select on public.course_permissions;
create policy course_permissions_select on public.course_permissions
  for select to authenticated
  using (
    private.is_course_staff()
    or user_id = (select auth.uid())
    or (institution_id is not null and private.can_supervise_institution(institution_id))
  );

drop policy invitations_select on public.invitations;
create policy invitations_select on public.invitations
  for select to authenticated
  using (
    private.is_sanady_admin()
    or (kind::text in ('institution_teacher', 'institution_supervisor') and private.is_institution_admin(institution_id))
  );

-- ─── Library and storage: training managers manage like administrators ─────
drop policy library_resources_select on public.library_resources;
drop policy library_resources_admin_insert on public.library_resources;
drop policy library_resources_admin_update on public.library_resources;
drop policy library_resources_admin_delete on public.library_resources;
create policy library_resources_select on public.library_resources
  for select to authenticated
  using (private.is_course_staff() or (status = 'published' and private.is_active_user()));
create policy library_resources_staff_insert on public.library_resources
  for insert to authenticated with check (private.is_course_staff());
create policy library_resources_staff_update on public.library_resources
  for update to authenticated using (private.is_course_staff()) with check (private.is_course_staff());
create policy library_resources_staff_delete on public.library_resources
  for delete to authenticated using (private.is_course_staff());

drop policy library_read on storage.objects;
drop policy library_admin_insert on storage.objects;
drop policy library_admin_update on storage.objects;
drop policy library_admin_delete on storage.objects;
create policy library_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'library'
    and (
      private.is_course_staff()
      or exists (
        select 1 from public.library_resources r
         where r.file_path = storage.objects.name and r.status = 'published' and private.is_active_user()
      )
    )
  );
create policy library_staff_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'library' and private.is_course_staff());
create policy library_staff_update on storage.objects
  for update to authenticated
  using (bucket_id = 'library' and private.is_course_staff()) with check (bucket_id = 'library' and private.is_course_staff());
create policy library_staff_delete on storage.objects
  for delete to authenticated using (bucket_id = 'library' and private.is_course_staff());

-- Course media and covers live under <course id>/…: the course's editors write.
drop policy course_media_read on storage.objects;
drop policy course_media_admin_insert on storage.objects;
drop policy course_media_admin_update on storage.objects;
drop policy course_media_admin_delete on storage.objects;
drop policy course_covers_admin_insert on storage.objects;
drop policy course_covers_admin_update on storage.objects;
drop policy course_covers_admin_delete on storage.objects;
create policy course_media_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'course-media'
    and (
      private.can_author_course(private.try_uuid((storage.foldername(name))[1]))
      or private.has_course_access(private.try_uuid((storage.foldername(name))[1]))
    )
  );
create policy course_media_editor_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'course-media' and private.can_edit_course(private.try_uuid((storage.foldername(name))[1])));
create policy course_media_editor_update on storage.objects
  for update to authenticated
  using (bucket_id = 'course-media' and private.can_edit_course(private.try_uuid((storage.foldername(name))[1])))
  with check (bucket_id = 'course-media' and private.can_edit_course(private.try_uuid((storage.foldername(name))[1])));
create policy course_media_editor_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'course-media' and private.can_edit_course(private.try_uuid((storage.foldername(name))[1])));
create policy course_covers_editor_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'course-covers' and private.can_edit_course(private.try_uuid((storage.foldername(name))[1])));
create policy course_covers_editor_update on storage.objects
  for update to authenticated
  using (bucket_id = 'course-covers' and private.can_edit_course(private.try_uuid((storage.foldername(name))[1])))
  with check (bucket_id = 'course-covers' and private.can_edit_course(private.try_uuid((storage.foldername(name))[1])));
create policy course_covers_editor_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'course-covers' and private.can_edit_course(private.try_uuid((storage.foldername(name))[1])));

-- ─── Course content functions: per-course editing right ────────────────────

create or replace function public.reorder_modules(p_course uuid, p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require(private.can_edit_course(p_course), 'forbidden');
  perform private.require(
    (select count(*) from public.modules where course_id = p_course and archived_at is null) = cardinality(p_ids)
    and (select count(*) from public.modules where course_id = p_course and archived_at is null and id = any(p_ids)) = cardinality(p_ids),
    'invalid_order'
  );
  update public.modules set position = position + 100000 where course_id = p_course and archived_at is null;
  update public.modules m set position = o.ord - 1
    from unnest(p_ids) with ordinality as o(id, ord)
   where m.id = o.id;
end;
$$;

create or replace function public.reorder_lessons(p_module uuid, p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require(private.can_edit_course((select m.course_id from public.modules m where m.id = p_module)), 'forbidden');
  perform private.require(
    (select count(*) from public.lessons where module_id = p_module and archived_at is null) = cardinality(p_ids)
    and (select count(*) from public.lessons where module_id = p_module and archived_at is null and id = any(p_ids)) = cardinality(p_ids),
    'invalid_order'
  );
  update public.lessons set position = position + 100000 where module_id = p_module and archived_at is null;
  update public.lessons l set position = o.ord - 1
    from unnest(p_ids) with ordinality as o(id, ord)
   where l.id = o.id;
end;
$$;

create or replace function public.reorder_questions(p_quiz uuid, p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require(private.can_edit_course((select q.course_id from public.quizzes q where q.id = p_quiz)), 'forbidden');
  update public.questions q set position = o.ord - 1
    from unnest(p_ids) with ordinality as o(id, ord)
   where q.id = o.id and q.quiz_id = p_quiz;
end;
$$;

create or replace function public.remove_lesson(p_lesson uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require(private.can_edit_course((select l.course_id from public.lessons l where l.id = p_lesson)), 'forbidden');
  if exists (select 1 from public.lesson_progress where lesson_id = p_lesson)
     or exists (select 1 from public.video_progress where lesson_id = p_lesson)
     or exists (select 1 from public.document_progress where lesson_id = p_lesson) then
    update public.lessons set archived_at = now() where id = p_lesson and archived_at is null;
    return 'archived';
  end if;
  delete from public.lessons where id = p_lesson;
  return 'deleted';
end;
$$;

create or replace function public.remove_question(p_question uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require(private.can_edit_course((select q.course_id from public.questions qu join public.quizzes q on q.id = qu.quiz_id where qu.id = p_question)), 'forbidden');
  if exists (select 1 from public.quiz_answers where question_id = p_question)
     or exists (select 1 from public.quiz_attempts where p_question = any(question_ids)) then
    update public.questions set archived_at = now() where id = p_question and archived_at is null;
    return 'archived';
  end if;
  delete from public.questions where id = p_question;
  return 'deleted';
end;
$$;

create or replace function public.remove_module(p_module uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_has_data boolean;
begin
  perform private.require(private.can_edit_course((select m.course_id from public.modules m where m.id = p_module)), 'forbidden');
  select exists (
           select 1 from public.lesson_progress lp join public.lessons l on l.id = lp.lesson_id where l.module_id = p_module
         )
      or exists (
           select 1 from public.quiz_attempts a join public.quizzes q on q.id = a.quiz_id where q.module_id = p_module
         )
    into v_has_data;

  if v_has_data then
    update public.modules set archived_at = now() where id = p_module and archived_at is null;
    update public.lessons set archived_at = now() where module_id = p_module and archived_at is null;
    return 'archived';
  end if;
  delete from public.modules where id = p_module;
  return 'deleted';
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
  perform private.require(private.can_edit_course((select q.course_id from public.quizzes q where q.id = p_quiz)), 'forbidden');
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
  perform private.require(private.can_author_course(p_course), 'forbidden');
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

-- ─── Staff functions: SANADY administrators and training managers ──────────

create or replace function public.platform_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_days smallint;
begin
  perform private.require(private.is_course_staff(), 'forbidden');
  select inactivity_threshold_days into v_days from public.platform_settings where id;

  return jsonb_build_object(
    'institutions', (select count(*) from public.institutions where status = 'active'),
    'teachers', (select count(*) from public.profiles p
                  where p.status = 'active'
                    and not exists (select 1 from public.platform_roles r where r.user_id = p.id)),
    'active_learners', (select count(distinct user_id) from public.enrollments
                         where last_activity_at >= now() - make_interval(days => v_days)),
    'inactivity_threshold_days', v_days,
    'published_courses', (select count(*) from public.courses where status = 'published'),
    'draft_courses', (select count(*) from public.courses where status = 'draft'),
    'enrollments', (select count(*) from public.enrollments),
    'completed_enrollments', (select count(*) from public.enrollments where status = 'completed'),
    'certificates', (select count(*) from public.certificates where revoked_at is null),
    'pending_invitations', (select count(*) from public.invitations
                             where accepted_at is null and revoked_at is null and expires_at > now()),
    'exhausted_attempts', (
      select count(*) from (
        select a.quiz_id, a.user_id
          from public.quiz_attempts a
         where a.voided_at is null and a.status = 'submitted'
         group by a.quiz_id, a.user_id
        having count(*) >= min(a.max_attempts) and not bool_or(a.passed)
      ) s
    )
  );
end;
$$;

create or replace function public.exhausted_attempts()
returns table (
  quiz_id        uuid,
  quiz_title     text,
  course_id      uuid,
  course_title   text,
  user_id        uuid,
  full_name      text,
  email          text,
  attempts       integer,
  best_score     numeric,
  last_attempt   timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require(private.is_course_staff(), 'forbidden');
  return query
    select a.quiz_id, q.title, c.id, c.title, p.id, p.full_name, p.email,
           count(*)::integer, max(a.score_percent), max(a.submitted_at)
      from public.quiz_attempts a
      join public.quizzes q  on q.id = a.quiz_id
      join public.courses c  on c.id = a.course_id
      join public.profiles p on p.id = a.user_id
     where a.voided_at is null and a.status = 'submitted'
     group by a.quiz_id, q.title, c.id, c.title, p.id, p.full_name, p.email
    having count(*) >= min(a.max_attempts) and not bool_or(a.passed)
     order by max(a.submitted_at) desc;
end;
$$;

create or replace function public.reset_quiz_attempts(p_quiz uuid, p_user uuid, p_reason text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_course uuid;
  v_count  integer;
begin
  perform private.require(private.is_course_staff(), 'forbidden');
  perform private.require(char_length(btrim(coalesce(p_reason, ''))) between 5 and 500, 'reason_required');

  select course_id into v_course from public.quizzes where id = p_quiz;
  perform private.require(found, 'not_found');
  perform private.require(
    not exists (select 1 from public.quiz_attempts where quiz_id = p_quiz and user_id = p_user and passed and voided_at is null),
    'quiz_already_passed'
  );

  update public.quiz_attempts
     set voided_at = now(), voided_by = auth.uid(), void_reason = btrim(p_reason)
   where quiz_id = p_quiz and user_id = p_user and voided_at is null;
  get diagnostics v_count = row_count;

  perform private.record_event(p_user, v_course, 'quiz_attempts_reset', null, p_quiz,
    jsonb_build_object('voided_attempts', v_count));
  perform private.log_audit('quiz_attempts_reset', 'quizzes', p_quiz, null,
    jsonb_build_object('learner_id', p_user, 'voided_attempts', v_count, 'reason', btrim(p_reason)));
  return v_count;
end;
$$;

create or replace function public.admin_report(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_from timestamptz;
  v_to   timestamptz;
begin
  perform private.require(private.is_course_staff(), 'forbidden');
  select b.v_from, b.v_to into v_from, v_to from private.period_bounds(p_from, p_to) b;

  return jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'kpis', (
      select jsonb_build_object(
        'teachers', (select count(*) from public.profiles p
                      where p.status = 'active' and not exists (select 1 from public.platform_roles r where r.user_id = p.id)),
        'new_teachers', (select count(*) from public.profiles p
                          where p.created_at >= v_from and p.created_at < v_to
                            and not exists (select 1 from public.platform_roles r where r.user_id = p.id)),
        'active_teachers', (select count(distinct e.user_id) from public.learning_events e
                             where e.occurred_at >= v_from and e.occurred_at < v_to and e.event_type::text not in ('enrolled', 'quiz_attempts_reset', 'certificate_issued')),
        'institutions', (select count(*) from public.institutions where status = 'active'),
        'published_courses', (select count(*) from public.courses where status = 'published'),
        'active_enrollments', (select count(*) from public.enrollments where status = 'active'),
        'completions', (select count(*) from public.enrollments where completed_at >= v_from and completed_at < v_to),
        'completion_rate', (select round(count(*) filter (where status = 'completed')::numeric
                                         / nullif(count(*) filter (where started_at is not null), 0), 4)
                              from public.enrollments),
        'attempts', a.n,
        'average_score', a.avg_score,
        'pass_rate', a.pass_rate,
        'certificates', (select count(*) from public.certificates
                          where issued_at >= v_from and issued_at < v_to and revoked_at is null)
      )
      from (
        select count(*) as n,
               round(avg(score_percent), 1) as avg_score,
               round(count(*) filter (where passed)::numeric / nullif(count(*), 0), 4) as pass_rate
          from public.quiz_attempts
         where status = 'submitted' and voided_at is null and submitted_at >= v_from and submitted_at < v_to
      ) a
    ),
    'weekly', coalesce((
      select jsonb_agg(jsonb_build_object(
               'week', w::date,
               'active_teachers', (select count(distinct e.user_id) from public.learning_events e
                                    where e.occurred_at >= greatest(w, v_from) and e.occurred_at < least(w + interval '7 days', v_to) and e.event_type::text not in ('enrolled', 'quiz_attempts_reset', 'certificate_issued')),
               'completions', (select count(*) from public.enrollments en
                                where en.completed_at >= greatest(w, v_from) and en.completed_at < least(w + interval '7 days', v_to)),
               'certificates', (select count(*) from public.certificates c
                                 where c.issued_at >= greatest(w, v_from) and c.issued_at < least(w + interval '7 days', v_to)
                                   and c.revoked_at is null)
             ) order by w)
        from generate_series(date_trunc('week', v_from), v_to - interval '1 second', interval '7 days') w
    ), '[]'::jsonb),
    'courses', coalesce((
      select jsonb_agg(row_to_json(x)::jsonb order by x.title)
        from (
          select c.id, c.title, c.status,
                 count(en.id) as enrolled,
                 count(en.started_at) as started,
                 count(en.completed_at) as completed,
                 round(count(en.completed_at)::numeric / nullif(count(en.started_at), 0), 4) as completion_rate,
                 (select count(distinct e.user_id) from public.learning_events e
                   where e.course_id = c.id and e.occurred_at >= v_from and e.occurred_at < v_to and e.event_type::text not in ('enrolled', 'quiz_attempts_reset', 'certificate_issued')) as active_in_period,
                 (select round(avg(qa.score_percent), 1) from public.quiz_attempts qa
                   where qa.course_id = c.id and qa.status = 'submitted' and qa.voided_at is null
                     and qa.submitted_at >= v_from and qa.submitted_at < v_to) as average_score,
                 (select count(*) from public.certificates ct where ct.course_id = c.id and ct.revoked_at is null) as certificates
            from public.courses c
            left join public.enrollments en on en.course_id = c.id
           where c.status <> 'draft'
           group by c.id
        ) x
    ), '[]'::jsonb),
    'institutions', coalesce((
      select jsonb_agg(row_to_json(x)::jsonb order by x.name)
        from (
          select i.id, i.name, i.city,
                 (select count(*) from public.institution_memberships m
                   where m.institution_id = i.id and m.role = 'teacher' and m.status = 'active') as teachers,
                 count(ca.id) as assignments,
                 count(en.completed_at) as completed,
                 round(count(en.completed_at)::numeric / nullif(count(ca.id), 0), 4) as completion_rate,
                 (select count(distinct e.user_id)
                    from public.learning_events e
                    join public.course_assignments ca2 on ca2.user_id = e.user_id and ca2.course_id = e.course_id
                                                     and ca2.institution_id = i.id and ca2.revoked_at is null
                   where e.occurred_at >= v_from and e.occurred_at < v_to and e.event_type::text not in ('enrolled', 'quiz_attempts_reset', 'certificate_issued')) as active_in_period,
                 count(ct.id) as certificates
            from public.institutions i
            left join public.course_assignments ca
                   on ca.institution_id = i.id and ca.revoked_at is null
                  and exists (select 1 from public.institution_memberships m
                               where m.institution_id = i.id and m.user_id = ca.user_id and m.role = 'teacher' and m.status = 'active')
            left join public.enrollments en on en.user_id = ca.user_id and en.course_id = ca.course_id
            left join public.certificates ct on ct.user_id = ca.user_id and ct.course_id = ca.course_id and ct.revoked_at is null
           where i.status = 'active'
           group by i.id
        ) x
    ), '[]'::jsonb),
    'quizzes', coalesce((
      select jsonb_agg(row_to_json(x)::jsonb order by x.course_title, x.module_position)
        from (
          select q.id, q.title, c.title as course_title, m.position + 1 as module_position,
                 count(distinct qa.user_id) as learners,
                 count(*) as attempts,
                 round(avg(qa.score_percent), 1) as average_score,
                 round(count(distinct qa.user_id) filter (where qa.passed)::numeric / nullif(count(distinct qa.user_id), 0), 4) as pass_rate,
                 round(count(*) filter (where qa.attempt_number = 1 and qa.passed)::numeric
                       / nullif(count(*) filter (where qa.attempt_number = 1), 0), 4) as first_attempt_pass_rate
            from public.quiz_attempts qa
            join public.quizzes q on q.id = qa.quiz_id
            join public.modules m on m.id = q.module_id
            join public.courses c on c.id = q.course_id
           where qa.status = 'submitted' and qa.voided_at is null
             and qa.submitted_at >= v_from and qa.submitted_at < v_to
           group by q.id, c.title, m.position
        ) x
    ), '[]'::jsonb)
  );
end;
$$;

-- ─── Institution reports: administrators and supervisors ───────────────────

create or replace function public.institution_overview(p_institution uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_days smallint;
begin
  perform private.require(
    private.is_course_staff() or private.can_supervise_institution(p_institution),
    'forbidden'
  );
  select inactivity_threshold_days into v_days from public.platform_settings where id;

  return (
    with teachers as (
      select m.user_id from public.institution_memberships m
       where m.institution_id = p_institution and m.role = 'teacher' and m.status = 'active'
    ),
    asg as (
      select ca.* from public.course_assignments ca
       join teachers t on t.user_id = ca.user_id
      where ca.institution_id = p_institution and ca.revoked_at is null
    ),
    enr as (
      select e.* from public.enrollments e join asg on asg.user_id = e.user_id and asg.course_id = e.course_id
    )
    select jsonb_build_object(
      'registered_teachers', (select count(*) from teachers),
      'active_teachers', (select count(distinct user_id) from enr
                            where last_activity_at >= now() - make_interval(days => v_days)),
      'inactivity_threshold_days', v_days,
      'authorized_courses', (select count(*) from public.course_permissions cp
                               join public.courses c on c.id = cp.course_id and c.status = 'published'
                              where cp.institution_id = p_institution and cp.revoked_at is null),
      'assigned_courses', (select count(distinct course_id) from asg),
      'assignments', (select count(*) from asg),
      'completed_assignments', (select count(*) from enr where status = 'completed'),
      'in_progress_assignments', (select count(*) from enr where status = 'active' and started_at is not null),
      'not_started_assignments', (select count(*) from enr where status = 'active' and started_at is null),
      'pending_invitations', (select count(*) from public.invitations i
                                where i.institution_id = p_institution and i.kind = 'institution_teacher'
                                  and i.accepted_at is null and i.revoked_at is null and i.expires_at > now())
    )
  );
end;
$$;

create or replace function public.institution_teacher_summaries(p_institution uuid)
returns table (
  user_id              uuid,
  membership_id        uuid,
  full_name            text,
  email                text,
  joined_at            timestamptz,
  source               public.membership_source,
  assigned_courses     integer,
  completed_courses    integer,
  certificates         integer,
  last_activity_at     timestamptz,
  exhausted_quizzes    integer,
  inactive             boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_days smallint;
begin
  perform private.require(
    private.is_course_staff() or private.can_supervise_institution(p_institution),
    'forbidden'
  );
  select inactivity_threshold_days into v_days from public.platform_settings where id;

  return query
  with t as (
    select m.user_id, m.id as membership_id, m.created_at, m.source
      from public.institution_memberships m
     where m.institution_id = p_institution and m.role = 'teacher' and m.status = 'active'
  ),
  asg as (
    select ca.user_id, ca.course_id, ca.assigned_at
      from public.course_assignments ca
      join t on t.user_id = ca.user_id
     where ca.institution_id = p_institution and ca.revoked_at is null
  )
  select t.user_id,
         t.membership_id,
         p.full_name,
         p.email,
         t.created_at,
         t.source,
         (select count(*)::integer from asg where asg.user_id = t.user_id),
         (select count(*)::integer from asg join public.enrollments e on e.user_id = asg.user_id and e.course_id = asg.course_id
            where asg.user_id = t.user_id and e.status = 'completed'),
         (select count(*)::integer from asg join public.certificates c on c.user_id = asg.user_id and c.course_id = asg.course_id
            where asg.user_id = t.user_id and c.revoked_at is null),
         (select max(e.last_activity_at) from asg join public.enrollments e on e.user_id = asg.user_id and e.course_id = asg.course_id
            where asg.user_id = t.user_id),
         (select count(*)::integer from (
            select a.quiz_id
              from public.quiz_attempts a
              join asg on asg.user_id = a.user_id and asg.course_id = a.course_id
             where a.user_id = t.user_id and a.voided_at is null and a.status = 'submitted'
             group by a.quiz_id
            having count(*) >= min(a.max_attempts) and not bool_or(a.passed)
          ) x),
         -- Inactive: an unfinished assigned course with no activity within
         -- the threshold (counting from assignment when never started).
         exists (
           select 1
             from asg
             join public.enrollments e on e.user_id = asg.user_id and e.course_id = asg.course_id
            where asg.user_id = t.user_id
              and e.status = 'active'
              and coalesce(e.last_activity_at, asg.assigned_at) < now() - make_interval(days => v_days)
         )
    from t
    join public.profiles p on p.id = t.user_id
   order by p.last_name, p.first_name, p.email;
end;
$$;

create or replace function public.institution_report(p_institution uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_from timestamptz;
  v_to   timestamptz;
begin
  perform private.require(
    private.is_course_staff() or private.can_supervise_institution(p_institution),
    'forbidden'
  );
  select b.v_from, b.v_to into v_from, v_to from private.period_bounds(p_from, p_to) b;

  return (
    -- Only (teacher, course) pairs this institution assigned, for its active members.
    with asg as (
      select ca.user_id, ca.course_id
        from public.course_assignments ca
        join public.institution_memberships m
          on m.institution_id = ca.institution_id and m.user_id = ca.user_id and m.role = 'teacher' and m.status = 'active'
       where ca.institution_id = p_institution and ca.revoked_at is null
    ),
    ev as (
      select e.user_id, e.course_id, e.occurred_at
        from public.learning_events e
        join asg on asg.user_id = e.user_id and asg.course_id = e.course_id
       where e.occurred_at >= v_from and e.occurred_at < v_to
         and e.event_type::text not in ('enrolled', 'quiz_attempts_reset', 'certificate_issued')
    ),
    att as (
      select qa.*
        from public.quiz_attempts qa
        join asg on asg.user_id = qa.user_id and asg.course_id = qa.course_id
       where qa.status = 'submitted' and qa.voided_at is null and qa.submitted_at >= v_from and qa.submitted_at < v_to
    ),
    enr as (
      select en.*
        from public.enrollments en
        join asg on asg.user_id = en.user_id and asg.course_id = en.course_id
    ),
    cert as (
      select ct.*
        from public.certificates ct
        join asg on asg.user_id = ct.user_id and asg.course_id = ct.course_id
       where ct.revoked_at is null
    )
    select jsonb_build_object(
      'from', p_from,
      'to', p_to,
      'kpis', jsonb_build_object(
        'teachers', (select count(*) from public.institution_memberships m
                      where m.institution_id = p_institution and m.role = 'teacher' and m.status = 'active'),
        'assignments', (select count(*) from asg),
        'completed', (select count(*) from enr where enr.status = 'completed'),
        'completion_rate', (select round(count(*) filter (where enr.status = 'completed')::numeric / nullif((select count(*) from asg), 0), 4) from enr),
        'active_teachers', (select count(distinct ev.user_id) from ev),
        'completions', (select count(*) from enr where enr.completed_at >= v_from and enr.completed_at < v_to),
        'attempts', (select count(*) from att),
        'average_score', (select round(avg(att.score_percent), 1) from att),
        'pass_rate', (select round(count(*) filter (where att.passed)::numeric / nullif(count(*), 0), 4) from att),
        'certificates', (select count(*) from cert where cert.issued_at >= v_from and cert.issued_at < v_to)
      ),
      'weekly', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'week', w::date,
                 'active_teachers', (select count(distinct ev.user_id) from ev
                                      where ev.occurred_at >= greatest(w, v_from) and ev.occurred_at < least(w + interval '7 days', v_to)),
                 'completions', (select count(*) from enr
                                  where enr.completed_at >= greatest(w, v_from) and enr.completed_at < least(w + interval '7 days', v_to))
               ) order by w)
          from generate_series(date_trunc('week', v_from), v_to - interval '1 second', interval '7 days') w
      ), '[]'::jsonb),
      'courses', coalesce((
        select jsonb_agg(row_to_json(x)::jsonb order by x.title)
          from (
            select c.id, c.title,
                   count(*) as assigned,
                   count(enr.started_at) as started,
                   count(enr.completed_at) as completed,
                   round(count(enr.completed_at)::numeric / nullif(count(*), 0), 4) as completion_rate,
                   (select round(avg(att.score_percent), 1) from att where att.course_id = c.id) as average_score,
                   (select count(*) from cert where cert.course_id = c.id) as certificates
              from asg
              join public.courses c on c.id = asg.course_id
              left join enr on enr.user_id = asg.user_id and enr.course_id = asg.course_id
             group by c.id
          ) x
      ), '[]'::jsonb)
    )
  );
end;
$$;

-- ─── Invitations: institution supervisors ──────────────────────────────────

create or replace function public.create_invitation(
  p_kind         public.invitation_kind,
  p_email        text,
  p_institution  uuid,
  p_token_hash   text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email   text := lower(btrim(p_email));
  v_days    smallint;
  v_id      uuid;
begin
  perform private.require(auth.uid() is not null, 'not_authenticated');

  if p_kind::text in ('institution_teacher', 'institution_supervisor') then
    perform private.require(
      private.is_sanady_admin() or private.is_institution_admin(p_institution),
      'forbidden'
    );
  else
    perform private.require(private.is_sanady_admin(), 'forbidden');
  end if;

  if p_kind::text in ('institution_admin', 'institution_teacher', 'institution_supervisor') then
    perform private.require(p_institution is not null, 'institution_required');
    perform private.require(
      exists (select 1 from public.institutions i where i.id = p_institution and i.status = 'active'),
      'institution_inactive'
    );
    perform private.require(
      not exists (
        select 1
          from public.institution_memberships m
          join public.profiles p on p.id = m.user_id
         where m.institution_id = p_institution
           and p.email = v_email
           and m.status = 'active'
      ),
      'already_member'
    );
  else
    perform private.require(p_institution is null, 'institution_not_allowed');
  end if;

  if p_kind = 'platform_admin' then
    perform private.require(
      not exists (
        select 1 from public.platform_roles r join public.profiles p on p.id = r.user_id
         where p.email = v_email
      ),
      'already_admin'
    );
  end if;

  select invitation_validity_days into v_days from public.platform_settings where id;

  -- Replace any open invitation for the same person and scope.
  update public.invitations
     set revoked_at = now(), revoked_by = auth.uid()
   where kind = p_kind
     and email = v_email
     and coalesce(institution_id, '00000000-0000-0000-0000-000000000000'::uuid)
         = coalesce(p_institution, '00000000-0000-0000-0000-000000000000'::uuid)
     and accepted_at is null
     and revoked_at is null;

  insert into public.invitations (kind, email, institution_id, token_hash, invited_by, expires_at)
  values (p_kind, v_email, p_institution, p_token_hash, auth.uid(), now() + make_interval(days => v_days))
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.accept_invitation(p_token_hash text, p_user uuid, p_consent boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv     public.invitations;
  v_email   text;
  v_member  public.institution_memberships;
  v_inst    uuid;
begin
  select * into v_inv from public.invitations where token_hash = p_token_hash for update;
  perform private.require(found, 'invitation_not_found');
  perform private.require(v_inv.revoked_at is null, 'invitation_revoked');
  perform private.require(v_inv.accepted_at is null, 'invitation_already_accepted');
  perform private.require(v_inv.expires_at > now(), 'invitation_expired');

  select email into v_email from public.profiles where id = p_user and status = 'active';
  perform private.require(found, 'account_unavailable');
  perform private.require(v_email = v_inv.email, 'invitation_email_mismatch');

  if v_inv.kind = 'platform_admin' then
    insert into public.platform_roles (user_id, role, granted_by)
    values (p_user, 'sanady_admin', v_inv.invited_by)
    on conflict (user_id) do nothing;

  elsif v_inv.kind = 'institution_admin' then
    select * into v_member from public.institution_memberships
     where institution_id = v_inv.institution_id and user_id = p_user;
    if found then
      update public.institution_memberships
         set role = 'admin', status = 'active', source = 'invitation',
             revoked_at = null, revoked_by = null
       where id = v_member.id;
    else
      insert into public.institution_memberships (institution_id, user_id, role, source)
      values (v_inv.institution_id, p_user, 'admin', 'invitation');
    end if;

  elsif v_inv.kind::text = 'institution_supervisor' then
    -- Read-only access to the institution; never downgrades an administrator.
    select * into v_member from public.institution_memberships
     where institution_id = v_inv.institution_id and user_id = p_user;
    if found and v_member.status = 'active' then
      raise exception using errcode = 'P0001', message = 'already_member';
    elsif found then
      update public.institution_memberships
         set role = 'supervisor', status = 'active', source = 'invitation', consented_at = null,
             revoked_at = null, revoked_by = null, created_at = now()
       where id = v_member.id;
    else
      insert into public.institution_memberships (institution_id, user_id, role, source)
      values (v_inv.institution_id, p_user, 'supervisor', 'invitation');
    end if;

  elsif v_inv.kind = 'institution_teacher' then
    perform private.require(p_consent is true, 'consent_required');
    if v_inv.enrollment_code_id is not null then
      v_inst := private.join_with_code(v_inv.enrollment_code_id, p_user);
    else
      select * into v_member from public.institution_memberships
       where institution_id = v_inv.institution_id and user_id = p_user;
      if found and v_member.status = 'active' then
        raise exception using errcode = 'P0001', message = 'already_member';
      elsif found then
        update public.institution_memberships
           set role = 'teacher', status = 'active', source = 'invitation', consented_at = now(),
               revoked_at = null, revoked_by = null, created_at = now()
         where id = v_member.id;
      else
        insert into public.institution_memberships (institution_id, user_id, role, source, consented_at)
        values (v_inv.institution_id, p_user, 'teacher', 'invitation', now());
      end if;
    end if;
  end if;
  -- kind = 'teacher': the personal account itself is the outcome.

  update public.invitations set accepted_at = now(), accepted_by = p_user where id = v_inv.id;

  return jsonb_build_object('kind', v_inv.kind, 'institution_id', v_inv.institution_id);
end;
$$;

-- ─── Public course page: trainers ──────────────────────────────────────────

create or replace function public.public_course(p_course uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', c.id,
    'title', c.title,
    'summary', c.summary,
    'description', c.description,
    'objectives', to_jsonb(c.objectives),
    'target_audience', c.target_audience,
    'level', c.level,
    'estimated_minutes', c.estimated_minutes,
    'cover_path', c.cover_path,
    'published_at', c.published_at,
    'updated_at', c.updated_at,
    'category', cat.name,
    'trainers', coalesce((
      select jsonb_agg(jsonb_build_object('name', p.full_name, 'job_title', p.job_title) order by p.last_name, p.first_name)
        from public.course_trainers ct
        join public.profiles p on p.id = ct.user_id and p.status = 'active'
       where ct.course_id = c.id
    ), '[]'::jsonb),
    'modules', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', m.id,
               'title', m.title,
               'description', m.description,
               'lessons', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'title', l.title,
                          'kind', l.kind,
                          'is_mandatory', l.is_mandatory,
                          'estimated_minutes', l.estimated_minutes,
                          'video_duration_seconds', l.video_duration_seconds,
                          'pdf_page_count', l.pdf_page_count
                        ) order by l.position)
                   from public.lessons l
                  where l.module_id = m.id and l.archived_at is null
               ), '[]'::jsonb),
               'quiz', (
                 select jsonb_build_object(
                          'title', q.title,
                          'pass_threshold', q.pass_threshold,
                          'max_attempts', q.max_attempts,
                          'question_count', (select count(*) from public.questions qq where qq.quiz_id = q.id and qq.archived_at is null))
                   from public.quizzes q where q.module_id = m.id
               )
             ) order by m.position)
        from public.modules m
       where m.course_id = c.id and m.archived_at is null
    ), '[]'::jsonb)
  )
    from public.courses c
    left join public.course_categories cat on cat.id = c.category_id
   where c.id = p_course and c.status = 'published' and c.public_listing;
$$;

-- ─── Review workflow ───────────────────────────────────────────────────────

-- A trainer (or staff) submits a complete draft for review.
create function public.submit_course_for_review(p_course uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_issues jsonb;
begin
  perform private.require(private.can_author_course(p_course), 'forbidden');
  select status::text into v_status from public.courses where id = p_course for update;
  perform private.require(v_status is not null, 'not_found');
  perform private.require(v_status = 'draft', 'course_not_draft');
  v_issues := public.validate_course(p_course);
  if jsonb_array_length(v_issues) > 0 then
    raise exception using errcode = 'P0001', message = 'course_not_publishable', detail = v_issues::text;
  end if;
  perform set_config('sanady.course_review', 'on', true);
  update public.courses
     set status = 'review', submitted_at = now(), submitted_by = auth.uid(), review_comment = null
   where id = p_course;
  perform set_config('sanady.course_review', 'off', true);
end;
$$;

-- Staff approve (publish) a course under review.
create function public.approve_course(p_course uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  perform private.require(private.is_course_staff(), 'forbidden');
  select status::text into v_status from public.courses where id = p_course for update;
  perform private.require(v_status = 'review', 'course_not_in_review');
  -- The publication guard re-checks completeness.
  update public.courses
     set status = 'published', reviewed_at = now(), reviewed_by = auth.uid(), review_comment = null
   where id = p_course;
end;
$$;

-- Staff send a course back to draft with an explanation for its trainers.
create function public.request_course_changes(p_course uuid, p_comment text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  perform private.require(private.is_course_staff(), 'forbidden');
  perform private.require(char_length(btrim(coalesce(p_comment, ''))) between 5 and 2000, 'invalid_input');
  select status::text into v_status from public.courses where id = p_course for update;
  perform private.require(v_status = 'review', 'course_not_in_review');
  update public.courses
     set status = 'draft', reviewed_at = now(), reviewed_by = auth.uid(), review_comment = btrim(p_comment)
   where id = p_course;
end;
$$;

-- ─── Trainers of a course ──────────────────────────────────────────────────
create function public.assign_course_trainer(p_course uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require(private.is_course_staff(), 'forbidden');
  perform private.require(exists (select 1 from public.courses where id = p_course), 'not_found');
  perform private.require(private.platform_role(p_user) = 'trainer', 'not_a_trainer');
  insert into public.course_trainers (course_id, user_id, assigned_by)
  values (p_course, p_user, auth.uid())
  on conflict (course_id, user_id) do nothing;
end;
$$;

create function public.remove_course_trainer(p_course uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require(private.is_course_staff(), 'forbidden');
  delete from public.course_trainers where course_id = p_course and user_id = p_user;
end;
$$;

-- ─── Platform roles of the pedagogical team ────────────────────────────────
-- SANADY administrators grant or remove « training_manager » / « trainer »
-- on an existing account. Administrator rights are only granted by
-- invitation and are never changed here.
create function public.set_platform_role(p_user uuid, p_role text)
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
  perform private.require(p_role is null or p_role in ('training_manager', 'trainer'), 'invalid_input');
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

-- Platform roles are visible to the team that needs them.
drop policy platform_roles_select on public.platform_roles;
create policy platform_roles_select on public.platform_roles
  for select to authenticated
  using (user_id = (select auth.uid()) or private.is_course_staff());

-- ─── Grants ────────────────────────────────────────────────────────────────
revoke execute on function
  public.submit_course_for_review(uuid),
  public.approve_course(uuid),
  public.request_course_changes(uuid, text),
  public.assign_course_trainer(uuid, uuid),
  public.remove_course_trainer(uuid, uuid),
  public.set_platform_role(uuid, text)
from public, anon;
grant execute on function
  public.submit_course_for_review(uuid),
  public.approve_course(uuid),
  public.request_course_changes(uuid, text),
  public.assign_course_trainer(uuid, uuid),
  public.remove_course_trainer(uuid, uuid),
  public.set_platform_role(uuid, text)
to authenticated;

revoke execute on function
  private.platform_role(uuid), private.is_training_manager(uuid), private.is_course_staff(uuid),
  private.is_course_trainer(uuid, uuid), private.can_author_course(uuid), private.can_edit_course(uuid),
  private.can_supervise_institution(uuid, uuid), private.supervised_institutions(uuid)
from public, anon;
grant execute on function
  private.platform_role(uuid), private.is_training_manager(uuid), private.is_course_staff(uuid),
  private.is_course_trainer(uuid, uuid), private.can_author_course(uuid), private.can_edit_course(uuid),
  private.can_supervise_institution(uuid, uuid), private.supervised_institutions(uuid)
to authenticated, service_role;
