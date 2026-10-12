import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  ApplicationStatus,
  ContributionType,
  InterventionField,
  NeedPriority,
  NeedStatus,
  OpportunityStatus,
  OrgType,
  PipelineStatus,
  PublicOpportunity,
} from "@/lib/partnerships";
import type { Viewer } from "@/server/auth";

/** Reads go through RLS: only partnership staff (2FA) see these rows. */

export interface ApplicationRow {
  id: string;
  reference: string;
  org_name: string;
  org_type: OrgType;
  country: string;
  contact_name: string;
  intervention_field: InterventionField;
  contribution_type: ContributionType;
  status: ApplicationStatus;
  created_at: string;
  organization_id: string | null;
}

export async function listApplications(filter: { status?: ApplicationStatus | "open"; field?: string; q?: string }) {
  const supabase = await createClient();
  let query = supabase
    .from("partnership_applications")
    .select("id, reference, org_name, org_type, country, contact_name, intervention_field, contribution_type, status, created_at, organization_id")
    .order("created_at", { ascending: false })
    .limit(200);
  if (filter.status === "open") query = query.in("status", ["received", "under_review"]);
  else if (filter.status) query = query.eq("status", filter.status);
  if (filter.field) query = query.eq("intervention_field", filter.field);
  if (filter.q) {
    const q = filter.q.replace(/[%_,()]/g, " ").trim();
    if (q) query = query.or(`org_name.ilike.%${q}%,reference.ilike.%${q}%,contact_name.ilike.%${q}%`);
  }
  const { data } = await query;
  return (data ?? []) as ApplicationRow[];
}

export async function applicationCounts() {
  const supabase = await createClient();
  const { data } = await supabase.from("partnership_applications").select("status");
  const counts: Record<string, number> = {};
  for (const r of (data ?? []) as Array<{ status: string }>) counts[r.status] = (counts[r.status] ?? 0) + 1;
  return counts;
}

export interface ApplicationDetail extends ApplicationRow {
  opportunity: { id: string; reference: string; title: string } | null;
  city: string | null;
  website: string | null;
  sector: string | null;
  org_description: string;
  contact_title: string;
  contact_email: string;
  contact_phone: string | null;
  contribution: string;
  cooperation: string;
  timeline: string | null;
  extra: string | null;
  consent_at: string;
  updated_at: string;
}

export async function getApplication(id: string) {
  const supabase = await createClient();
  const [{ data: app }, { data: docs }, { data: notes }, { data: history }] = await Promise.all([
    supabase.from("partnership_applications").select("*, opportunity:partnership_opportunities(id, reference, title)").eq("id", id).maybeSingle(),
    supabase.from("partnership_documents").select("id, file_name, file_size, created_at").eq("application_id", id).order("created_at"),
    supabase
      .from("partnership_notes")
      .select("id, body, created_at, author:profiles!partnership_notes_author_id_fkey(full_name, email)")
      .eq("application_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("partnership_status_history")
      .select("id, from_status, to_status, note, created_at, by:profiles!partnership_status_history_changed_by_fkey(full_name, email)")
      .eq("application_id", id)
      .order("created_at", { ascending: false }),
  ]);
  if (!app) return null;
  return {
    application: app as ApplicationDetail,
    documents: (docs ?? []) as Array<{ id: string; file_name: string; file_size: number; created_at: string }>,
    notes: (notes ?? []) as unknown as Note[],
    history: (history ?? []) as unknown as HistoryEntry[],
  };
}

export interface Note {
  id: string;
  body: string;
  created_at: string;
  author: { full_name: string | null; email: string } | null;
}
export interface HistoryEntry {
  id: string;
  from_status: string | null;
  to_status: string;
  note: string | null;
  created_at: string;
  by: { full_name: string | null; email: string } | null;
}

export interface OrganizationRow {
  id: string;
  name: string;
  org_type: OrgType;
  country: string | null;
  city: string | null;
  fields: InterventionField[];
  contributions: ContributionType[];
  status: PipelineStatus;
  updated_at: string;
  assignee: { full_name: string | null; email: string } | null;
}

export async function listOrganizations(filter: { status?: string; field?: string; q?: string }) {
  const supabase = await createClient();
  let query = supabase
    .from("partner_organizations")
    .select("id, name, org_type, country, city, fields, contributions, status, updated_at, assignee:profiles!partner_organizations_assigned_to_fkey(full_name, email)")
    .order("updated_at", { ascending: false })
    .limit(500);
  if (filter.status) query = query.eq("status", filter.status);
  if (filter.field) query = query.contains("fields", [filter.field]);
  if (filter.q) {
    const q = filter.q.replace(/[%_,()]/g, " ").trim();
    if (q) query = query.ilike("name", `%${q}%`);
  }
  const { data } = await query;
  return (data ?? []) as unknown as OrganizationRow[];
}

export interface OrganizationDetail extends OrganizationRow {
  website: string | null;
  sector: string | null;
  description: string | null;
  created_at: string;
}
export interface Contact {
  id: string;
  full_name: string;
  job_title: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
}
export interface Task {
  id: string;
  title: string;
  due_on: string | null;
  done_at: string | null;
  organization_id: string;
  assignee: { id: string; full_name: string | null; email: string } | null;
}

export async function getOrganization(id: string) {
  const supabase = await createClient();
  const [{ data: org }, { data: contacts }, { data: notes }, { data: history }, { data: tasks }, { data: applications }] = await Promise.all([
    supabase
      .from("partner_organizations")
      .select("*, assignee:profiles!partner_organizations_assigned_to_fkey(full_name, email)")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("partner_contacts").select("id, full_name, job_title, email, phone, is_primary").eq("organization_id", id).order("is_primary", { ascending: false }).order("full_name"),
    supabase
      .from("partnership_notes")
      .select("id, body, created_at, author:profiles!partnership_notes_author_id_fkey(full_name, email)")
      .eq("organization_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("partnership_status_history")
      .select("id, from_status, to_status, note, created_at, by:profiles!partnership_status_history_changed_by_fkey(full_name, email)")
      .eq("organization_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("partnership_tasks")
      .select("id, title, due_on, done_at, organization_id, assignee:profiles!partnership_tasks_assigned_to_fkey(id, full_name, email)")
      .eq("organization_id", id)
      .order("done_at", { ascending: true, nullsFirst: true })
      .order("due_on", { ascending: true, nullsFirst: false }),
    supabase.from("partnership_applications").select("id, reference, created_at, status").eq("organization_id", id).order("created_at"),
  ]);
  if (!org) return null;
  return {
    organization: org as unknown as OrganizationDetail,
    contacts: (contacts ?? []) as Contact[],
    notes: (notes ?? []) as unknown as Note[],
    history: (history ?? []) as unknown as HistoryEntry[],
    tasks: (tasks ?? []) as unknown as Task[],
    applications: (applications ?? []) as Array<{ id: string; reference: string; created_at: string; status: ApplicationStatus }>,
  };
}

/** Open follow-up tasks across organisations (inbox side panel). */
export async function openTasks(limit = 8) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("partnership_tasks")
    .select("id, title, due_on, done_at, organization_id, assignee:profiles!partnership_tasks_assigned_to_fkey(id, full_name, email), organization:partner_organizations(name)")
    .is("done_at", null)
    .order("due_on", { ascending: true, nullsFirst: false })
    .limit(limit);
  return (data ?? []) as unknown as Array<Task & { organization: { name: string } | null }>;
}

/** People a task can be assigned to: SANADY admins and partnership staff. */
export async function partnershipTeam() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("platform_roles")
    .select("role, user:profiles!platform_roles_user_id_fkey(id, full_name, email, status)")
    .in("role", ["sanady_admin", "partnership_coordinator", "partnership_manager"]);
  return ((data ?? []) as unknown as Array<{ role: string; user: { id: string; full_name: string | null; email: string; status: string } }>)
    .filter((r) => r.user?.status === "active")
    .map((r) => ({ ...r.user, role: r.role }));
}

/** What the current person may do in the pipeline (the database re-checks). */
export async function pipelineActor(viewer: Viewer) {
  const supabase = await createClient();
  const { data } = await supabase.from("partnership_signatories").select("id").eq("user_id", viewer.id).is("revoked_at", null).maybeSingle();
  return {
    staff: viewer.isSanadyAdmin || viewer.platformRole === "partnership_coordinator" || viewer.platformRole === "partnership_manager",
    manager: viewer.platformRole === "partnership_manager",
    signatory: Boolean(data),
  };
}

export async function listSignatories() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("partnership_signatories")
    .select("granted_at, user:profiles!partnership_signatories_user_id_fkey(id, full_name, email), granter:profiles!partnership_signatories_granted_by_fkey(full_name, email)")
    .is("revoked_at", null)
    .order("granted_at");
  return (data ?? []) as unknown as Array<{
    granted_at: string;
    user: { id: string; full_name: string | null; email: string };
    granter: { full_name: string | null; email: string } | null;
  }>;
}

/**
 * Retention: applications closed without a partnership for 24 months are
 * deleted with their files. Runs when the team opens the inbox.
 */
export async function purgeExpiredApplications() {
  const supabase = await createClient();
  const cutoff = new Date(Date.now() - 730 * 24 * 3600 * 1000).toISOString();
  const { data } = await supabase
    .from("partnership_applications")
    .select("id")
    .in("status", ["declined", "withdrawn", "spam"])
    .lt("updated_at", cutoff)
    .limit(50);
  const ids = ((data ?? []) as Array<{ id: string }>).map((r) => r.id);
  if (!ids.length) return 0;
  const admin = createAdminClient();
  const { data: docs } = await admin.from("partnership_documents").select("storage_path").in("application_id", ids);
  const paths = ((docs ?? []) as Array<{ storage_path: string }>).map((d) => d.storage_path);
  if (paths.length) await admin.storage.from("partnerships").remove(paths);
  const { data: n } = await admin.rpc("purge_partnership_applications", { p_ids: ids });
  return (n as number) ?? 0;
}

/* ─── Phase 3: needs and projects ──────────────────────────────────────── */

export interface NeedRow {
  id: string;
  reference: string;
  title: string;
  intervention_field: InterventionField;
  priority: NeedPriority;
  status: NeedStatus;
  estimated_cost: string | null;
  currency: string;
  updated_at: string;
  institution: { name: string } | null;
  responsible: { full_name: string | null; email: string } | null;
}

export async function listNeeds(filter: { status?: string; field?: string }) {
  const supabase = await createClient();
  let query = supabase
    .from("educational_needs")
    .select(
      "id, reference, title, intervention_field, priority, status, estimated_cost, currency, updated_at, institution:institutions(name), responsible:profiles!educational_needs_responsible_id_fkey(full_name, email)",
    )
    .order("updated_at", { ascending: false })
    .limit(300);
  if (filter.status) query = query.eq("status", filter.status);
  if (filter.field) query = query.eq("intervention_field", filter.field);
  const { data } = await query;
  return (data ?? []) as unknown as NeedRow[];
}

export interface NeedDetail extends NeedRow {
  institution_id: string | null;
  project_label: string | null;
  description: string;
  justification: string;
  required_resources: string | null;
  timeline: string | null;
  responsible_id: string | null;
  decided_at: string | null;
  created_at: string;
  decider: { full_name: string | null; email: string } | null;
}

export async function getNeed(id: string) {
  const supabase = await createClient();
  const [{ data: need }, { data: notes }, { data: history }, { data: opportunities }] = await Promise.all([
    supabase
      .from("educational_needs")
      .select(
        "*, institution:institutions(name), responsible:profiles!educational_needs_responsible_id_fkey(full_name, email), decider:profiles!educational_needs_decided_by_fkey(full_name, email)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("partnership_notes").select("id, body, created_at, author:profiles!partnership_notes_author_id_fkey(full_name, email)").eq("need_id", id).order("created_at", { ascending: false }),
    supabase
      .from("partnership_status_history")
      .select("id, from_status, to_status, note, created_at, by:profiles!partnership_status_history_changed_by_fkey(full_name, email)")
      .eq("need_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("partnership_opportunities").select("id, reference, title, status").eq("need_id", id).order("created_at"),
  ]);
  if (!need) return null;
  return {
    need: need as unknown as NeedDetail,
    notes: (notes ?? []) as unknown as Note[],
    history: (history ?? []) as unknown as HistoryEntry[],
    opportunities: (opportunities ?? []) as Array<{ id: string; reference: string; title: string; status: OpportunityStatus }>,
  };
}

export interface OpportunityRow {
  id: string;
  reference: string;
  title: string;
  intervention_field: InterventionField;
  status: OpportunityStatus;
  deadline: string | null;
  published_at: string | null;
  updated_at: string;
  contribution_types: ContributionType[];
}

export async function listOpportunities(filter: { status?: string; field?: string }) {
  const supabase = await createClient();
  let query = supabase
    .from("partnership_opportunities")
    .select("id, reference, title, intervention_field, status, deadline, published_at, updated_at, contribution_types")
    .order("updated_at", { ascending: false })
    .limit(300);
  if (filter.status) query = query.eq("status", filter.status);
  if (filter.field) query = query.eq("intervention_field", filter.field);
  const { data } = await query;
  return (data ?? []) as OpportunityRow[];
}

export interface OpportunityDetail extends OpportunityRow {
  need_id: string | null;
  summary: string;
  description: string;
  objectives: string;
  beneficiaries: string;
  geographic_scope: string | null;
  expected_contribution: string;
  required_resources: string | null;
  funding_target: string | null;
  currency: string;
  timeline: string | null;
  department: string | null;
  approved_at: string | null;
  closed_at: string | null;
  created_at: string;
  approver: { full_name: string | null; email: string } | null;
  need: { reference: string; title: string } | null;
}

export async function getOpportunity(id: string) {
  const supabase = await createClient();
  const [{ data: opp }, { data: notes }, { data: history }, { data: applications }] = await Promise.all([
    supabase
      .from("partnership_opportunities")
      .select("*, approver:profiles!partnership_opportunities_approved_by_fkey(full_name, email), need:educational_needs(reference, title)")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("partnership_notes").select("id, body, created_at, author:profiles!partnership_notes_author_id_fkey(full_name, email)").eq("opportunity_id", id).order("created_at", { ascending: false }),
    supabase
      .from("partnership_status_history")
      .select("id, from_status, to_status, note, created_at, by:profiles!partnership_status_history_changed_by_fkey(full_name, email)")
      .eq("opportunity_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("partnership_applications").select("id, reference, org_name, status, created_at").eq("opportunity_id", id).order("created_at", { ascending: false }),
  ]);
  if (!opp) return null;
  return {
    opportunity: opp as unknown as OpportunityDetail,
    notes: (notes ?? []) as unknown as Note[],
    history: (history ?? []) as unknown as HistoryEntry[],
    applications: (applications ?? []) as Array<{ id: string; reference: string; org_name: string; status: ApplicationStatus; created_at: string }>,
  };
}

/** Active institutions (a need may concern one school). */
export async function institutionsForNeeds() {
  const supabase = await createClient();
  const { data } = await supabase.from("institutions").select("id, name").eq("status", "active").order("name");
  return (data ?? []) as Array<{ id: string; name: string }>;
}

/** Published projects for the public pages (no internal data; anon allowed). */
export const publicOpportunities = cache(async (): Promise<PublicOpportunity[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_partnership_opportunities");
  if (error) {
    console.error("[partnerships] public opportunities", error.message);
    return [];
  }
  return (data ?? []) as PublicOpportunity[];
});
