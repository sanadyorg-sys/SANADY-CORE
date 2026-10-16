"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { errorMessage, messageFor } from "@/lib/errors";
import { lineSchema, planSchema } from "@/lib/enterprise-schema";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";
import { parseInput, uuidSchema } from "@/lib/validation";
import { requireEnterpriseStaff } from "@/server/auth";

/** Reusable service plans. Approval, locking and currency rules are in the database. */

const BASE = "/admin/partenariats/entreprises";
const PLANS = `${BASE}/formules`;

export async function savePlan(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireEnterpriseStaff();
  const id = String(formData.get("id") ?? "");
  const parsed = parseInput(planSchema, formData);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors, message: "Certaines informations sont à compléter." };
  const { data, error } = await (await createClient()).rpc("save_service_plan", { p_id: id || null, p: parsed.data });
  if (error) return { ok: false, message: errorMessage(error) };
  revalidatePath(PLANS);
  if (!id) redirect(`${PLANS}/${data as string}`);
  revalidatePath(`${PLANS}/${id}`);
  return { ok: true, message: "Formule enregistrée. Elle doit être approuvée à nouveau avant d’être utilisée." };
}

export async function savePlanLine(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireEnterpriseStaff();
  const plan = uuidSchema.safeParse(formData.get("plan_id"));
  if (!plan.success) return { ok: false, message: messageFor("not_found") };
  const parsed = parseInput(lineSchema, formData);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const { error } = await (await createClient()).rpc("save_plan_line", { p_plan: plan.data, p: parsed.data });
  if (error) return { ok: false, message: errorMessage(error) };
  revalidatePath(`${PLANS}/${plan.data}`);
  return { ok: true, message: "Ligne ajoutée." };
}

export async function deletePlanLine(lineId: string, planId: string): Promise<ActionState> {
  await requireEnterpriseStaff();
  const { error } = await (await createClient()).rpc("delete_plan_line", { p_line: lineId });
  if (error) return { ok: false, message: errorMessage(error) };
  revalidatePath(`${PLANS}/${planId}`);
  return { ok: true, message: "Ligne supprimée." };
}

export async function setPlanStatus(planId: string, status: "draft" | "active" | "archived"): Promise<ActionState> {
  await requireEnterpriseStaff();
  const { error } = await (await createClient()).rpc("set_plan_status", { p_plan: planId, p_status: status });
  if (error) return { ok: false, message: errorMessage(error) };
  revalidatePath(PLANS);
  revalidatePath(`${PLANS}/${planId}`);
  return { ok: true, message: status === "active" ? "Formule approuvée : elle peut être appliquée aux propositions." : status === "archived" ? "Formule archivée." : "Formule repassée en brouillon." };
}

export async function applyPlan(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireEnterpriseStaff();
  const proposal = uuidSchema.safeParse(formData.get("proposal_id"));
  const plan = uuidSchema.safeParse(formData.get("plan_id"));
  if (!proposal.success) return { ok: false, message: messageFor("not_found") };
  if (!plan.success) return { ok: false, fieldErrors: { plan_id: "Choisissez une formule." } };
  const { data, error } = await (await createClient()).rpc("apply_plan_to_proposal", { p_proposal: proposal.data, p_plan: plan.data });
  if (error) return { ok: false, message: errorMessage(error) };
  revalidatePath(`${BASE}/propositions/${proposal.data}`);
  return { ok: true, message: `${data as number} ligne(s) ajoutée(s) depuis la formule. Ajustez-les si besoin.` };
}
