-- ════════════════════════════════════════════════════════════════════════════
-- SANADY Enterprise — phase E4: custom training production studio (brief V3 §13)
--
-- A training project carries a client's order from the brief to the launch
-- in its workspace, on top of the EXISTING course engine and review flow:
--   brief → design (objectives, curriculum, module outline) → production
--   (draft course, trainers, tasks: videos, PDFs, quizzes) → internal
--   pedagogical review (training managers) → client review (if the contract
--   requires it) → final institutional approval (approver, 2FA) → course
--   published by the pedagogical team → launched in the client's workspace.
-- A project course cannot be published before the approver's approval.
-- Each approval stores a frozen snapshot of the course (version history);
-- an update after launch is a new version, approved again.
-- ════════════════════════════════════════════════════════════════════════════

create type public.training_project_status as enum (
  'brief', 'design', 'production', 'internal_review', 'client_review', 'approval', 'approved', 'published', 'launched', 'cancelled'
);
create type public.training_task_kind as enum ('video', 'pdf', 'quiz', 'activity', 'review', 'other');
create type public.training_task_status as enum ('todo', 'in_progress', 'done');

create sequence public.training_project_reference_seq;

create table public.training_projects (
  id                      uuid primary key default gen_random_uuid(),
  reference               text not null unique,
  organization_id         uuid not null references public.partner_organizations (id) on delete restrict,
  tenant_id               uuid references public.enterprise_tenants (id) on delete set null,
  proposal_id             uuid references public.enterprise_proposals (id) on delete set null,
  title                   text not null check (char_length(btrim(title)) between 5 and 200),
  target_audience         text not null check (char_length(btrim(target_audience)) between 3 and 1000),
  objectives              text check (char_length(objectives) <= 4000),
  constraints             text check (char_length(constraints) <= 2000),
  language                text not null default 'fr' check (language in ('fr', 'ar', 'en', 'multiple')),
  target_minutes          integer check (target_minutes between 10 and 100000),
  ownership               public.course_ownership not null default 'company' check (ownership <> 'sanady'),
  client_review_required  boolean not null default true,
  due_on                  date,
  lead_id                 uuid references public.profiles (id) on delete set null,
  course_id               uuid unique references public.courses (id) on delete set null,
  status                  public.training_project_status not null default 'brief',
  version                 integer not null default 1 check (version >= 1),
  approved_by             uuid references public.profiles (id) on delete set null,
  approved_at             timestamptz,
  launched_at             timestamptz,
  created_by              uuid references public.profiles (id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index training_projects_status_idx on public.training_projects (status, updated_at desc);
create index training_projects_org_idx on public.training_projects (organization_id);

-- Curriculum: the planned modules (before and alongside the course itself).
create table public.training_outline (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.training_projects (id) on delete cascade,
  position     integer not null check (position >= 0),
  title        text not null check (char_length(btrim(title)) between 2 and 200),
  description  text check (char_length(description) <= 2000),
  created_at   timestamptz not null default now()
);
create index training_outline_project_idx on public.training_outline (project_id, position);

create table public.training_tasks (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.training_projects (id) on delete cascade,
  kind         public.training_task_kind not null default 'other',
  title        text not null check (char_length(btrim(title)) between 2 and 200),
  assigned_to  uuid references public.profiles (id) on delete set null,
  due_on       date,
  status       public.training_task_status not null default 'todo',
  done_at      timestamptz,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index training_tasks_project_idx on public.training_tasks (project_id);
create index training_tasks_assignee_idx on public.training_tasks (assigned_to) where status <> 'done';

-- Review comments: internal (pedagogical team) and client.
create table public.training_reviews (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.training_projects (id) on delete cascade,
  kind         text not null check (kind in ('internal', 'client')),
  decision     text not null check (decision in ('approved', 'changes_requested')),
  comment      text check (char_length(comment) <= 4000),
  version      integer not null,
  reviewer_id  uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index training_reviews_project_idx on public.training_reviews (project_id, created_at desc);

-- Version history: a frozen copy of the course at each approval.
create table public.training_versions (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.training_projects (id) on delete cascade,
  version      integer not null,
  snapshot     jsonb not null,
  approved_by  uuid references public.profiles (id) on delete set null,
  approved_at  timestamptz not null default now(),
  unique (project_id, version)
);

alter table public.enterprise_history
  add column project_id uuid references public.training_projects (id) on delete cascade,
  drop constraint enterprise_history_one_target,
  add constraint enterprise_history_one_target check (num_nonnulls(organization_id, request_id, proposal_id, tenant_id, project_id) = 1);
create index enterprise_history_project_idx on public.enterprise_history (project_id, created_at);

-- ─── Helpers ───────────────────────────────────────────────────────────────
-- Who runs projects: SANADY admins, enterprise managers, production managers (2FA).
create function private.can_manage_training(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_enterprise_manager(p_user)
      or (coalesce(private.platform_role(p_user) = 'production_manager', false)
          and (p_user is distinct from auth.uid() or private.session_aal() = 'aal2'));
$$;

-- Project managers read their project's course as authors do (content,
-- answers, validation, submission for review); editing stays with the
-- pedagogical team and the course's trainers (private.can_edit_course).
create or replace function private.can_author_course(p_course uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_course_staff() or private.is_course_trainer(p_course)
      or (private.can_manage_training() and exists (select 1 from public.training_projects p where p.course_id = p_course));
$$;

-- Who reads the studio: enterprise staff, the pedagogical team, approvers,
-- and the trainers and assignees of the project.
create function private.can_read_training(p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_enterprise_staff() or private.is_course_staff() or private.is_partnership_signatory()
      or exists (select 1 from public.training_projects p
                  where p.id = p_project and p.course_id is not null and private.is_course_trainer(p.course_id))
      or exists (select 1 from public.training_tasks t where t.project_id = p_project and t.assigned_to = auth.uid());
$$;

create function private.project_log(p_project uuid, p_from text, p_to text, p_note text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.enterprise_history (project_id, from_status, to_status, note, changed_by)
  values (p_project, p_from, p_to, nullif(btrim(coalesce(p_note, '')), ''), auth.uid());
$$;

-- Frozen copy of a course: modules, lessons, quizzes, questions and answers.
create function private.course_snapshot(p_course uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'title', c.title, 'summary', c.summary, 'objectives', c.objectives, 'status', c.status,
    'modules', coalesce((
      select jsonb_agg(jsonb_build_object(
        'title', m.title, 'description', m.description,
        'lessons', coalesce((
          select jsonb_agg(jsonb_build_object('title', l.title, 'kind', l.kind, 'mandatory', l.is_mandatory,
                                              'video_ref', l.video_ref, 'pdf_path', l.pdf_path) order by l.position)
            from public.lessons l where l.module_id = m.id and l.archived_at is null), '[]'::jsonb),
        'quiz', (
          select jsonb_build_object('title', q.title, 'pass_threshold', q.pass_threshold, 'max_attempts', q.max_attempts,
            'questions', coalesce((
              select jsonb_agg(jsonb_build_object('prompt', qu.prompt, 'kind', qu.kind, 'points', qu.points,
                'options', (select jsonb_agg(jsonb_build_object('label', o.label, 'correct', o.is_correct) order by o.position)
                              from public.question_options o where o.question_id = qu.id)) order by qu.position)
                from public.questions qu where qu.quiz_id = q.id and qu.archived_at is null), '[]'::jsonb))
            from public.quizzes q where q.module_id = m.id)
      ) order by m.position)
        from public.modules m where m.course_id = c.id and m.archived_at is null), '[]'::jsonb)
  )
  from public.courses c where c.id = p_course;
$$;

-- The 12 production steps (brief §13), computed from the records.
create function public.training_checklist(p_project uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  p        public.training_projects;
  v_course public.courses;
  v_issues integer := null;
  v_modules integer := 0;
  v_quizzes integer := 0;
  v_media  integer := 0;
begin
  perform private.require(private.can_read_training(p_project), 'forbidden');
  select * into p from public.training_projects where id = p_project;
  perform private.require(p.id is not null, 'not_found');
  if p.course_id is not null then
    select * into v_course from public.courses where id = p.course_id;
    select count(*) into v_modules from public.modules where course_id = p.course_id and archived_at is null;
    select count(*) into v_quizzes from public.quizzes q join public.modules m on m.id = q.module_id
     where q.course_id = p.course_id and m.archived_at is null
       and exists (select 1 from public.questions qu where qu.quiz_id = q.id and qu.archived_at is null);
    select count(*) into v_media from public.lessons where course_id = p.course_id and archived_at is null
       and (video_ref is not null or pdf_path is not null);
    -- Detailed validation is for the course's authors (approvers see the rest).
    if private.can_author_course(p.course_id) then
      v_issues := jsonb_array_length(public.validate_course(p.course_id));
    end if;
  end if;
  return jsonb_build_object(
    'brief', true,
    'objectives', char_length(btrim(coalesce(p.objectives, ''))) >= 20,
    'curriculum', exists (select 1 from public.training_outline where project_id = p.id),
    'modules', v_modules > 0,
    'assigned', exists (select 1 from public.course_trainers where course_id = p.course_id)
                or exists (select 1 from public.training_tasks where project_id = p.id and assigned_to is not null),
    'content', v_media > 0,
    'quizzes', v_modules > 0 and v_quizzes >= v_modules,
    'internal_review', exists (select 1 from public.training_reviews r where r.project_id = p.id and r.kind = 'internal'
                                and r.version = p.version and r.decision = 'approved'
                                and r.created_at = (select max(created_at) from public.training_reviews where project_id = p.id and kind = 'internal' and version = p.version)),
    'client_review', not p.client_review_required
                     or exists (select 1 from public.training_reviews r where r.project_id = p.id and r.kind = 'client'
                                 and r.version = p.version and r.decision = 'approved'
                                 and r.created_at = (select max(created_at) from public.training_reviews where project_id = p.id and kind = 'client' and version = p.version)),
    'approved', p.approved_at is not null and exists (select 1 from public.training_versions v where v.project_id = p.id and v.version = p.version),
    'published', coalesce(v_course.status::text = 'published', false),
    'launched', p.launched_at is not null,
    'open_tasks', (select count(*) from public.training_tasks where project_id = p.id and status <> 'done'),
    'course_issues', v_issues,
    'course_status', v_course.status
  );
end;
$$;

-- ─── Guards on the course engine ───────────────────────────────────────────
-- A project course is published only after the approver's approval.
create function private.guard_project_publication()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.training_projects;
begin
  if new.status::text = 'published' and old.status::text <> 'published' then
    select * into p from public.training_projects where course_id = new.id;
    if p.id is not null then
      perform private.require(p.status in ('approved', 'published', 'launched'), 'project_not_approved');
      if p.status = 'approved' then
        update public.training_projects set status = 'published', updated_at = now() where id = p.id;
        insert into public.enterprise_history (project_id, from_status, to_status, changed_by)
        values (p.id, 'approved', 'published', auth.uid());
      end if;
    end if;
  end if;
  return new;
end;
$$;
create trigger courses_project_publication
  before update on public.courses
  for each row execute function private.guard_project_publication();

-- ─── Row level security ────────────────────────────────────────────────────
alter table public.training_projects enable row level security;
alter table public.training_outline  enable row level security;
alter table public.training_tasks    enable row level security;
alter table public.training_reviews  enable row level security;
alter table public.training_versions enable row level security;
revoke all on public.training_projects, public.training_outline, public.training_tasks, public.training_reviews, public.training_versions
  from anon, authenticated;
revoke all on sequence public.training_project_reference_seq from anon, authenticated;

create policy training_projects_select on public.training_projects for select to authenticated using (private.can_read_training(id));
create policy training_outline_select  on public.training_outline  for select to authenticated using (private.can_read_training(project_id));
create policy training_tasks_select    on public.training_tasks    for select to authenticated using (private.can_read_training(project_id));
create policy training_reviews_select  on public.training_reviews  for select to authenticated using (private.can_read_training(project_id));
create policy training_versions_select on public.training_versions for select to authenticated using (private.can_read_training(project_id));
grant select on public.training_projects, public.training_outline, public.training_tasks, public.training_reviews, public.training_versions
  to authenticated;

-- ─── Projects ──────────────────────────────────────────────────────────────
create function public.save_training_project(p_id uuid, p_org uuid, p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id     uuid := p_id;
  v_tenant uuid := nullif(p ->> 'tenant_id', '')::uuid;
  v_lead   uuid := nullif(p ->> 'lead_id', '')::uuid;
  v_ref    text;
  cur      public.training_projects;
begin
  perform private.require(private.can_manage_training(), 'forbidden');
  perform private.require(
    exists (select 1 from public.partner_organizations o where o.id = p_org and o.enterprise_status is not null), 'not_found');
  perform private.require(
    v_tenant is null or exists (select 1 from public.enterprise_tenants t where t.id = v_tenant and t.organization_id = p_org),
    'invalid_input');
  perform private.require(
    nullif(p ->> 'proposal_id', '') is null
    or exists (select 1 from public.enterprise_proposals pr where pr.id = (p ->> 'proposal_id')::uuid and pr.organization_id = p_org),
    'invalid_input');
  perform private.require(
    v_lead is null or coalesce(private.platform_role(v_lead) in ('sanady_admin', 'enterprise_manager', 'production_manager', 'training_manager'), false),
    'invalid_input');

  if v_id is null then
    v_ref := 'FS-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.training_project_reference_seq')::text, 4, '0');
    insert into public.training_projects (
      reference, organization_id, tenant_id, proposal_id, title, target_audience, objectives, constraints, language,
      target_minutes, ownership, client_review_required, due_on, lead_id, created_by)
    values (
      v_ref, p_org, v_tenant, nullif(p ->> 'proposal_id', '')::uuid, btrim(p ->> 'title'), btrim(p ->> 'target_audience'),
      nullif(btrim(coalesce(p ->> 'objectives', '')), ''), nullif(btrim(coalesce(p ->> 'constraints', '')), ''),
      coalesce(nullif(p ->> 'language', ''), 'fr'), nullif(p ->> 'target_minutes', '')::integer,
      coalesce(nullif(p ->> 'ownership', ''), 'company')::public.course_ownership,
      coalesce((p ->> 'client_review_required')::boolean, true), nullif(p ->> 'due_on', '')::date,
      coalesce(v_lead, auth.uid()), auth.uid())
    returning id into v_id;
    perform private.project_log(v_id, null, 'brief', null);
    perform private.log_audit('training_project_created', 'training_projects', v_id, null, jsonb_build_object('reference', v_ref));
  else
    select * into cur from public.training_projects where id = v_id and organization_id = p_org for update;
    perform private.require(cur.id is not null, 'not_found');
    -- The order is frozen from the approval request on (a new version reopens it).
    perform private.require(cur.status in ('brief', 'design', 'production'), 'project_locked');
    update public.training_projects
       set tenant_id = v_tenant, proposal_id = nullif(p ->> 'proposal_id', '')::uuid, title = btrim(p ->> 'title'),
           target_audience = btrim(p ->> 'target_audience'), objectives = nullif(btrim(coalesce(p ->> 'objectives', '')), ''),
           constraints = nullif(btrim(coalesce(p ->> 'constraints', '')), ''), language = coalesce(nullif(p ->> 'language', ''), 'fr'),
           target_minutes = nullif(p ->> 'target_minutes', '')::integer,
           ownership = coalesce(nullif(p ->> 'ownership', ''), 'company')::public.course_ownership,
           client_review_required = coalesce((p ->> 'client_review_required')::boolean, true),
           due_on = nullif(p ->> 'due_on', '')::date, lead_id = coalesce(v_lead, lead_id), updated_at = now()
     where id = v_id;
  end if;
  return v_id;
end;
$$;

-- Outline (planned modules).
create function public.save_outline_item(p_id uuid, p_project uuid, p_title text, p_description text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := p_id;
begin
  perform private.require(private.can_manage_training(), 'forbidden');
  perform private.require(
    exists (select 1 from public.training_projects where id = p_project and status in ('brief', 'design', 'production')), 'project_locked');
  perform private.require(char_length(btrim(coalesce(p_title, ''))) between 2 and 200, 'invalid_input');
  if v_id is null then
    insert into public.training_outline (project_id, position, title, description)
    values (p_project, coalesce((select max(position) + 1 from public.training_outline where project_id = p_project), 0),
            btrim(p_title), nullif(btrim(coalesce(p_description, '')), ''))
    returning id into v_id;
  else
    update public.training_outline set title = btrim(p_title), description = nullif(btrim(coalesce(p_description, '')), '')
     where id = v_id and project_id = p_project;
    perform private.require(found, 'not_found');
  end if;
  return v_id;
end;
$$;

create function public.move_outline_item(p_id uuid, p_delta integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  it    public.training_outline;
  other public.training_outline;
begin
  perform private.require(private.can_manage_training(), 'forbidden');
  select * into it from public.training_outline where id = p_id;
  perform private.require(it.id is not null, 'not_found');
  select * into other from public.training_outline
   where project_id = it.project_id
     and case when p_delta < 0 then position < it.position else position > it.position end
   order by case when p_delta < 0 then -position else position end
   limit 1;
  if other.id is not null then
    update public.training_outline set position = other.position where id = it.id;
    update public.training_outline set position = it.position where id = other.id;
  end if;
end;
$$;

create function public.delete_outline_item(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require(private.can_manage_training(), 'forbidden');
  delete from public.training_outline o
   using public.training_projects p
   where o.id = p_id and p.id = o.project_id and p.status in ('brief', 'design', 'production');
  perform private.require(found, 'project_locked');
end;
$$;

-- Step 4 → the draft course of the project, built from the outline, owned
-- by the client (and reserved to its workspace when there is one).
create function public.create_project_course(p_project uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  p        public.training_projects;
  v_inst   uuid;
  v_course uuid;
  o        record;
begin
  perform private.require(private.can_manage_training(), 'forbidden');
  select * into p from public.training_projects where id = p_project for update;
  perform private.require(p.id is not null, 'not_found');
  perform private.require(p.course_id is null, 'already_exists');
  perform private.require(p.status in ('design', 'production'), 'invalid_transition');
  perform private.require(exists (select 1 from public.training_outline where project_id = p.id), 'outline_required');
  select institution_id into v_inst from public.enterprise_tenants where id = p.tenant_id;
  -- A course owned by the company belongs to its workspace.
  perform private.require(p.ownership <> 'company' or v_inst is not null, 'tenant_required');

  insert into public.courses (title, summary, description, objectives, estimated_minutes, target_audience, created_by,
                              ownership, owner_institution_id, tenant_private)
  values (p.title, left(coalesce(p.objectives, ''), 400), coalesce(p.objectives, ''), '{}', p.target_minutes,
          left(p.target_audience, 300), auth.uid(), p.ownership,
          case when p.ownership = 'company' or v_inst is not null then v_inst end,
          v_inst is not null and p.ownership = 'company')
  returning id into v_course;
  for o in select * from public.training_outline where project_id = p.id order by position loop
    insert into public.modules (course_id, title, description, position)
    values (v_course, o.title, coalesce(o.description, ''), o.position);
  end loop;

  update public.training_projects set course_id = v_course, updated_at = now() where id = p.id;
  perform private.project_log(p.id, null, 'course_created', p.title);
  perform private.log_audit('training_course_created', 'training_projects', p.id, v_inst, jsonb_build_object('course', v_course));
  return v_course;
end;
$$;

-- Step 5: trainers of the project course (they author it while in draft).
create function public.assign_project_trainer(p_project uuid, p_user uuid, p_assign boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_course uuid;
begin
  perform private.require(private.can_manage_training(), 'forbidden');
  select course_id into v_course from public.training_projects where id = p_project;
  perform private.require(v_course is not null, 'course_required');
  if p_assign then
    perform private.require(private.platform_role(p_user) = 'trainer', 'not_a_trainer');
    insert into public.course_trainers (course_id, user_id, assigned_by) values (v_course, p_user, auth.uid())
    on conflict (course_id, user_id) do nothing;
  else
    delete from public.course_trainers where course_id = v_course and user_id = p_user;
  end if;
end;
$$;

-- Production tasks.
create function public.save_training_task(p_id uuid, p_project uuid, p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := p_id;
  v_to uuid := nullif(p ->> 'assigned_to', '')::uuid;
begin
  perform private.require(private.can_manage_training(), 'forbidden');
  perform private.require(exists (select 1 from public.training_projects where id = p_project and status not in ('launched', 'cancelled')), 'project_locked');
  perform private.require(char_length(btrim(coalesce(p ->> 'title', ''))) between 2 and 200, 'invalid_input');
  perform private.require(
    v_to is null or coalesce(private.platform_role(v_to) in ('sanady_admin', 'enterprise_manager', 'production_manager', 'training_manager', 'trainer'), false),
    'invalid_input');
  if v_id is null then
    insert into public.training_tasks (project_id, kind, title, assigned_to, due_on, created_by)
    values (p_project, coalesce(nullif(p ->> 'kind', ''), 'other')::public.training_task_kind, btrim(p ->> 'title'), v_to,
            nullif(p ->> 'due_on', '')::date, auth.uid())
    returning id into v_id;
  else
    update public.training_tasks
       set kind = coalesce(nullif(p ->> 'kind', ''), 'other')::public.training_task_kind, title = btrim(p ->> 'title'),
           assigned_to = v_to, due_on = nullif(p ->> 'due_on', '')::date
     where id = v_id and project_id = p_project;
    perform private.require(found, 'not_found');
  end if;
  return v_id;
end;
$$;

-- The assignee (e.g. a trainer) moves their own task; managers move any task.
create function public.set_training_task_status(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.training_tasks;
begin
  select * into t from public.training_tasks where id = p_id for update;
  perform private.require(t.id is not null, 'not_found');
  perform private.require(private.can_manage_training() or t.assigned_to = auth.uid(), 'forbidden');
  perform private.require(p_status in ('todo', 'in_progress', 'done'), 'invalid_input');
  update public.training_tasks
     set status = p_status::public.training_task_status, done_at = case when p_status = 'done' then now() end
   where id = p_id;
end;
$$;

-- Steps 8 and 9: reviews. Internal review by the pedagogical team (training
-- managers, administrators); client review recorded by the enterprise team
-- or given by the company administrator in their workspace.
create function public.record_training_review(p_project uuid, p_kind text, p_decision text, p_comment text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p      public.training_projects;
  v_inst uuid;
  v_to   text;
begin
  select * into p from public.training_projects where id = p_project for update;
  perform private.require(p.id is not null, 'not_found');
  perform private.require(p_decision in ('approved', 'changes_requested'), 'invalid_input');
  perform private.require(p_decision = 'approved' or char_length(btrim(coalesce(p_comment, ''))) >= 5, 'comment_required');
  if p_kind = 'internal' then
    perform private.require(private.is_course_staff(), 'forbidden');
    perform private.require(p.status = 'internal_review', 'invalid_transition');
  elsif p_kind = 'client' then
    select institution_id into v_inst from public.enterprise_tenants where id = p.tenant_id;
    perform private.require(private.can_manage_training() or (v_inst is not null and private.is_institution_admin(v_inst)), 'forbidden');
    perform private.require(p.status = 'client_review', 'invalid_transition');
  else
    perform private.require(false, 'invalid_input');
  end if;

  insert into public.training_reviews (project_id, kind, decision, comment, version, reviewer_id)
  values (p.id, p_kind, p_decision, nullif(btrim(coalesce(p_comment, '')), ''), p.version, auth.uid());

  -- The decision moves the project: back to production, or forward.
  update public.training_projects
     set status = case
                    when p_decision = 'changes_requested' then 'production'
                    when p_kind = 'internal' and p.client_review_required then 'client_review'
                    else 'approval'
                  end::public.training_project_status,
         updated_at = now()
   where id = p.id
  returning status::text into v_to;
  -- Changes requested: the course goes back to its authors (draft).
  if p_decision = 'changes_requested' then
    perform set_config('sanady.course_review', 'on', true);
    update public.courses
       set status = 'draft', review_comment = left(btrim(p_comment), 2000), reviewed_at = now(), reviewed_by = auth.uid()
     where id = p.course_id and status::text = 'review';
    perform set_config('sanady.course_review', 'off', true);
  end if;
  perform private.project_log(p.id, p.status::text, v_to, p_comment);
end;
$$;

-- Transitions driven by people (the reviews and the publication move the rest).
create function public.set_training_status(p_project uuid, p_status text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p      public.training_projects;
  c      jsonb;
  v_inst uuid;
begin
  select * into p from public.training_projects where id = p_project for update;
  perform private.require(p.id is not null, 'not_found');

  if (p.status::text, p_status) = ('brief', 'design') then
    perform private.require(private.can_manage_training(), 'forbidden');
    perform private.require(char_length(btrim(coalesce(p.objectives, ''))) >= 20, 'objectives_required');
  elsif (p.status::text, p_status) = ('design', 'production') then
    perform private.require(private.can_manage_training(), 'forbidden');
    perform private.require(p.course_id is not null, 'course_required');
  elsif (p.status::text, p_status) = ('production', 'internal_review') then
    perform private.require(private.can_manage_training(), 'forbidden');
    c := public.training_checklist(p_project);
    perform private.require((c ->> 'open_tasks')::integer = 0, 'tasks_open');
    -- The course is submitted to the pedagogical team (validated on the way).
    if c ->> 'course_status' = 'draft' then
      perform public.submit_course_for_review(p.course_id);
    end if;
  elsif (p.status::text, p_status) = ('approval', 'approved') then
    -- Step 10: final institutional approval, with a frozen copy of the course.
    perform private.require(private.is_partnership_signatory(), 'forbidden');
    c := public.training_checklist(p_project);
    perform private.require((c ->> 'internal_review')::boolean and (c ->> 'client_review')::boolean, 'reviews_required');
    insert into public.training_versions (project_id, version, snapshot, approved_by)
    values (p.id, p.version, private.course_snapshot(p.course_id), auth.uid());
    update public.training_projects set approved_by = auth.uid(), approved_at = now() where id = p.id;
    -- An update of a course already published and launched goes straight back to « launched ».
    if p.launched_at is not null and (c ->> 'published')::boolean then
      p_status := 'launched';
    elsif (c ->> 'published')::boolean then
      p_status := 'published';
    end if;
  elsif (p.status::text, p_status) = ('approval', 'production') then
    perform private.require(private.is_partnership_signatory(), 'forbidden');
    perform private.require(char_length(btrim(coalesce(p_note, ''))) >= 5, 'comment_required');
  elsif (p.status::text, p_status) = ('published', 'launched') then
    -- Step 12: the course is opened to the client's workspace.
    perform private.require(private.can_manage_training(), 'forbidden');
    select institution_id into v_inst from public.enterprise_tenants where id = p.tenant_id and status = 'active';
    perform private.require(v_inst is not null, 'tenant_inactive');
    insert into public.course_permissions (course_id, institution_id, granted_by)
    select p.course_id, v_inst, auth.uid()
     where not exists (select 1 from public.course_permissions cp where cp.course_id = p.course_id and cp.institution_id = v_inst and cp.revoked_at is null);
    update public.training_projects set launched_at = now() where id = p.id;
  elsif (p.status::text, p_status) = ('launched', 'production') then
    -- A new version: the content is updated, reviewed and approved again.
    perform private.require(private.can_manage_training(), 'forbidden');
    update public.training_projects set version = version + 1, approved_by = null, approved_at = null where id = p.id;
  elsif p_status = 'cancelled' then
    perform private.require(private.can_manage_training(), 'forbidden');
    perform private.require(p.status in ('brief', 'design', 'production', 'internal_review', 'client_review', 'approval'), 'invalid_transition');
    perform private.require(char_length(btrim(coalesce(p_note, ''))) >= 5, 'comment_required');
  else
    perform private.require(false, 'invalid_transition');
  end if;

  update public.training_projects set status = p_status::public.training_project_status, updated_at = now() where id = p.id;
  perform private.project_log(p.id, p.status::text, p_status, p_note);
  perform private.log_audit('training_status', 'training_projects', p.id, null, jsonb_build_object('from', p.status::text, 'to', p_status));
end;
$$;

-- What a company administrator sees of the projects for their workspace:
-- the order, its objectives and outline, and whether their review is awaited.
create function public.workspace_training_projects(p_institution uuid)
returns table (id uuid, reference text, title text, status public.training_project_status, version integer,
               objectives text, target_audience text, outline jsonb, client_review_required boolean, due_on date)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.reference, p.title, p.status, p.version, p.objectives, p.target_audience,
         coalesce((select jsonb_agg(jsonb_build_object('title', o.title, 'description', o.description) order by o.position)
                     from public.training_outline o where o.project_id = p.id), '[]'::jsonb),
         p.client_review_required, p.due_on
    from public.training_projects p
    join public.enterprise_tenants t on t.id = p.tenant_id
   where t.institution_id = p_institution
     and private.is_institution_admin(p_institution)
     and p.status <> 'cancelled'
   order by p.updated_at desc;
$$;

-- People who can lead a project or receive production tasks (names only).
create function public.production_team()
returns table (id uuid, full_name text, email text, role text)
language sql
stable
security definer
set search_path = ''
as $$
  select pr.id, pr.full_name, pr.email, r.role::text
    from public.platform_roles r
    join public.profiles pr on pr.id = r.user_id and pr.status = 'active'
   where r.role::text in ('sanady_admin', 'enterprise_manager', 'production_manager', 'training_manager', 'trainer')
     and (private.can_manage_training() or private.is_course_staff())
   order by coalesce(pr.full_name, pr.email);
$$;

-- ─── Grants ────────────────────────────────────────────────────────────────
revoke execute on function
  private.can_manage_training(uuid), private.can_read_training(uuid), private.can_author_course(uuid), private.project_log(uuid, text, text, text),
  private.course_snapshot(uuid), private.guard_project_publication()
from public, anon;
grant execute on function private.can_read_training(uuid), private.can_author_course(uuid), private.can_manage_training(uuid) to authenticated;

revoke execute on function
  public.training_checklist(uuid), public.save_training_project(uuid, uuid, jsonb), public.save_outline_item(uuid, uuid, text, text),
  public.move_outline_item(uuid, integer), public.delete_outline_item(uuid), public.create_project_course(uuid),
  public.assign_project_trainer(uuid, uuid, boolean), public.save_training_task(uuid, uuid, jsonb),
  public.set_training_task_status(uuid, text), public.record_training_review(uuid, text, text, text),
  public.set_training_status(uuid, text, text), public.workspace_training_projects(uuid), public.production_team()
from public, anon;
grant execute on function
  public.training_checklist(uuid), public.save_training_project(uuid, uuid, jsonb), public.save_outline_item(uuid, uuid, text, text),
  public.move_outline_item(uuid, integer), public.delete_outline_item(uuid), public.create_project_course(uuid),
  public.assign_project_trainer(uuid, uuid, boolean), public.save_training_task(uuid, uuid, jsonb),
  public.set_training_task_status(uuid, text), public.record_training_review(uuid, text, text, text),
  public.set_training_status(uuid, text, text), public.workspace_training_projects(uuid), public.production_team()
to authenticated;

-- The server needs no direct access to these tables (everything goes
-- through RLS and the functions above).
