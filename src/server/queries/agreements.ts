import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AgreementStatus, ContributionKind, ContributionStage, DocumentKind, InterventionField } from "@/lib/partnerships";
import type { HistoryEntry } from "@/server/queries/partnerships";

/** Partnership phase 4. Reads go through RLS: partnership staff and approvers (2FA). */

type Person = { full_name: string | null; email: string } | null;
const HISTORY = "id, from_status, to_status, note, created_at, by:profiles!partnership_status_history_changed_by_fkey(full_name, email)";
const DOCS = "id, kind, file_name, file_size, created_at";

export interface AgreementRow {
  id: string;
  reference: string;
  title: string;
  status: AgreementStatus;
  intervention_field: InterventionField;
  start_on: string | null;
  end_on: string | null;
  renewal_notice_days: number;
  updated_at: string;
  organization: { id: string; name: string } | null;
}
const AGREEMENT_ROW = "id, reference, title, status, intervention_field, start_on, end_on, renewal_notice_days, updated_at, organization:partner_organizations(id, name)";

export async function listAgreements(filter: { status?: string; organization?: string } = {}) {
  const supabase = await createClient();
  let q = supabase.from("partnership_agreements").select(AGREEMENT_ROW).order("updated_at", { ascending: false }).limit(300);
  if (filter.status) q = q.eq("status", filter.status);
  if (filter.organization) q = q.eq("organization_id", filter.organization);
  const { data } = await q;
  return (data ?? []) as unknown as AgreementRow[];
}

export interface AgreementDetail extends AgreementRow {
  organization_id: string;
  opportunity_id: string | null;
  objectives: string;
  responsibilities: string | null;
  contributions_summary: string | null;
  renewal_terms: string | null;
  approved_at: string | null;
  signed_on: string | null;
  created_at: string;
  approver: Person;
  recorder: Person;
  opportunity: { id: string; reference: string; title: string } | null;
}
export interface DocumentRow {
  id: string;
  kind: DocumentKind;
  file_name: string;
  file_size: number;
  created_at: string;
}

export async function getAgreement(id: string) {
  const supabase = await createClient();
  const { data: a } = await supabase
    .from("partnership_agreements")
    .select(
      `*, organization:partner_organizations(id, name), opportunity:partnership_opportunities(id, reference, title),
       approver:profiles!partnership_agreements_approved_by_fkey(full_name, email), recorder:profiles!partnership_agreements_signed_recorded_by_fkey(full_name, email)`,
    )
    .eq("id", id)
    .maybeSingle();
  if (!a) return null;
  const [{ data: docs }, { data: milestones }, { data: history }, contributions] = await Promise.all([
    supabase.from("partnership_documents").select(DOCS).eq("agreement_id", id).order("created_at"),
    supabase.from("partnership_milestones").select("id, title, due_on, done_at, note").eq("agreement_id", id).order("due_on"),
    supabase.from("partnership_status_history").select(HISTORY).eq("agreement_id", id).order("created_at", { ascending: false }),
    listContributions({ agreement: id }),
  ]);
  return {
    agreement: a as unknown as AgreementDetail,
    documents: (docs ?? []) as DocumentRow[],
    milestones: (milestones ?? []) as Array<{ id: string; title: string; due_on: string; done_at: string | null; note: string | null }>,
    history: (history ?? []) as unknown as HistoryEntry[],
    contributions,
  };
}

export interface ContributionRow {
  id: string;
  kind: ContributionKind;
  description: string;
  stage: ContributionStage;
  currency: string;
  amount_pledged: string | null;
  amount_received: string | null;
  item: string | null;
  quantity: number | null;
  estimated_value: string | null;
  expertise_category: string | null;
  hours_pledged: string | null;
  hours_delivered: string | null;
  expected_on: string | null;
  updated_at: string;
  organization: { id: string; name: string } | null;
  agreement: { id: string; reference: string } | null;
}
const CONTRIBUTION_ROW =
  "id, kind, description, stage, currency, amount_pledged, amount_received, item, quantity, estimated_value, expertise_category, hours_pledged, hours_delivered, expected_on, updated_at, organization:partner_organizations(id, name), agreement:partnership_agreements(id, reference)";

export async function listContributions(filter: { stage?: string; organization?: string; agreement?: string; kind?: string } = {}) {
  const supabase = await createClient();
  let q = supabase.from("partnership_contributions").select(CONTRIBUTION_ROW).order("updated_at", { ascending: false }).limit(300);
  if (filter.stage) q = q.eq("stage", filter.stage);
  if (filter.organization) q = q.eq("organization_id", filter.organization);
  if (filter.agreement) q = q.eq("agreement_id", filter.agreement);
  if (filter.kind) q = q.eq("kind", filter.kind);
  const { data } = await q;
  return (data ?? []) as unknown as ContributionRow[];
}

export interface ContributionDetail extends ContributionRow {
  organization_id: string;
  agreement_id: string | null;
  opportunity_id: string | null;
  restricted_purpose: string | null;
  recipient: string | null;
  supported_activities: string | null;
  received_on: string | null;
  verified_at: string | null;
  created_at: string;
  verifier: Person;
}

export async function getContribution(id: string) {
  const supabase = await createClient();
  const { data: c } = await supabase
    .from("partnership_contributions")
    .select(`*, organization:partner_organizations(id, name), agreement:partnership_agreements(id, reference), verifier:profiles!partnership_contributions_verified_by_fkey(full_name, email)`)
    .eq("id", id)
    .maybeSingle();
  if (!c) return null;
  const [{ data: docs }, { data: history }] = await Promise.all([
    supabase.from("partnership_documents").select(DOCS).eq("contribution_id", id).order("created_at"),
    supabase.from("partnership_status_history").select(HISTORY).eq("contribution_id", id).order("created_at", { ascending: false }),
  ]);
  return {
    contribution: c as unknown as ContributionDetail,
    documents: (docs ?? []) as DocumentRow[],
    history: (history ?? []) as unknown as HistoryEntry[],
  };
}

export interface ContributionTotal {
  kind: ContributionKind;
  currency: string;
  stage: ContributionStage;
  n: number;
  pledged: string | null;
  received: string | null;
  hours_pledged: string | null;
  hours_delivered: string | null;
  estimated_value: string | null;
}

export async function contributionTotals(organizationId?: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("contribution_totals", { p_org: organizationId ?? null });
  return (data ?? []) as ContributionTotal[];
}

export interface Watchlist {
  renewals: Array<{ id: string; reference: string; title: string; organization: string; end_on: string }>;
  milestones: Array<{ id: string; agreement_id: string; reference: string; title: string; due_on: string }>;
  contributions: Array<{ id: string; organization: string; description: string; stage: ContributionStage; expected_on: string }>;
  approvals: number;
}

export async function partnershipWatchlist() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("partnership_watchlist");
  return (data ?? null) as Watchlist | null;
}

/** Agreements and opportunities a contribution or agreement can be tied to. */
export async function linkOptions(organizationId: string) {
  const supabase = await createClient();
  const [{ data: agreements }, { data: opportunities }] = await Promise.all([
    supabase.from("partnership_agreements").select("id, reference, title").eq("organization_id", organizationId).neq("status", "archived"),
    supabase.from("partnership_opportunities").select("id, reference, title").in("status", ["approved", "published", "closed"]).order("reference"),
  ]);
  return {
    agreements: ((agreements ?? []) as Array<{ id: string; reference: string; title: string }>).map((a) => ({ id: a.id, label: `${a.reference} — ${a.title}` })),
    opportunities: ((opportunities ?? []) as Array<{ id: string; reference: string; title: string }>).map((o) => ({ id: o.id, label: `${o.reference} — ${o.title}` })),
  };
}
