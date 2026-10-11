-- ════════════════════════════════════════════════════════════════════════════
-- SANADY · Public site: catalog, course pages, access requests
--
-- Anyone can browse the courses a SANADY administrator chose to list
-- publicly (program, objectives, duration — never content or media).
-- Joining stays invitation-only: visitors send an access request that a
-- SANADY administrator approves (an invitation is then issued) or rejects.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Public listing flag ───────────────────────────────────────────────────
alter table public.courses add column public_listing boolean not null default false;
comment on column public.courses.public_listing is
  'Shown in the public catalog when published. Off by default: a course may be reserved for some institutions.';

-- ─── Access requests ───────────────────────────────────────────────────────
create type public.access_request_status as enum ('pending', 'approved', 'rejected');

create table public.access_requests (
  id                uuid primary key default gen_random_uuid(),
  -- teacher: approved by issuing a teacher invitation.
  -- institution: partnership request, followed up by the SANADY team.
  kind              text not null default 'teacher' check (kind in ('teacher', 'institution')),
  first_name        text not null check (char_length(btrim(first_name)) between 1 and 80),
  last_name         text not null check (char_length(btrim(last_name)) between 1 and 80),
  email             text not null check (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  job_title         text check (char_length(job_title) <= 150),
  subject_area      text check (char_length(subject_area) <= 150),
  institution_name  text check (char_length(institution_name) <= 200),
  city              text check (char_length(city) <= 100),
  message           text not null default '' check (char_length(message) <= 1000),
  course_id         uuid references public.courses (id) on delete set null,
  status            public.access_request_status not null default 'pending',
  created_at        timestamptz not null default now(),
  handled_at        timestamptz,
  handled_by        uuid references public.profiles (id) on delete set null,
  invitation_id     uuid references public.invitations (id) on delete set null
);

-- One open request per person; a new submission refreshes it.
create unique index access_requests_pending_email_idx on public.access_requests (email) where status = 'pending';
create index access_requests_status_idx on public.access_requests (status, created_at desc);

-- Audit decisions without personal data (field names only).
create trigger access_requests_audit
  after update or delete on public.access_requests
  for each row execute function private.audit_row_change('status');

alter table public.access_requests enable row level security;

create policy access_requests_select on public.access_requests
  for select to authenticated
  using (private.is_sanady_admin());

grant select on public.access_requests to authenticated;
-- No direct insert/update/delete: see request_access / resolve_access_request.

-- Server-only (service role, after rate limiting). Same silent outcome
-- whether or not the address already has an account (no enumeration).
create function public.request_access(
  p_first_name   text,
  p_last_name    text,
  p_email        text,
  p_job_title    text default null,
  p_subject_area text default null,
  p_institution  text default null,
  p_city         text default null,
  p_message      text default '',
  p_course       uuid default null,
  p_kind         text default 'teacher'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email  text := lower(btrim(p_email));
  v_course uuid;
begin
  -- Existing accounts need no invitation (institution requests still go through).
  if p_kind is distinct from 'institution' and exists (select 1 from public.profiles p where p.email = v_email) then
    return;
  end if;

  select c.id into v_course
    from public.courses c
   where c.id = p_course and c.status = 'published' and c.public_listing;

  insert into public.access_requests as r
    (kind, first_name, last_name, email, job_title, subject_area, institution_name, city, message, course_id)
  values (
    case when p_kind = 'institution' then 'institution' else 'teacher' end,
    btrim(p_first_name), btrim(p_last_name), v_email,
    nullif(btrim(coalesce(p_job_title, '')), ''),
    nullif(btrim(coalesce(p_subject_area, '')), ''),
    nullif(btrim(coalesce(p_institution, '')), ''),
    nullif(btrim(coalesce(p_city, '')), ''),
    btrim(coalesce(p_message, '')),
    v_course
  )
  on conflict (email) where status = 'pending' do update
    set kind             = excluded.kind,
        first_name       = excluded.first_name,
        last_name        = excluded.last_name,
        job_title        = excluded.job_title,
        subject_area     = excluded.subject_area,
        institution_name = excluded.institution_name,
        city             = excluded.city,
        message          = excluded.message,
        course_id        = coalesce(excluded.course_id, r.course_id),
        created_at       = now();
end;
$$;

create function public.resolve_access_request(
  p_request    uuid,
  p_status     public.access_request_status,
  p_invitation uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text;
begin
  perform private.require(private.is_sanady_admin(), 'forbidden');
  perform private.require(p_status in ('approved', 'rejected'), 'invalid_input');

  select kind into v_kind from public.access_requests where id = p_request and status = 'pending' for update;
  perform private.require(v_kind is not null, 'not_found');
  -- A teacher request is approved only together with the invitation it produced.
  perform private.require(p_status = 'rejected' or v_kind = 'institution' or p_invitation is not null, 'invalid_input');

  update public.access_requests
     set status = p_status, handled_at = now(), handled_by = auth.uid(), invitation_id = p_invitation
   where id = p_request;
end;
$$;

-- ─── Public catalog ────────────────────────────────────────────────────────
create function public.public_catalog()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with listed as (
    select c.*
      from public.courses c
     where c.status = 'published' and c.public_listing
  ),
  cards as (
    select l.id, l.title, l.summary, l.level, l.estimated_minutes, l.cover_path, l.published_at,
           cat.id as category_id, cat.name as category, cat.position as category_position,
           (select count(*) from public.modules m where m.course_id = l.id and m.archived_at is null) as module_count,
           (select count(*) from public.lessons ls where ls.course_id = l.id and ls.archived_at is null) as lesson_count,
           (select count(*) from public.lessons ls where ls.course_id = l.id and ls.archived_at is null and ls.kind = 'video') as video_count,
           (select count(*) from public.quizzes q join public.modules m on m.id = q.module_id
             where q.course_id = l.id and m.archived_at is null) as quiz_count
      from listed l
      left join public.course_categories cat on cat.id = l.category_id
  )
  select jsonb_build_object(
    'courses', coalesce((select jsonb_agg(to_jsonb(cards) - 'category_position' order by cards.published_at desc nulls last, cards.title) from cards), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.category_id, 'name', x.category, 'count', x.n) order by x.pos, x.category)
        from (select category_id, category, min(category_position) as pos, count(*) as n
                from cards where category_id is not null group by category_id, category) x
    ), '[]'::jsonb),
    'stats', jsonb_build_object(
      'courses', (select count(*) from listed),
      'minutes', (select coalesce(sum(estimated_minutes), 0) from listed),
      'certificates', (select count(*) from public.certificates where revoked_at is null),
      'institutions', (select count(*) from public.institutions where status = 'active')
    )
  );
$$;

create function public.public_course(p_course uuid)
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

grant execute on function public.public_catalog(), public.public_course(uuid) to anon, authenticated;
grant execute on function public.resolve_access_request(uuid, public.access_request_status, uuid) to authenticated;
revoke execute on function public.resolve_access_request(uuid, public.access_request_status, uuid) from public, anon;
revoke execute on function public.request_access(text, text, text, text, text, text, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.request_access(text, text, text, text, text, text, text, text, uuid, text) to service_role;
revoke execute on function public.public_catalog(), public.public_course(uuid) from public;
