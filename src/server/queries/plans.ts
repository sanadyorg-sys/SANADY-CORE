import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { EnterpriseService, LineCategory, PlanStatus } from "@/lib/enterprise";

/** Reusable service plans (Enterprise staff and approvers, through RLS). */

type Person = { full_name: string | null; email: string } | null;

export interface PlanLine {
  id: string;
  category: LineCategory;
  label: string;
  quantity: string;
  unit: string | null;
  unit_price: string;
  position: number;
}

export interface PlanRow {
  id: string;
  name: string;
  service: Exclude<EnterpriseService, "partenariat">;
  description: string | null;
  currency: string;
  pricing_model: string;
  learner_limit: number | null;
  storage_limit_gb: string | null;
  video_minutes_limit: number | null;
  support_level: string | null;
  support_commitments: string | null;
  status: PlanStatus;
  approved_at: string | null;
  updated_at: string;
  approver: Person;
  lines: PlanLine[];
}
const ROW = "*, approver:profiles!enterprise_service_plans_approved_by_fkey(full_name, email), lines:enterprise_plan_lines(id, category, label, quantity, unit, unit_price, position)";

const sortLines = (p: PlanRow) => ({ ...p, lines: [...p.lines].sort((a, b) => a.position - b.position) });

export async function listPlans(filter: { status?: PlanStatus } = {}) {
  const supabase = await createClient();
  let q = supabase.from("enterprise_service_plans").select(ROW).order("name");
  if (filter.status) q = q.eq("status", filter.status);
  const { data } = await q;
  return ((data ?? []) as unknown as PlanRow[]).map(sortLines);
}

export async function getPlan(id: string) {
  const { data } = await (await createClient()).from("enterprise_service_plans").select(ROW).eq("id", id).maybeSingle();
  return data ? sortLines(data as unknown as PlanRow) : null;
}
