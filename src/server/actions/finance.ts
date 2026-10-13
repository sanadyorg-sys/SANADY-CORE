"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { costSchema, invoiceSchema, paymentSchema } from "@/lib/enterprise-schema";
import { errorMessage, messageFor } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";
import { parseInput, uuidSchema } from "@/lib/validation";
import { requireViewer } from "@/server/auth";

/** SANADY Enterprise, phase E6: recorded invoices, payments and costs. The platform bills nothing. */

const BASE = "/admin/partenariats/entreprises";

async function call(fn: string, args: Record<string, unknown>, paths: string[], success: string): Promise<ActionState> {
  await requireViewer();
  const { error } = await (await createClient()).rpc(fn, args);
  if (error) return { ok: false, message: errorMessage(error) };
  for (const p of paths) revalidatePath(p);
  return { ok: true, message: success };
}
const paths = (contractId?: string) => [`${BASE}/finances`, ...(contractId ? [`${BASE}/contrats/${contractId}`] : [])];

export async function recordInvoice(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const contract = uuidSchema.safeParse(formData.get("contract_id"));
  if (!contract.success) return { ok: false, message: messageFor("not_found") };
  const parsed = parseInput(invoiceSchema, formData);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  return call("record_invoice", { p_contract: contract.data, p: parsed.data }, paths(contract.data), "Facture enregistrée.");
}

export async function cancelInvoice(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseInput(z.object({ id: uuidSchema, contract_id: uuidSchema, reason: z.string().trim().min(5, "Indiquez le motif (avoir émis…).").max(500) }), formData);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  return call("cancel_invoice", { p_invoice: parsed.data.id, p_reason: parsed.data.reason }, paths(parsed.data.contract_id), "Facture annulée.");
}

export async function recordPayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ids = parseInput(z.object({ invoice_id: uuidSchema, contract_id: uuidSchema }), formData);
  if (!ids.ok) return { ok: false, message: messageFor("not_found") };
  const parsed = parseInput(paymentSchema, formData);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  return call("record_payment", { p_invoice: ids.data.invoice_id, p: parsed.data }, paths(ids.data.contract_id), "Paiement enregistré — à confirmer par un approbateur.");
}

export async function confirmPayment(paymentId: string, contractId: string | null): Promise<ActionState> {
  if (!uuidSchema.safeParse(paymentId).success) return { ok: false, message: messageFor("not_found") };
  return call("confirm_payment", { p_payment: paymentId }, paths(contractId ?? undefined), "Paiement confirmé.");
}

export async function recordCost(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseInput(costSchema, formData);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  return call("record_cost", { p: parsed.data }, paths(parsed.data.contract_id || undefined), parsed.data.is_estimate ? "Estimation de coût enregistrée." : "Coût enregistré.");
}

export async function deleteCost(costId: string): Promise<ActionState> {
  if (!uuidSchema.safeParse(costId).success) return { ok: false, message: messageFor("not_found") };
  return call("delete_cost", { p_id: costId }, paths(), "Coût supprimé.");
}
