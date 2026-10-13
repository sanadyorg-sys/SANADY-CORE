-- ════════════════════════════════════════════════════════════════════════════
-- SANADY · Partenariats & Coopération — brief V2, phase 6 (§15)
--   Optional partner portal: /espace-partenaire
--
-- DISABLED by default. External partner accounts exist only when:
--   1. a SANADY administrator switches the portal on (audited), and
--   2. a partnership manager (or an administrator) invites one contact of
--      an organisation with an active partnership.
-- A partner member sees only their own organisation, through functions that
-- return what is meant for partners: signed agreements and their
-- milestones, supported projects (public fields), reports already shared
-- with them, their own deliverables and the conversation with SANADY.
-- Internal notes, needs, tasks, approvals and other partners never leave
-- the team (no table is readable by partners).
-- ════════════════════════════════════════════════════════════════════════════

alter type public.invitation_kind add value if not exists 'partner_member';

alter table public.platform_settings
  add column partner_portal_enabled boolean not null default false;

alter table public.invitations
  add column partner_organization_id uuid references public.partner_organizations (id) on delete cascade,
  add constraint invitations_partner_check check ((kind::text = 'partner_member') = (partner_organization_id is not null));

create table public.partner_portal_members (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.partner_organizations (id) on delete cascade,
  user_id          uuid not null references public.profiles (id) on delete cascade,
  granted_by       uuid references public.profiles (id) on delete set null,
  granted_at       timestamptz not null default now(),
  revoked_at       timestamptz,
  revoked_by       uuid references public.profiles (id) on delete set null
);
create unique index partner_portal_members_active_idx on public.partner_portal_members (organization_id, user_id) where revoked_at is null;
create index partner_portal_members_user_idx on public.partner_portal_members (user_id) where revoked_at is null;

create table public.partner_deliverables (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.partner_organizations (id) on delete cascade,
  agreement_id     uuid references public.partnership_agreements (id) on delete set null,
  milestone_id     uuid references public.partnership_milestones (id) on delete set null,
  title            text not null check (char_length(btrim(title)) between 3 and 200),
  description      text check (char_length(description) <= 2000),
  status           text not null default 'submitted' check (status in ('submitted', 'accepted', 'returned')),
  review_comment   text check (char_length(review_comment) <= 1000),
  submitted_by     uuid references public.profiles (id) on delete set null,
  reviewed_by      uuid references public.profiles (id) on delete set null,
  reviewed_at      timestamptz,
  created_at       timestamptz not null default now()
);
create index partner_deliverables_org_idx on public.partner_deliverables (organization_id, created_at desc);

create table public.partner_messages (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.partner_organizations (id) on delete cascade,
  author_id        uuid references public.profiles (id) on delete set null,
  from_partner     boolean not null,
  body             text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at       timestamptz not null default now()
);
create index partner_messages_org_idx on public.partner_messages (organization_id, created_at desc);

alter table public.partnership_documents
  add column deliverable_id uuid references public.partner_deliverables (id) on delete cascade,
  drop constraint partnership_documents_one_target,
  add constraint partnership_documents_one_target check (num_nonnulls(application_id, organization_id, agreement_id, contribution_id, deliverable_id) = 1),
  drop constraint partnership_documents_kind_check,
  add constraint partnership_documents_kind_check check (kind in ('proposal', 'draft', 'signed', 'supporting', 'evidence', 'deliverable'));

-- ─── Row level security: the team reads; partners go through functions ────
alter table public.partner_portal_members enable row level security;
alter table public.partner_deliverables   enable row level security;
alter table public.partner_messages       enable row level security;
revoke all on public.partner_portal_members, public.partner_deliverables, public.partner_messages from anon, authenticated;
create policy partner_portal_members_select on public.partner_portal_members for select to authenticated using (private.is_partnership_staff());
create policy partner_deliverables_select   on public.partner_deliverables   for select to authenticated using (private.is_partnership_staff());
create policy partner_messages_select       on public.partner_messages       for select to authenticated using (private.is_partnership_staff());
grant select on public.partner_portal_members, public.partner_deliverables, public.partner_messages to authenticated;

-- ─── Helpers ───────────────────────────────────────────────────────────────
create function private.partner_portal_enabled()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select partner_portal_enabled from public.platform_settings where id), false);
$$;

-- The organisation of the current partner member (portal on, account active).
create function private.portal_organization(p_user uuid default auth.uid())
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.organization_id
    from public.partner_portal_members m
    join public.profiles p on p.id = m.user_id and p.status = 'active'
   where m.user_id = p_user and m.revoked_at is null and private.partner_portal_enabled()
   order by m.granted_at
   limit 1;
$$;

-- ─── Switch and access (SANADY side) ───────────────────────────────────────
create function public.set_partner_portal(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require(private.is_sanady_admin(), 'forbidden');
  update public.platform_settings set partner_portal_enabled = coalesce(p_enabled, false), updated_by = auth.uid() where id;
  perform private.log_audit(case when p_enabled then 'partner_portal_enabled' else 'partner_portal_disabled' end,
                            'platform_settings', null, null, '{}'::jsonb);
end;
$$;

create function public.invite_partner_member(p_org uuid, p_email text, p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(p_email));
  v_days  smallint;
  v_id    uuid;
begin
  perform private.require(private.is_sanady_admin() or private.is_partnership_manager(), 'forbidden');
  perform private.require(private.partner_portal_enabled(), 'portal_disabled');
  perform private.require(v_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(v_email) <= 254, 'invalid_input');
  perform private.require(p_token_hash ~ '^[0-9a-f]{64}$', 'invalid_input');
  -- Only organisations with a signed partnership.
  perform private.require(
    exists (select 1 from public.partner_organizations where id = p_org and status in ('agreement_signed', 'implementation', 'monitoring', 'renewal_or_closure')),
    'partnership_not_active');
  -- SANADY staff never get a partner account.
  perform private.require(
    not exists (select 1 from public.platform_roles r join public.profiles p on p.id = r.user_id where p.email = v_email), 'invalid_input');
  perform private.require(
    not exists (select 1 from public.partner_portal_members m join public.profiles p on p.id = m.user_id
                 where m.organization_id = p_org and p.email = v_email and m.revoked_at is null), 'already_member');
  select invitation_validity_days into v_days from public.platform_settings where id;
  update public.invitations set revoked_at = now(), revoked_by = auth.uid()
   where kind::text = 'partner_member' and email = v_email and partner_organization_id = p_org and accepted_at is null and revoked_at is null;
  insert into public.invitations (kind, email, partner_organization_id, token_hash, invited_by, expires_at)
  values ('partner_member', v_email, p_org, p_token_hash, auth.uid(), now() + make_interval(days => v_days))
  returning id into v_id;
  perform private.log_audit('partner_member_invited', 'partner_organizations', p_org, null, '{}'::jsonb);
  return v_id;
end;
$$;

create function public.revoke_partner_member(p_member uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require(private.is_sanady_admin() or private.is_partnership_manager(), 'forbidden');
  update public.partner_portal_members set revoked_at = now(), revoked_by = auth.uid() where id = p_member and revoked_at is null;
  perform private.require(found, 'not_found');
  perform private.log_audit('partner_member_revoked', 'partner_portal_members', p_member, null, '{}'::jsonb);
end;
$$;

-- ─── What a partner sees ───────────────────────────────────────────────────
create function public.portal_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_org uuid := private.portal_organization();
begin
  perform private.require(v_org is not null, 'forbidden');
  return jsonb_build_object(
    'organization', (select jsonb_build_object('id', o.id, 'name', o.name) from public.partner_organizations o where o.id = v_org),
    'representative', (select pr.full_name from public.partner_organizations o join public.profiles pr on pr.id = o.assigned_to where o.id = v_org),
    'agreements', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', a.id, 'reference', a.reference, 'title', a.title, 'objectives', a.objectives, 'field', f.name,
               'start_on', a.start_on, 'end_on', a.end_on, 'status', a.status, 'signed_on', a.signed_on,
               'milestones', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'title', m.title, 'due_on', m.due_on, 'done', m.done_at is not null) order by m.due_on)
                                         from public.partnership_milestones m where m.agreement_id = a.id), '[]'::jsonb)
             ) order by a.start_on desc nulls last)
        from public.partnership_agreements a join public.intervention_fields f on f.slug = a.intervention_field
       where a.organization_id = v_org and a.status in ('signed', 'active', 'completed')), '[]'::jsonb),
    'projects', coalesce((
      select jsonb_agg(distinct jsonb_build_object('reference', o.reference, 'title', o.title, 'summary', o.summary, 'status', o.status))
        from public.partnership_opportunities o
       where o.status in ('published', 'closed')
         and (o.id in (select opportunity_id from public.partnership_agreements where organization_id = v_org and status in ('signed', 'active', 'completed'))
              or o.id in (select opportunity_id from public.partnership_contributions where organization_id = v_org and stage <> 'cancelled'))), '[]'::jsonb),
    'reports', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'reference', r.reference, 'title', r.title, 'period_start', r.period_start,
                                          'period_end', r.period_end, 'shared_at', r.shared_at) order by r.shared_at desc)
        from public.partnership_reports r where r.organization_id = v_org and r.status = 'shared'), '[]'::jsonb),
    'deliverables', coalesce((
      select jsonb_agg(jsonb_build_object('id', d.id, 'title', d.title, 'status', d.status, 'review_comment', d.review_comment,
                                          'created_at', d.created_at, 'agreement', a.reference,
                                          'files', (select coalesce(jsonb_agg(doc.file_name), '[]'::jsonb) from public.partnership_documents doc where doc.deliverable_id = d.id))
                       order by d.created_at desc)
        from public.partner_deliverables d left join public.partnership_agreements a on a.id = d.agreement_id
       where d.organization_id = v_org), '[]'::jsonb),
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'body', m.body, 'from_partner', m.from_partner, 'created_at', m.created_at,
                                          'author', case when m.from_partner then pr.full_name else 'Équipe SANADY' end) order by m.created_at)
        from (select * from public.partner_messages where organization_id = v_org order by created_at desc limit 100) m
        left join public.profiles pr on pr.id = m.author_id), '[]'::jsonb)
  );
end;
$$;

-- Deliverables submitted by the partner (PDF verified and moved by the server first).
create function public.submit_partner_deliverable(p_id uuid, p jsonb, p_documents jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := private.portal_organization();
  v_agr uuid := nullif(p ->> 'agreement_id', '')::uuid;
  d     jsonb;
begin
  perform private.require(v_org is not null, 'forbidden');
  perform private.require(
    v_agr is null or exists (select 1 from public.partnership_agreements where id = v_agr and organization_id = v_org and status in ('signed', 'active')),
    'invalid_input');
  perform private.require(jsonb_typeof(p_documents) = 'array' and jsonb_array_length(p_documents) between 1 and 3, 'document_required');
  insert into public.partner_deliverables (id, organization_id, agreement_id, title, description, submitted_by)
  values (p_id, v_org, v_agr, btrim(p ->> 'title'), nullif(btrim(coalesce(p ->> 'description', '')), ''), auth.uid());
  for d in select * from jsonb_array_elements(p_documents) loop
    perform private.require((d ->> 'path') like 'deliverables/' || p_id::text || '/%', 'invalid_input');
    insert into public.partnership_documents (deliverable_id, kind, storage_path, file_name, mime_type, file_size, uploaded_by)
    values (p_id, 'deliverable', d ->> 'path', left(d ->> 'name', 200), 'application/pdf', (d ->> 'size')::integer, auth.uid());
  end loop;
  insert into public.partner_messages (organization_id, author_id, from_partner, body)
  values (v_org, auth.uid(), true, 'Livrable déposé : ' || btrim(p ->> 'title'));
  perform private.log_audit('partner_deliverable_submitted', 'partner_deliverables', p_id, null, '{}'::jsonb);
  return p_id;
end;
$$;

create function public.review_partner_deliverable(p_id uuid, p_status text, p_comment text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  perform private.require(private.is_partnership_staff(), 'forbidden');
  perform private.require(p_status in ('accepted', 'returned'), 'invalid_input');
  perform private.require(p_status = 'accepted' or char_length(btrim(coalesce(p_comment, ''))) >= 5, 'comment_required');
  update public.partner_deliverables
     set status = p_status, review_comment = nullif(btrim(coalesce(p_comment, '')), ''), reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_id and status = 'submitted'
  returning organization_id into v_org;
  perform private.require(v_org is not null, 'invalid_transition');
end;
$$;

-- One conversation per organisation: the partner's members and the team.
create function public.post_partner_message(p_org uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_partner boolean := false;
begin
  perform private.require(char_length(btrim(coalesce(p_body, ''))) between 1 and 4000, 'invalid_input');
  if private.is_partnership_staff() then
    perform private.require(exists (select 1 from public.partner_organizations where id = p_org), 'not_found');
  else
    perform private.require(private.portal_organization() = p_org, 'forbidden');
    v_partner := true;
  end if;
  insert into public.partner_messages (organization_id, author_id, from_partner, body) values (p_org, auth.uid(), v_partner, btrim(p_body));
end;
$$;

-- The organisation of the signed-in partner, for the application shell.
create function public.my_partner_organization()
returns table (id uuid, name text)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.name from public.partner_organizations o where o.id = private.portal_organization();
$$;

-- ─── Grants ────────────────────────────────────────────────────────────────
revoke execute on function private.partner_portal_enabled(), private.portal_organization(uuid) from public, anon;
grant execute on function private.portal_organization(uuid) to authenticated;
revoke execute on function
  public.set_partner_portal(boolean), public.invite_partner_member(uuid, text, text), public.revoke_partner_member(uuid),
  public.portal_overview(), public.submit_partner_deliverable(uuid, jsonb, jsonb), public.review_partner_deliverable(uuid, text, text),
  public.post_partner_message(uuid, text), public.my_partner_organization()
from public, anon;
grant execute on function
  public.set_partner_portal(boolean), public.invite_partner_member(uuid, text, text), public.revoke_partner_member(uuid),
  public.portal_overview(), public.submit_partner_deliverable(uuid, jsonb, jsonb), public.review_partner_deliverable(uuid, text, text),
  public.post_partner_message(uuid, text), public.my_partner_organization()
to authenticated;

-- ─── Redefinitions (same functions as before, extended for partners) ──────
create or replace function public.accept_invitation(p_token_hash text, p_user uuid, p_consent boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv     public.invitations;
  v_email   text;
  v_member  public.institution_memberships;
  v_inst    uuid;
begin
  select * into v_inv from public.invitations where token_hash = p_token_hash for update;
  perform private.require(found, 'invitation_not_found');
  perform private.require(v_inv.revoked_at is null, 'invitation_revoked');
  perform private.require(v_inv.accepted_at is null, 'invitation_already_accepted');
  perform private.require(v_inv.expires_at > now(), 'invitation_expired');

  select email into v_email from public.profiles where id = p_user and status = 'active';
  perform private.require(found, 'account_unavailable');
  perform private.require(v_email = v_inv.email, 'invitation_email_mismatch');

  -- Partner portal (partnerships phase 6): access to one organisation.
  if v_inv.kind::text = 'partner_member' then
    perform private.require(private.partner_portal_enabled(), 'portal_disabled');
    insert into public.partner_portal_members (organization_id, user_id, granted_by)
    select v_inv.partner_organization_id, p_user, v_inv.invited_by
     where not exists (select 1 from public.partner_portal_members m
                        where m.organization_id = v_inv.partner_organization_id and m.user_id = p_user and m.revoked_at is null);
    update public.invitations set accepted_at = now(), accepted_by = p_user where id = v_inv.id;
    return jsonb_build_object('kind', v_inv.kind, 'organization_id', v_inv.partner_organization_id);
  end if;

  if v_inv.kind = 'platform_admin' then
    insert into public.platform_roles (user_id, role, granted_by)
    values (p_user, 'sanady_admin', v_inv.invited_by)
    on conflict (user_id) do nothing;

  elsif v_inv.kind = 'institution_admin' then
    select * into v_member from public.institution_memberships
     where institution_id = v_inv.institution_id and user_id = p_user;
    if found then
      update public.institution_memberships
         set role = 'admin', status = 'active', source = 'invitation',
             revoked_at = null, revoked_by = null
       where id = v_member.id;
    else
      insert into public.institution_memberships (institution_id, user_id, role, source)
      values (v_inv.institution_id, p_user, 'admin', 'invitation');
    end if;

  elsif v_inv.kind::text = 'institution_supervisor' then
    -- Read-only access to the institution; never downgrades an administrator.
    select * into v_member from public.institution_memberships
     where institution_id = v_inv.institution_id and user_id = p_user;
    if found and v_member.status = 'active' then
      raise exception using errcode = 'P0001', message = 'already_member';
    elsif found then
      update public.institution_memberships
         set role = 'supervisor', status = 'active', source = 'invitation', consented_at = null,
             revoked_at = null, revoked_by = null, created_at = now()
       where id = v_member.id;
    else
      insert into public.institution_memberships (institution_id, user_id, role, source)
      values (v_inv.institution_id, p_user, 'supervisor', 'invitation');
    end if;

  elsif v_inv.kind = 'institution_teacher' then
    perform private.require(p_consent is true, 'consent_required');
    if v_inv.enrollment_code_id is not null then
      v_inst := private.join_with_code(v_inv.enrollment_code_id, p_user);
    else
      select * into v_member from public.institution_memberships
       where institution_id = v_inv.institution_id and user_id = p_user;
      if found and v_member.status = 'active' then
        raise exception using errcode = 'P0001', message = 'already_member';
      elsif found then
        update public.institution_memberships
           set role = 'teacher', status = 'active', source = 'invitation', consented_at = now(),
               revoked_at = null, revoked_by = null, created_at = now()
         where id = v_member.id;
      else
        insert into public.institution_memberships (institution_id, user_id, role, source, consented_at)
        values (v_inv.institution_id, p_user, 'teacher', 'invitation', now());
      end if;
    end if;
  end if;
  -- kind = 'teacher': the personal account itself is the outcome.

  update public.invitations set accepted_at = now(), accepted_by = p_user where id = v_inv.id;

  return jsonb_build_object('kind', v_inv.kind, 'institution_id', v_inv.institution_id);
end;
$$;

create or replace function public.describe_invitation(p_token_hash text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
           'id', i.id,
           'kind', i.kind,
           'email', i.email,
           'institution_id', i.institution_id,
           'institution_name', coalesce(inst.name, po.name),
           'expires_at', i.expires_at,
           'state', case
                      when i.revoked_at is not null then 'revoked'
                      when i.accepted_at is not null then 'accepted'
                      when i.expires_at <= now() then 'expired'
                      else 'valid'
                    end,
           'account_exists', exists (select 1 from public.profiles p where p.email = i.email)
         )
    from public.invitations i
    left join public.institutions inst on inst.id = i.institution_id
    left join public.partner_organizations po on po.id = i.partner_organization_id
   where i.token_hash = p_token_hash;
$$;

create function private.report_payload(p_report uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r public.partnership_reports;
begin
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

create or replace function public.partner_report_data(p_report uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require(private.is_partnership_staff() or private.is_partnership_signatory(), 'forbidden');
  return private.report_payload(p_report);
end;
$$;

-- A partner member downloads the reports already shared with their organisation.
create function public.portal_report_data(p_report uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_org uuid := private.portal_organization();
begin
  perform private.require(v_org is not null, 'forbidden');
  perform private.require(
    exists (select 1 from public.partnership_reports where id = p_report and organization_id = v_org and status = 'shared'), 'not_found');
  return private.report_payload(p_report);
end;
$$;

create or replace function private.is_enterprise_only_user(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- Partner portal contacts with no school membership are not teachers either.
  select (exists (
           select 1 from public.partner_portal_members pm
            where pm.user_id = p_user and pm.revoked_at is null
         )
     and not exists (select 1 from public.institution_memberships m where m.user_id = p_user and m.status = 'active')
     and not exists (select 1 from public.platform_roles r where r.user_id = p_user))
  or (exists (
           select 1 from public.institution_memberships m join public.institutions i on i.id = m.institution_id
            where m.user_id = p_user and m.status = 'active' and i.kind = 'enterprise'
         )
     and not exists (
           select 1 from public.institution_memberships m join public.institutions i on i.id = m.institution_id
            where m.user_id = p_user and m.status = 'active' and i.kind = 'school'
         )
     and not exists (select 1 from public.platform_roles r where r.user_id = p_user));
$$;

revoke execute on function private.report_payload(uuid) from public, anon;
revoke execute on function public.portal_report_data(uuid) from public, anon;
grant execute on function public.portal_report_data(uuid) to authenticated;

-- ─── The team sees partner invitations and partner contacts' names ────────
create policy invitations_partner_select on public.invitations
  for select to authenticated
  using (partner_organization_id is not null and private.is_partnership_staff());

create or replace function private.can_view_profile(p_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_profile = auth.uid()
      or private.is_course_staff()
      or exists (
           select 1 from public.institution_memberships m
            where m.user_id = p_profile
              and m.status = 'active'
              and m.institution_id in (select private.supervised_institutions())
         )
      or exists (
           select 1
             from public.enrollments e
             join public.course_trainers ct on ct.course_id = e.course_id and ct.user_id = auth.uid()
            where e.user_id = p_profile
              and private.platform_role() = 'trainer'
         )
      or (
           (private.is_partnership_staff() or private.is_enterprise_staff())
           and exists (select 1 from public.platform_roles pr where pr.user_id = p_profile)
         )
      -- Partnership staff see the names of partner portal contacts.
      or (
           private.is_partnership_staff()
           and exists (select 1 from public.partner_portal_members m where m.user_id = p_profile)
         );
$$;
