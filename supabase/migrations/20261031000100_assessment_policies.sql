-- ════════════════════════════════════════════════════════════════════════════
-- SANADY Enterprise — company assessment policies (brief V3 §12)
--
-- SANADY's own rule never changes for teachers: 70 % to pass, 3 attempts,
-- correct answers shown after passing, a certificate on completion. A company
-- space may have its own policy, prepared by the enterprise manager and
-- applied only once an approver has approved it:
--   pass mark (50–100 %), attempts (1–10), when correct answers are shown
--   (after passing · after each attempt · never), certificates issued or not,
--   and whether the due date of an assignment closes new attempts.
-- It applies to the company's members, on the courses the company assigned
-- to them or owns. Everything is enforced here, server-side; each attempt
-- keeps the rule it started with, so a change only affects new attempts.
-- ════════════════════════════════════════════════════════════════════════════

create table public.enterprise_assessment_policies (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null unique references public.enterprise_tenants (id) on delete cascade,
  contract_id        uuid references public.enterprise_contracts (id) on delete set null,
  pass_threshold     smallint not null default 70 check (pass_threshold between 50 and 100),
  max_attempts       smallint not null default 3 check (max_attempts between 1 and 10),
  feedback           text not null default 'after_pass' check (feedback in ('after_pass', 'after_each_attempt', 'never')),
  certificates       boolean not null default true,
  enforce_due_dates  boolean not null default false,
  note               text check (char_length(note) <= 1000),
  status             text not null default 'draft' check (status in ('draft', 'approved')),
  approved_by        uuid references public.profiles (id) on delete set null,
  approved_at        timestamptz,
  updated_by         uuid references public.profiles (id) on delete set null,
  updated_at         timestamptz not null default now()
);

alter table public.enterprise_assessment_policies enable row level security;
revoke all on public.enterprise_assessment_policies from anon, authenticated;
-- The team, approvers, and the company's administrators (who see their rules).
create policy enterprise_assessment_policies_select on public.enterprise_assessment_policies for select to authenticated
  using (private.is_enterprise_staff() or private.is_partnership_signatory()
         or exists (select 1 from public.enterprise_tenants t where t.id = tenant_id and t.institution_id is not null and private.is_institution_admin(t.institution_id)));
grant select on public.enterprise_assessment_policies to authenticated;

create function public.save_assessment_policy(p_tenant uuid, p jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contract uuid := nullif(p ->> 'contract_id', '')::uuid;
begin
  perform private.require(private.is_enterprise_manager(), 'forbidden');
  perform private.require(exists (select 1 from public.enterprise_tenants where id = p_tenant), 'not_found');
  perform private.require(v_contract is null or exists (select 1 from public.enterprise_contracts c join public.enterprise_tenants t on t.id = p_tenant
                                                         where c.id = v_contract and c.organization_id = t.organization_id), 'invalid_input');
  insert into public.enterprise_assessment_policies (tenant_id, contract_id, pass_threshold, max_attempts, feedback, certificates, enforce_due_dates, note, updated_by)
  values (p_tenant, v_contract, (p ->> 'pass_threshold')::smallint, (p ->> 'max_attempts')::smallint, p ->> 'feedback',
          coalesce((p ->> 'certificates')::boolean, true), coalesce((p ->> 'enforce_due_dates')::boolean, false),
          nullif(btrim(coalesce(p ->> 'note', '')), ''), auth.uid())
  on conflict (tenant_id) do update
     set contract_id = excluded.contract_id, pass_threshold = excluded.pass_threshold, max_attempts = excluded.max_attempts,
         feedback = excluded.feedback, certificates = excluded.certificates, enforce_due_dates = excluded.enforce_due_dates,
         note = excluded.note, updated_by = auth.uid(), updated_at = now(),
         -- Any change needs a new approval before it applies.
         status = 'draft', approved_by = null, approved_at = null;
  perform private.tenant_log(p_tenant, null, 'assessment_policy_saved', null);
end;
$$;

create function public.approve_assessment_policy(p_tenant uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require(private.is_partnership_signatory(), 'forbidden');
  update public.enterprise_assessment_policies set status = 'approved', approved_by = auth.uid(), approved_at = now()
   where tenant_id = p_tenant and status = 'draft';
  perform private.require(found, 'invalid_transition');
  perform private.tenant_log(p_tenant, null, 'assessment_policy_approved', null);
end;
$$;

-- Back to SANADY's rule (70 %, 3 attempts).
create function public.remove_assessment_policy(p_tenant uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require(private.is_enterprise_manager(), 'forbidden');
  delete from public.enterprise_assessment_policies where tenant_id = p_tenant;
  perform private.require(found, 'not_found');
  perform private.tenant_log(p_tenant, null, 'assessment_policy_removed', null);
end;
$$;

-- The approved policy that applies to this learner on this course, if any:
-- the learner is an active member of the company space, and the course was
-- assigned by the company (active assignment) or belongs to it.
create function private.assessment_policy_for(p_user uuid, p_course uuid)
returns public.enterprise_assessment_policies
language sql
stable
security definer
set search_path = ''
as $$
  select ap.*
    from public.enterprise_assessment_policies ap
    join public.enterprise_tenants t on t.id = ap.tenant_id
    join public.institution_memberships m on m.institution_id = t.institution_id and m.user_id = p_user and m.status = 'active'
   where ap.status = 'approved'
     and (exists (select 1 from public.course_assignments ca
                   where ca.institution_id = t.institution_id and ca.user_id = p_user and ca.course_id = p_course and ca.revoked_at is null)
          or exists (select 1 from public.courses c where c.id = p_course and c.owner_institution_id = t.institution_id))
   order by ap.approved_at
   limit 1;
$$;

-- Earliest due date of the company's active assignment of this course, when the policy enforces it.
create function private.assessment_due_on(p_user uuid, p_course uuid)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select min(ca.due_on)
    from public.enterprise_assessment_policies ap
    join public.enterprise_tenants t on t.id = ap.tenant_id
    join public.course_assignments ca on ca.institution_id = t.institution_id and ca.user_id = p_user and ca.course_id = p_course and ca.revoked_at is null
   where ap.id = (private.assessment_policy_for(p_user, p_course)).id and ap.enforce_due_dates;
$$;

revoke execute on function private.assessment_policy_for(uuid, uuid), private.assessment_due_on(uuid, uuid) from public, anon, authenticated;

-- ─── Quiz engine: same functions, the company's rule where it applies ─────

create or replace function public.quiz_status(p_quiz uuid, p_user uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user  uuid := coalesce(p_user, auth.uid());
  v_quiz  public.quizzes;
  v_pol   public.enterprise_assessment_policies;
  v_max   integer;
  v_pass_at integer;
  v_due   date;
  v_used  integer;
  v_open  uuid;
  v_pass  boolean;
  v_best  numeric;
begin
  select * into v_quiz from public.quizzes where id = p_quiz;
  perform private.require(found, 'not_found');
  perform private.require(
    v_user = auth.uid()
      or private.is_sanady_admin()
      or private.can_view_learner_course(v_user, v_quiz.course_id),
    'forbidden'
  );
  v_pol := private.assessment_policy_for(v_user, v_quiz.course_id);
  v_max := coalesce(v_pol.max_attempts, v_quiz.max_attempts);
  v_pass_at := coalesce(v_pol.pass_threshold, v_quiz.pass_threshold);
  v_due := private.assessment_due_on(v_user, v_quiz.course_id);

  select count(*),
         bool_or(passed),
         max(score_percent),
         (array_agg(id) filter (where status = 'in_progress'))[1]
    into v_used, v_pass, v_best, v_open
    from public.quiz_attempts
   where quiz_id = p_quiz and user_id = v_user and voided_at is null;

  return jsonb_build_object(
    'quiz_id', p_quiz,
    'attempts_used', v_used,
    'max_attempts', v_max,
    'remaining_attempts', greatest(v_max - v_used, 0),
    'pass_threshold', v_pass_at,
    'passed', coalesce(v_pass, false),
    'best_score', v_best,
    'open_attempt_id', v_open,
    'unlocked', private.module_lessons_complete(v_user, v_quiz.module_id),
    'question_count', (select count(*) from public.questions q where q.quiz_id = p_quiz and q.archived_at is null),
    'exhausted', not coalesce(v_pass, false) and v_open is null and v_used >= v_max,
    'company_policy', v_pol.id is not null,
    'due_on', v_due,
    'closed', v_due is not null and v_due < (now() at time zone 'Africa/Casablanca')::date and v_open is null and not coalesce(v_pass, false)
  );
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
  v_pol      public.enterprise_assessment_policies;
  v_attempt  public.quiz_attempts;
  v_used     integer;
  v_qids     uuid[];
  v_due      date;
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

    -- The company's approved policy, where it applies (SANADY's rule otherwise).
    v_pol := private.assessment_policy_for(v_uid, v_quiz.course_id);
    v_due := private.assessment_due_on(v_uid, v_quiz.course_id);
    perform private.require(v_due is null or v_due >= (now() at time zone 'Africa/Casablanca')::date, 'assessment_closed');

    select count(*) into v_used from public.quiz_attempts
     where quiz_id = p_quiz and user_id = v_uid and voided_at is null;
    perform private.require(v_used < coalesce(v_pol.max_attempts, v_quiz.max_attempts), 'attempts_exhausted');

    -- Order is fixed once per attempt (stored), so reloading keeps it.
    select coalesce(array_agg(id order by case when v_quiz.shuffle_questions then random() end, position, created_at), '{}') into v_qids
      from public.questions where quiz_id = p_quiz and archived_at is null;
    perform private.require(cardinality(v_qids) > 0, 'quiz_empty');

    insert into public.quiz_attempts (quiz_id, user_id, course_id, attempt_number, pass_threshold, max_attempts, question_ids)
    values (p_quiz, v_uid, v_quiz.course_id, v_used + 1,
            coalesce(v_pol.pass_threshold, v_quiz.pass_threshold), coalesce(v_pol.max_attempts, v_quiz.max_attempts), v_qids)
    returning * into v_attempt;

    perform private.touch_enrollment(v_uid, v_quiz.course_id);
    perform private.record_event(v_uid, v_quiz.course_id, 'quiz_started', null, p_quiz,
      jsonb_build_object('attempt_number', v_attempt.attempt_number, 'company_policy', v_pol.id is not null));
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

create or replace function public.get_attempt_result(p_attempt uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_a        public.quiz_attempts;
  v_pol      public.enterprise_assessment_policies;
  v_reveal   boolean;
  v_used     integer;
begin
  select * into v_a from public.quiz_attempts where id = p_attempt;
  perform private.require(found, 'not_found');
  perform private.require(
    v_a.user_id = auth.uid()
      or private.is_sanady_admin()
      or private.can_view_learner_course(v_a.user_id, v_a.course_id),
    'forbidden'
  );
  perform private.require(v_a.status = 'submitted', 'attempt_not_submitted');

  -- When correct answers are shown: SANADY's rule is after passing; a
  -- company policy may show them after each attempt, or never.
  v_pol := private.assessment_policy_for(v_a.user_id, v_a.course_id);
  v_reveal := private.is_sanady_admin()
    or case coalesce(v_pol.feedback, 'after_pass')
         when 'after_each_attempt' then true
         when 'never' then false
         else exists (select 1 from public.quiz_attempts
                       where quiz_id = v_a.quiz_id and user_id = v_a.user_id and passed and voided_at is null)
       end;

  select count(*) into v_used from public.quiz_attempts
   where quiz_id = v_a.quiz_id and user_id = v_a.user_id and voided_at is null;

  return jsonb_build_object(
    'attempt_id', v_a.id,
    'quiz_id', v_a.quiz_id,
    'course_id', v_a.course_id,
    'attempt_number', v_a.attempt_number,
    'submitted_at', v_a.submitted_at,
    'earned_points', v_a.earned_points,
    'max_points', v_a.max_points,
    'score_percent', v_a.score_percent,
    'passed', v_a.passed,
    'pass_threshold', v_a.pass_threshold,
    'max_attempts', v_a.max_attempts,
    'attempts_used', v_used,
    'remaining_attempts', case when v_a.voided_at is null then greatest(v_a.max_attempts - v_used, 0) else null end,
    'voided', v_a.voided_at is not null,
    'answers_revealed', v_reveal,
    'questions', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'id', q.id,
                 'kind', q.kind,
                 'prompt', q.prompt,
                 'points', q.points,
                 'explanation', case when v_reveal or coalesce(v_pol.feedback, 'after_pass') <> 'never' then nullif(q.explanation, '') end,
                 'is_correct', coalesce(ans.is_correct, false),
                 'points_awarded', coalesce(ans.points_awarded, 0),
                 'selected_option_ids', coalesce(to_jsonb(ans.selected_option_ids), '[]'::jsonb),
                 'options', coalesce((
                   select jsonb_agg(
                            jsonb_build_object('id', o.id, 'label', o.label)
                              || case when v_reveal then jsonb_build_object('is_correct', o.is_correct) else '{}'::jsonb end
                            order by o.position)
                     from public.question_options o where o.question_id = q.id
                 ), '[]'::jsonb)
               ) order by ord.n)
        from unnest(v_a.question_ids) with ordinality as ord(id, n)
        join public.questions q on q.id = ord.id
        left join public.quiz_answers ans on ans.attempt_id = v_a.id and ans.question_id = q.id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function private.evaluate_course_completion(p_user uuid, p_course uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_complete  boolean;
  v_course    public.courses;
  v_name      text;
  v_minutes   integer;
  v_cert_id   uuid;
  v_tries     integer := 0;
begin
  select * into v_course from public.courses where id = p_course;

  select exists (select 1 from public.modules m where m.course_id = p_course and m.archived_at is null)
     and not exists (
       select 1
         from public.lessons l
         join public.modules m on m.id = l.module_id and m.archived_at is null
        where l.course_id = p_course and l.archived_at is null and l.is_mandatory
          and not exists (
            select 1 from public.lesson_progress lp
             where lp.lesson_id = l.id and lp.user_id = p_user and lp.status = 'completed'
          )
     )
     and not exists (
       select 1
         from public.modules m
        where m.course_id = p_course and m.archived_at is null
          and not exists (
            select 1
              from public.quizzes q
              join public.quiz_attempts a on a.quiz_id = q.id
             where q.module_id = m.id and a.user_id = p_user
               and a.passed and a.voided_at is null
          )
     )
    into v_complete;

  if not v_complete then
    return false;
  end if;

  update public.enrollments
     set status = 'completed', completed_at = coalesce(completed_at, now())
   where user_id = p_user and course_id = p_course and status <> 'completed';
  if found then
    perform private.record_event(p_user, p_course, 'course_completed');
  end if;

  -- A company policy may record completion without issuing a document.
  if not coalesce((private.assessment_policy_for(p_user, p_course)).certificates, true) then
    return false;
  end if;

  select coalesce(nullif(full_name, ''), email) into v_name from public.profiles where id = p_user;
  v_minutes := coalesce(
    v_course.estimated_minutes,
    (select nullif(sum(coalesce(l.estimated_minutes, ceil(l.video_duration_seconds / 60.0)::integer, 0)), 0)
       from public.lessons l where l.course_id = p_course and l.archived_at is null)
  );

  loop
    begin
      insert into public.certificates (
        user_id, course_id, certificate_number, verification_code,
        recipient_name, course_title, course_duration_minutes, completed_at
      )
      values (
        p_user, p_course,
        'SND-' || to_char(now(), 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
        replace(gen_random_uuid()::text, '-', ''),
        v_name, v_course.title, v_minutes,
        coalesce((select completed_at from public.enrollments where user_id = p_user and course_id = p_course), now())
      )
      on conflict (user_id, course_id) do nothing
      returning id into v_cert_id;
      exit;
    exception when unique_violation then
      -- Extremely unlikely random-number collision: retry with new values.
      v_tries := v_tries + 1;
      if v_tries > 5 then raise; end if;
    end;
  end loop;

  if v_cert_id is not null then
    perform private.record_event(p_user, p_course, 'certificate_issued', null, null,
      jsonb_build_object('certificate_id', v_cert_id));
    return true;
  end if;
  return false;
end;
$$;

revoke execute on function public.save_assessment_policy(uuid, jsonb), public.approve_assessment_policy(uuid), public.remove_assessment_policy(uuid) from public, anon;
grant execute on function public.save_assessment_policy(uuid, jsonb), public.approve_assessment_policy(uuid), public.remove_assessment_policy(uuid) to authenticated;
