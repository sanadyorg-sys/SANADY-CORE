import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { TaskKind, TaskStatus, TrainingChecklist, TrainingStatus } from "@/lib/enterprise";
import type { Viewer } from "@/server/auth";
import type { HistoryEntry } from "@/server/queries/partnerships";

/**
 * Custom training production studio (SANADY Enterprise, phase E4). Reads go
 * through RLS: enterprise staff, the pedagogical team, approvers, and the
 * trainers and assignees of a project.
 */

type Person = { id?: string; full_name: string | null; email: string } | null;

export interface ProjectRow {
  id: string;
  reference: string;
  title: string;
  status: TrainingStatus;
  version: number;
  due_on: string | null;
  updated_at: string;
  organization: { id: string; name: string } | null;
  lead: Person;
}

const ROW = "id, reference, title, status, version, due_on, updated_at, organization:partner_organizations(id, name), lead:profiles!training_projects_lead_id_fkey(full_name, email)";

export async function listProjects(filter: { status?: string; organization?: string } = {}) {
  const supabase = await createClient();
  let q = supabase.from("training_projects").select(ROW).order("updated_at", { ascending: false }).limit(200);
  if (filter.status) q = q.eq("status", filter.status);
  if (filter.organization) q = q.eq("organization_id", filter.organization);
  const { data } = await q;
  return (data ?? []) as unknown as ProjectRow[];
}

export interface ProjectDetail extends ProjectRow {
  organization_id: string;
  tenant_id: string | null;
  proposal_id: string | null;
  target_audience: string;
  objectives: string | null;
  constraints: string | null;
  language: "fr" | "ar" | "en" | "multiple";
  target_minutes: number | null;
  ownership: "company" | "joint" | "licensed";
  client_review_required: boolean;
  lead_id: string | null;
  course_id: string | null;
  approved_at: string | null;
  launched_at: string | null;
  created_at: string;
  approver: Person;
  tenant: { id: string; display_name: string; status: string; institution_id: string | null } | null;
  course: { id: string; title: string; status: string } | null;
}

export interface TrainingTask {
  id: string;
  kind: TaskKind;
  title: string;
  status: TaskStatus;
  due_on: string | null;
  assigned_to: string | null;
  assignee: Person;
}

export interface TrainingReview {
  id: string;
  kind: "internal" | "client";
  decision: "approved" | "changes_requested";
  comment: string | null;
  version: number;
  created_at: string;
  reviewer: Person;
}

export async function getProject(id: string) {
  const supabase = await createClient();
  const { data: p } = await supabase
    .from("training_projects")
    .select(
      `*, organization:partner_organizations(id, name), lead:profiles!training_projects_lead_id_fkey(full_name, email),
       approver:profiles!training_projects_approved_by_fkey(full_name, email),
       tenant:enterprise_tenants(id, display_name, status, institution_id), course:courses(id, title, status)`,
    )
    .eq("id", id)
    .maybeSingle();
  if (!p) return null;
  const project = p as unknown as ProjectDetail;
  const [{ data: outline }, { data: tasks }, { data: reviews }, { data: versions }, { data: history }, { data: checklist }, { data: trainers }] = await Promise.all([
    supabase.from("training_outline").select("id, position, title, description").eq("project_id", id).order("position"),
    supabase
      .from("training_tasks")
      .select("id, kind, title, status, due_on, assigned_to, assignee:profiles!training_tasks_assigned_to_fkey(id, full_name, email)")
      .eq("project_id", id)
      .order("status")
      .order("due_on", { ascending: true, nullsFirst: false }),
    supabase
      .from("training_reviews")
      .select("id, kind, decision, comment, version, created_at, reviewer:profiles!training_reviews_reviewer_id_fkey(full_name, email)")
      .eq("project_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("training_versions")
      .select("id, version, approved_at, approver:profiles!training_versions_approved_by_fkey(full_name, email)")
      .eq("project_id", id)
      .order("version", { ascending: false }),
    supabase
      .from("enterprise_history")
      .select("id, from_status, to_status, note, created_at, by:profiles!enterprise_history_changed_by_fkey(full_name, email)")
      .eq("project_id", id)
      .order("created_at", { ascending: false }),
    supabase.rpc("training_checklist", { p_project: id }),
    supabase.rpc("project_trainers", { p_project: id }),
  ]);
  return {
    project,
    outline: (outline ?? []) as Array<{ id: string; position: number; title: string; description: string | null }>,
    tasks: (tasks ?? []) as unknown as TrainingTask[],
    reviews: (reviews ?? []) as unknown as TrainingReview[],
    versions: (versions ?? []) as unknown as Array<{ id: string; version: number; approved_at: string; approver: Person }>,
    history: (history ?? []) as unknown as HistoryEntry[],
    checklist: (checklist ?? null) as TrainingChecklist | null,
    trainers: (trainers ?? []) as Array<{ id: string; full_name: string | null; email: string }>,
  };
}

/** People who can lead a project or receive production tasks. */
export async function productionTeam() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("production_team");
  return (data ?? []) as Array<{ id: string; full_name: string | null; email: string; role: string }>;
}

/** What the current person may do in the studio (the database re-checks). */
export async function studioActor(viewer: Viewer) {
  const supabase = await createClient();
  const { data } = await supabase.from("partnership_signatories").select("id").eq("user_id", viewer.id).is("revoked_at", null).maybeSingle();
  return {
    manage: viewer.isSanadyAdmin || viewer.platformRole === "enterprise_manager" || viewer.platformRole === "production_manager",
    pedagogy: viewer.isCourseStaff,
    signatory: Boolean(data),
  };
}

/** Production tasks assigned to the current person (trainers' « Studio » page). */
export async function myTrainingTasks(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("training_tasks")
    .select("id, kind, title, status, due_on, project:training_projects(id, reference, title)")
    .eq("assigned_to", userId)
    .neq("status", "done")
    .order("due_on", { ascending: true, nullsFirst: false });
  return (data ?? []) as unknown as Array<{ id: string; kind: TaskKind; title: string; status: TaskStatus; due_on: string | null; project: { id: string; reference: string; title: string } | null }>;
}

/** Projects of a company workspace, as its administrator sees them. */
export async function workspaceProjects(institutionId: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("workspace_training_projects", { p_institution: institutionId });
  return (data ?? []) as Array<{
    id: string;
    reference: string;
    title: string;
    status: TrainingStatus;
    version: number;
    objectives: string | null;
    target_audience: string;
    outline: Array<{ title: string; description: string | null }>;
    client_review_required: boolean;
    due_on: string | null;
    can_preview: boolean;
  }>;
}

/** Workspaces and proposals of a client (project form). */
export async function projectFormOptions(organizationId: string) {
  const supabase = await createClient();
  const [{ data: tenants }, { data: proposals }] = await Promise.all([
    supabase.from("enterprise_tenants").select("id, display_name, status").eq("organization_id", organizationId).not("status", "in", "(closed,cancelled)"),
    supabase.from("enterprise_proposals").select("id, reference, title").eq("organization_id", organizationId).in("status", ["approved", "sent", "accepted"]),
  ]);
  return {
    tenants: ((tenants ?? []) as Array<{ id: string; display_name: string; status: string }>).map((t) => ({ id: t.id, label: t.display_name })),
    proposals: ((proposals ?? []) as Array<{ id: string; reference: string; title: string }>).map((p) => ({ id: p.id, label: `${p.reference} — ${p.title}` })),
  };
}

export interface ClientPreview {
  project_id: string;
  project_title: string;
  status: TrainingStatus;
  course_id: string;
  course_title: string;
  description: string | null;
  modules: Array<{
    id: string;
    title: string;
    description: string | null;
    lessons: Array<{ id: string; title: string; kind: "video" | "pdf"; minutes: number | null; pages: number | null }>;
    quiz: { id: string; title: string; questions: Array<{ prompt: string; kind: string; options: string[] }> } | null;
  }>;
}

/** The draft course behind a project, for the company's administrators while their review is awaited (labels only). */
export async function clientCoursePreview(projectId: string) {
  const { data, error } = await (await createClient()).rpc("client_course_preview", { p_project: projectId });
  if (error) return null;
  return data as ClientPreview;
}
