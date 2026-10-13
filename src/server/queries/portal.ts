import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Partner portal (partnerships phase 6). Partners never read tables: they
 * go through public.portal_overview(), which returns only what concerns
 * their organisation and is meant for partners.
 */

export interface PortalOverview {
  organization: { id: string; name: string };
  representative: string | null;
  agreements: Array<{
    id: string;
    reference: string;
    title: string;
    objectives: string;
    field: string;
    start_on: string | null;
    end_on: string | null;
    status: "signed" | "active" | "completed";
    signed_on: string | null;
    milestones: Array<{ id: string; title: string; due_on: string; done: boolean }>;
  }>;
  projects: Array<{ reference: string; title: string; summary: string; status: string }>;
  reports: Array<{ id: string; reference: string; title: string; period_start: string; period_end: string; shared_at: string }>;
  deliverables: Array<{ id: string; title: string; status: "submitted" | "accepted" | "returned"; review_comment: string | null; created_at: string; agreement: string | null; files: string[] }>;
  messages: Array<{ id: string; body: string; from_partner: boolean; created_at: string; author: string | null }>;
}

export async function portalOverview() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("portal_overview");
  if (error) return null;
  return data as PortalOverview;
}

/* ─── SANADY side (partnership staff, through RLS) ─────────────────────── */

export async function portalEnabled() {
  const supabase = await createClient();
  const { data } = await supabase.from("platform_settings").select("partner_portal_enabled").maybeSingle();
  return Boolean((data as { partner_portal_enabled: boolean } | null)?.partner_portal_enabled);
}

export async function portalForOrganization(organizationId: string) {
  const supabase = await createClient();
  const [{ data: members }, { data: invitations }, { data: deliverables }, { data: messages }] = await Promise.all([
    supabase
      .from("partner_portal_members")
      .select("id, granted_at, user:profiles!partner_portal_members_user_id_fkey(full_name, email)")
      .eq("organization_id", organizationId)
      .is("revoked_at", null),
    supabase
      .from("invitations")
      .select("id, email, expires_at, email_sent_at")
      .eq("partner_organization_id", organizationId)
      .is("accepted_at", null)
      .is("revoked_at", null),
    supabase
      .from("partner_deliverables")
      .select("id, title, description, status, review_comment, created_at, agreement:partnership_agreements(reference), docs:partnership_documents(id, file_name, file_size)")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }),
    supabase
      .from("partner_messages")
      .select("id, body, from_partner, created_at, author:profiles!partner_messages_author_id_fkey(full_name, email)")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  return {
    members: (members ?? []) as unknown as Array<{ id: string; granted_at: string; user: { full_name: string | null; email: string } | null }>,
    invitations: (invitations ?? []) as Array<{ id: string; email: string; expires_at: string; email_sent_at: string | null }>,
    deliverables: (deliverables ?? []) as unknown as Array<{
      id: string;
      title: string;
      description: string | null;
      status: "submitted" | "accepted" | "returned";
      review_comment: string | null;
      created_at: string;
      agreement: { reference: string } | null;
      docs: Array<{ id: string; file_name: string; file_size: number }>;
    }>,
    messages: ((messages ?? []) as unknown as Array<{ id: string; body: string; from_partner: boolean; created_at: string; author: { full_name: string | null; email: string } | null }>).reverse(),
  };
}
