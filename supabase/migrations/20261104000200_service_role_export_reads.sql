-- The end-of-contract export is built on the server (service key) after
-- public.can_export_tenant() has allowed the person. On this project, new
-- tables are not readable by the service role by default: grant read access
-- to exactly the tables the export reads (see 20261019000200 for the same
-- pattern with document purges).
grant select on
  public.enterprise_tenants, public.partner_organizations, public.enterprise_departments, public.enterprise_usage_records,
  public.enterprise_support_requests, public.enterprise_support_messages,
  public.institution_memberships, public.course_assignments, public.profiles,
  public.courses, public.modules, public.lessons, public.quizzes, public.questions, public.question_options,
  public.enrollments, public.quiz_attempts, public.certificates, public.lesson_progress
to service_role;
