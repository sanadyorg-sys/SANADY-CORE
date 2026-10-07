-- ════════════════════════════════════════════════════════════════════════════
-- SANADY · 0006 · Row Level Security & privileges
--
-- Model
--   * Default deny: every table has RLS enabled and privileges are granted
--     explicitly (nothing relies on Supabase's default grants).
--   * anon: no table access at all; only verify_certificate().
--   * authenticated: SELECT filtered by policies; writes are limited to
--     content authoring (SANADY admins) and the user's own profile fields.
--     Every other write goes through the audited functions of 0005.
--   * service_role: server-only (invitation acceptance, rate limiting).
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Additional policy helpers ─────────────────────────────────────────────
create function private.can_view_profile(p_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_profile = auth.uid()
      or private.is_sanady_admin()
      or exists (
           select 1 from public.institution_memberships m
            where m.user_id = p_profile
              and m.status = 'active'
              and m.institution_id in (select private.administered_institutions())
         );
$$;

-- Is the course authorized for at least one institution the caller administers?
create function private.institution_admin_has_course(p_course uuid)
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
       and cp.institution_id in (select private.administered_institutions())
  );
$$;

create function private.can_view_course(p_course uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_sanady_admin()
      or exists (select 1 from public.enrollments e where e.course_id = p_course and e.user_id = auth.uid())
      or private.has_course_access(p_course)
      or (
        exists (select 1 from public.courses c where c.id = p_course and c.status = 'published')
        and private.institution_admin_has_course(p_course)
      );
$$;

create function private.can_view_course_content(p_course uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_sanady_admin()
      or private.has_course_access(p_course)
      or private.institution_admin_has_course(p_course);
$$;

-- Learner data visibility: self, SANADY admins, or the institution that
-- assigned this course to this (consenting, active) member.
create function private.can_view_learner_data(p_learner uuid, p_course uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_learner = auth.uid()
      or private.is_sanady_admin()
      or private.can_view_learner_course(p_learner, p_course);
$$;

-- ─── Enable RLS everywhere ─────────────────────────────────────────────────
alter table public.profiles                 enable row level security;
alter table public.platform_roles           enable row level security;
alter table public.platform_settings        enable row level security;
alter table public.audit_logs               enable row level security;
alter table public.institutions             enable row level security;
alter table public.enrollment_codes         enable row level security;
alter table public.institution_memberships  enable row level security;
alter table public.invitations              enable row level security;
alter table public.course_categories        enable row level security;
alter table public.courses                  enable row level security;
alter table public.modules                  enable row level security;
alter table public.lessons                  enable row level security;
alter table public.lesson_resources         enable row level security;
alter table public.quizzes                  enable row level security;
alter table public.questions                enable row level security;
alter table public.question_options         enable row level security;
alter table public.course_permissions       enable row level security;
alter table public.course_assignments       enable row level security;
alter table public.enrollments              enable row level security;
alter table public.lesson_progress          enable row level security;
alter table public.video_progress           enable row level security;
alter table public.document_progress        enable row level security;
alter table public.quiz_attempts            enable row level security;
alter table public.quiz_answers             enable row level security;
alter table public.certificates             enable row level security;
alter table public.learning_events          enable row level security;
alter table private.rate_limits             enable row level security;

-- ─── Reset privileges ──────────────────────────────────────────────────────
revoke all on all tables    in schema public  from anon, authenticated;
revoke all on all sequences in schema public  from anon, authenticated;
revoke all on all tables    in schema private from anon, authenticated, public;
revoke execute on all functions in schema public  from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
grant execute on all functions in schema private to service_role;

-- Helpers evaluated inside RLS policies.
grant execute on function
  private.is_active_user(uuid),
  private.is_sanady_admin(uuid),
  private.is_institution_admin(uuid, uuid),
  private.is_institution_member(uuid, uuid),
  private.administered_institutions(uuid),
  private.has_course_access(uuid, uuid),
  private.institution_has_course(uuid, uuid),
  private.can_view_learner_course(uuid, uuid, uuid),
  private.can_view_profile(uuid),
  private.institution_admin_has_course(uuid),
  private.can_view_course(uuid),
  private.can_view_course_content(uuid),
  private.can_view_learner_data(uuid, uuid),
  private.try_uuid(text)
to authenticated;

-- ─── Profiles ──────────────────────────────────────────────────────────────
create policy profiles_select on public.profiles
  for select to authenticated
  using (private.can_view_profile(id));

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

grant select on public.profiles to authenticated;
-- Only personal fields are self-editable (status, e-mail, timestamps are not).
grant update (first_name, last_name, job_title, subject_area, phone) on public.profiles to authenticated;

-- ─── Platform roles ────────────────────────────────────────────────────────
create policy platform_roles_select on public.platform_roles
  for select to authenticated
  using (user_id = (select auth.uid()) or private.is_sanady_admin());

create policy platform_roles_delete on public.platform_roles
  for delete to authenticated
  using (private.is_sanady_admin() and user_id <> (select auth.uid()));

grant select, delete on public.platform_roles to authenticated;

-- ─── Platform settings ─────────────────────────────────────────────────────
create policy platform_settings_select on public.platform_settings
  for select to authenticated using (true);

create policy platform_settings_update on public.platform_settings
  for update to authenticated
  using (private.is_sanady_admin())
  with check (private.is_sanady_admin());

grant select on public.platform_settings to authenticated;
grant update (inactivity_threshold_days, invitation_validity_days, certificate_issuer_name,
              certificate_signatory_name, certificate_signatory_title, support_email, updated_by)
  on public.platform_settings to authenticated;

-- ─── Audit log (read-only, SANADY admins) ──────────────────────────────────
create policy audit_logs_select on public.audit_logs
  for select to authenticated using (private.is_sanady_admin());

grant select on public.audit_logs to authenticated;

-- ─── Institutions ──────────────────────────────────────────────────────────
create policy institutions_select on public.institutions
  for select to authenticated
  using (private.is_sanady_admin() or private.is_institution_member(id));

create policy institutions_insert on public.institutions
  for insert to authenticated with check (private.is_sanady_admin());

create policy institutions_update on public.institutions
  for update to authenticated
  using (private.is_sanady_admin()) with check (private.is_sanady_admin());

grant select, insert, update on public.institutions to authenticated;

-- ─── Memberships ───────────────────────────────────────────────────────────
create policy memberships_select on public.institution_memberships
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.is_sanady_admin()
    or private.is_institution_admin(institution_id)
  );

grant select on public.institution_memberships to authenticated;

-- ─── Invitations (token hash is never readable by clients) ─────────────────
create policy invitations_select on public.invitations
  for select to authenticated
  using (
    private.is_sanady_admin()
    or (kind = 'institution_teacher' and private.is_institution_admin(institution_id))
  );

grant select (id, kind, email, institution_id, enrollment_code_id, invited_by, expires_at,
              email_sent_at, accepted_at, accepted_by, revoked_at, revoked_by, created_at)
  on public.invitations to authenticated;

-- ─── Enrollment codes ──────────────────────────────────────────────────────
create policy enrollment_codes_select on public.enrollment_codes
  for select to authenticated
  using (private.is_sanady_admin() or private.is_institution_admin(institution_id));

grant select on public.enrollment_codes to authenticated;

-- ─── Course catalog & curriculum ───────────────────────────────────────────
create policy categories_select on public.course_categories
  for select to authenticated using (true);
create policy categories_write on public.course_categories
  for all to authenticated
  using (private.is_sanady_admin()) with check (private.is_sanady_admin());
grant select, insert, update, delete on public.course_categories to authenticated;

create policy courses_select on public.courses
  for select to authenticated using (private.can_view_course(id));
create policy courses_insert on public.courses
  for insert to authenticated with check (private.is_sanady_admin());
create policy courses_update on public.courses
  for update to authenticated
  using (private.is_sanady_admin()) with check (private.is_sanady_admin());
create policy courses_delete on public.courses
  for delete to authenticated using (private.is_sanady_admin() and status = 'draft');
grant select, insert, update, delete on public.courses to authenticated;

create policy modules_select on public.modules
  for select to authenticated
  using (private.is_sanady_admin() or (archived_at is null and private.can_view_course_content(course_id)));
create policy modules_write on public.modules
  for all to authenticated
  using (private.is_sanady_admin()) with check (private.is_sanady_admin());
grant select, insert, update on public.modules to authenticated;

create policy lessons_select on public.lessons
  for select to authenticated
  using (private.is_sanady_admin() or (archived_at is null and private.can_view_course_content(course_id)));
create policy lessons_write on public.lessons
  for all to authenticated
  using (private.is_sanady_admin()) with check (private.is_sanady_admin());
grant select, insert, update on public.lessons to authenticated;

create policy lesson_resources_select on public.lesson_resources
  for select to authenticated
  using (exists (select 1 from public.lessons l where l.id = lesson_id));
create policy lesson_resources_write on public.lesson_resources
  for all to authenticated
  using (private.is_sanady_admin()) with check (private.is_sanady_admin());
grant select, insert, update, delete on public.lesson_resources to authenticated;

create policy quizzes_select on public.quizzes
  for select to authenticated
  using (private.is_sanady_admin() or private.can_view_course_content(course_id));
create policy quizzes_write on public.quizzes
  for all to authenticated
  using (private.is_sanady_admin()) with check (private.is_sanady_admin());
grant select, insert, update on public.quizzes to authenticated;

-- Questions and options (with correctness) are visible to SANADY admins only.
-- Learners receive questions exclusively through start_quiz_attempt().
create policy questions_admin on public.questions
  for all to authenticated
  using (private.is_sanady_admin()) with check (private.is_sanady_admin());
grant select, update on public.questions to authenticated;

create policy question_options_admin on public.question_options
  for all to authenticated
  using (private.is_sanady_admin()) with check (private.is_sanady_admin());
grant select on public.question_options to authenticated;

-- ─── Authorization & assignment (read-only; writes via functions) ──────────
create policy course_permissions_select on public.course_permissions
  for select to authenticated
  using (
    private.is_sanady_admin()
    or user_id = (select auth.uid())
    or (institution_id is not null and private.is_institution_admin(institution_id))
  );
grant select on public.course_permissions to authenticated;

create policy course_assignments_select on public.course_assignments
  for select to authenticated
  using (
    private.is_sanady_admin()
    or user_id = (select auth.uid())
    or private.is_institution_admin(institution_id)
  );
grant select on public.course_assignments to authenticated;

-- ─── Learner records (read-only for clients) ───────────────────────────────
create policy enrollments_select on public.enrollments
  for select to authenticated using (private.can_view_learner_data(user_id, course_id));
grant select on public.enrollments to authenticated;

create policy lesson_progress_select on public.lesson_progress
  for select to authenticated using (private.can_view_learner_data(user_id, course_id));
grant select on public.lesson_progress to authenticated;

create policy video_progress_select on public.video_progress
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.lessons l
                where l.id = lesson_id and private.can_view_learner_data(video_progress.user_id, l.course_id))
  );
grant select on public.video_progress to authenticated;

create policy document_progress_select on public.document_progress
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.lessons l
                where l.id = lesson_id and private.can_view_learner_data(document_progress.user_id, l.course_id))
  );
grant select on public.document_progress to authenticated;

create policy quiz_attempts_select on public.quiz_attempts
  for select to authenticated using (private.can_view_learner_data(user_id, course_id));
grant select on public.quiz_attempts to authenticated;

create policy quiz_answers_select on public.quiz_answers
  for select to authenticated
  using (exists (select 1 from public.quiz_attempts a where a.id = attempt_id and a.status = 'submitted'));
grant select on public.quiz_answers to authenticated;

create policy certificates_select on public.certificates
  for select to authenticated using (private.can_view_learner_data(user_id, course_id));
grant select on public.certificates to authenticated;

create policy learning_events_select on public.learning_events
  for select to authenticated using (private.can_view_learner_data(user_id, course_id));
grant select on public.learning_events to authenticated;

-- ─── Callable functions ────────────────────────────────────────────────────
grant execute on function
  public.complete_onboarding(text, text, text, text),
  public.set_user_status(uuid, public.account_status),
  public.create_invitation(public.invitation_kind, text, uuid, text),
  public.revoke_invitation(uuid),
  public.create_enrollment_code(uuid, text, text, integer, timestamptz),
  public.revoke_enrollment_code(uuid),
  public.redeem_enrollment_code(text, boolean),
  public.revoke_membership(uuid),
  public.leave_institution(uuid),
  public.validate_course(uuid),
  public.reorder_modules(uuid, uuid[]),
  public.reorder_lessons(uuid, uuid[]),
  public.reorder_questions(uuid, uuid[]),
  public.remove_lesson(uuid),
  public.remove_question(uuid),
  public.remove_module(uuid),
  public.save_question(uuid, uuid, public.question_kind, text, text, smallint, jsonb),
  public.grant_course_to_institution(uuid, uuid),
  public.revoke_course_from_institution(uuid, uuid),
  public.grant_course_to_user(uuid, uuid),
  public.revoke_course_from_user(uuid, uuid),
  public.assign_course(uuid, uuid, uuid[], date),
  public.unassign_course(uuid),
  public.refresh_course_completion(uuid),
  public.start_lesson(uuid),
  public.record_video_progress(uuid, integer[], integer, integer),
  public.record_document_progress(uuid, integer[], integer),
  public.quiz_status(uuid, uuid),
  public.start_quiz_attempt(uuid),
  public.get_attempt_result(uuid),
  public.submit_quiz_attempt(uuid, jsonb),
  public.reset_quiz_attempts(uuid, uuid, text),
  public.revoke_certificate(uuid, text),
  public.course_progress(uuid, uuid),
  public.institution_overview(uuid),
  public.institution_teacher_summaries(uuid),
  public.platform_overview(),
  public.exhausted_attempts()
to authenticated;

grant execute on function public.verify_certificate(text) to anon, authenticated;

-- Server-only functions (service role): explicitly listed for clarity.
revoke execute on function
  public.describe_invitation(text),
  public.accept_invitation(text, uuid, boolean),
  public.describe_enrollment_code(text),
  public.create_code_invitation(text, text, text),
  public.consume_rate_limit(text, integer, integer),
  public.mark_invitation_sent(uuid)
from anon, authenticated;
