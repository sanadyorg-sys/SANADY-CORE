-- ════════════════════════════════════════════════════════════════════════════
-- SANADY · Reports and analytics
--
-- Real counts only, computed from the platform's own records. Periods are
-- calendar days in Morocco's time zone (Africa/Casablanca), both bounds
-- included, at most 2 years.
--
-- admin_report: whole platform, SANADY administrators only.
-- institution_report: one institution, restricted to the courses that
-- institution assigned to its active, consenting teachers (same privacy rule
-- as everywhere else: personal learning is never counted).
--
-- « Active » means the teacher's own learning activity (lessons, videos,
-- quizzes). Enrolment by an assignment, attempt resets by an administrator
-- and automatic certificate events are not activity.
-- ════════════════════════════════════════════════════════════════════════════

create function private.period_bounds(p_from date, p_to date, out v_from timestamptz, out v_to timestamptz)
language plpgsql
stable
set search_path = ''
as $$
begin
  perform private.require(p_from is not null and p_to is not null and p_from <= p_to and p_to - p_from <= 731, 'invalid_input');
  v_from := p_from::timestamp at time zone 'Africa/Casablanca';
  v_to := (p_to + 1)::timestamp at time zone 'Africa/Casablanca';
end;
$$;

create function public.admin_report(p_from date, p_to date)
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
  perform private.require(private.is_sanady_admin(), 'forbidden');
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

create function public.institution_report(p_institution uuid, p_from date, p_to date)
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
    private.is_sanady_admin() or private.is_institution_admin(p_institution),
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

revoke execute on function public.admin_report(date, date), public.institution_report(uuid, date, date) from public, anon;
grant execute on function public.admin_report(date, date), public.institution_report(uuid, date, date) to authenticated;
revoke execute on function private.period_bounds(date, date) from public, anon;
grant execute on function private.period_bounds(date, date) to authenticated;
