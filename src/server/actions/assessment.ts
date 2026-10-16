"use server";

import { revalidatePath } from "next/cache";
import { errorMessage, messageFor } from "@/lib/errors";
import { assessmentPolicySchema } from "@/lib/enterprise-schema";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";
import { parseInput, uuidSchema } from "@/lib/validation";
import { requireEnterpriseStaff } from "@/server/auth";

/** Company assessment policies. Approval and enforcement are in the database. */

const page = (tenantId: string) => `/admin/partenariats/entreprises/espaces/${tenantId}`;

export async function saveAssessmentPolicy(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireEnterpriseStaff();
  const tenant = uuidSchema.safeParse(formData.get("tenant_id"));
  if (!tenant.success) return { ok: false, message: messageFor("not_found") };
  const parsed = parseInput(assessmentPolicySchema, {
    ...Object.fromEntries(formData.entries()),
    certificates: formData.get("certificates") ?? "off",
    enforce_due_dates: formData.get("enforce_due_dates") ?? "off",
  });
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors, message: "Certaines règles sont à corriger." };
  const { error } = await (await createClient()).rpc("save_assessment_policy", { p_tenant: tenant.data, p: parsed.data });
  if (error) return { ok: false, message: errorMessage(error) };
  revalidatePath(page(tenant.data));
  return { ok: true, message: "Règles enregistrées. Elles s’appliqueront une fois approuvées par un approbateur." };
}

export async function approveAssessmentPolicy(tenantId: string): Promise<ActionState> {
  await requireEnterpriseStaff();
  const { error } = await (await createClient()).rpc("approve_assessment_policy", { p_tenant: tenantId });
  if (error) return { ok: false, message: errorMessage(error) };
  revalidatePath(page(tenantId));
  return { ok: true, message: "Règles approuvées : elles s’appliquent aux nouvelles tentatives des collaborateurs." };
}

export async function removeAssessmentPolicy(tenantId: string): Promise<ActionState> {
  await requireEnterpriseStaff();
  const { error } = await (await createClient()).rpc("remove_assessment_policy", { p_tenant: tenantId });
  if (error) return { ok: false, message: errorMessage(error) };
  revalidatePath(page(tenantId));
  return { ok: true, message: "Règles retirées : la règle SANADY s’applique (70 %, 3 tentatives)." };
}
