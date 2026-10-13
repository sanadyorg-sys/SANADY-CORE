-- ════════════════════════════════════════════════════════════════════════════
-- SANADY · Partenariats & Coopération — brief V2, phase 5
--   Impact indicators, verified partner reports, partnership dashboard
--
-- An indicator is a figure reported by the team for one field of
-- intervention and period, linked to an agreement or a project, with its
-- measurement method and the share attributed to the partnership. It is an
-- OUTPUT (activities, participants) or an OUTCOME (longer-term result) —
-- never mixed. Only figures verified by an approver are used in reports.
-- Nothing is attributed automatically (brief §12). Reports hold aggregates
-- only: no teacher or student is named (brief §13).
-- ════════════════════════════════════════════════════════════════════════════

create type public.metric_status as enum ('reported', 'verified', 'rejected');
create type public.report_status as enum ('draft', 'approved', 'shared');

create table public.partnership_impact_metrics (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.partner_organizations (id) on delete restrict,
  agreement_id        uuid references public.partnership_agreements (id) on delete set null,
  opportunity_id      uuid references public.partnership_opportunities (id) on delete set null,
  intervention_field  text not null references public.intervention_fields (slug),
  dimension           text not null check (dimension in (
                        'students_supported', 'activities_delivered', 'teachers_trained', 'trainings_completed',
                        'certificates_issued', 'orientation_activities', 'participating_students', 'assistance_activities',
                        'supported_applications', 'workshops_delivered', 'participants_reached', 'equipment_delivered',
                        'schools_supported', 'rehabilitation_milestones', 'other')),
  label               text check (char_length(label) <= 200),
  metric_type         text not null check (metric_type in ('output', 'outcome')),
  value               numeric(12, 2) not null check (value >= 0),
  unit                text check (char_length(unit) <= 60),
  period_start        date not null,
  period_end          date not null,
  method              text not null check (char_length(btrim(method)) between 10 and 2000),
  attribution         text not null check (attribution in ('direct', 'shared', 'context')),
  status              public.metric_status not null default 'reported',
  review_comment      text check (char_length(review_comment) <= 1000),
  verified_by         uuid references public.profiles (id) on delete set null,
  verified_at         timestamptz,
  created_by          uuid references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (period_end >= period_start),
  check (dimension <> 'other' or label is not null),
  check (agreement_id is not null or opportunity_id is not null)
);
create index partnership_impact_metrics_org_idx on public.partnership_impact_metrics (organization_id);
create index partnership_impact_metrics_status_idx on public.partnership_impact_metrics (status, updated_at desc);

create sequence public.partner_report_reference_seq;

create table public.partnership_reports (
  id                   uuid primary key default gen_random_uuid(),
  reference            text not null unique,
  organization_id      uuid not null references public.partner_organizations (id) on delete restrict,
  agreement_id         uuid references public.partnership_agreements (id) on delete set null,
  title                text not null check (char_length(btrim(title)) between 5 and 200),
  period_start         date not null,
  period_end           date not null,
  activities           text check (char_length(activities) <= 4000),
  challenges           text check (char_length(challenges) <= 4000),
  future_opportunities text check (char_length(future_opportunities) <= 4000),
  status               public.report_status not null default 'draft',
  approved_by          uuid references public.profiles (id) on delete set null,
  approved_at          timestamptz,
  shared_at            timestamptz,
  shared_by            uuid references public.profiles (id) on delete set null,
  created_by           uuid references public.profiles (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  check (period_end >= period_start)
);
create index partnership_reports_org_idx on public.partnership_reports (organization_id);

-- ─── Row level security ────────────────────────────────────────────────────
alter table public.partnership_impact_metrics enable row level security;
alter table public.partnership_reports        enable row level security;
revoke all on public.partnership_impact_metrics, public.partnership_reports from anon, authenticated;
revoke all on sequence public.partner_report_reference_seq from anon, authenticated;
create policy partnership_impact_metrics_select on public.partnership_impact_metrics for select to authenticated
  using (private.is_partnership_staff() or private.is_partnership_signatory());
create policy partnership_reports_select on public.partnership_reports for select to authenticated
  using (private.is_partnership_staff() or private.is_partnership_signatory());
grant select on public.partnership_impact_metrics, public.partnership_reports to authenticated;

-- ─── Impact indicators ─────────────────────────────────────────────────────
create function public.save_impact_metric(p_id uuid, p_org uuid, p jsonb)
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
    select status::text into v_st from public.partnership_impact_metrics where id = v_id and organization_id = p_org for update;
    perform private.require(v_st is not null, 'not_found');
    -- A verified figure is frozen; a rejected one is corrected and reported again.
    perform private.require(v_st <> 'verified', 'metric_locked');
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

create function public.set_metric_status(p_metric uuid, p_status text, p_comment text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_st text;
begin
  perform private.require(private.is_partnership_signatory(), 'forbidden');
  select status::text into v_st from public.partnership_impact_metrics where id = p_metric for update;
  perform private.require(v_st is not null, 'not_found');
  perform private.require(v_st = 'reported' and p_status in ('verified', 'rejected'), 'invalid_transition');
  perform private.require(p_status = 'verified' or char_length(btrim(coalesce(p_comment, ''))) >= 5, 'comment_required');
  update public.partnership_impact_metrics
     set status = p_status::public.metric_status, review_comment = nullif(btrim(coalesce(p_comment, '')), ''),
         verified_by = case when p_status = 'verified' then auth.uid() end,
         verified_at = case when p_status = 'verified' then now() end, updated_at = now()
   where id = p_metric;
  perform private.log_audit('impact_metric_' || p_status, 'partnership_impact_metrics', p_metric, null, '{}'::jsonb);
end;
$$;

-- ─── Partner reports ───────────────────────────────────────────────────────
create function public.save_partner_report(p_id uuid, p_org uuid, p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id  uuid := p_id;
  v_agr uuid := nullif(p ->> 'agreement_id', '')::uuid;
  v_st  text;
begin
  perform private.require(private.is_partnership_staff(), 'forbidden');
  perform private.require(exists (select 1 from public.partner_organizations where id = p_org and status is not null), 'not_found');
  perform private.require(v_agr is null or exists (select 1 from public.partnership_agreements where id = v_agr and organization_id = p_org), 'invalid_input');
  if v_id is null then
    insert into public.partnership_reports (reference, organization_id, agreement_id, title, period_start, period_end,
                                            activities, challenges, future_opportunities, created_by)
    values ('RAP-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.partner_report_reference_seq')::text, 4, '0'),
            p_org, v_agr, btrim(p ->> 'title'), (p ->> 'period_start')::date, (p ->> 'period_end')::date,
            nullif(btrim(coalesce(p ->> 'activities', '')), ''), nullif(btrim(coalesce(p ->> 'challenges', '')), ''),
            nullif(btrim(coalesce(p ->> 'future_opportunities', '')), ''), auth.uid())
    returning id into v_id;
  else
    select status::text into v_st from public.partnership_reports where id = v_id and organization_id = p_org for update;
    perform private.require(v_st is not null, 'not_found');
    perform private.require(v_st = 'draft', 'report_locked');
    update public.partnership_reports
       set agreement_id = v_agr, title = btrim(p ->> 'title'), period_start = (p ->> 'period_start')::date,
           period_end = (p ->> 'period_end')::date, activities = nullif(btrim(coalesce(p ->> 'activities', '')), ''),
           challenges = nullif(btrim(coalesce(p ->> 'challenges', '')), ''),
           future_opportunities = nullif(btrim(coalesce(p ->> 'future_opportunities', '')), ''), updated_at = now()
     where id = v_id;
  end if;
  return v_id;
end;
$$;

-- draft → approved (approver) · approved → draft (staff) · approved → shared (staff, records the date)
create function public.set_report_status(p_report uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_st text;
begin
  perform private.require(private.is_partnership_staff() or private.is_partnership_signatory(), 'forbidden');
  select status::text into v_st from public.partnership_reports where id = p_report for update;
  perform private.require(v_st is not null, 'not_found');
  if (v_st, p_status) = ('draft', 'approved') then
    perform private.require(private.is_partnership_signatory(), 'forbidden');
  elsif (v_st, p_status) in (('approved', 'draft'), ('approved', 'shared')) then
    perform private.require(private.is_partnership_staff(), 'forbidden');
  else
    perform private.require(false, 'invalid_transition');
  end if;
  update public.partnership_reports
     set status = p_status::public.report_status,
         approved_by = case when p_status = 'approved' then auth.uid() when p_status = 'draft' then null else approved_by end,
         approved_at = case when p_status = 'approved' then now() when p_status = 'draft' then null else approved_at end,
         shared_at = case when p_status = 'shared' then now() else shared_at end,
         shared_by = case when p_status = 'shared' then auth.uid() else shared_by end,
         updated_at = now()
   where id = p_report;
  perform private.log_audit('partner_report_' || p_status, 'partnership_reports', p_report, null, '{}'::jsonb);
end;
$$;

-- Everything a report shows, from verified data only, for this partner
-- only, and as aggregates (no person is named).
create function public.partner_report_data(p_report uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r public.partnership_reports;
begin
  perform private.require(private.is_partnership_staff() or private.is_partnership_signatory(), 'forbidden');
  select * into r from public.partnership_reports where id = p_report;
  perform private.require(r.id is not null, 'not_found');
  return jsonb_build_object(
    'report', to_jsonb(r) - 'created_by' - 'approved_by' - 'shared_by',
    'approver', (select pr.full_name from public.profiles pr where pr.id = r.approved_by),
    'organization', (select jsonb_build_object('name', o.name, 'type', o.org_type, 'city', o.city, 'country', o.country)
                       from public.partner_organizations o where o.id = r.organization_id),
    'agreements', coalesce((
      select jsonb_agg(jsonb_build_object('reference', a.reference, 'title', a.title, 'objectives', a.objectives,
                                          'field', f.name, 'start_on', a.start_on, 'end_on', a.end_on, 'status', a.status) order by a.start_on)
        from public.partnership_agreements a join public.intervention_fields f on f.slug = a.intervention_field
       where a.organization_id = r.organization_id and a.status in ('signed', 'active', 'completed')
         and (r.agreement_id is null or a.id = r.agreement_id)), '[]'::jsonb),
    'projects', coalesce((
      select jsonb_agg(distinct jsonb_build_object('reference', o.reference, 'title', o.title))
        from public.partnership_opportunities o
       where o.id in (select a.opportunity_id from public.partnership_agreements a
                       where a.organization_id = r.organization_id and (r.agreement_id is null or a.id = r.agreement_id))
          or o.id in (select c.opportunity_id from public.partnership_contributions c
                       where c.organization_id = r.organization_id and (r.agreement_id is null or c.agreement_id = r.agreement_id))), '[]'::jsonb),
    'contributions', coalesce((
      select jsonb_agg(jsonb_build_object('kind', c.kind, 'description', c.description, 'stage', c.stage, 'currency', c.currency,
                                          'amount_pledged', c.amount_pledged, 'amount_received', c.amount_received,
                                          'item', c.item, 'quantity', c.quantity, 'hours_pledged', c.hours_pledged,
                                          'hours_delivered', c.hours_delivered, 'received_on', c.received_on) order by c.created_at)
        from public.partnership_contributions c
       where c.organization_id = r.organization_id and c.stage <> 'cancelled'
         and (r.agreement_id is null or c.agreement_id = r.agreement_id)), '[]'::jsonb),
    'milestones', coalesce((
      select jsonb_agg(jsonb_build_object('title', m.title, 'due_on', m.due_on, 'done_at', m.done_at) order by m.due_on)
        from public.partnership_milestones m join public.partnership_agreements a on a.id = m.agreement_id
       where a.organization_id = r.organization_id and (r.agreement_id is null or a.id = r.agreement_id)
         and m.done_at is not null and m.done_at::date between r.period_start and r.period_end), '[]'::jsonb),
    'metrics', coalesce((
      select jsonb_agg(jsonb_build_object('field', f.name, 'dimension', m.dimension, 'label', m.label, 'type', m.metric_type,
                                          'value', m.value, 'unit', m.unit, 'period_start', m.period_start, 'period_end', m.period_end,
                                          'method', m.method, 'attribution', m.attribution) order by m.metric_type, f.position)
        from public.partnership_impact_metrics m join public.intervention_fields f on f.slug = m.intervention_field
       where m.organization_id = r.organization_id and m.status = 'verified'
         and (r.agreement_id is null or m.agreement_id = r.agreement_id)
         and m.period_start <= r.period_end and m.period_end >= r.period_start), '[]'::jsonb)
  );
end;
$$;

-- ─── Partnership dashboard (real values only) ──────────────────────────────
create function public.partnership_dashboard()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when not (private.is_partnership_staff() or private.is_partnership_signatory()) then null else jsonb_build_object(
    'prospects', (select count(*) from public.partner_organizations where status in ('prospect', 'first_contact', 'interest_confirmed', 'proposal_received', 'evaluation', 'negotiation')),
    'new_applications', (select count(*) from public.partnership_applications where created_at >= now() - interval '30 days'),
    'applications_open', (select count(*) from public.partnership_applications where status in ('received', 'under_review')),
    'active_partnerships', (select count(*) from public.partner_organizations where status in ('agreement_signed', 'implementation', 'monitoring')),
    'agreements_signed', (select count(*) from public.partnership_agreements where status in ('signed', 'active', 'completed')),
    'renewals', (select count(*) from public.partnership_agreements where status in ('signed', 'active') and end_on is not null and end_on - renewal_notice_days <= current_date),
    'follow_ups', (select count(*) from public.partnership_tasks where done_at is null),
    'projects_published', (select count(*) from public.partnership_opportunities where status = 'published'),
    'projects_closed', (select count(*) from public.partnership_opportunities where status in ('closed', 'archived')),
    'in_kind', (select count(*) from public.partnership_contributions where kind in ('material', 'expertise') and stage in ('delivered', 'verified')),
    'metrics_pending', (select count(*) from public.partnership_impact_metrics where status = 'reported'),
    'received', coalesce((select jsonb_agg(jsonb_build_object('currency', currency, 'received', s, 'verified', v))
                            from (select currency, sum(amount_received) s, sum(amount_received) filter (where stage = 'verified') v
                                    from public.partnership_contributions where kind = 'financial' and stage in ('delivered', 'verified')
                                   group by currency) t), '[]'::jsonb),
    'pipeline', coalesce((select jsonb_object_agg(status, n) from (select status::text, count(*) n from public.partner_organizations where status is not null group by status) t), '{}'::jsonb),
    'by_field', coalesce((select jsonb_agg(jsonb_build_object('field', f.name, 'slug', f.slug,
                            'agreements', (select count(*) from public.partnership_agreements a where a.intervention_field = f.slug and a.status in ('signed', 'active', 'completed')),
                            'projects', (select count(*) from public.partnership_opportunities o where o.intervention_field = f.slug and o.status in ('published', 'closed'))) order by f.position)
                            from public.intervention_fields f), '[]'::jsonb),
    'verified_metrics', coalesce((select jsonb_agg(jsonb_build_object('field', f.name, 'dimension', m.dimension, 'label', m.label, 'type', m.metric_type,
                                                              'value', m.total, 'unit', m.unit) order by f.position, m.metric_type)
                                    from (select intervention_field, dimension, label, metric_type, unit, sum(value) total
                                            from public.partnership_impact_metrics where status = 'verified'
                                           group by intervention_field, dimension, label, metric_type, unit) m
                                    join public.intervention_fields f on f.slug = m.intervention_field), '[]'::jsonb)
  ) end;
$$;

-- ─── Grants ────────────────────────────────────────────────────────────────
revoke execute on function
  public.save_impact_metric(uuid, uuid, jsonb), public.set_metric_status(uuid, text, text),
  public.save_partner_report(uuid, uuid, jsonb), public.set_report_status(uuid, text),
  public.partner_report_data(uuid), public.partnership_dashboard()
from public, anon;
grant execute on function
  public.save_impact_metric(uuid, uuid, jsonb), public.set_metric_status(uuid, text, text),
  public.save_partner_report(uuid, uuid, jsonb), public.set_report_status(uuid, text),
  public.partner_report_data(uuid), public.partnership_dashboard()
to authenticated;
