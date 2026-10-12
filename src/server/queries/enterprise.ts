import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { EnterpriseService, EnterpriseStage, LineCategory, ProposalStatus, RequestStatus } from "@/lib/enterprise";
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
  const supabase = await createClient();
  const cutoff = new Date(Date.now() - 730 * 24 * 3600 * 1000).toISOString();
  const { data } = await supabase.from("enterprise_requests").select("id").in("status", ["declined", "withdrawn", "spam"]).lt("updated_at", cutoff).limit(50);
  const ids = ((data ?? []) as Array<{ id: string }>).map((r) => r.id);
  if (!ids.length) return 0;
  const admin = createAdminClient();
  const { data: docs } = await admin.from("enterprise_documents").select("storage_path").in("request_id", ids);
  const paths = ((docs ?? []) as Array<{ storage_path: string }>).map((d) => d.storage_path);
  if (paths.length) await admin.storage.from("enterprise").remove(paths);
  const { data: n } = await admin.rpc("purge_enterprise_requests", { p_ids: ids });
  return (n as number) ?? 0;
}
