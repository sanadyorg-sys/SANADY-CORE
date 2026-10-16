import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { SupportCategory, SupportPriority, SupportStatus } from "@/lib/enterprise";

/**
 * Support requests. Reads go through RLS: the Enterprise team sees every
 * request and internal note; a company administrator sees their company's
 * requests and the messages meant for them — never internal notes.
 */

type Person = { full_name: string | null; email: string } | null;

export interface SupportRow {
  id: string;
  reference: string;
  institution_id: string;
  tenant_id: string;
  category: SupportCategory;
  priority: SupportPriority;
  subject: string;
  status: SupportStatus;
  assigned_to: string | null;
  first_response_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  tenant: { id: string; display_name: string; support_level: string | null } | null;
  assignee: Person;
}
const ROW = "*, tenant:enterprise_tenants(id, display_name, support_level), assignee:profiles!enterprise_support_requests_assigned_to_fkey(full_name, email)";

export async function listSupportRequests(filter: { institution?: string; status?: "active" | SupportStatus } = {}) {
  const supabase = await createClient();
  let q = supabase.from("enterprise_support_requests").select(ROW).order("updated_at", { ascending: false }).limit(300);
  if (filter.institution) q = q.eq("institution_id", filter.institution);
  if (filter.status === "active") q = q.in("status", ["open", "in_progress", "waiting_client"]);
  else if (filter.status) q = q.eq("status", filter.status);
  const { data } = await q;
  return (data ?? []) as unknown as SupportRow[];
}

export interface SupportMessage {
  id: string;
  from_team: boolean;
  internal: boolean;
  body: string;
  created_at: string;
  author: Person;
}

export async function getSupportRequest(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("enterprise_support_requests").select(ROW).eq("id", id).maybeSingle();
  if (!data) return null;
  const request = data as unknown as SupportRow;
  const [{ data: messages }, { data: opener }] = await Promise.all([
    supabase.from("enterprise_support_messages").select("id, from_team, internal, body, created_at, author_id").eq("request_id", id).order("created_at"),
    supabase.from("enterprise_support_requests").select("opener:profiles!enterprise_support_requests_opened_by_fkey(full_name, email)").eq("id", id).maybeSingle(),
  ]);
  // Names are looked up separately: each side only sees the profiles it may see.
  const rows = (messages ?? []) as Array<Omit<SupportMessage, "author"> & { author_id: string | null }>;
  const ids = [...new Set(rows.map((m) => m.author_id).filter(Boolean))] as string[];
  const { data: people } = ids.length ? await supabase.from("profiles").select("id, full_name, email").in("id", ids) : { data: [] };
  const byId = new Map(((people ?? []) as Array<{ id: string; full_name: string | null; email: string }>).map((p) => [p.id, p]));
  return {
    request,
    messages: rows.map(({ author_id, ...m }) => ({ ...m, author: (author_id && byId.get(author_id)) || null })) as SupportMessage[],
    opener: ((opener as { opener: Person } | null)?.opener ?? null) as Person,
  };
}

/** Support terms of the company's contract, for the team. */
export async function supportCommitments(tenantId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("enterprise_contracts")
    .select("reference, support_commitments")
    .eq("tenant_id", tenantId)
    .in("status", ["signed", "active", "renewal"])
    .not("support_commitments", "is", null)
    .limit(1)
    .maybeSingle();
  return (data ?? null) as { reference: string; support_commitments: string } | null;
}

export interface SupportOverview {
  open: number;
  waiting_client: number;
  urgent_unanswered: number;
  last_30_days: number;
  incidents_90_days: number;
  resolved_90_days: number;
  median_first_response_hours: number | null;
  by_tenant: Array<{ tenant_id: string; tenant: string; open: number; total: number }>;
}

export async function supportOverview() {
  const { data } = await (await createClient()).rpc("support_overview");
  return (data ?? null) as SupportOverview | null;
}

/** The company space's support level (company administrators read their own tenant). */
export async function tenantSupportLevel(institutionId: string) {
  const { data } = await (await createClient()).from("enterprise_tenants").select("support_level").eq("institution_id", institutionId).maybeSingle();
  return ((data as { support_level: string | null } | null)?.support_level ?? null) as string | null;
}
