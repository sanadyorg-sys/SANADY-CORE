"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { CONTRACT_STATUS, type ContractStatus } from "@/lib/enterprise";
import { contractSchema, lineSchema } from "@/lib/enterprise-schema";
import { errorMessage, messageFor } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";
import { optionalText, parseInput, uuidSchema } from "@/lib/validation";
import { requireViewer } from "@/server/auth";
import { signedPdfUpload, verifyPdfUploads } from "@/server/pdf-upload";

/** SANADY Enterprise, phase E5: contracts and usage. Every rule is in the database; nothing is billed. */

const BASE = "/admin/partenariats/entreprises";
const contractPaths = (id: string) => [`${BASE}/contrats`, `${BASE}/contrats/${id}`, BASE];

async function call(fn: string, args: Record<string, unknown>, paths: string[], success: string): Promise<ActionState> {
  await requireViewer();
  const { error } = await (await createClient()).rpc(fn, args);
  if (error) return { ok: false, message: errorMessage(error) };
  for (const p of paths) revalidatePath(p);
  return { ok: true, message: success };
}

export async function createContractFromProposal(proposalId: string): Promise<ActionState> {
  await requireViewer();
  if (!uuidSchema.safeParse(proposalId).success) return { ok: false, message: messageFor("not_found") };
  const { data, error } = await (await createClient()).rpc("create_contract_from_proposal", { p_proposal: proposalId });
  if (error) return { ok: false, message: errorMessage(error) };
  revalidatePath(`${BASE}/contrats`);
  redirect(`${BASE}/contrats/${data as string}`);
}

export async function saveContract(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = uuidSchema.safeParse(formData.get("id"));
  if (!id.success) return { ok: false, message: messageFor("not_found") };
  const parsed = parseInput(contractSchema, formData);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors, message: "Certaines informations sont à compléter." };
  return call("save_enterprise_contract", { p_id: id.data, p: parsed.data }, contractPaths(id.data), "Contrat enregistré.");
}

export async function saveContractLine(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const contract = uuidSchema.safeParse(formData.get("contract_id"));
  if (!contract.success) return { ok: false, message: messageFor("not_found") };
  const parsed = parseInput(lineSchema, formData);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  return call("save_contract_line", { p_id: null, p_contract: contract.data, p: parsed.data }, contractPaths(contract.data), "Ligne ajoutée.");
}

export async function deleteContractLine(lineId: string, contractId: string): Promise<ActionState> {
  return call("delete_contract_line", { p_id: lineId }, contractPaths(contractId), "Ligne supprimée.");
}

export async function setContractStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseInput(
    z.object({
      id: uuidSchema,
      status: z.enum(Object.keys(CONTRACT_STATUS) as [ContractStatus], "Choisissez une action."),
      signed_on: z.union([z.iso.date("Date invalide."), z.literal("")]).optional(),
      note: optionalText(1000),
    }),
    formData,
  );
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const { id, status, signed_on, note } = parsed.data;
  if (status === "signed" && !signed_on) return { ok: false, fieldErrors: { signed_on: "Indiquez la date de signature." } };
  if (status === "closed" && !note) return { ok: false, fieldErrors: { note: "Indiquez le motif de la clôture." } };
  return call("set_contract_status", { p_contract: id, p_status: status, p: { signed_on: signed_on ?? "", note: note ?? "" } }, contractPaths(id), `Statut « ${CONTRACT_STATUS[status].label} » enregistré.`);
}

export async function applyContractToTenant(contractId: string): Promise<ActionState> {
  if (!uuidSchema.safeParse(contractId).success) return { ok: false, message: messageFor("not_found") };
  return call("apply_contract_to_tenant", { p_contract: contractId }, [...contractPaths(contractId), `${BASE}/espaces`], "Limites et dates appliquées à l’espace de formation.");
}

export async function prepareContractUpload(input: { name: string; size: number; type: string }) {
  await requireViewer();
  return signedPdfUpload("enterprise", input);
}

export async function attachContractDocument(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireViewer();
  const parsed = parseInput(z.object({ contract_id: uuidSchema, kind: z.enum(["draft", "signed", "supporting"], "Choisissez le type de document.") }), formData);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const { contract_id, kind } = parsed.data;
  const uploads = await verifyPdfUploads("enterprise", formData, "contracts", contract_id);
  if (!uploads.ok) return uploads.state;
  if (!uploads.documents.length) return { ok: false, fieldErrors: { documents: "Ajoutez un document PDF." } };
  const supabase = await createClient();
  for (const doc of uploads.documents) {
    const { error } = await supabase.rpc("add_contract_document", { p_contract: contract_id, p_kind: kind, p_path: doc.path, p_name: doc.name, p_size: doc.size });
    if (error) {
      await createAdminClient().storage.from("enterprise").remove(uploads.documents.map((d) => d.path));
      return { ok: false, message: errorMessage(error) };
    }
  }
  for (const p of contractPaths(contract_id)) revalidatePath(p);
  return { ok: true, message: "Document ajouté." };
}

export async function recordTenantUsage(tenantId: string, period: string): Promise<ActionState> {
  if (!uuidSchema.safeParse(tenantId).success || !/^\d{4}-\d{2}-01$/.test(period)) return { ok: false, message: messageFor("invalid_input") };
  return call("record_tenant_usage", { p_tenant: tenantId, p_period: period }, [`${BASE}/espaces/${tenantId}`, BASE], "Relevé d’utilisation enregistré.");
}

export async function reviewOverage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseInput(z.object({ id: uuidSchema, tenant_id: uuidSchema, note: z.string().trim().min(5, "Indiquez la suite donnée (5 caractères au moins).").max(1000) }), formData);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  return call("review_usage_overage", { p_record: parsed.data.id, p_note: parsed.data.note }, [`${BASE}/espaces/${parsed.data.tenant_id}`, BASE], "Dépassement examiné.");
}
