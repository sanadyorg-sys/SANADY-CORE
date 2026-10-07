-- ════════════════════════════════════════════════════════════════════════════
-- SANADY · 0003 · Courses, curriculum, assessments, authorization
-- Course → Modules → Lessons (video | pdf) → Module quiz (mandatory)
-- ════════════════════════════════════════════════════════════════════════════

create type public.course_level      as enum ('debutant', 'intermediaire', 'avance');
create type public.course_status     as enum ('draft', 'published', 'archived');
create type public.lesson_kind       as enum ('video', 'pdf');
create type public.video_provider    as enum ('storage', 'mux');
create type public.question_kind     as enum ('single', 'multiple');
create type public.enrollment_status as enum ('active', 'completed');

-- ─── Categories ────────────────────────────────────────────────────────────
create table public.course_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (char_length(btrim(name)) between 2 and 80),
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

-- ─── Courses ───────────────────────────────────────────────────────────────
create table public.courses (
  id                 uuid primary key default gen_random_uuid(),
  title              text not null check (char_length(btrim(title)) between 3 and 200),
  summary            text not null default '' check (char_length(summary) <= 400),
  description        text not null default '' check (char_length(description) <= 20000),
  objectives         text[] not null default '{}' check (cardinality(objectives) <= 20),
  cover_path         text,
  estimated_minutes  integer check (estimated_minutes between 1 and 100000),
  category_id        uuid references public.course_categories (id) on delete set null,
  target_audience    text not null default '' check (char_length(target_audience) <= 300),
  level              public.course_level not null default 'debutant',
  status             public.course_status not null default 'draft',
  published_at       timestamptz,
  created_by         uuid references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index courses_status_idx   on public.courses (status, updated_at desc);
create index courses_category_idx on public.courses (category_id);

create trigger courses_updated_at
  before update on public.courses
  for each row execute function private.set_updated_at();

create trigger courses_audit
  after insert or update or delete on public.courses
  for each row execute function private.audit_row_change('title');

-- ─── Modules ───────────────────────────────────────────────────────────────
create table public.modules (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null references public.courses (id) on delete cascade,
  title        text not null check (char_length(btrim(title)) between 2 and 200),
  description  text not null default '' check (char_length(description) <= 4000),
  position     integer not null check (position >= 0),
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index modules_position_idx on public.modules (course_id, position) where archived_at is null;

create trigger modules_updated_at
  before update on public.modules
  for each row execute function private.set_updated_at();

create trigger modules_audit
  after insert or update or delete on public.modules
  for each row execute function private.audit_row_change('title');

-- ─── Lessons ───────────────────────────────────────────────────────────────
create table public.lessons (
  id                      uuid primary key default gen_random_uuid(),
  module_id               uuid not null references public.modules (id) on delete cascade,
  course_id               uuid not null references public.courses (id) on delete cascade,
  title                   text not null check (char_length(btrim(title)) between 2 and 200),
  description             text not null default '' check (char_length(description) <= 10000),
  kind                    public.lesson_kind not null,
  position                integer not null check (position >= 0),
  is_mandatory            boolean not null default true,
  estimated_minutes       integer check (estimated_minutes between 1 and 1440),
  -- Video
  video_provider          public.video_provider,
  video_ref               text check (char_length(video_ref) <= 500),
  video_duration_seconds  integer check (video_duration_seconds > 0),
  -- PDF
  pdf_path                text check (char_length(pdf_path) <= 500),
  pdf_page_count          integer check (pdf_page_count between 1 and 5000),
  -- Share of the content (video buckets / PDF pages) that must be covered.
  -- NULL → platform default: 0.90 for video, 1.00 for PDF.
  completion_threshold    numeric(3, 2) check (completion_threshold between 0.50 and 1.00),
  archived_at             timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  check (kind = 'video' or (video_provider is null and video_ref is null and video_duration_seconds is null)),
  check (kind = 'pdf'   or (pdf_path is null and pdf_page_count is null))
);

create unique index lessons_position_idx on public.lessons (module_id, position) where archived_at is null;
create index lessons_course_idx on public.lessons (course_id) where archived_at is null;

create trigger lessons_updated_at
  before update on public.lessons
  for each row execute function private.set_updated_at();

create trigger lessons_audit
  after insert or update or delete on public.lessons
  for each row execute function private.audit_row_change('title');

-- Keep the denormalized course_id consistent with the parent module.
create function private.lessons_sync_course()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select m.course_id into new.course_id from public.modules m where m.id = new.module_id;
  return new;
end;
$$;

create trigger lessons_sync_course
  before insert or update of module_id on public.lessons
  for each row execute function private.lessons_sync_course();

create function private.lesson_threshold(p_kind public.lesson_kind, p_threshold numeric)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_threshold, case p_kind when 'video' then 0.90 else 1.00 end);
$$;

-- ─── Lesson resources (supplementary downloads) ────────────────────────────
create table public.lesson_resources (
  id          uuid primary key default gen_random_uuid(),
  lesson_id   uuid not null references public.lessons (id) on delete cascade,
  title       text not null check (char_length(btrim(title)) between 2 and 200),
  file_path   text not null check (char_length(file_path) <= 500),
  size_bytes  bigint check (size_bytes >= 0),
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

create index lesson_resources_lesson_idx on public.lesson_resources (lesson_id, position);

-- ─── Quizzes (exactly one per module) ──────────────────────────────────────
create table public.quizzes (
  id              uuid primary key default gen_random_uuid(),
  module_id       uuid not null unique references public.modules (id) on delete cascade,
  course_id       uuid not null references public.courses (id) on delete cascade,
  title           text not null check (char_length(btrim(title)) between 2 and 200),
  instructions    text not null default '' check (char_length(instructions) <= 4000),
  -- Confirmed rules: 70 % minimum, 3 attempts. Stored per quiz so that every
  -- attempt can snapshot the rule that applied when it was taken.
  pass_threshold  smallint not null default 70 check (pass_threshold between 50 and 100),
  max_attempts    smallint not null default 3  check (max_attempts between 1 and 10),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger quizzes_updated_at
  before update on public.quizzes
  for each row execute function private.set_updated_at();

create trigger quizzes_audit
  after insert or update or delete on public.quizzes
  for each row execute function private.audit_row_change('title');

create function private.quizzes_sync_course()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select m.course_id into new.course_id from public.modules m where m.id = new.module_id;
  return new;
end;
$$;

create trigger quizzes_sync_course
  before insert or update of module_id on public.quizzes
  for each row execute function private.quizzes_sync_course();

create table public.questions (
  id           uuid primary key default gen_random_uuid(),
  quiz_id      uuid not null references public.quizzes (id) on delete cascade,
  kind         public.question_kind not null default 'single',
  prompt       text not null check (char_length(btrim(prompt)) between 3 and 2000),
  explanation  text not null default '' check (char_length(explanation) <= 4000),
  points       smallint not null default 1 check (points between 1 and 100),
  position     integer not null check (position >= 0),
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index questions_quiz_idx on public.questions (quiz_id, position) where archived_at is null;

create trigger questions_updated_at
  before update on public.questions
  for each row execute function private.set_updated_at();

create trigger questions_audit
  after insert or update or delete on public.questions
  for each row execute function private.audit_row_change();

create table public.question_options (
  id           uuid primary key default gen_random_uuid(),
  question_id  uuid not null references public.questions (id) on delete cascade,
  label        text not null check (char_length(btrim(label)) between 1 and 500),
  is_correct   boolean not null default false,
  position     integer not null check (position >= 0),
  created_at   timestamptz not null default now()
);

create index question_options_question_idx on public.question_options (question_id, position);

-- ─── Course permissions (authorization) ────────────────────────────────────
-- Exactly one grantee: an institution OR an individual teacher.
create table public.course_permissions (
  id              uuid primary key default gen_random_uuid(),
  course_id       uuid not null references public.courses (id) on delete cascade,
  institution_id  uuid references public.institutions (id) on delete cascade,
  user_id         uuid references public.profiles (id) on delete cascade,
  granted_by      uuid references public.profiles (id) on delete set null,
  granted_at      timestamptz not null default now(),
  revoked_at      timestamptz,
  revoked_by      uuid references public.profiles (id) on delete set null,
  check (num_nonnulls(institution_id, user_id) = 1)
);

create unique index course_permissions_institution_active_idx
  on public.course_permissions (course_id, institution_id)
  where revoked_at is null and institution_id is not null;
create unique index course_permissions_user_active_idx
  on public.course_permissions (course_id, user_id)
  where revoked_at is null and user_id is not null;
create index course_permissions_institution_idx on public.course_permissions (institution_id) where revoked_at is null;
create index course_permissions_user_idx        on public.course_permissions (user_id)        where revoked_at is null;

create trigger course_permissions_audit
  after insert or update on public.course_permissions
  for each row execute function private.audit_row_change('course_id', 'institution_id');

-- ─── Course assignments (institution → teacher) ────────────────────────────
create table public.course_assignments (
  id              uuid primary key default gen_random_uuid(),
  institution_id  uuid not null references public.institutions (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  course_id       uuid not null references public.courses (id) on delete cascade,
  assigned_by     uuid references public.profiles (id) on delete set null,
  assigned_at     timestamptz not null default now(),
  due_on          date,
  revoked_at      timestamptz,
  revoked_by      uuid references public.profiles (id) on delete set null
);

create unique index course_assignments_active_idx
  on public.course_assignments (institution_id, user_id, course_id)
  where revoked_at is null;
create index course_assignments_user_idx   on public.course_assignments (user_id, course_id) where revoked_at is null;
create index course_assignments_course_idx on public.course_assignments (institution_id, course_id) where revoked_at is null;

create trigger course_assignments_audit
  after insert or update on public.course_assignments
  for each row execute function private.audit_row_change('course_id', 'institution_id');

-- ─── Enrollments (the learner's single record per course) ─────────────────
create table public.enrollments (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  course_id         uuid not null references public.courses (id) on delete restrict,
  status            public.enrollment_status not null default 'active',
  enrolled_at       timestamptz not null default now(),
  started_at        timestamptz,
  completed_at      timestamptz,
  last_activity_at  timestamptz,
  unique (user_id, course_id),
  check ((status = 'completed') = (completed_at is not null))
);

create index enrollments_course_idx   on public.enrollments (course_id);
create index enrollments_activity_idx on public.enrollments (user_id, last_activity_at desc nulls last);

-- ─── Access control helpers ────────────────────────────────────────────────
-- A learner may access a course when it is published, their account is
-- active, and they hold either an individual permission or an active
-- assignment from an active institution that is itself authorized.
create function private.has_course_access(p_course uuid, p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.courses c where c.id = p_course and c.status = 'published')
     and exists (select 1 from public.profiles p where p.id = p_user and p.status = 'active')
     and (
       exists (
         select 1 from public.course_permissions cp
          where cp.course_id = p_course
            and cp.user_id = p_user
            and cp.revoked_at is null
       )
       or exists (
         select 1
           from public.course_assignments ca
           join public.course_permissions cp
             on cp.course_id = ca.course_id
            and cp.institution_id = ca.institution_id
            and cp.revoked_at is null
           join public.institution_memberships m
             on m.institution_id = ca.institution_id
            and m.user_id = ca.user_id
            and m.status = 'active'
           join public.institutions i
             on i.id = ca.institution_id
            and i.status = 'active'
          where ca.course_id = p_course
            and ca.user_id = p_user
            and ca.revoked_at is null
       )
     );
$$;

-- Whether the course is authorized for an institution (for catalog/assignment).
create function private.institution_has_course(p_institution uuid, p_course uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.course_permissions cp
     where cp.course_id = p_course
       and cp.institution_id = p_institution
       and cp.revoked_at is null
  );
$$;

-- Whether the current user (an institution admin) may see a learner's
-- progress in a given course. Visibility is limited to courses assigned by
-- that institution to an active, consenting member — personal learning in
-- other courses is never exposed.
create function private.can_view_learner_course(p_learner uuid, p_course uuid, p_viewer uuid default auth.uid())
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
       and private.is_institution_admin(ca.institution_id, p_viewer)
  );
$$;

-- Same rule, scoped to one institution (used by reports).
create function private.institution_can_view_learner_course(p_institution uuid, p_learner uuid, p_course uuid)
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
     where ca.institution_id = p_institution
       and ca.user_id = p_learner
       and ca.course_id = p_course
       and ca.revoked_at is null
  );
$$;
