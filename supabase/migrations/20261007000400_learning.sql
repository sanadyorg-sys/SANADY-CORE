-- ════════════════════════════════════════════════════════════════════════════
-- SANADY · 0004 · Learning records
-- Three distinct concepts are stored separately and never merged:
--   1. Lesson completion   → lesson_progress (+ video_progress / document_progress)
--   2. Assessment results  → quiz_attempts / quiz_answers
--   3. Certification       → certificates
-- All writes happen through SECURITY DEFINER functions (0005); learners have
-- no direct INSERT/UPDATE rights on these tables.
-- ════════════════════════════════════════════════════════════════════════════

create type public.progress_status as enum ('in_progress', 'completed');
create type public.attempt_status  as enum ('in_progress', 'submitted');
create type public.learning_event_type as enum (
  'enrolled',
  'lesson_started',
  'video_checkpoint',
  'lesson_completed',
  'quiz_started',
  'quiz_submitted',
  'quiz_passed',
  'quiz_failed',
  'quiz_attempts_reset',
  'course_completed',
  'certificate_issued'
);

-- ─── Lesson progress ───────────────────────────────────────────────────────
create table public.lesson_progress (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  lesson_id        uuid not null references public.lessons (id) on delete restrict,
  course_id        uuid not null references public.courses (id) on delete restrict,
  status           public.progress_status not null default 'in_progress',
  progress_ratio   numeric(5, 4) not null default 0 check (progress_ratio between 0 and 1),
  -- Resume pointer: seconds for videos, page number for PDFs.
  resume_position  integer not null default 0 check (resume_position >= 0),
  started_at       timestamptz not null default now(),
  completed_at     timestamptz,
  updated_at       timestamptz not null default now(),
  unique (user_id, lesson_id),
  check ((status = 'completed') = (completed_at is not null))
);

create index lesson_progress_course_idx on public.lesson_progress (user_id, course_id);

-- Video coverage stored as distinct 1 % buckets (0‥99). Replaying the same
-- segment never adds progress because buckets are merged as a set.
create table public.video_progress (
  user_id           uuid not null references public.profiles (id) on delete cascade,
  lesson_id         uuid not null references public.lessons (id) on delete restrict,
  watched_buckets   smallint[] not null default '{}',
  milestones        smallint[] not null default '{}',
  duration_seconds  integer check (duration_seconds > 0),
  updated_at        timestamptz not null default now(),
  primary key (user_id, lesson_id),
  check (cardinality(watched_buckets) <= 100)
);

-- PDF reading coverage stored as the distinct set of pages viewed.
create table public.document_progress (
  user_id       uuid not null references public.profiles (id) on delete cascade,
  lesson_id     uuid not null references public.lessons (id) on delete restrict,
  pages_viewed  integer[] not null default '{}',
  page_count    integer not null check (page_count > 0),
  updated_at    timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

-- ─── Quiz attempts ─────────────────────────────────────────────────────────
create table public.quiz_attempts (
  id              uuid primary key default gen_random_uuid(),
  quiz_id         uuid not null references public.quizzes (id) on delete restrict,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  course_id       uuid not null references public.courses (id) on delete restrict,
  attempt_number  smallint not null check (attempt_number >= 1),
  status          public.attempt_status not null default 'in_progress',
  pass_threshold  smallint not null,
  max_attempts    smallint not null,
  -- Question order frozen at start; grading uses exactly these questions.
  question_ids    uuid[] not null,
  started_at      timestamptz not null default now(),
  submitted_at    timestamptz,
  earned_points   integer,
  max_points      integer,
  score_percent   numeric(5, 2) check (score_percent between 0 and 100),
  passed          boolean,
  voided_at       timestamptz,
  voided_by       uuid references public.profiles (id) on delete set null,
  void_reason     text check (char_length(void_reason) <= 500),
  check ((status = 'submitted') = (submitted_at is not null)),
  check (status = 'in_progress' or (score_percent is not null and passed is not null))
);

-- Database-level guarantees (the functions also check, but these are final):
-- one attempt number per learner per quiz, and a single open attempt.
create unique index quiz_attempts_number_idx
  on public.quiz_attempts (quiz_id, user_id, attempt_number)
  where voided_at is null;
create unique index quiz_attempts_one_open_idx
  on public.quiz_attempts (quiz_id, user_id)
  where status = 'in_progress' and voided_at is null;
create index quiz_attempts_user_course_idx on public.quiz_attempts (user_id, course_id);

create table public.quiz_answers (
  id                   uuid primary key default gen_random_uuid(),
  attempt_id           uuid not null references public.quiz_attempts (id) on delete cascade,
  question_id          uuid not null references public.questions (id) on delete restrict,
  selected_option_ids  uuid[] not null default '{}',
  is_correct           boolean not null,
  points_awarded       integer not null check (points_awarded >= 0),
  unique (attempt_id, question_id)
);

-- ─── Certificates ──────────────────────────────────────────────────────────
-- Snapshot of the facts at issuance so later course edits never alter an
-- issued certificate. UNIQUE (user_id, course_id) makes issuance idempotent.
create table public.certificates (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references public.profiles (id) on delete cascade,
  course_id                uuid not null references public.courses (id) on delete restrict,
  certificate_number       text not null unique check (certificate_number ~ '^SND-[0-9]{4}-[0-9A-F]{8}$'),
  verification_code        text not null unique check (verification_code ~ '^[0-9a-f]{32}$'),
  recipient_name           text not null,
  course_title             text not null,
  course_duration_minutes  integer,
  completed_at             timestamptz not null,
  issued_at                timestamptz not null default now(),
  revoked_at               timestamptz,
  revoked_by               uuid references public.profiles (id) on delete set null,
  revoke_reason            text check (char_length(revoke_reason) <= 500),
  unique (user_id, course_id)
);

create index certificates_course_idx on public.certificates (course_id);

create trigger certificates_audit
  after update on public.certificates
  for each row execute function private.audit_row_change('certificate_number');

-- ─── Learning events (meaningful milestones only) ─────────────────────────
create table public.learning_events (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  course_id    uuid not null references public.courses (id) on delete cascade,
  lesson_id    uuid references public.lessons (id) on delete set null,
  quiz_id      uuid references public.quizzes (id) on delete set null,
  event_type   public.learning_event_type not null,
  metadata     jsonb not null default '{}'::jsonb,
  occurred_at  timestamptz not null default now()
);

create index learning_events_user_idx   on public.learning_events (user_id, occurred_at desc);
create index learning_events_course_idx on public.learning_events (course_id, user_id, occurred_at desc);

create function private.record_event(
  p_user      uuid,
  p_course    uuid,
  p_type      public.learning_event_type,
  p_lesson    uuid default null,
  p_quiz      uuid default null,
  p_metadata  jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.learning_events (user_id, course_id, lesson_id, quiz_id, event_type, metadata)
  values (p_user, p_course, p_lesson, p_quiz, p_type, coalesce(p_metadata, '{}'::jsonb));
$$;
