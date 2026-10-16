import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { EnterpriseService, EnterpriseStage, LineCategory, ProposalStatus, RequestStatus, TenantChecklist, TenantStatus } from "@/lib/enterprise";
import type { OrgType, PipelineStatus } from "@/lib/partnerships";
import type { Viewer } from "@/server/auth";
import type { Contact, HistoryEntry, Note, Task } from "@/server/queries/partnerships";

/** Reads go through RLS: only enterprise staff (2FA) see these rows. */

type Person = { full_name: string | null; email: string } | null;

export interface RequestRow {
  id: string;
  reference: string;
  org_name: string;
  org_type: OrgType;
  country: string;
  employee_count: string;
  service: EnterpriseService;
  topic: string;
  learner_count: number | null;
  status: RequestStatus;
  created_at: string;
  organization_id: string | null;
}

export async function listRequests(filter: { status?: RequestStatus | "open"; service?: string }) {
  const supabase = await createClient();
  let q = supabase
    .from("enterprise_requests")
    .select("id, reference, org_name, org_type, country, employee_count, service, topic, learner_count, status, created_at, organization_id")
    .order("created_at", { ascending: false })
    .limit(200);
  if (filter.status === "open") q = q.in("status", ["received", "qualified"]);
  else if (filter.status) q = q.eq("status", filter.status);
  if (filter.service) q = q.eq("service", filter.service);
  const { data } = await q;
  return (data ?? []) as RequestRow[];
}

export async function requestCounts() {
  const supabase = await createClient();
  const { data } = await supabase.from("enterprise_requests").select("status");
  const counts: Record<string, number> = {};
  for (const r of (data ?? []) as Array<{ status: string }>) counts[r.status] = (counts[r.status] ?? 0) + 1;
  return counts;
}

export interface RequestDetail extends RequestRow {
  city: string | null;
  website: string | null;
  sector: string | null;
  contact_name: string;
  contact_title: string;
  contact_email: string;
  contact_phone: string | null;
  target_population: string;
  outcomes: string;
  existing_content: string;
  language: string;
  timeline: string | null;
  reporting: string | null;
  accessibility: string | null;
  extra: string | null;
  consent_at: string;
}

const NOTE_SELECT = "id, body, created_at, author:profiles!enterprise_notes_author_id_fkey(full_name, email)";
const HISTORY_SELECT = "id, from_status, to_status, note, created_at, by:profiles!enterprise_history_changed_by_fkey(full_name, email)";

export async function getRequest(id: string) {
  const supabase = await createClient();
  const [{ data: req }, { data: docs }, { data: notes }, { data: history }] = await Promise.all([
    supabase.from("enterprise_requests").select("*").eq("id", id).maybeSingle(),
    supabase.from("enterprise_documents").select("id, file_name, file_size").eq("request_id", id).order("created_at"),
    supabase.from("enterprise_notes").select(NOTE_SELECT).eq("request_id", id).order("created_at", { ascending: false }),
    supabase.from("enterprise_history").select(HISTORY_SELECT).eq("request_id", id).order("created_at", { ascending: false }),
  ]);
  if (!req) return null;
  return {
    request: req as RequestDetail,
    documents: (docs ?? []) as Array<{ id: string; file_name: string; file_size: number }>,
    notes: (notes ?? []) as unknown as Note[],
    history: (history ?? []) as unknown as HistoryEntry[],
  };
}

/** Existing organisations a request may be linked to (no duplicate record): names only. */
export async function linkableOrganizations(name: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("find_organizations_for_enterprise", { p_query: name });
  if (error) return [];
  return (data ?? []) as Array<{ id: string; name: string; is_partner: boolean }>;
}

export interface ClientRow {
  id: string;
  name: string;
  org_type: OrgType;
  country: string | null;
  employee_count: string | null;
  enterprise_status: EnterpriseStage;
  enterprise_services: EnterpriseService[];
  status: PipelineStatus | null;
  updated_at: string;
  manager: Person;
}

export async function listClients(filter: { stage?: string }) {
  const supabase = await createClient();
  let q = supabase
    .from("partner_organizations")
    .select("id, name, org_type, country, employee_count, enterprise_status, enterprise_services, status, updated_at, manager:profiles!partner_organizations_enterprise_manager_id_fkey(full_name, email)")
    .not("enterprise_status", "is", null)
    .order("updated_at", { ascending: false })
    .limit(500);
  if (filter.stage) q = q.eq("enterprise_status", filter.stage);
  const { data } = await q;
  return (data ?? []) as unknown as ClientRow[];
}

export interface ProposalRow {
  id: string;
  reference: string;
  title: string;
  service: EnterpriseService;
  status: ProposalStatus;
  currency: string;
  valid_until: string | null;
  plan_id?: string | null;
  updated_at: string;
  organization: { id: string; name: string } | null;
  lines: Array<{ quantity: string; unit_price: string }>;
}

export async function listProposals(filter: { status?: string; organization?: string }) {
  const supabase = await createClient();
  let q = supabase
    .from("enterprise_proposals")
    .select("id, reference, title, service, status, currency, valid_until, updated_at, organization:partner_organizations(id, name), lines:enterprise_proposal_lines(quantity, unit_price)")
    .order("updated_at", { ascending: false })
    .limit(300);
  if (filter.status) q = q.eq("status", filter.status);
  if (filter.organization) q = q.eq("organization_id", filter.organization);
  const { data } = await q;
  return (data ?? []) as unknown as ProposalRow[];
}

export async function getClient(id: string) {
  const supabase = await createClient();
  const [{ data: org }, { data: contacts }, { data: notes }, { data: history }, { data: tasks }, { data: requests }, proposals] = await Promise.all([
    supabase
      .from("partner_organizations")
      .select("*, manager:profiles!partner_organizations_enterprise_manager_id_fkey(full_name, email)")
      .eq("id", id)
      .not("enterprise_status", "is", null)
      .maybeSingle(),
    supabase.from("partner_contacts").select("id, full_name, job_title, email, phone, is_primary").eq("organization_id", id).order("is_primary", { ascending: false }),
    supabase.from("enterprise_notes").select(NOTE_SELECT).eq("organization_id", id).order("created_at", { ascending: false }),
    supabase.from("enterprise_history").select(HISTORY_SELECT).eq("organization_id", id).order("created_at", { ascending: false }),
    supabase
      .from("enterprise_tasks")
      .select("id, title, due_on, done_at, organization_id, assignee:profiles!enterprise_tasks_assigned_to_fkey(id, full_name, email)")
      .eq("organization_id", id)
      .order("done_at", { ascending: true, nullsFirst: true })
      .order("due_on", { ascending: true, nullsFirst: false }),
    supabase.from("enterprise_requests").select("id, reference, service, status, created_at").eq("organization_id", id).order("created_at"),
    listProposals({ organization: id }),
  ]);
  if (!org) return null;
  return {
    client: org as unknown as ClientRow & {
      city: string | null;
      website: string | null;
      sector: string | null;
      description: string | null;
      enterprise_manager_id: string | null;
      created_at: string;
    },
    contacts: (contacts ?? []) as Contact[],
    notes: (notes ?? []) as unknown as Note[],
    history: (history ?? []) as unknown as HistoryEntry[],
    tasks: (tasks ?? []) as unknown as Task[],
    requests: (requests ?? []) as Array<{ id: string; reference: string; service: EnterpriseService; status: RequestStatus; created_at: string }>,
    proposals,
  };
}

export async function getProposal(id: string) {
  const supabase = await createClient();
  const [{ data: p }, { data: lines }, { data: notes }, { data: history }] = await Promise.all([
    supabase
      .from("enterprise_proposals")
      .select("*, organization:partner_organizations(id, name), approver:profiles!enterprise_proposals_approved_by_fkey(full_name, email), request:enterprise_requests(id, reference)")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("enterprise_proposal_lines").select("id, category, label, quantity, unit, unit_price").eq("proposal_id", id).order("position"),
    supabase.from("enterprise_notes").select(NOTE_SELECT).eq("proposal_id", id).order("created_at", { ascending: false }),
    supabase.from("enterprise_history").select(HISTORY_SELECT).eq("proposal_id", id).order("created_at", { ascending: false }),
  ]);
  if (!p) return null;
  return {
    proposal: p as unknown as {
      id: string;
      reference: string;
      title: string;
      service: EnterpriseService;
      summary: string | null;
      currency: string;
      valid_until: string | null;
      plan_id: string | null;
      status: ProposalStatus;
      approved_at: string | null;
      sent_at: string | null;
      decided_at: string | null;
      created_at: string;
      organization: { id: string; name: string } | null;
      approver: Person;
      request: { id: string; reference: string } | null;
    },
    lines: (lines ?? []) as Array<{ id: string; category: LineCategory; label: string; quantity: string; unit: string | null; unit_price: string }>,
    notes: (notes ?? []) as unknown as Note[],
    history: (history ?? []) as unknown as HistoryEntry[],
  };
}

/** Open enterprise follow-ups (inbox side panel). */
export async function openEnterpriseTasks(limit = 8) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("enterprise_tasks")
    .select("id, title, due_on, done_at, organization_id, assignee:profiles!enterprise_tasks_assigned_to_fkey(id, full_name, email), organization:partner_organizations(name)")
    .is("done_at", null)
    .order("due_on", { ascending: true, nullsFirst: false })
    .limit(limit);
  return (data ?? []) as unknown as Array<Task & { organization: { name: string } | null }>;
}

/** People enterprise tasks can be assigned to. */
export async function enterpriseTeam() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("platform_roles")
    .select("role, user:profiles!platform_roles_user_id_fkey(id, full_name, email, status)")
    .in("role", ["sanady_admin", "enterprise_manager", "production_manager"]);
  return ((data ?? []) as unknown as Array<{ role: string; user: { id: string; full_name: string | null; email: string; status: string } }>)
    .filter((r) => r.user?.status === "active")
    .map((r) => ({ ...r.user, role: r.role }));
}

/** What the current person may do (the database re-checks every action). */
export async function enterpriseActor(viewer: Viewer) {
  const supabase = await createClient();
  const { data } = await supabase.from("partnership_signatories").select("id").eq("user_id", viewer.id).is("revoked_at", null).maybeSingle();
  return { manager: viewer.isSanadyAdmin || viewer.platformRole === "enterprise_manager", signatory: Boolean(data) };
}

/** Retention: closed requests without follow-up, 24 months after closure (files first). */
export async function purgeExpiredRequests() {
  // Server-side job: also runs without a signed-in person (daily schedule).
  const cutoff = new Date(Date.now() - 730 * 24 * 3600 * 1000).toISOString();
  const { data } = await createAdminClient().from("enterprise_requests").select("id").in("status", ["declined", "withdrawn", "spam"]).lt("updated_at", cutoff).limit(50);
  const ids = ((data ?? []) as Array<{ id: string }>).map((r) => r.id);
  if (!ids.length) return 0;
  const admin = createAdminClient();
  const { data: docs } = await admin.from("enterprise_documents").select("storage_path").in("request_id", ids);
  const paths = ((docs ?? []) as Array<{ storage_path: string }>).map((d) => d.storage_path);
  if (paths.length) await admin.storage.from("enterprise").remove(paths);
  const { data: n } = await admin.rpc("purge_enterprise_requests", { p_ids: ids });
  return (n as number) ?? 0;
}

/* ─── Phase E3: company learning spaces ────────────────────────────────── */

export interface TenantRow {
  id: string;
  organization_id: string;
  institution_id: string | null;
  slug: string;
  display_name: string;
  service_plan: Exclude<EnterpriseService, "partenariat">;
  max_learners: number;
  status: TenantStatus;
  contract_start_on: string | null;
  contract_end_on: string | null;
  updated_at: string;
  organization: { name: string } | null;
}

const TENANT_ROW = "id, organization_id, institution_id, slug, display_name, service_plan, max_learners, status, contract_start_on, contract_end_on, updated_at, organization:partner_organizations(name)";

export async function listTenants(filter: { status?: string } = {}) {
  const supabase = await createClient();
  let q = supabase.from("enterprise_tenants").select(TENANT_ROW).order("updated_at", { ascending: false }).limit(200);
  if (filter.status) q = q.eq("status", filter.status);
  const { data } = await q;
  return (data ?? []) as unknown as TenantRow[];
}

export interface TenantDetail extends TenantRow {
  proposal_id: string | null;
  storage_allowance_gb: string | null;
  video_minutes_allowance: number | null;
  support_level: string | null;
  support_email: string | null;
  primary_contact_id: string | null;
  certificate_kind: "attestation" | "certificat";
  logo_path: string | null;
  logo_updated_at: string | null;
  authorized_at: string | null;
  security_checked_at: string | null;
  activated_at: string | null;
  offboarding_started_at: string | null;
  termination_note: string | null;
  export_authorized_at: string | null;
  deletion_due_on: string | null;
  closed_at: string | null;
  data_deleted_at: string | null;
  created_at: string;
  authorizer: Person;
  checker: Person;
  exporter: Person;
}

export interface TenantUsage {
  employees: number;
  invited: number;
  admins: number;
  admin_invitations: Array<{ id: string; email: string; sent: boolean; accepted: boolean; expires_at: string }>;
  courses: number;
  private_courses: number;
  active_30d: number;
  completions: number;
  certificates: number;
}

export async function getTenant(id: string) {
  const supabase = await createClient();
  const { data: t } = await supabase
    .from("enterprise_tenants")
    .select(
      `*, organization:partner_organizations(name), authorizer:profiles!enterprise_tenants_authorized_by_fkey(full_name, email),
       checker:profiles!enterprise_tenants_security_checked_by_fkey(full_name, email), exporter:profiles!enterprise_tenants_export_authorized_by_fkey(full_name, email)`,
    )
    .eq("id", id)
    .maybeSingle();
  if (!t) return null;
  const tenant = t as unknown as TenantDetail;
  const [{ data: checklist }, { data: usage }, { data: history }, { data: contacts }, { data: proposals }] = await Promise.all([
    supabase.rpc("tenant_checklist", { p_tenant: id }),
    supabase.rpc("tenant_usage", { p_tenant: id }),
    supabase.from("enterprise_history").select(HISTORY_SELECT).eq("tenant_id", id).order("created_at", { ascending: false }),
    supabase.from("partner_contacts").select("id, full_name, email").eq("organization_id", tenant.organization_id).order("full_name"),
    supabase.from("enterprise_proposals").select("id, reference, title").eq("organization_id", tenant.organization_id).eq("status", "accepted"),
  ]);
  return {
    tenant,
    checklist: (checklist ?? {}) as TenantChecklist,
    usage: (usage ?? null) as TenantUsage | null,
    history: (history ?? []) as unknown as HistoryEntry[],
    contacts: (contacts ?? []) as Array<{ id: string; full_name: string; email: string | null }>,
    proposals: (proposals ?? []) as Array<{ id: string; reference: string; title: string }>,
  };
}

/** The open workspace of a client, if any (client page). */
export async function tenantForOrganization(organizationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("enterprise_tenants")
    .select(TENANT_ROW)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data ?? null) as unknown as TenantRow | null;
}

/** Accepted proposals and contacts of a client (new workspace form). */
export async function tenantFormOptions(organizationId: string) {
  const supabase = await createClient();
  const [{ data: contacts }, { data: proposals }] = await Promise.all([
    supabase.from("partner_contacts").select("id, full_name, email").eq("organization_id", organizationId).order("full_name"),
    supabase.from("enterprise_proposals").select("id, reference, title").eq("organization_id", organizationId).eq("status", "accepted"),
  ]);
  return {
    contacts: (contacts ?? []) as Array<{ id: string; full_name: string; email: string | null }>,
    proposals: (proposals ?? []) as Array<{ id: string; reference: string; title: string }>,
  };
}

/* ─── Phase E5: contracts and usage ────────────────────────────────────── */

export interface ContractRow {
  id: string;
  reference: string;
  title: string;
  status: import("@/lib/enterprise").ContractStatus;
  service: EnterpriseService;
  pricing_model: import("@/lib/enterprise").PricingModel;
  currency: string;
  start_on: string | null;
  end_on: string | null;
  renewal_notice_days: number;
  updated_at: string;
  organization: { id: string; name: string } | null;
}
const CONTRACT_ROW = "id, reference, title, status, service, pricing_model, currency, start_on, end_on, renewal_notice_days, updated_at, organization:partner_organizations(id, name)";

export async function listContracts(filter: { status?: string; organization?: string } = {}) {
  const supabase = await createClient();
  let q = supabase.from("enterprise_contracts").select(CONTRACT_ROW).order("updated_at", { ascending: false }).limit(200);
  if (filter.status) q = q.eq("status", filter.status);
  if (filter.organization) q = q.eq("organization_id", filter.organization);
  const { data } = await q;
  return (data ?? []) as unknown as ContractRow[];
}

export interface ContractDetail extends ContractRow {
  organization_id: string;
  proposal_id: string | null;
  tenant_id: string | null;
  renewal_terms: string | null;
  learner_limit: number | null;
  storage_limit_gb: string | null;
  video_minutes_limit: number | null;
  support_commitments: string | null;
  data_ownership: string | null;
  content_ownership: string | null;
  termination_provisions: string | null;
  approved_at: string | null;
  signed_on: string | null;
  created_at: string;
  approver: Person;
  recorder: Person;
  proposal: { id: string; reference: string } | null;
  tenant: { id: string; display_name: string } | null;
}

export async function getContract(id: string) {
  const supabase = await createClient();
  const { data: c } = await supabase
    .from("enterprise_contracts")
    .select(
      `*, organization:partner_organizations(id, name), proposal:enterprise_proposals(id, reference), tenant:enterprise_tenants(id, display_name),
       approver:profiles!enterprise_contracts_approved_by_fkey(full_name, email), recorder:profiles!enterprise_contracts_signed_recorded_by_fkey(full_name, email)`,
    )
    .eq("id", id)
    .maybeSingle();
  if (!c) return null;
  const contract = c as unknown as ContractDetail;
  const [{ data: lines }, { data: docs }, { data: history }, { data: tenants }] = await Promise.all([
    supabase.from("enterprise_contract_lines").select("id, category, label, quantity, unit, unit_price").eq("contract_id", id).order("position"),
    supabase.from("enterprise_documents").select("id, kind, file_name, file_size, created_at").eq("contract_id", id).order("created_at"),
    supabase.from("enterprise_history").select(HISTORY_SELECT).eq("contract_id", id).order("created_at", { ascending: false }),
    supabase.from("enterprise_tenants").select("id, display_name").eq("organization_id", contract.organization_id).not("status", "in", "(closed,cancelled)"),
  ]);
  return {
    contract,
    lines: (lines ?? []) as Array<{ id: string; category: LineCategory; label: string; quantity: string; unit: string | null; unit_price: string }>,
    documents: (docs ?? []) as Array<{ id: string; kind: string; file_name: string; file_size: number; created_at: string }>,
    history: (history ?? []) as unknown as HistoryEntry[],
    tenants: (tenants ?? []) as Array<{ id: string; display_name: string }>,
  };
}

export async function contractForProposal(proposalId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("enterprise_contracts").select("id, reference, status").eq("proposal_id", proposalId).maybeSingle();
  return (data ?? null) as { id: string; reference: string; status: string } | null;
}

export interface UsageRecord {
  id: string;
  period: string;
  active_learners: number;
  enrolled_learners: number;
  completions: number;
  storage_mb: string;
  learner_limit: number | null;
  storage_limit_gb: string | null;
  overage: boolean;
  review_note: string | null;
  reviewed_at: string | null;
}

export async function tenantUsageRecords(tenantId: string) {
  const supabase = await createClient();
  const [{ data: records }, { data: now }, { data: contracts }] = await Promise.all([
    supabase.from("enterprise_usage_records").select("*").eq("tenant_id", tenantId).order("period", { ascending: false }).limit(24),
    supabase.rpc("tenant_usage_now", { p_tenant: tenantId }),
    supabase.from("enterprise_contracts").select("id, reference, status, pricing_model, learner_limit, storage_limit_gb").eq("tenant_id", tenantId).in("status", ["signed", "active", "renewal"]),
  ]);
  return {
    records: (records ?? []) as UsageRecord[],
    now: (now ?? null) as { active_learners: number; enrolled_learners: number; completions: number; storage_mb: number } | null,
    contracts: (contracts ?? []) as Array<{ id: string; reference: string; status: string; pricing_model: string; learner_limit: number | null; storage_limit_gb: string | null }>,
  };
}

export async function enterpriseWatchlist() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("enterprise_watchlist");
  return (data ?? null) as {
    renewals: Array<{ id: string; reference: string; title: string; organization: string; end_on: string }>;
    overages: Array<{ id: string; tenant_id: string; tenant: string; period: string }>;
    approvals: number;
    support_waiting: number;
    support_urgent: number;
    deletions: Array<{ tenant_id: string; tenant: string; due_on: string; status: "proposed" | "confirmed" | null; execute_after: string | null; on_hold: boolean }>;
  } | null;
}

export interface AssessmentPolicy {
  id: string;
  tenant_id: string;
  contract_id: string | null;
  pass_threshold: number;
  max_attempts: number;
  feedback: "after_pass" | "after_each_attempt" | "never";
  certificates: boolean;
  enforce_due_dates: boolean;
  note: string | null;
  status: "draft" | "approved";
  approved_at: string | null;
  updated_at: string;
  approver: Person;
}

/** The company space's assessment policy (team, approvers, the company's administrators). */
export async function assessmentPolicy(tenantId: string) {
  const { data } = await (await createClient())
    .from("enterprise_assessment_policies")
    .select("*, approver:profiles!enterprise_assessment_policies_approved_by_fkey(full_name, email)")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return (data ?? null) as AssessmentPolicy | null;
}

/** The approved assessment policy of the company space behind an institution (its administrators read it). */
export async function workspaceAssessmentPolicy(institutionId: string) {
  const supabase = await createClient();
  const { data: t } = await supabase.from("enterprise_tenants").select("id").eq("institution_id", institutionId).maybeSingle();
  if (!t) return null;
  const policy = await assessmentPolicy((t as { id: string }).id);
  return policy?.status === "approved" ? policy : null;
}

export interface DataDeletion {
  id: string;
  tenant_id: string;
  status: "proposed" | "confirmed" | "cancelled" | "executed";
  reason: string;
  proposed_at: string;
  notice_sent_on: string | null;
  notice_recipient: string | null;
  data_delivered_on: string | null;
  delivery_method: string | null;
  hold_reason: string | null;
  held_at: string | null;
  confirmed_at: string | null;
  confirm_reason: string | null;
  execute_after: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  executed_at: string | null;
  certificate: {
    organisation: string; space: string; executed_at: string; proposed_at: string; proposed_by: string | null; confirmed_at: string; confirmed_by: string | null;
    notice_sent_on: string; data_delivered_on: string; delivery_method: string;
    deleted: { accounts: number; memberships: number; courses: number; files: number; support_requests: number };
    kept: string;
  } | null;
  proposed_by: string | null;
  proposer: Person;
  confirmer: Person;
}

/** The deletion in progress for a company space (or the last one), and what still blocks it. */
export async function tenantDeletion(tenantId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("data_deletions")
    .select("*, proposer:profiles!data_deletions_proposed_by_fkey(full_name, email), confirmer:profiles!data_deletions_confirmed_by_fkey(full_name, email)")
    .eq("tenant_id", tenantId)
    .order("proposed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const deletion = (data ?? null) as DataDeletion | null;
  if (!deletion) return { deletion: null, blockers: [] as string[] };
  const { data: blockers } = deletion.status === "proposed" ? await supabase.rpc("deletion_blockers", { p_deletion: deletion.id }) : { data: [] };
  return { deletion, blockers: ((blockers ?? []) as string[]) };
}
