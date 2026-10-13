import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Attribution, ContributionKind, ContributionStage, InterventionField, MetricStatus, MetricType, ReportStatus } from "@/lib/partnerships";

/** Partnership phase 5. Reads go through RLS: partnership staff and approvers (2FA). */

type Person = { full_name: string | null; email: string } | null;

export interface MetricRow {
  id: string;
  organization_id: string;
  agreement_id: string | null;
  opportunity_id: string | null;
  intervention_field: InterventionField;
  dimension: string;
  label: string | null;
  metric_type: MetricType;
  value: string;
  unit: string | null;
  period_start: string;
  period_end: string;
  method: string;
  attribution: Attribution;
  status: MetricStatus;
  review_comment: string | null;
  verified_at: string | null;
  updated_at: string;
  organization: { id: string; name: string } | null;
  agreement: { id: string; reference: string } | null;
  verifier: Person;
}
const METRIC_ROW =
  "*, organization:partner_organizations(id, name), agreement:partnership_agreements(id, reference), verifier:profiles!partnership_impact_metrics_verified_by_fkey(full_name, email)";

export async function listMetrics(filter: { status?: string; organization?: string } = {}) {
  const supabase = await createClient();
  let q = supabase.from("partnership_impact_metrics").select(METRIC_ROW).order("updated_at", { ascending: false }).limit(300);
  if (filter.status) q = q.eq("status", filter.status);
  if (filter.organization) q = q.eq("organization_id", filter.organization);
  const { data } = await q;
  return (data ?? []) as unknown as MetricRow[];
}

export interface ReportRow {
  id: string;
  reference: string;
  title: string;
  status: ReportStatus;
  period_start: string;
  period_end: string;
  updated_at: string;
  organization: { id: string; name: string } | null;
}

export async function listReports(filter: { organization?: string } = {}) {
  const supabase = await createClient();
  let q = supabase
    .from("partnership_reports")
    .select("id, reference, title, status, period_start, period_end, updated_at, organization:partner_organizations(id, name)")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (filter.organization) q = q.eq("organization_id", filter.organization);
  const { data } = await q;
  return (data ?? []) as unknown as ReportRow[];
}

export interface ReportDetail extends ReportRow {
  organization_id: string;
  agreement_id: string | null;
  activities: string | null;
  challenges: string | null;
  future_opportunities: string | null;
  approved_at: string | null;
  shared_at: string | null;
  created_at: string;
  approver: Person;
}

export async function getReport(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("partnership_reports")
    .select("*, organization:partner_organizations(id, name), approver:profiles!partnership_reports_approved_by_fkey(full_name, email)")
    .eq("id", id)
    .maybeSingle();
  return (data ?? null) as unknown as ReportDetail | null;
}

/** Verified content of a report (aggregates only; see public.partner_report_data). */
export interface PartnerReportData {
  report: { reference: string; title: string; period_start: string; period_end: string; activities: string | null; challenges: string | null; future_opportunities: string | null; status: ReportStatus; approved_at: string | null };
  approver: string | null;
  organization: { name: string; type: string; city: string | null; country: string | null };
  agreements: Array<{ reference: string; title: string; objectives: string; field: string; start_on: string | null; end_on: string | null; status: string }>;
  projects: Array<{ reference: string; title: string }>;
  contributions: Array<{
    kind: ContributionKind;
    description: string;
    stage: ContributionStage;
    currency: string;
    amount_pledged: string | null;
    amount_received: string | null;
    item: string | null;
    quantity: number | null;
    hours_pledged: string | null;
    hours_delivered: string | null;
    received_on: string | null;
  }>;
  milestones: Array<{ title: string; due_on: string; done_at: string }>;
  metrics: Array<{ field: string; dimension: string; label: string | null; type: MetricType; value: string; unit: string | null; period_start: string; period_end: string; method: string; attribution: Attribution }>;
}

export async function partnerReportData(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("partner_report_data", { p_report: id });
  if (error) return null;
  return data as PartnerReportData;
}

export interface Dashboard {
  prospects: number;
  new_applications: number;
  applications_open: number;
  active_partnerships: number;
  agreements_signed: number;
  renewals: number;
  follow_ups: number;
  projects_published: number;
  projects_closed: number;
  in_kind: number;
  metrics_pending: number;
  received: Array<{ currency: string; received: string; verified: string | null }>;
  pipeline: Record<string, number>;
  by_field: Array<{ field: string; slug: string; agreements: number; projects: number }>;
  verified_metrics: Array<{ field: string; dimension: string; label: string | null; type: MetricType; value: string; unit: string | null }>;
}

export async function partnershipDashboard() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("partnership_dashboard");
  return (data ?? null) as Dashboard | null;
}
