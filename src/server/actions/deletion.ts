"use server";

import { revalidatePath } from "next/cache";
import { errorMessage } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";
import { requireEnterpriseStaff } from "@/server/auth";

/**
 * Deletion of a company space's data. Every safeguard (notice, data handed
 * over, hold, four eyes, 30 days, unpaid invoices, running contracts) is
 * enforced by the database; these actions only pass what people record.
 */

const page = (tenantId: string) => `/admin/partenariats/entreprises/espaces/${tenantId}`;
const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

async function run(tenantId: string, fn: string, args: Record<string, unknown>, success: string): Promise<ActionState> {
  await requireEnterpriseStaff();
  const { error } = await (await createClient()).rpc(fn, args);
  if (error) return { ok: false, message: errorMessage(error) };
  revalidatePath(page(tenantId));
  revalidatePath("/admin/partenariats/entreprises");
  return { ok: true, message: success };
}

export async function proposeDeletion(tenantId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const reason = text(formData, "reason");
  if (reason.length < 5) return { ok: false, fieldErrors: { reason: "Indiquez le motif (5 caractères au moins)." } };
  return run(tenantId, "propose_data_deletion", { p_tenant: tenantId, p_reason: reason }, "Suppression proposée. Prévenez l’organisation et remettez-lui ses données.");
}

export async function recordDeletionNotice(tenantId: string, deletionId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const date = text(formData, "date");
  const recipient = text(formData, "recipient");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, fieldErrors: { date: "Date d’envoi requise." } };
  if (recipient.length < 3) return { ok: false, fieldErrors: { recipient: "Indiquez à qui l’avis a été envoyé." } };
  return run(tenantId, "record_deletion_step", { p_deletion: deletionId, p_step: "notice", p: { date, recipient } }, "Envoi de l’avis enregistré.");
}

export async function recordDataDelivery(tenantId: string, deletionId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const date = text(formData, "date");
  const method = text(formData, "method");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, fieldErrors: { date: "Date requise." } };
  if (method.length < 5) return { ok: false, fieldErrors: { method: "Indiquez comment les données ont été remises (ou que l’organisation n’en veut pas)." } };
  return run(tenantId, "record_deletion_step", { p_deletion: deletionId, p_step: "delivery", p: { date, method } }, "Remise des données enregistrée.");
}

export async function holdDeletion(tenantId: string, deletionId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const reason = text(formData, "reason");
  if (reason.length < 5) return { ok: false, fieldErrors: { reason: "Indiquez pourquoi la suppression est suspendue." } };
  return run(tenantId, "set_deletion_hold", { p_deletion: deletionId, p_reason: reason }, "Suppression suspendue.");
}

export async function releaseDeletionHold(tenantId: string, deletionId: string): Promise<ActionState> {
  return run(tenantId, "set_deletion_hold", { p_deletion: deletionId, p_reason: "" }, "Suspension levée.");
}

export async function confirmDeletion(tenantId: string, deletionId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const reason = text(formData, "reason");
  if (reason.length < 5) return { ok: false, fieldErrors: { reason: "Indiquez le motif de votre confirmation." } };
  return run(tenantId, "confirm_data_deletion", { p_deletion: deletionId, p_reason: reason }, "Suppression confirmée : elle aura lieu dans 30 jours, sauf annulation ou suspension.");
}

export async function cancelDeletion(tenantId: string, deletionId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const reason = text(formData, "reason");
  if (reason.length < 5) return { ok: false, fieldErrors: { reason: "Indiquez pourquoi la suppression est annulée." } };
  return run(tenantId, "cancel_data_deletion", { p_deletion: deletionId, p_reason: reason }, "Suppression annulée. Rien n’a été supprimé.");
}
