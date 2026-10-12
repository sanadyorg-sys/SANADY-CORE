"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { errorMessage, messageFor } from "@/lib/errors";
import { AGREEMENT_STATUS, CONTRIBUTION_STAGE, type AgreementStatus, type ContributionStage } from "@/lib/partnerships";
import { agreementSchema, contributionSchema, deliverySchema } from "@/lib/partnerships-schema";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";
import { optionalText, parseInput, uuidSchema } from "@/lib/validation";
import { requireViewer, staffRole } from "@/server/auth";
import { signedPdfUpload, verifyPdfUploads } from "@/server/pdf-upload";

/** Partnership phase 4: agreements, contributions, milestones. Every rule is in the database. */

const BASE = "/admin/partenariats";

/** Partnership staff or an approver (the database re-checks every call). */
async function requirePartnershipActor() {
  const viewer = await requireViewer();
  const role = staffRole(viewer);
  if (role === "admin" || role === "partners") return viewer;
  const { data } = await (await createClient()).from("partnership_signatories").select("id").eq("user_id", viewer.id).is("revoked_at", null).maybeSingle();
  if (!data) redirect("/mon-espace");
  return viewer;
}

async function call(fn: string, args: Record<string, unknown>, paths: string[], success: string): Promise<ActionState> {
  await requirePartnershipActor();
  const { error } = await (await createClient()).rpc(fn, args);
  if (error) return { ok: false, message: errorMessage(error) };
  for (const p of paths) revalidatePath(p);
  return { ok: true, message: success };
}
const agreementPaths = (id: string, org?: string) => [`${BASE}/conventions`, `${BASE}/conventions/${id}`, BASE, ...(org ? [`${BASE}/organisations/${org}`] : [])];
const contributionPaths = (id: string, org?: string) => [`${BASE}/contributions`, `${BASE}/contributions/${id}`, BASE, ...(org ? [`${BASE}/organisations/${org}`] : [])];

/* ─── Agreements ────────────────────────────────────────────────────────── */

export async function saveAgreement(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePartnershipActor();
  const id = String(formData.get("id") ?? "");
  const org = uuidSchema.safeParse(formData.get("organization_id"));
  if (!org.success) return { ok: false, message: messageFor("not_found") };
  const parsed = parseInput(agreementSchema, formData);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors, message: "Certaines informations sont à compléter." };
  const { data, error } = await (await createClient()).rpc("save_partnership_agreement", { p_id: id || null, p_org: org.data, p: parsed.data });
  if (error) return { ok: false, message: errorMessage(error) };
  for (const p of agreementPaths((data as string) ?? id, org.data)) revalidatePath(p);
  if (!id) redirect(`${BASE}/conventions/${data as string}`);
  return { ok: true, message: "Convention enregistrée." };
}

export async function setAgreementStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseInput(
    z.object({
      id: uuidSchema,
      status: z.enum(Object.keys(AGREEMENT_STATUS) as [AgreementStatus], "Choisissez une action."),
      signed_on: z.union([z.iso.date("Date invalide."), z.literal("")]).optional(),
      note: optionalText(1000),
    }),
    formData,
  );
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const { id, status, signed_on, note } = parsed.data;
  if (status === "signed" && !signed_on) return { ok: false, fieldErrors: { signed_on: "Indiquez la date de signature." } };
  return call("set_agreement_status", { p_agreement: id, p_status: status, p: { signed_on: signed_on ?? "", note: note ?? "" } }, agreementPaths(id), `Statut « ${AGREEMENT_STATUS[status].label} » enregistré.`);
}

export async function saveMilestone(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseInput(
    z.object({
      agreement_id: uuidSchema,
      title: z.string().trim().min(2, "Décrivez l’étape.").max(200),
      due_on: z.iso.date("Date requise."),
      note: optionalText(1000),
    }),
    formData,
  );
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const d = parsed.data;
  return call("save_partnership_milestone", { p_id: null, p_agreement: d.agreement_id, p_title: d.title, p_due_on: d.due_on, p_note: d.note ?? null }, agreementPaths(d.agreement_id), "Étape ajoutée.");
}

export async function setMilestoneDone(milestoneId: string, done: boolean, agreementId: string): Promise<ActionState> {
  if (!uuidSchema.safeParse(milestoneId).success) return { ok: false, message: messageFor("not_found") };
  return call("set_partnership_milestone_done", { p_id: milestoneId, p_done: done }, agreementPaths(agreementId), done ? "Étape réalisée." : "Étape rouverte.");
}

/* ─── Contributions ─────────────────────────────────────────────────────── */

export async function saveContribution(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePartnershipActor();
  const id = String(formData.get("id") ?? "");
  const org = uuidSchema.safeParse(formData.get("organization_id"));
  if (!org.success) return { ok: false, message: messageFor("not_found") };
  const parsed = parseInput(contributionSchema, formData);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors, message: "Certaines informations sont à compléter." };
  const { data, error } = await (await createClient()).rpc("save_partnership_contribution", { p_id: id || null, p_org: org.data, p: parsed.data });
  if (error) return { ok: false, message: errorMessage(error) };
  for (const p of contributionPaths((data as string) ?? id, org.data)) revalidatePath(p);
  if (!id) redirect(`${BASE}/contributions/${data as string}`);
  return { ok: true, message: "Contribution enregistrée." };
}

export async function setContributionStage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseInput(
    z.object({ id: uuidSchema, stage: z.enum(Object.keys(CONTRIBUTION_STAGE) as [ContributionStage], "Choisissez une action."), note: optionalText(1000) }),
    formData,
  );
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const delivery = parseInput(deliverySchema, formData);
  if (!delivery.ok) return { ok: false, fieldErrors: delivery.fieldErrors };
  const { id, stage, note } = parsed.data;
  return call(
    "set_contribution_stage",
    { p_contribution: id, p_stage: stage, p: { ...delivery.data, note: note ?? "" } },
    contributionPaths(id),
    `Étape « ${CONTRIBUTION_STAGE[stage].label} » enregistrée.`,
  );
}

/* ─── Documents (PDF, private storage) ─────────────────────────────────── */

export async function prepareTeamUpload(input: { name: string; size: number; type: string }) {
  await requirePartnershipActor();
  return signedPdfUpload("partnerships", input);
}

/** Verifies the uploaded PDFs (real type, size) and attaches them to an agreement or a contribution. */
export async function attachDocuments(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePartnershipActor();
  const parsed = parseInput(
    z.object({
      target: z.enum(["agreement", "contribution"]),
      target_id: uuidSchema,
      kind: z.enum(["draft", "signed", "supporting", "evidence"], "Choisissez le type de document."),
    }),
    formData,
  );
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const { target, target_id, kind } = parsed.data;
  const folder = target === "agreement" ? "agreements" : "contributions";
  const uploads = await verifyPdfUploads("partnerships", formData, folder, target_id);
  if (!uploads.ok) return uploads.state;
  if (!uploads.documents.length) return { ok: false, fieldErrors: { documents: "Ajoutez un document PDF." } };

  const supabase = await createClient();
  for (const doc of uploads.documents) {
    const { error } = await supabase.rpc("add_partnership_document", {
      p_agreement: target === "agreement" ? target_id : null,
      p_contribution: target === "contribution" ? target_id : null,
      p_kind: kind,
      p_path: doc.path,
      p_name: doc.name,
      p_size: doc.size,
    });
    if (error) {
      // Refused by the database (role, status): the verified file is removed.
      await createAdminClient().storage.from("partnerships").remove(uploads.documents.map((d) => d.path));
      return { ok: false, message: errorMessage(error) };
    }
  }
  for (const p of target === "agreement" ? agreementPaths(target_id) : contributionPaths(target_id)) revalidatePath(p);
  return { ok: true, message: uploads.documents.length > 1 ? "Documents ajoutés." : "Document ajouté." };
}

export async function deleteDocument(documentId: string, target: "agreement" | "contribution", targetId: string): Promise<ActionState> {
  await requirePartnershipActor();
  if (!uuidSchema.safeParse(documentId).success) return { ok: false, message: messageFor("not_found") };
  const { data, error } = await (await createClient()).rpc("delete_partnership_document", { p_id: documentId });
  if (error) return { ok: false, message: errorMessage(error) };
  if (data) await createAdminClient().storage.from("partnerships").remove([data as string]);
  for (const p of target === "agreement" ? agreementPaths(targetId) : contributionPaths(targetId)) revalidatePath(p);
  return { ok: true, message: "Document supprimé." };
}
