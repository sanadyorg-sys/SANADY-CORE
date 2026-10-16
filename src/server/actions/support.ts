"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { errorMessage, messageFor } from "@/lib/errors";
import { supportMessageSchema, supportRequestSchema } from "@/lib/enterprise-schema";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";
import { parseInput, uuidSchema } from "@/lib/validation";
import { requireViewer } from "@/server/auth";

/**
 * Support requests between a company administrator and the SANADY
 * Enterprise team. Every rule (who may write, internal notes, status
 * changes) is in the database.
 */

const TEAM = "/admin/partenariats/entreprises/assistance";
const company = (institutionId: string) => `/etablissement/${institutionId}/assistance`;

function refresh(institutionId: string | null, requestId: string) {
  revalidatePath(TEAM);
  revalidatePath(`${TEAM}/${requestId}`);
  revalidatePath("/admin/partenariats/entreprises");
  if (institutionId) {
    revalidatePath(company(institutionId));
    revalidatePath(`${company(institutionId)}/${requestId}`);
  }
}

export async function openSupportRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireViewer();
  const inst = uuidSchema.safeParse(formData.get("institution_id"));
  if (!inst.success) return { ok: false, message: messageFor("not_found") };
  const parsed = parseInput(supportRequestSchema, formData);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors, message: "Certaines informations sont à compléter." };
  const { data, error } = await (await createClient()).rpc("open_support_request", { p_institution: inst.data, p: parsed.data });
  if (error) return { ok: false, message: errorMessage(error) };
  revalidatePath(company(inst.data));
  revalidatePath(TEAM);
  redirect(`${company(inst.data)}/${data as string}`);
}

export async function postSupportMessage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireViewer();
  const id = uuidSchema.safeParse(formData.get("request_id"));
  if (!id.success) return { ok: false, message: messageFor("not_found") };
  const parsed = parseInput(supportMessageSchema, formData);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const internal = formData.get("internal") === "on";
  const { error } = await (await createClient()).rpc("post_support_message", { p_request: id.data, p_body: parsed.data.body, p_internal: internal });
  if (error) return { ok: false, message: errorMessage(error) };
  refresh(String(formData.get("institution_id") || "") || null, id.data);
  return { ok: true, message: internal ? "Note interne ajoutée." : "Message envoyé." };
}

export async function setSupportStatus(requestId: string, institutionId: string, status: string): Promise<ActionState> {
  await requireViewer();
  if (!uuidSchema.safeParse(requestId).success) return { ok: false, message: messageFor("not_found") };
  const { error } = await (await createClient()).rpc("set_support_status", { p_request: requestId, p_status: status });
  if (error) return { ok: false, message: errorMessage(error) };
  refresh(institutionId, requestId);
  return { ok: true, message: "Demande mise à jour." };
}

export async function assignSupportRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireViewer();
  const id = uuidSchema.safeParse(formData.get("request_id"));
  if (!id.success) return { ok: false, message: messageFor("not_found") };
  const raw = String(formData.get("assigned_to") ?? "");
  const user = raw ? uuidSchema.safeParse(raw) : null;
  if (user && !user.success) return { ok: false, message: messageFor("invalid_input") };
  const { error } = await (await createClient()).rpc("assign_support_request", { p_request: id.data, p_user: user?.data ?? null });
  if (error) return { ok: false, message: errorMessage(error) };
  refresh(null, id.data);
  return { ok: true, message: user ? "Demande attribuée." : "Attribution retirée." };
}
