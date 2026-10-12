-- ════════════════════════════════════════════════════════════════════════════
-- SANADY · Partenariats & Coopération — brief V2, phase 3
--   Educational needs registry and projects seeking partners (opportunities)
--
-- Need identified → internal review → institutional approval (approver, 2FA)
--   → opportunity drafted from the approved need → internal review →
--   approved (approver, 2FA) → published → closed → archived.
-- A need is internal and never becomes public by itself: an opportunity is
-- a separate record, published only after an approver's decision. Funding
-- targets are shown publicly only on published (hence approved) projects.
-- Visitors read published projects through public_partnership_opportunities()
-- (anon still reads no table).
-- ════════════════════════════════════════════════════════════════════════════

create type public.need_priority as enum ('low', 'medium', 'high');
create type public.need_status as enum ('identified', 'internal_review', 'approved', 'rejected', 'closed');
create type public.opportunity_status as enum ('draft', 'internal_review', 'approved', 'published', 'closed', 'archived');

create sequence public.need_reference_seq;
create sequence public.opportunity_reference_seq;

-- ─── Educational needs (internal) ──────────────────────────────────────────
create table public.educational_needs (
  id                  uuid primary key default gen_random_uuid(),
  reference           text not null unique,
  title               text not null check (char_length(btrim(title)) between 5 and 200),
  intervention_field  text not null references public.intervention_fields (slug),
  institution_id      uuid references public.institutions (id) on delete set null,
  project_label       text check (char_length(project_label) <= 200),
  description         text not null check (char_length(btrim(description)) between 20 and 4000),
  justification       text not null check (char_length(btrim(justification)) between 20 and 4000),
  priority            public.need_priority not null default 'medium',
  required_resources  text check (char_length(required_resources) <= 2000),
  estimated_cost      numeric(12, 2) check (estimated_cost >= 0),
  currency            text not null default 'MAD' check (currency in ('MAD', 'EUR', 'USD')),
  timeline            text check (char_length(timeline) <= 200),
  responsible_id      uuid references public.profiles (id) on delete set null,
  status              public.need_status not null default 'identified',
  decided_by          uuid references public.profiles (id) on delete set null,
  decided_at          timestamptz,
  created_by          uuid references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index educational_needs_status_idx on public.educational_needs (status, updated_at desc);

-- ─── Projects seeking partners ─────────────────────────────────────────────
create table public.partnership_opportunities (
  id                     uuid primary key default gen_random_uuid(),
  reference              text not null unique,
  need_id                uuid references public.educational_needs (id) on delete set null,
  title                  text not null check (char_length(btrim(title)) between 5 and 200),
  intervention_field     text not null references public.intervention_fields (slug),
  summary                text not null check (char_length(btrim(summary)) between 20 and 300),
  description            text not null check (char_length(btrim(description)) between 50 and 6000),
  objectives             text not null check (char_length(btrim(objectives)) between 20 and 3000),
  beneficiaries          text not null check (char_length(btrim(beneficiaries)) between 5 and 1000),
  geographic_scope       text check (char_length(geographic_scope) <= 200),
  contribution_types     public.partnership_contribution[] not null default '{}' check (cardinality(contribution_types) > 0),
  expected_contribution  text not null check (char_length(btrim(expected_contribution)) between 10 and 2000),
  required_resources     text check (char_length(required_resources) <= 2000),
  funding_target         numeric(12, 2) check (funding_target > 0),
  currency               text not null default 'MAD' check (currency in ('MAD', 'EUR', 'USD')),
  timeline               text check (char_length(timeline) <= 200),
  department             text check (char_length(department) <= 150),
  deadline               date,
  status                 public.opportunity_status not null default 'draft',
  approved_by            uuid references public.profiles (id) on delete set null,
  approved_at            timestamptz,
  published_at           timestamptz,
  closed_at              timestamptz,
  created_by             uuid references public.profiles (id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index partnership_opportunities_status_idx on public.partnership_opportunities (status, published_at desc);

-- Applications may target a published project.
alter table public.partnership_applications
  add column opportunity_id uuid references public.partnership_opportunities (id) on delete set null;
create index partnership_applications_opportunity_idx on public.partnership_applications (opportunity_id);

-- History, notes and documents also cover needs and opportunities.
alter table public.partnership_status_history
  add column need_id uuid references public.educational_needs (id) on delete cascade,
  add column opportunity_id uuid references public.partnership_opportunities (id) on delete cascade,
  drop constraint partnership_status_history_check,
  add constraint partnership_status_history_one_target check (num_nonnulls(application_id, organization_id, need_id, opportunity_id) = 1);
create index partnership_status_history_need_idx on public.partnership_status_history (need_id, created_at);
create index partnership_status_history_opportunity_idx on public.partnership_status_history (opportunity_id, created_at);

alter table public.partnership_notes
  add column need_id uuid references public.educational_needs (id) on delete cascade,
  add column opportunity_id uuid references public.partnership_opportunities (id) on delete cascade,
  drop constraint partnership_notes_check,
  add constraint partnership_notes_one_target check (num_nonnulls(application_id, organization_id, need_id, opportunity_id) = 1);

-- ─── Row level security ────────────────────────────────────────────────────
alter table public.educational_needs         enable row level security;
alter table public.partnership_opportunities enable row level security;
revoke all on public.educational_needs, public.partnership_opportunities from anon, authenticated;
revoke all on sequence public.need_reference_seq, public.opportunity_reference_seq from anon, authenticated;
create policy educational_needs_select         on public.educational_needs         for select to authenticated using (private.is_partnership_staff());
create policy partnership_opportunities_select on public.partnership_opportunities for select to authenticated using (private.is_partnership_staff());
grant select on public.educational_needs, public.partnership_opportunities to authenticated;

-- ─── Internal helpers ──────────────────────────────────────────────────────
create function private.partnership_target_history(p_need uuid, p_opportunity uuid, p_from text, p_to text, p_note text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.partnership_status_history (need_id, opportunity_id, from_status, to_status, note, changed_by)
  values (p_need, p_opportunity, p_from, p_to, nullif(btrim(coalesce(p_note, '')), ''), auth.uid());
$$;

create function private.money(p text)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case when nullif(btrim(coalesce(p, '')), '') is null then null else replace(btrim(p), ',', '.')::numeric end;
$$;

-- ─── Needs ─────────────────────────────────────────────────────────────────
create function public.save_educational_need(p_id uuid, p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id     uuid := p_id;
  v_status text;
begin
  perform private.require(private.is_partnership_staff(), 'forbidden');
  perform private.require(exists (select 1 from public.intervention_fields where slug = p ->> 'intervention_field' and active), 'invalid_input');
  perform private.require(
    nullif(p ->> 'responsible_id', '') is null
    or coalesce(private.platform_role((p ->> 'responsible_id')::uuid) in ('sanady_admin', 'partnership_coordinator', 'partnership_manager'), false),
    'invalid_input');
  if v_id is null then
    insert into public.educational_needs (reference, title, intervention_field, institution_id, project_label, description, justification,
                                          priority, required_resources, estimated_cost, currency, timeline, responsible_id, created_by)
    values ('BES-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.need_reference_seq')::text, 4, '0'),
            btrim(p ->> 'title'), p ->> 'intervention_field', nullif(p ->> 'institution_id', '')::uuid,
            nullif(btrim(coalesce(p ->> 'project_label', '')), ''), btrim(p ->> 'description'), btrim(p ->> 'justification'),
            coalesce(nullif(p ->> 'priority', ''), 'medium')::public.need_priority,
            nullif(btrim(coalesce(p ->> 'required_resources', '')), ''), private.money(p ->> 'estimated_cost'),
            coalesce(nullif(p ->> 'currency', ''), 'MAD'), nullif(btrim(coalesce(p ->> 'timeline', '')), ''),
            coalesce(nullif(p ->> 'responsible_id', '')::uuid, auth.uid()), auth.uid())
    returning id into v_id;
    perform private.partnership_target_history(v_id, null, null, 'identified', null);
    perform private.log_audit('need_created', 'educational_needs', v_id, null, '{}'::jsonb);
  else
    select status::text into v_status from public.educational_needs where id = v_id for update;
    perform private.require(v_status is not null, 'not_found');
    -- Once decided, a need is frozen: its decision must stay meaningful.
    perform private.require(v_status in ('identified', 'internal_review'), 'invalid_transition');
    update public.educational_needs
       set title = btrim(p ->> 'title'),
           intervention_field = p ->> 'intervention_field',
           institution_id = nullif(p ->> 'institution_id', '')::uuid,
           project_label = nullif(btrim(coalesce(p ->> 'project_label', '')), ''),
           description = btrim(p ->> 'description'),
           justification = btrim(p ->> 'justification'),
           priority = coalesce(nullif(p ->> 'priority', ''), 'medium')::public.need_priority,
           required_resources = nullif(btrim(coalesce(p ->> 'required_resources', '')), ''),
           estimated_cost = private.money(p ->> 'estimated_cost'),
           currency = coalesce(nullif(p ->> 'currency', ''), 'MAD'),
           timeline = nullif(btrim(coalesce(p ->> 'timeline', '')), ''),
           responsible_id = nullif(p ->> 'responsible_id', '')::uuid,
           updated_at = now()
     where id = v_id;
    perform private.log_audit('need_updated', 'educational_needs', v_id, null, '{}'::jsonb);
  end if;
  return v_id;
end;
$$;

-- identified ⇄ internal_review (staff) · internal_review → approved | rejected
-- (approver, 2FA) · identified | internal_review | approved → closed (staff)
create function public.set_need_status(p_need uuid, p_status text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from text;
begin
  perform private.require(private.is_partnership_staff() or private.is_partnership_signatory(), 'forbidden');
  select status::text into v_from from public.educational_needs where id = p_need for update;
  perform private.require(v_from is not null, 'not_found');

  if (v_from, p_status) in (('identified', 'internal_review'), ('internal_review', 'identified')) then
    perform private.require(private.is_partnership_staff(), 'forbidden');
  elsif v_from = 'internal_review' and p_status in ('approved', 'rejected') then
    perform private.require(private.is_partnership_signatory(), 'forbidden');
  elsif v_from in ('identified', 'internal_review', 'approved') and p_status = 'closed' then
    perform private.require(private.is_partnership_staff(), 'forbidden');
  else
    perform private.require(false, 'invalid_transition');
  end if;

  update public.educational_needs
     set status = p_status::public.need_status,
         decided_by = case when p_status in ('approved', 'rejected') then auth.uid() else decided_by end,
         decided_at = case when p_status in ('approved', 'rejected') then now() else decided_at end,
         updated_at = now()
   where id = p_need;
  perform private.partnership_target_history(p_need, null, v_from, p_status, p_note);
  perform private.log_audit('need_status', 'educational_needs', p_need, null, jsonb_build_object('from', v_from, 'to', p_status));
end;
$$;

-- ─── Opportunities ─────────────────────────────────────────────────────────
create function private.opportunity_values(p jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require(exists (select 1 from public.intervention_fields where slug = p ->> 'intervention_field' and active), 'invalid_input');
  perform private.require(nullif(p ->> 'deadline', '') is null or (p ->> 'deadline')::date >= current_date, 'invalid_input');
  return p;
end;
$$;

-- A draft from an approved need (the need itself never becomes public).
create function public.create_opportunity_from_need(p_need uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  n    public.educational_needs;
  v_id uuid;
begin
  perform private.require(private.is_partnership_staff(), 'forbidden');
  select * into n from public.educational_needs where id = p_need;
  perform private.require(n.id is not null, 'not_found');
  perform private.require(n.status::text = 'approved', 'invalid_transition');

  insert into public.partnership_opportunities (reference, need_id, title, intervention_field, summary, description, objectives,
                                                beneficiaries, contribution_types, expected_contribution, required_resources,
                                                currency, timeline, created_by)
  values ('OPP-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.opportunity_reference_seq')::text, 4, '0'),
          n.id, n.title, n.intervention_field, left(n.description, 300),
          'Besoin : ' || n.description || E'\n\nJustification : ' || n.justification,
          n.justification, 'À préciser', '{financier}', 'À préciser avant la revue interne.',
          n.required_resources, n.currency, n.timeline, auth.uid())
  returning id into v_id;
  perform private.partnership_target_history(null, v_id, null, 'draft', 'Créée depuis le besoin ' || n.reference);
  perform private.log_audit('opportunity_created', 'partnership_opportunities', v_id, null, jsonb_build_object('need', n.reference));
  return v_id;
end;
$$;

create function public.save_partnership_opportunity(p_id uuid, p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id     uuid := p_id;
  v_status text;
  v        jsonb;
begin
  perform private.require(private.is_partnership_staff(), 'forbidden');
  v := private.opportunity_values(p);
  if v_id is null then
    insert into public.partnership_opportunities (reference, title, intervention_field, summary, description, objectives, beneficiaries,
                                                  geographic_scope, contribution_types, expected_contribution, required_resources,
                                                  funding_target, currency, timeline, department, deadline, created_by)
    values ('OPP-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.opportunity_reference_seq')::text, 4, '0'),
            btrim(v ->> 'title'), v ->> 'intervention_field', btrim(v ->> 'summary'), btrim(v ->> 'description'),
            btrim(v ->> 'objectives'), btrim(v ->> 'beneficiaries'), nullif(btrim(coalesce(v ->> 'geographic_scope', '')), ''),
            private.partner_contributions(v -> 'contribution_types'), btrim(v ->> 'expected_contribution'),
            nullif(btrim(coalesce(v ->> 'required_resources', '')), ''), private.money(v ->> 'funding_target'),
            coalesce(nullif(v ->> 'currency', ''), 'MAD'), nullif(btrim(coalesce(v ->> 'timeline', '')), ''),
            nullif(btrim(coalesce(v ->> 'department', '')), ''), nullif(v ->> 'deadline', '')::date, auth.uid())
    returning id into v_id;
    perform private.partnership_target_history(null, v_id, null, 'draft', null);
    perform private.log_audit('opportunity_created', 'partnership_opportunities', v_id, null, '{}'::jsonb);
  else
    select status::text into v_status from public.partnership_opportunities where id = v_id for update;
    perform private.require(v_status is not null, 'not_found');
    -- Approved or published content is frozen: what the approver validated is what visitors see.
    perform private.require(v_status in ('draft', 'internal_review'), 'invalid_transition');
    update public.partnership_opportunities
       set title = btrim(v ->> 'title'),
           intervention_field = v ->> 'intervention_field',
           summary = btrim(v ->> 'summary'),
           description = btrim(v ->> 'description'),
           objectives = btrim(v ->> 'objectives'),
           beneficiaries = btrim(v ->> 'beneficiaries'),
           geographic_scope = nullif(btrim(coalesce(v ->> 'geographic_scope', '')), ''),
           contribution_types = private.partner_contributions(v -> 'contribution_types'),
           expected_contribution = btrim(v ->> 'expected_contribution'),
           required_resources = nullif(btrim(coalesce(v ->> 'required_resources', '')), ''),
           funding_target = private.money(v ->> 'funding_target'),
           currency = coalesce(nullif(v ->> 'currency', ''), 'MAD'),
           timeline = nullif(btrim(coalesce(v ->> 'timeline', '')), ''),
           department = nullif(btrim(coalesce(v ->> 'department', '')), ''),
           deadline = nullif(v ->> 'deadline', '')::date,
           updated_at = now()
     where id = v_id;
    perform private.log_audit('opportunity_updated', 'partnership_opportunities', v_id, null, '{}'::jsonb);
  end if;
  return v_id;
end;
$$;

-- draft ⇄ internal_review (staff) · internal_review → approved (approver, 2FA)
-- · approved → published (staff or approver) · approved → draft (staff)
-- · published → closed (staff) · closed → published (approver, reopen)
-- · closed → archived (staff)
create function public.set_opportunity_status(p_opportunity uuid, p_status text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.partnership_opportunities;
begin
  perform private.require(private.is_partnership_staff() or private.is_partnership_signatory(), 'forbidden');
  select * into o from public.partnership_opportunities where id = p_opportunity for update;
  perform private.require(o.id is not null, 'not_found');

  if (o.status::text, p_status) in (('draft', 'internal_review'), ('internal_review', 'draft'), ('approved', 'draft'),
                                    ('published', 'closed'), ('closed', 'archived')) then
    perform private.require(private.is_partnership_staff(), 'forbidden');
  elsif (o.status::text, p_status) in (('internal_review', 'approved'), ('closed', 'published')) then
    perform private.require(private.is_partnership_signatory(), 'forbidden');
  elsif (o.status::text, p_status) = ('approved', 'published') then
    perform private.require(private.is_partnership_staff() or private.is_partnership_signatory(), 'forbidden');
    perform private.require(o.deadline is null or o.deadline >= current_date, 'invalid_input');
  else
    perform private.require(false, 'invalid_transition');
  end if;

  update public.partnership_opportunities
     set status = p_status::public.opportunity_status,
         approved_by = case when p_status = 'approved' then auth.uid() when p_status = 'draft' then null else approved_by end,
         approved_at = case when p_status = 'approved' then now() when p_status = 'draft' then null else approved_at end,
         published_at = case when p_status = 'published' then coalesce(published_at, now()) else published_at end,
         closed_at = case when p_status = 'closed' then now() when p_status = 'published' then null else closed_at end,
         updated_at = now()
   where id = p_opportunity;
  perform private.partnership_target_history(null, p_opportunity, o.status::text, p_status, p_note);
  perform private.log_audit('opportunity_status', 'partnership_opportunities', p_opportunity, null,
                            jsonb_build_object('from', o.status::text, 'to', p_status));
end;
$$;

-- ─── Notes on needs and opportunities ──────────────────────────────────────
create function public.add_partnership_target_note(p_need uuid, p_opportunity uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.require(private.is_partnership_staff(), 'forbidden');
  perform private.require((p_need is null) <> (p_opportunity is null), 'invalid_input');
  perform private.require(char_length(btrim(coalesce(p_body, ''))) between 1 and 4000, 'invalid_input');
  insert into public.partnership_notes (need_id, opportunity_id, body, author_id)
  values (p_need, p_opportunity, btrim(p_body), auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

-- ─── Public: published projects (no internal data) ─────────────────────────
-- Published projects, and those closed within the last 12 months (shown as
-- closed). A published project past its deadline is shown as closed.
create function public.public_partnership_opportunities()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(x order by x ->> 'open' desc, x ->> 'published_at' desc), '[]'::jsonb)
    from (
      select jsonb_build_object(
               'reference', o.reference,
               'title', o.title,
               'intervention_field', o.intervention_field,
               'summary', o.summary,
               'description', o.description,
               'objectives', o.objectives,
               'beneficiaries', o.beneficiaries,
               'geographic_scope', o.geographic_scope,
               'contribution_types', to_jsonb(o.contribution_types),
               'expected_contribution', o.expected_contribution,
               'required_resources', o.required_resources,
               'funding_target', o.funding_target,
               'currency', o.currency,
               'timeline', o.timeline,
               'department', o.department,
               'deadline', o.deadline,
               'published_at', o.published_at,
               'open', o.status = 'published' and (o.deadline is null or o.deadline >= current_date)
             ) as x
        from public.partnership_opportunities o
       where o.status = 'published'
          or (o.status = 'closed' and o.closed_at > now() - interval '12 months')
    ) s;
$$;

-- ─── Applications may name a published, open project ──────────────────────
create or replace function public.submit_partnership_application(p_id uuid, p jsonb, p_documents jsonb default '[]'::jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ref      text;
  v_email    text := lower(btrim(p ->> 'contact_email'));
  v_existing text;
  v_doc      jsonb;
  v_opp      public.partnership_opportunities;
  v_field    text := p ->> 'intervention_field';
begin
  select a.reference into v_existing
    from public.partnership_applications a
   where lower(a.contact_email) = v_email
     and lower(btrim(a.org_name)) = lower(btrim(p ->> 'org_name'))
     and a.created_at > now() - interval '10 minutes'
   limit 1;
  if v_existing is not null then
    return v_existing;
  end if;

  if nullif(p ->> 'opportunity', '') is not null then
    select * into v_opp from public.partnership_opportunities
     where reference = p ->> 'opportunity' and status = 'published' and (deadline is null or deadline >= current_date);
    perform private.require(v_opp.id is not null, 'invalid_input');
    v_field := v_opp.intervention_field;
  end if;

  perform private.require(jsonb_array_length(coalesce(p_documents, '[]'::jsonb)) <= 3, 'invalid_input');
  perform private.require(exists (select 1 from public.intervention_fields f where f.slug = v_field and f.active), 'invalid_input');

  v_ref := 'PART-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.partnership_reference_seq')::text, 4, '0');

  insert into public.partnership_applications (
    id, reference, org_name, org_type, country, city, website, sector, org_description,
    contact_name, contact_title, contact_email, contact_phone,
    intervention_field, contribution_type, contribution, cooperation, timeline, extra, consent_at, opportunity_id
  ) values (
    p_id, v_ref,
    btrim(p ->> 'org_name'), (p ->> 'org_type')::public.partner_org_type, btrim(p ->> 'country'),
    nullif(btrim(coalesce(p ->> 'city', '')), ''), nullif(btrim(coalesce(p ->> 'website', '')), ''),
    nullif(btrim(coalesce(p ->> 'sector', '')), ''), btrim(p ->> 'org_description'),
    btrim(p ->> 'contact_name'), btrim(p ->> 'contact_title'), v_email,
    nullif(btrim(coalesce(p ->> 'contact_phone', '')), ''),
    v_field, (p ->> 'contribution_type')::public.partnership_contribution,
    btrim(p ->> 'contribution'), btrim(p ->> 'cooperation'),
    nullif(btrim(coalesce(p ->> 'timeline', '')), ''), nullif(btrim(coalesce(p ->> 'extra', '')), ''), now(), v_opp.id
  );

  for v_doc in select * from jsonb_array_elements(coalesce(p_documents, '[]'::jsonb)) loop
    perform private.require((v_doc ->> 'path') like 'applications/' || p_id::text || '/%', 'invalid_input');
    perform private.require(v_doc ->> 'mime' = 'application/pdf', 'invalid_input');
    insert into public.partnership_documents (application_id, storage_path, file_name, mime_type, file_size)
    values (p_id, v_doc ->> 'path', left(v_doc ->> 'name', 200), v_doc ->> 'mime', (v_doc ->> 'size')::integer);
  end loop;

  perform private.partnership_history(p_id, null, null, 'received', null);
  perform private.log_audit('partnership_application_received', 'partnership_applications', p_id, null,
                            jsonb_build_object('reference', v_ref, 'field', v_field, 'opportunity', v_opp.reference));
  return v_ref;
end;
$$;

-- ─── Grants ────────────────────────────────────────────────────────────────
revoke execute on function public.public_partnership_opportunities() from public;
grant execute on function public.public_partnership_opportunities() to anon, authenticated;

revoke execute on function
  public.save_educational_need(uuid, jsonb),
  public.set_need_status(uuid, text, text),
  public.create_opportunity_from_need(uuid),
  public.save_partnership_opportunity(uuid, jsonb),
  public.set_opportunity_status(uuid, text, text),
  public.add_partnership_target_note(uuid, uuid, text)
  from public, anon;
grant execute on function
  public.save_educational_need(uuid, jsonb),
  public.set_need_status(uuid, text, text),
  public.create_opportunity_from_need(uuid),
  public.save_partnership_opportunity(uuid, jsonb),
  public.set_opportunity_status(uuid, text, text),
  public.add_partnership_target_note(uuid, uuid, text)
  to authenticated;

revoke execute on function public.submit_partnership_application(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.submit_partnership_application(uuid, jsonb, jsonb) to service_role;

revoke execute on function
  private.partnership_target_history(uuid, uuid, text, text, text),
  private.money(text),
  private.opportunity_values(jsonb)
  from public, anon, authenticated;
