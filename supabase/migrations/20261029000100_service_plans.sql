-- ════════════════════════════════════════════════════════════════════════════
-- SANADY Enterprise — reusable service plans (brief V3: « Service plans »,
-- « Support levels », contract-specific limits)
--
-- A plan is a standard package the team prepares once: its lines (with
-- prices typed by the team — none is set by the platform), its pricing
-- model, limits (employees, storage, video) and support terms. Because it
-- carries prices, a plan is used only once an approver has activated it;
-- editing an active plan sends it back to draft for a new approval.
-- Applying a plan to a draft proposal copies its lines (they can then be
-- adjusted); the proposal is still approved as before. A contract prepared
-- from that proposal takes the plan's pricing model, limits and support
-- terms, which stay editable in the draft contract.
-- ════════════════════════════════════════════════════════════════════════════

create table public.enterprise_service_plans (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null unique check (char_length(btrim(name)) between 3 and 120),
  service              public.enterprise_service not null check (service <> 'partenariat'),
  description          text check (char_length(description) <= 2000),
  currency             text not null default 'MAD' check (currency in ('MAD', 'EUR', 'USD')),
  pricing_model        text not null check (pricing_model in ('annual_subscription', 'monthly_subscription', 'per_active_learner',
                                                              'per_enrolled_learner', 'fixed_fee', 'mixed')),
  learner_limit        integer check (learner_limit > 0),
  storage_limit_gb     numeric(8, 2) check (storage_limit_gb > 0),
  video_minutes_limit  integer check (video_minutes_limit > 0),
  support_level        text check (char_length(support_level) <= 200),
  support_commitments  text check (char_length(support_commitments) <= 2000),
  status               text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  approved_by          uuid references public.profiles (id) on delete set null,
  approved_at          timestamptz,
  created_by           uuid references public.profiles (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table public.enterprise_plan_lines (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references public.enterprise_service_plans (id) on delete cascade,
  category    public.proposal_line_category not null,
  label       text not null check (char_length(btrim(label)) between 2 and 200),
  quantity    numeric(12, 2) not null default 1 check (quantity > 0),
  unit        text check (char_length(unit) <= 40),
  unit_price  numeric(12, 2) not null check (unit_price >= 0),
  position    integer not null default 0
);
create index enterprise_plan_lines_idx on public.enterprise_plan_lines (plan_id, position);

alter table public.enterprise_proposals add column plan_id uuid references public.enterprise_service_plans (id) on delete set null;

alter table public.enterprise_service_plans enable row level security;
alter table public.enterprise_plan_lines enable row level security;
revoke all on public.enterprise_service_plans, public.enterprise_plan_lines from anon, authenticated;
create policy enterprise_service_plans_select on public.enterprise_service_plans for select to authenticated
  using (private.is_enterprise_staff() or private.is_partnership_signatory());
create policy enterprise_plan_lines_select on public.enterprise_plan_lines for select to authenticated
  using (private.is_enterprise_staff() or private.is_partnership_signatory());
grant select on public.enterprise_service_plans, public.enterprise_plan_lines to authenticated;

create function public.save_service_plan(p_id uuid, p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := p_id;
  v_st text;
begin
  perform private.require(private.is_enterprise_manager(), 'forbidden');
  if v_id is null then
    insert into public.enterprise_service_plans (name, service, description, currency, pricing_model, learner_limit, storage_limit_gb,
                                                 video_minutes_limit, support_level, support_commitments, created_by)
    values (btrim(p ->> 'name'), (p ->> 'service')::public.enterprise_service, nullif(btrim(coalesce(p ->> 'description', '')), ''),
            coalesce(nullif(p ->> 'currency', ''), 'MAD'), p ->> 'pricing_model', nullif(p ->> 'learner_limit', '')::integer,
            nullif(p ->> 'storage_limit_gb', '')::numeric, nullif(p ->> 'video_minutes_limit', '')::integer,
            nullif(btrim(coalesce(p ->> 'support_level', '')), ''), nullif(btrim(coalesce(p ->> 'support_commitments', '')), ''), auth.uid())
    returning id into v_id;
  else
    select status into v_st from public.enterprise_service_plans where id = v_id for update;
    perform private.require(v_st is not null, 'not_found');
    perform private.require(v_st <> 'archived', 'plan_archived');
    -- A change to an active plan needs a new approval.
    update public.enterprise_service_plans
       set name = btrim(p ->> 'name'), service = (p ->> 'service')::public.enterprise_service,
           description = nullif(btrim(coalesce(p ->> 'description', '')), ''),
           currency = case when exists (select 1 from public.enterprise_plan_lines where plan_id = v_id) then currency
                           else coalesce(nullif(p ->> 'currency', ''), 'MAD') end,
           pricing_model = p ->> 'pricing_model', learner_limit = nullif(p ->> 'learner_limit', '')::integer,
           storage_limit_gb = nullif(p ->> 'storage_limit_gb', '')::numeric, video_minutes_limit = nullif(p ->> 'video_minutes_limit', '')::integer,
           support_level = nullif(btrim(coalesce(p ->> 'support_level', '')), ''),
           support_commitments = nullif(btrim(coalesce(p ->> 'support_commitments', '')), ''),
           status = 'draft', approved_by = null, approved_at = null, updated_at = now()
     where id = v_id;
  end if;
  return v_id;
end;
$$;

create function public.save_plan_line(p_plan uuid, p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.require(private.is_enterprise_manager(), 'forbidden');
  perform private.require(exists (select 1 from public.enterprise_service_plans where id = p_plan and status = 'draft'), 'plan_locked');
  insert into public.enterprise_plan_lines (plan_id, category, label, quantity, unit, unit_price, position)
  values (p_plan, (p ->> 'category')::public.proposal_line_category, btrim(p ->> 'label'),
          coalesce(nullif(p ->> 'quantity', '')::numeric, 1), nullif(btrim(coalesce(p ->> 'unit', '')), ''), (p ->> 'unit_price')::numeric,
          coalesce((select max(position) + 1 from public.enterprise_plan_lines where plan_id = p_plan), 0))
  returning id into v_id;
  update public.enterprise_service_plans set updated_at = now() where id = p_plan;
  return v_id;
end;
$$;

create function public.delete_plan_line(p_line uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan uuid;
begin
  perform private.require(private.is_enterprise_manager(), 'forbidden');
  select plan_id into v_plan from public.enterprise_plan_lines where id = p_line;
  perform private.require(v_plan is not null, 'not_found');
  perform private.require(exists (select 1 from public.enterprise_service_plans where id = v_plan and status = 'draft'), 'plan_locked');
  delete from public.enterprise_plan_lines where id = p_line;
end;
$$;

-- draft → active (approver, 2FA, at least one line) · active → draft (manager,
-- to change it) · draft | active → archived (manager) · archived → draft (manager)
create function public.set_plan_status(p_plan uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_st text;
begin
  select status into v_st from public.enterprise_service_plans where id = p_plan for update;
  perform private.require(v_st is not null, 'not_found');
  if p_status = 'active' then
    perform private.require(private.is_partnership_signatory(), 'forbidden');
    perform private.require(v_st = 'draft', 'invalid_transition');
    perform private.require(exists (select 1 from public.enterprise_plan_lines where plan_id = p_plan), 'plan_lines_required');
    update public.enterprise_service_plans set status = 'active', approved_by = auth.uid(), approved_at = now(), updated_at = now() where id = p_plan;
  else
    perform private.require(private.is_enterprise_manager(), 'forbidden');
    perform private.require((p_status = 'draft' and v_st in ('active', 'archived')) or (p_status = 'archived' and v_st in ('draft', 'active')), 'invalid_transition');
    update public.enterprise_service_plans
       set status = p_status, approved_by = null, approved_at = null, updated_at = now() where id = p_plan;
  end if;
  perform private.log_audit('service_plan_status', 'enterprise_service_plans', p_plan, null, jsonb_build_object('from', v_st, 'to', p_status));
end;
$$;

-- Copies an active plan's lines into a draft proposal (added after existing lines).
create function public.apply_plan_to_proposal(p_proposal uuid, p_plan uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  pr public.enterprise_proposals;
  pl public.enterprise_service_plans;
  v_start integer;
  v_n integer;
begin
  perform private.require(private.is_enterprise_manager(), 'forbidden');
  select * into pr from public.enterprise_proposals where id = p_proposal for update;
  perform private.require(pr.id is not null, 'not_found');
  perform private.require(pr.status = 'draft', 'invalid_transition');
  select * into pl from public.enterprise_service_plans where id = p_plan;
  perform private.require(pl.id is not null and pl.status = 'active', 'plan_inactive');
  -- Amounts are never converted: a plan in another currency only fits an empty proposal.
  perform private.require(pl.currency = pr.currency or not exists (select 1 from public.enterprise_proposal_lines where proposal_id = p_proposal), 'currency_mismatch');
  v_start := coalesce((select max(position) + 1 from public.enterprise_proposal_lines where proposal_id = p_proposal), 0);
  insert into public.enterprise_proposal_lines (proposal_id, category, label, quantity, unit, unit_price, position)
  select p_proposal, l.category, l.label, l.quantity, l.unit, l.unit_price, v_start + l.position
    from public.enterprise_plan_lines l where l.plan_id = p_plan;
  get diagnostics v_n = row_count;
  update public.enterprise_proposals set plan_id = p_plan, service = pl.service, currency = pl.currency, updated_at = now() where id = p_proposal;
  perform private.log_audit('plan_applied', 'enterprise_proposals', p_proposal, null, jsonb_build_object('plan', pl.name, 'lines', v_n));
  return v_n;
end;
$$;

-- The contract takes the plan's pricing model, limits and support terms.
create or replace function public.create_contract_from_proposal(p_proposal uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  pr   public.enterprise_proposals;
  pl   public.enterprise_service_plans;
  v_id uuid;
begin
  perform private.require(private.is_enterprise_manager(), 'forbidden');
  select * into pr from public.enterprise_proposals where id = p_proposal;
  perform private.require(pr.id is not null, 'not_found');
  perform private.require(pr.status = 'accepted', 'proposal_not_accepted');
  perform private.require(pr.service <> 'partenariat', 'invalid_input');
  perform private.require(not exists (select 1 from public.enterprise_contracts where proposal_id = pr.id), 'already_exists');
  select * into pl from public.enterprise_service_plans where id = pr.plan_id;
  insert into public.enterprise_contracts (reference, organization_id, proposal_id, title, service, pricing_model, currency,
                                           learner_limit, storage_limit_gb, video_minutes_limit, support_commitments, created_by)
  values ('CTR-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.contract_reference_seq')::text, 4, '0'),
          pr.organization_id, pr.id, pr.title, pr.service, coalesce(pl.pricing_model, 'fixed_fee'), pr.currency,
          pl.learner_limit, pl.storage_limit_gb, pl.video_minutes_limit,
          nullif(concat_ws(E'\n', pl.support_level, pl.support_commitments), ''), auth.uid())
  returning id into v_id;
  insert into public.enterprise_contract_lines (contract_id, category, label, quantity, unit, unit_price, position)
  select v_id, l.category, l.label, l.quantity, l.unit, l.unit_price, l.position
    from public.enterprise_proposal_lines l where l.proposal_id = pr.id;
  perform private.contract_log(v_id, null, 'draft', pr.reference);
  perform private.log_audit('contract_created', 'enterprise_contracts', v_id, null, jsonb_build_object('proposal', pr.reference, 'plan', pl.name));
  return v_id;
end;
$$;

revoke execute on function
  public.save_service_plan(uuid, jsonb), public.save_plan_line(uuid, jsonb), public.delete_plan_line(uuid),
  public.set_plan_status(uuid, text), public.apply_plan_to_proposal(uuid, uuid)
from public, anon;
grant execute on function
  public.save_service_plan(uuid, jsonb), public.save_plan_line(uuid, jsonb), public.delete_plan_line(uuid),
  public.set_plan_status(uuid, text), public.apply_plan_to_proposal(uuid, uuid)
to authenticated;
