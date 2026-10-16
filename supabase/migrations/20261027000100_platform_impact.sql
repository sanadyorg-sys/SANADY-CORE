-- ════════════════════════════════════════════════════════════════════════════
-- SANADY · Partenariats & Coopération — impact indicators from platform data
--
-- The team can compute a training indicator from SANADY itself instead of
-- typing it: teachers trained, courses completed, certificates issued,
-- active teachers, participating schools — for schools and (optionally)
-- courses the team chooses, over a period.
--   • Nothing is attributed automatically (brief V2 §12): a person chooses
--     the agreement or project, the scope and the share of the partnership.
--   • The database computes the figure; the team cannot type over it. It is
--     « reported » and an approver verifies it as any other indicator, with
--     the figure recomputed live beside it.
--   • Aggregates only, never a name (brief §13). Only teachers who consented
--     to share their progress with their school, and whose membership is
--     active, are counted; company workspaces are never in scope. A count
--     between 1 and 4 is flagged so nobody can be recognised in a report.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.partnership_impact_metrics
  add column source       text not null default 'manual' check (source in ('manual', 'platform')),
  add column source_scope jsonb,
  add constraint partnership_impact_metrics_source_scope check ((source = 'platform') = (source_scope is not null));

create function private.platform_measure(p_measure text, p_institutions uuid[], p_courses uuid[], p_from date, p_to date)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  with teachers as (
    select distinct m.user_id, m.institution_id
      from public.institution_memberships m
      join public.institutions i on i.id = m.institution_id and i.kind = 'school'
     where m.institution_id = any (p_institutions)
       and m.role = 'teacher' and m.status = 'active' and m.consented_at is not null
  ),
  done as (
    select e.user_id, e.course_id
      from public.enrollments e
     where e.user_id in (select user_id from teachers)
       and e.completed_at is not null
       and (e.completed_at at time zone 'Africa/Casablanca')::date between p_from and p_to
       and (coalesce(cardinality(p_courses), 0) = 0 or e.course_id = any (p_courses))
  )
  select case p_measure
    when 'teachers_trained'    then (select count(distinct user_id) from done)
    when 'trainings_completed' then (select count(*) from done)
    when 'certificates_issued' then (
      select count(*) from public.certificates c
       where c.user_id in (select user_id from teachers) and c.revoked_at is null
         and (c.issued_at at time zone 'Africa/Casablanca')::date between p_from and p_to
         and (coalesce(cardinality(p_courses), 0) = 0 or c.course_id = any (p_courses)))
    when 'active_teachers' then (
      select count(distinct e.user_id) from public.enrollments e
       where e.user_id in (select user_id from teachers)
         and (coalesce(cardinality(p_courses), 0) = 0 or e.course_id = any (p_courses))
         and ((e.enrolled_at at time zone 'Africa/Casablanca')::date between p_from and p_to
              or (e.last_activity_at at time zone 'Africa/Casablanca')::date between p_from and p_to))
    when 'participating_schools' then (
      select count(distinct t.institution_id) from teachers t where t.user_id in (select user_id from done))
  end::integer;
$$;
revoke execute on function private.platform_measure(text, uuid[], uuid[], date, date) from public, anon, authenticated;

-- Preview: the figure, without saving anything.
create function public.platform_impact_measure(p_measure text, p_institutions uuid[], p_courses uuid[], p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v integer;
begin
  perform private.require(private.is_partnership_staff() or private.is_partnership_signatory(), 'forbidden');
  perform private.require(p_measure in ('teachers_trained', 'trainings_completed', 'certificates_issued', 'active_teachers', 'participating_schools'), 'invalid_input');
  perform private.require(coalesce(cardinality(p_institutions), 0) between 1 and 200 and coalesce(cardinality(p_courses), 0) <= 200, 'scope_required');
  perform private.require(p_from is not null and p_to is not null and p_to >= p_from, 'invalid_input');
  perform private.require(not exists (select 1 from unnest(p_institutions) x where not exists (select 1 from public.institutions where id = x and kind = 'school')), 'invalid_input');
  v := private.platform_measure(p_measure, p_institutions, p_courses, p_from, p_to);
  return jsonb_build_object('value', v, 'small', v between 1 and 4);
end;
$$;

-- Saved as « reported »: the value is computed here, never taken from the form.
create function public.record_platform_metric(p_id uuid, p_org uuid, p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id      uuid := p_id;
  v_agr     uuid := nullif(p ->> 'agreement_id', '')::uuid;
  v_opp     uuid := nullif(p ->> 'opportunity_id', '')::uuid;
  v_measure text := p ->> 'measure';
  v_inst    uuid[] := array(select distinct x::uuid from jsonb_array_elements_text(coalesce(p -> 'institution_ids', '[]')) x);
  v_courses uuid[] := array(select distinct x::uuid from jsonb_array_elements_text(coalesce(p -> 'course_ids', '[]')) x);
  v_from    date := (p ->> 'period_start')::date;
  v_to      date := (p ->> 'period_end')::date;
  v_value   integer;
  v_dim     text;
  v_label   text;
  v_names   text;
  v_titles  text;
  v_method  text;
  v_st      text;
begin
  perform private.require(private.is_partnership_staff(), 'forbidden');
  perform private.require(exists (select 1 from public.partner_organizations where id = p_org and status is not null), 'not_found');
  perform private.require(v_agr is not null or v_opp is not null, 'attribution_required');
  perform private.require(v_agr is null or exists (select 1 from public.partnership_agreements where id = v_agr and organization_id = p_org), 'invalid_input');
  perform private.require(v_opp is null or exists (select 1 from public.partnership_opportunities where id = v_opp), 'invalid_input');
  perform private.require(p ->> 'attribution' in ('direct', 'shared', 'context'), 'invalid_input');
  perform private.require(exists (select 1 from public.intervention_fields where slug = p ->> 'intervention_field'), 'invalid_input');
  perform private.require(not exists (select 1 from unnest(v_courses) x where not exists (select 1 from public.courses where id = x)), 'invalid_input');
  v_value := ((public.platform_impact_measure(v_measure, v_inst, v_courses, v_from, v_to)) ->> 'value')::integer;

  v_dim := case when v_measure in ('teachers_trained', 'trainings_completed', 'certificates_issued') then v_measure else 'other' end;
  v_label := case v_measure when 'active_teachers' then 'Enseignants actifs sur SANADY' when 'participating_schools' then 'Établissements participants' end;
  select string_agg(name, ', ' order by name) into v_names from public.institutions where id = any (v_inst);
  select string_agg(title, ', ' order by title) into v_titles from public.courses where id = any (v_courses);
  v_method := left(
    'Calculé à partir des données de la plateforme SANADY le ' || to_char(now() at time zone 'Africa/Casablanca', 'DD/MM/YYYY') || ' — '
    || case v_measure
         when 'teachers_trained'      then 'enseignants ayant terminé au moins une formation'
         when 'trainings_completed'   then 'formations terminées (une par enseignant et par formation)'
         when 'certificates_issued'   then 'certificats délivrés et non révoqués'
         when 'active_teachers'       then 'enseignants inscrits ou actifs dans une formation'
         when 'participating_schools' then 'établissements dont au moins un enseignant a terminé une formation'
       end
    || ' entre le ' || to_char(v_from, 'DD/MM/YYYY') || ' et le ' || to_char(v_to, 'DD/MM/YYYY')
    || '. Établissements : ' || v_names || '. Formations : ' || coalesce(v_titles, 'toutes') || '.'
    || ' Seuls les enseignants ayant accepté de partager leur progression avec leur établissement sont comptés.'
    || coalesce(' Note : ' || nullif(btrim(coalesce(p ->> 'note', '')), ''), ''), 2000);

  if v_id is null then
    insert into public.partnership_impact_metrics (
      organization_id, agreement_id, opportunity_id, intervention_field, dimension, label, metric_type, value, unit,
      period_start, period_end, method, attribution, source, source_scope, created_by)
    values (
      p_org, v_agr, v_opp, p ->> 'intervention_field', v_dim, v_label, 'output', v_value, null,
      v_from, v_to, v_method, p ->> 'attribution', 'platform',
      jsonb_build_object('measure', v_measure, 'institution_ids', to_jsonb(v_inst), 'course_ids', to_jsonb(v_courses), 'computed_at', now()),
      auth.uid())
    returning id into v_id;
  else
    select status::text into v_st from public.partnership_impact_metrics where id = v_id and organization_id = p_org and source = 'platform' for update;
    perform private.require(v_st is not null, 'not_found');
    perform private.require(v_st <> 'verified', 'metric_locked');
    update public.partnership_impact_metrics
       set agreement_id = v_agr, opportunity_id = v_opp, intervention_field = p ->> 'intervention_field', dimension = v_dim, label = v_label,
           value = v_value, period_start = v_from, period_end = v_to, method = v_method, attribution = p ->> 'attribution',
           source_scope = jsonb_build_object('measure', v_measure, 'institution_ids', to_jsonb(v_inst), 'course_ids', to_jsonb(v_courses), 'computed_at', now()),
           status = 'reported', review_comment = null, updated_at = now()
     where id = v_id;
  end if;
  return v_id;
end;
$$;

-- What the figure is today, for the approver who verifies it.
create function public.platform_metric_recount(p_metric uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  m public.partnership_impact_metrics;
begin
  perform private.require(private.is_partnership_staff() or private.is_partnership_signatory(), 'forbidden');
  select * into m from public.partnership_impact_metrics where id = p_metric and source = 'platform';
  perform private.require(m.id is not null, 'not_found');
  return private.platform_measure(
    m.source_scope ->> 'measure',
    array(select x::uuid from jsonb_array_elements_text(m.source_scope -> 'institution_ids') x),
    array(select x::uuid from jsonb_array_elements_text(m.source_scope -> 'course_ids') x),
    m.period_start, m.period_end);
end;
$$;

-- A computed figure cannot be typed over through the manual form.
create or replace function public.save_impact_metric(p_id uuid, p_org uuid, p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id  uuid := p_id;
  v_agr uuid := nullif(p ->> 'agreement_id', '')::uuid;
  v_opp uuid := nullif(p ->> 'opportunity_id', '')::uuid;
  v_st  text;
  v_src text;
begin
  perform private.require(private.is_partnership_staff(), 'forbidden');
  perform private.require(exists (select 1 from public.partner_organizations where id = p_org and status is not null), 'not_found');
  perform private.require(v_agr is not null or v_opp is not null, 'attribution_required');
  perform private.require(v_agr is null or exists (select 1 from public.partnership_agreements where id = v_agr and organization_id = p_org), 'invalid_input');
  perform private.require(v_opp is null or exists (select 1 from public.partnership_opportunities where id = v_opp), 'invalid_input');

  if v_id is null then
    insert into public.partnership_impact_metrics (
      organization_id, agreement_id, opportunity_id, intervention_field, dimension, label, metric_type, value, unit,
      period_start, period_end, method, attribution, created_by)
    values (
      p_org, v_agr, v_opp, p ->> 'intervention_field', p ->> 'dimension', nullif(btrim(coalesce(p ->> 'label', '')), ''),
      p ->> 'metric_type', private.money(p ->> 'value'), nullif(btrim(coalesce(p ->> 'unit', '')), ''),
      (p ->> 'period_start')::date, (p ->> 'period_end')::date, btrim(p ->> 'method'), p ->> 'attribution', auth.uid())
    returning id into v_id;
  else
    select status::text, source into v_st, v_src from public.partnership_impact_metrics where id = v_id and organization_id = p_org for update;
    perform private.require(v_st is not null, 'not_found');
    -- A verified figure is frozen; a rejected one is corrected and reported again.
    perform private.require(v_st <> 'verified', 'metric_locked');
    perform private.require(v_src = 'manual', 'metric_computed');
    update public.partnership_impact_metrics
       set agreement_id = v_agr, opportunity_id = v_opp, intervention_field = p ->> 'intervention_field', dimension = p ->> 'dimension',
           label = nullif(btrim(coalesce(p ->> 'label', '')), ''), metric_type = p ->> 'metric_type', value = private.money(p ->> 'value'),
           unit = nullif(btrim(coalesce(p ->> 'unit', '')), ''), period_start = (p ->> 'period_start')::date,
           period_end = (p ->> 'period_end')::date, method = btrim(p ->> 'method'), attribution = p ->> 'attribution',
           status = 'reported', review_comment = null, updated_at = now()
     where id = v_id;
  end if;
  return v_id;
end;
$$;

-- Schools and courses the team can choose from (names only).
create function public.platform_impact_scope()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require(private.is_partnership_staff(), 'forbidden');
  return jsonb_build_object(
    'institutions', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name) order by name) from public.institutions where kind = 'school'), '[]'),
    'courses', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'title', title) order by title) from public.courses where status = 'published' and not tenant_private), '[]'),
    -- A supported project points to a need, which may name a school: suggested, never imposed.
    'project_schools', coalesce((select jsonb_object_agg(o.id, n.institution_id)
                                   from public.partnership_opportunities o
                                   join public.educational_needs n on n.id = o.need_id
                                   join public.institutions i on i.id = n.institution_id and i.kind = 'school'), '{}'));
end;
$$;

revoke execute on function
  public.platform_impact_measure(text, uuid[], uuid[], date, date), public.record_platform_metric(uuid, uuid, jsonb),
  public.platform_metric_recount(uuid), public.platform_impact_scope()
from public, anon;
grant execute on function
  public.platform_impact_measure(text, uuid[], uuid[], date, date), public.record_platform_metric(uuid, uuid, jsonb),
  public.platform_metric_recount(uuid), public.platform_impact_scope()
to authenticated;
