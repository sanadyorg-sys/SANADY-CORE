import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CostCategory, RevenueCategory } from "@/lib/enterprise";

/**
 * SANADY Enterprise, phase E6. Reads go through RLS: the enterprise
 * manager, SANADY administrators and approvers. Amounts are recorded, never
 * produced by the platform, and never converted between currencies.
 */

type Person = { full_name: string | null; email: string } | null;

export interface InvoiceRow {
  id: string;
  external_reference: string;
  category: RevenueCategory;
  description: string | null;
  amount: string;
  currency: string;
  issued_on: string;
  due_on: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  payments: Array<{ id: string; amount: string; received_on: string; method: string; bank_reference: string | null; confirmed_at: string | null; recorded_by: string | null; confirmer: Person }>;
}

export async function contractInvoices(contractId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("enterprise_invoices")
    .select("*, payments:enterprise_payments(id, amount, received_on, method, bank_reference, confirmed_at, recorded_by, confirmer:profiles!enterprise_payments_confirmed_by_fkey(full_name, email))")
    .eq("contract_id", contractId)
    .order("issued_on", { ascending: false });
  return (data ?? []) as unknown as InvoiceRow[];
}

export interface FinanceOverview {
  from: string;
  to: string;
  by_currency: Array<{ currency: string; contracted: string; invoiced: string; received: string; confirmed: string; outstanding: string; overdue: string; costs_actual: string; costs_estimated: string }>;
  revenue_by_category: Array<{ currency: string; category: RevenueCategory; invoiced: string }>;
  costs_by_category: Array<{ currency: string; category: CostCategory; actual: string | null; estimated: string | null }>;
  active_learner_months: number;
  contracts: Array<{ id: string; reference: string; title: string; currency: string; status: string; organization: string; contracted: string; invoiced: string; received: string; direct_costs: string }>;
}

export async function enterpriseFinance(from: string, to: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("enterprise_finance", { p_from: from, p_to: to });
  if (error) return null;
  return data as FinanceOverview;
}

export async function listCosts(from: string, to: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("enterprise_costs")
    .select("id, category, description, amount, currency, incurred_on, is_estimate, contract:enterprise_contracts(id, reference)")
    .gte("incurred_on", from)
    .lte("incurred_on", to)
    .order("incurred_on", { ascending: false })
    .limit(200);
  return (data ?? []) as unknown as Array<{ id: string; category: CostCategory; description: string; amount: string; currency: string; incurred_on: string; is_estimate: boolean; contract: { id: string; reference: string } | null }>;
}

/** Payments recorded but not yet checked against the bank (four eyes). */
export async function unconfirmedPayments() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("enterprise_payments")
    .select("id, amount, received_on, method, bank_reference, recorded_by, invoice:enterprise_invoices(external_reference, currency, contract:enterprise_contracts(id, reference))")
    .is("confirmed_at", null)
    .order("received_on");
  return (data ?? []) as unknown as Array<{
    id: string;
    amount: string;
    received_on: string;
    method: string;
    bank_reference: string | null;
    recorded_by: string | null;
    invoice: { external_reference: string; currency: string; contract: { id: string; reference: string } | null } | null;
  }>;
}

export interface Relationships {
  partnership: { status: string | null; agreements: number; contributions_received: Array<{ currency: string; amount: string }>; in_kind: number; verified_metrics: number };
  enterprise: { status: string | null; contracts: number; workspaces: number; projects: number; invoiced: Array<{ currency: string; amount: string }> | null };
}

export async function organizationRelationships(organizationId: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("organization_relationships", { p_org: organizationId });
  return (data ?? null) as Relationships | null;
}

export async function contractOptions() {
  const supabase = await createClient();
  const { data } = await supabase.from("enterprise_contracts").select("id, reference, title, currency").in("status", ["signed", "active", "renewal", "closed"]).order("reference");
  return (data ?? []) as Array<{ id: string; reference: string; title: string; currency: string }>;
}
