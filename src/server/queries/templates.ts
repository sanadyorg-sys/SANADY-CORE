import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { TemplateCategory } from "@/lib/partnerships";

/** Communication templates (partnership staff, through RLS). */

export interface TemplateRow {
  id: string;
  category: TemplateCategory;
  title: string;
  subject: string;
  body: string;
  archived_at: string | null;
  updated_at: string;
}

export async function listTemplates({ archived = false } = {}) {
  const supabase = await createClient();
  let q = supabase.from("partnership_templates").select("id, category, title, subject, body, archived_at, updated_at").order("category").order("title");
  q = archived ? q.not("archived_at", "is", null) : q.is("archived_at", null);
  const { data } = await q;
  return (data ?? []) as TemplateRow[];
}

/** References a message can mention for one organisation. */
export async function organizationReferences(organizationId: string) {
  const supabase = await createClient();
  const [{ data: apps }, { data: agreements }, { data: reports }] = await Promise.all([
    supabase.from("partnership_applications").select("reference").eq("organization_id", organizationId),
    supabase.from("partnership_agreements").select("reference").eq("organization_id", organizationId),
    supabase.from("partnership_reports").select("reference").eq("organization_id", organizationId).in("status", ["approved", "shared"]),
  ]);
  return [
    ...((apps ?? []) as Array<{ reference: string }>).map((r) => ({ value: r.reference, label: `${r.reference} (candidature)` })),
    ...((agreements ?? []) as Array<{ reference: string }>).map((r) => ({ value: r.reference, label: `${r.reference} (convention)` })),
    ...((reports ?? []) as Array<{ reference: string }>).map((r) => ({ value: r.reference, label: `${r.reference} (rapport)` })),
  ];
}
