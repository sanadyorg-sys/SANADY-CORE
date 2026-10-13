-- ════════════════════════════════════════════════════════════════════════════
-- SANADY Enterprise — phase E6: financial foundation and cross-module view
--   (brief V3 §17, §18, §25; PROPOSED activity — no billing, no payment)
--
-- The platform does not issue invoices nor collect payments: the team
-- RECORDS the invoices issued and the payments received elsewhere (the
-- Foundation's accounting), so that contracted, invoiced, received and
-- outstanding amounts stay separate. A payment is « confirmed » by an
-- approver once checked against the bank. Costs are recorded per category,
-- as actual or estimated. Margins and cost per learner are ESTIMATES and
-- labelled as such; amounts are never converted between currencies.
-- Commercial amounts are never mixed with partnership contributions
-- (brief §25: purchases are not donations).
-- ════════════════════════════════════════════════════════════════════════════

create type public.revenue_category as enum (
  'custom_training', 'platform_subscription', 'setup', 'support_maintenance', 'content_updates', 'other'
);
create type public.cost_category as enum (
  'cloud_infrastructure', 'video_hosting', 'file_storage', 'technical_maintenance', 'content_production',
  'trainer_compensation', 'customer_support', 'administrative'
);

create table public.enterprise_invoices (
  id                uuid primary key default gen_random_uuid(),
  contract_id       uuid not null references public.enterprise_contracts (id) on delete restrict,
  external_reference text not null check (char_length(btrim(external_reference)) between 1 and 80),
  category          public.revenue_category not null,
  description       text check (char_length(description) <= 500),
  amount            numeric(12, 2) not null check (amount > 0),
  currency          text not null check (currency in ('MAD', 'EUR', 'USD')),
  issued_on         date not null,
  due_on            date,
  cancelled_at      timestamptz,
  cancel_reason     text check (char_length(cancel_reason) <= 500),
  recorded_by       uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  unique (contract_id, external_reference),
  check (due_on is null or due_on >= issued_on)
);
create index enterprise_invoices_contract_idx on public.enterprise_invoices (contract_id);

create table public.enterprise_payments (
  id            uuid primary key default gen_random_uuid(),
  invoice_id    uuid not null references public.enterprise_invoices (id) on delete restrict,
  amount        numeric(12, 2) not null check (amount > 0),
  received_on   date not null,
  method        text not null check (method in ('transfer', 'cheque', 'cash', 'card', 'other')),
  bank_reference text check (char_length(bank_reference) <= 120),
  confirmed_by  uuid references public.profiles (id) on delete set null,
  confirmed_at  timestamptz,
  recorded_by   uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);
create index enterprise_payments_invoice_idx on public.enterprise_payments (invoice_id);

create table public.enterprise_costs (
  id            uuid primary key default gen_random_uuid(),
  contract_id   uuid references public.enterprise_contracts (id) on delete set null,
  category      public.cost_category not null,
  description   text not null check (char_length(btrim(description)) between 3 and 500),
  amount        numeric(12, 2) not null check (amount > 0),
  currency      text not null check (currency in ('MAD', 'EUR', 'USD')),
  incurred_on   date not null,
  is_estimate   boolean not null default false,
  recorded_by   uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);
create index enterprise_costs_contract_idx on public.enterprise_costs (contract_id);
create index enterprise_costs_date_idx on public.enterprise_costs (incurred_on);

-- ─── Row level security: finance is for the enterprise manager, admins and approvers ─
create function private.can_read_finance()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_enterprise_manager() or private.is_partnership_signatory();
$$;

alter table public.enterprise_invoices enable row level security;
alter table public.enterprise_payments enable row level security;
alter table public.enterprise_costs    enable row level security;
revoke all on public.enterprise_invoices, public.enterprise_payments, public.enterprise_costs from anon, authenticated;
create policy enterprise_invoices_select on public.enterprise_invoices for select to authenticated using (private.can_read_finance());
create policy enterprise_payments_select on public.enterprise_payments for select to authenticated using (private.can_read_finance());
create policy enterprise_costs_select    on public.enterprise_costs    for select to authenticated using (private.can_read_finance());
grant select on public.enterprise_invoices, public.enterprise_payments, public.enterprise_costs to authenticated;

-- ─── Records ───────────────────────────────────────────────────────────────
-- An invoice issued by the Foundation's accounting, for a signed contract,
-- in the contract's currency.
create function public.record_invoice(p_contract uuid, p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  c    public.enterprise_contracts;
  v_id uuid;
begin
  perform private.require(private.is_enterprise_manager(), 'forbidden');
  select * into c from public.enterprise_contracts where id = p_contract;
  perform private.require(c.id is not null, 'not_found');
  perform private.require(c.status in ('signed', 'active', 'renewal', 'closed'), 'contract_not_signed');
  perform private.require((p ->> 'issued_on')::date <= current_date, 'invalid_input');
  insert into public.enterprise_invoices (contract_id, external_reference, category, description, amount, currency, issued_on, due_on, recorded_by)
  values (c.id, btrim(p ->> 'external_reference'), (p ->> 'category')::public.revenue_category, nullif(btrim(coalesce(p ->> 'description', '')), ''),
          private.money(p ->> 'amount'), c.currency, (p ->> 'issued_on')::date, nullif(p ->> 'due_on', '')::date, auth.uid())
  returning id into v_id;
  perform private.contract_log(c.id, null, 'invoice_recorded', (p ->> 'external_reference'));
  perform private.log_audit('invoice_recorded', 'enterprise_invoices', v_id, null, jsonb_build_object('amount', p ->> 'amount', 'currency', c.currency));
  return v_id;
exception
  when unique_violation then
    raise exception using errcode = 'P0001', message = 'already_exists';
end;
$$;

-- Cancelled (credit note issued elsewhere), never deleted; not once paid.
create function public.cancel_invoice(p_invoice uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require(private.is_enterprise_manager(), 'forbidden');
  perform private.require(char_length(btrim(coalesce(p_reason, ''))) >= 5, 'comment_required');
  perform private.require(not exists (select 1 from public.enterprise_payments where invoice_id = p_invoice), 'invoice_paid');
  update public.enterprise_invoices set cancelled_at = now(), cancel_reason = btrim(p_reason) where id = p_invoice and cancelled_at is null;
  perform private.require(found, 'not_found');
  perform private.log_audit('invoice_cancelled', 'enterprise_invoices', p_invoice, null, '{}'::jsonb);
end;
$$;

-- A payment received, never more than what remains due on the invoice.
create function public.record_payment(p_invoice uuid, p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  i      public.enterprise_invoices;
  v_paid numeric;
  v_amt  numeric := private.money(p ->> 'amount');
  v_id   uuid;
begin
  perform private.require(private.is_enterprise_manager(), 'forbidden');
  select * into i from public.enterprise_invoices where id = p_invoice for update;
  perform private.require(i.id is not null and i.cancelled_at is null, 'not_found');
  select coalesce(sum(amount), 0) into v_paid from public.enterprise_payments where invoice_id = i.id;
  perform private.require(v_amt is not null and v_amt > 0 and v_paid + v_amt <= i.amount, 'payment_exceeds_invoice');
  perform private.require((p ->> 'received_on')::date <= current_date and (p ->> 'received_on')::date >= i.issued_on, 'invalid_input');
  insert into public.enterprise_payments (invoice_id, amount, received_on, method, bank_reference, recorded_by)
  values (i.id, v_amt, (p ->> 'received_on')::date, coalesce(nullif(p ->> 'method', ''), 'transfer'), nullif(btrim(coalesce(p ->> 'bank_reference', '')), ''), auth.uid())
  returning id into v_id;
  perform private.log_audit('payment_recorded', 'enterprise_payments', v_id, null, jsonb_build_object('amount', v_amt));
  return v_id;
end;
$$;

-- Checked against the bank by an approver (or a SANADY administrator).
create function public.confirm_payment(p_payment uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_by uuid;
begin
  perform private.require(private.is_partnership_signatory() or private.is_sanady_admin(), 'forbidden');
  select recorded_by into v_by from public.enterprise_payments where id = p_payment and confirmed_at is null;
  perform private.require(found, 'not_found');
  -- Four eyes: whoever recorded the payment does not confirm it.
  perform private.require(v_by is distinct from auth.uid(), 'forbidden');
  update public.enterprise_payments set confirmed_by = auth.uid(), confirmed_at = now() where id = p_payment;
  perform private.log_audit('payment_confirmed', 'enterprise_payments', p_payment, null, '{}'::jsonb);
end;
$$;

create function public.record_cost(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contract uuid := nullif(p ->> 'contract_id', '')::uuid;
  v_id       uuid;
begin
  perform private.require(private.is_enterprise_manager(), 'forbidden');
  perform private.require(v_contract is null or exists (select 1 from public.enterprise_contracts where id = v_contract), 'not_found');
  insert into public.enterprise_costs (contract_id, category, description, amount, currency, incurred_on, is_estimate, recorded_by)
  values (v_contract, (p ->> 'category')::public.cost_category, btrim(p ->> 'description'), private.money(p ->> 'amount'),
          coalesce(nullif(p ->> 'currency', ''), 'MAD'), (p ->> 'incurred_on')::date, coalesce((p ->> 'is_estimate')::boolean, false), auth.uid())
  returning id into v_id;
  perform private.log_audit('cost_recorded', 'enterprise_costs', v_id, null, jsonb_build_object('amount', p ->> 'amount'));
  return v_id;
end;
$$;

create function public.delete_cost(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require(private.is_enterprise_manager(), 'forbidden');
  delete from public.enterprise_costs where id = p_id;
  perform private.require(found, 'not_found');
  perform private.log_audit('cost_deleted', 'enterprise_costs', p_id, null, '{}'::jsonb);
end;
$$;

-- ─── Financial overview (brief §18), per currency, never converted ────────
create function public.enterprise_finance(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require(private.can_read_finance(), 'forbidden');
  perform private.require(p_from is not null and p_to is not null and p_from <= p_to and p_to - p_from <= 1100, 'invalid_input');
  return jsonb_build_object(
    'from', p_from, 'to', p_to,
    -- Contracted: lines of signed contracts starting in the period.
    'by_currency', coalesce((
      select jsonb_agg(row_to_json(x)::jsonb order by x.currency)
        from (
          select cur.currency,
                 (select coalesce(sum(l.quantity * l.unit_price), 0) from public.enterprise_contracts c join public.enterprise_contract_lines l on l.contract_id = c.id
                   where c.currency = cur.currency and c.status in ('signed', 'active', 'renewal', 'closed') and c.start_on between p_from and p_to) as contracted,
                 (select coalesce(sum(i.amount), 0) from public.enterprise_invoices i
                   where i.currency = cur.currency and i.cancelled_at is null and i.issued_on between p_from and p_to) as invoiced,
                 (select coalesce(sum(pm.amount), 0) from public.enterprise_payments pm join public.enterprise_invoices i on i.id = pm.invoice_id
                   where i.currency = cur.currency and pm.received_on between p_from and p_to) as received,
                 (select coalesce(sum(pm.amount), 0) from public.enterprise_payments pm join public.enterprise_invoices i on i.id = pm.invoice_id
                   where i.currency = cur.currency and pm.received_on between p_from and p_to and pm.confirmed_at is not null) as confirmed,
                 (select coalesce(sum(i.amount - coalesce((select sum(pm.amount) from public.enterprise_payments pm where pm.invoice_id = i.id), 0)), 0)
                    from public.enterprise_invoices i where i.currency = cur.currency and i.cancelled_at is null and i.issued_on <= p_to) as outstanding,
                 (select coalesce(sum(i.amount - coalesce((select sum(pm.amount) from public.enterprise_payments pm where pm.invoice_id = i.id), 0)), 0)
                    from public.enterprise_invoices i where i.currency = cur.currency and i.cancelled_at is null and i.due_on < current_date) as overdue,
                 (select coalesce(sum(co.amount), 0) from public.enterprise_costs co
                   where co.currency = cur.currency and not co.is_estimate and co.incurred_on between p_from and p_to) as costs_actual,
                 (select coalesce(sum(co.amount), 0) from public.enterprise_costs co
                   where co.currency = cur.currency and co.is_estimate and co.incurred_on between p_from and p_to) as costs_estimated
            from (select distinct currency from public.enterprise_contracts
                  union select distinct currency from public.enterprise_costs) cur
        ) x
    ), '[]'::jsonb),
    'revenue_by_category', coalesce((
      select jsonb_agg(jsonb_build_object('currency', currency, 'category', category, 'invoiced', s) order by currency, category)
        from (select currency, category::text, sum(amount) s from public.enterprise_invoices
               where cancelled_at is null and issued_on between p_from and p_to group by currency, category) t), '[]'::jsonb),
    'costs_by_category', coalesce((
      select jsonb_agg(jsonb_build_object('currency', currency, 'category', category, 'actual', a, 'estimated', e) order by currency, category)
        from (select currency, category::text, sum(amount) filter (where not is_estimate) a, sum(amount) filter (where is_estimate) e
                from public.enterprise_costs where incurred_on between p_from and p_to group by currency, category) t), '[]'::jsonb),
    -- Average active learners per month over the readings of the period (E5).
    'active_learner_months', (select coalesce(sum(active_learners), 0) from public.enterprise_usage_records where period between date_trunc('month', p_from)::date and p_to),
    'contracts', coalesce((
      select jsonb_agg(row_to_json(x)::jsonb order by x.reference)
        from (
          select c.id, c.reference, c.title, c.currency, c.status, o.name as organization,
                 (select coalesce(sum(l.quantity * l.unit_price), 0) from public.enterprise_contract_lines l where l.contract_id = c.id) as contracted,
                 (select coalesce(sum(i.amount), 0) from public.enterprise_invoices i where i.contract_id = c.id and i.cancelled_at is null) as invoiced,
                 (select coalesce(sum(pm.amount), 0) from public.enterprise_payments pm join public.enterprise_invoices i on i.id = pm.invoice_id where i.contract_id = c.id) as received,
                 (select coalesce(sum(co.amount), 0) from public.enterprise_costs co where co.contract_id = c.id and co.currency = c.currency) as direct_costs
            from public.enterprise_contracts c join public.partner_organizations o on o.id = c.organization_id
           where c.status in ('signed', 'active', 'renewal', 'closed')
        ) x
    ), '[]'::jsonb)
  );
end;
$$;

-- ─── One organisation, two relationships, never mixed (brief §25) ─────────
create function public.organization_relationships(p_org uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when not (private.is_partnership_staff() or private.is_enterprise_staff() or private.is_partnership_signatory()) then null else jsonb_build_object(
    'partnership', jsonb_build_object(
      'status', (select status from public.partner_organizations where id = p_org),
      'agreements', (select count(*) from public.partnership_agreements where organization_id = p_org and status in ('signed', 'active', 'completed')),
      'contributions_received', coalesce((select jsonb_agg(jsonb_build_object('currency', currency, 'amount', s)) from (
          select currency, sum(amount_received) s from public.partnership_contributions
           where organization_id = p_org and kind = 'financial' and stage in ('delivered', 'verified') group by currency) t), '[]'::jsonb),
      'in_kind', (select count(*) from public.partnership_contributions where organization_id = p_org and kind <> 'financial' and stage in ('delivered', 'verified')),
      'verified_metrics', (select count(*) from public.partnership_impact_metrics where organization_id = p_org and status = 'verified')
    ),
    'enterprise', jsonb_build_object(
      'status', (select enterprise_status from public.partner_organizations where id = p_org),
      'contracts', (select count(*) from public.enterprise_contracts where organization_id = p_org and status in ('signed', 'active', 'renewal', 'closed')),
      'workspaces', (select count(*) from public.enterprise_tenants where organization_id = p_org and status in ('active', 'suspended', 'offboarding')),
      'projects', (select count(*) from public.training_projects where organization_id = p_org and status <> 'cancelled'),
      -- Commercial amounts only for those who read finance.
      'invoiced', case when private.can_read_finance() then coalesce((select jsonb_agg(jsonb_build_object('currency', currency, 'amount', s)) from (
          select i.currency, sum(i.amount) s from public.enterprise_invoices i join public.enterprise_contracts c on c.id = i.contract_id
           where c.organization_id = p_org and i.cancelled_at is null group by i.currency) t), '[]'::jsonb) end
    )
  ) end;
$$;

-- ─── Grants ────────────────────────────────────────────────────────────────
revoke execute on function private.can_read_finance() from public, anon;
grant execute on function private.can_read_finance() to authenticated;
revoke execute on function
  public.record_invoice(uuid, jsonb), public.cancel_invoice(uuid, text), public.record_payment(uuid, jsonb), public.confirm_payment(uuid),
  public.record_cost(jsonb), public.delete_cost(uuid), public.enterprise_finance(date, date), public.organization_relationships(uuid)
from public, anon;
grant execute on function
  public.record_invoice(uuid, jsonb), public.cancel_invoice(uuid, text), public.record_payment(uuid, jsonb), public.confirm_payment(uuid),
  public.record_cost(jsonb), public.delete_cost(uuid), public.enterprise_finance(date, date), public.organization_relationships(uuid)
to authenticated;
