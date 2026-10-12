"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { errorMessage, messageFor } from "@/lib/errors";
import {
  CONTRIBUTION_TYPES,
  DOCUMENT_MIME,
  INTERVENTION_FIELDS,
  isPdf,
  MAX_DOCUMENT_BYTES,
  MAX_DOCUMENTS,
  NEED_STATUS,
  OPPORTUNITY_STATUS,
  ORG_TYPES,
  PIPELINE,
  safeFileName,
  type NeedStatus,
  type OpportunityStatus,
} from "@/lib/partnerships";
import { applicationSchema, needSchema, opportunitySchema } from "@/lib/partnerships-schema";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";
import { checkboxSchema, emailSchema, optionalText, parseInput, uuidSchema } from "@/lib/validation";
import { requirePartnershipStaff } from "@/server/auth";
import { sendEmail } from "@/server/email";
import { clientIp, rateLimit } from "@/server/rate-limit";

const BUCKET = "partnerships";
/** incoming/<yyyymmddhh>-<uuid>/<name>.pdf — the hour lets old uploads be cleaned. */
const INCOMING = /^incoming\/(\d{10})-[0-9a-f-]{36}\/[A-Za-z0-9._-]{1,120}$/;

const hourStamp = (d = new Date()) => d.toISOString().slice(0, 13).replace(/\D/g, "");

/* ─── Public: single-use upload link for a PDF ─────────────────────────── */

export async function preparePartnershipUpload(input: { name: string; size: number; type: string }): Promise<
  { ok: true; path: string; token: string } | { ok: false; message: string }
> {
  const f = z
    .object({ name: z.string().min(1).max(200), size: z.number().int().min(1), type: z.string().max(100) })
    .safeParse(input);
  if (!f.success) return { ok: false, message: "Fichier invalide." };
  if (f.data.type !== DOCUMENT_MIME || !/\.pdf$/i.test(f.data.name)) return { ok: false, message: "Seuls les documents PDF sont acceptés." };
  if (f.data.size > MAX_DOCUMENT_BYTES) return { ok: false, message: "Le document dépasse 10 Mo." };

  const ip = await clientIp();
  if (!(await rateLimit(`partnership-upload:${ip}`, 12, 60 * 60))) return { ok: false, message: messageFor("rate_limited") };

  const storage = createAdminClient().storage.from(BUCKET);
  await cleanIncoming(storage).catch((e) => console.error("[partnerships] incoming cleanup", e));

  const name = safeFileName(f.data.name).replace(/(\.pdf)?$/i, ".pdf");
  const path = `incoming/${hourStamp()}-${randomUUID()}/${name}`;
  const { data, error } = await storage.createSignedUploadUrl(path);
  if (error || !data) {
    console.error("[partnerships] signed upload", error?.message);
    return { ok: false, message: "Le téléversement est indisponible. Réessayez dans quelques minutes." };
  }
  return { ok: true, path, token: data.token };
}

/** Deletes uploads never attached to an application (older than 24 h). */
async function cleanIncoming(storage: ReturnType<ReturnType<typeof createAdminClient>["storage"]["from"]>) {
  const limit = hourStamp(new Date(Date.now() - 24 * 3600 * 1000));
  const { data: folders } = await storage.list("incoming", { limit: 50, sortBy: { column: "name", order: "asc" } });
  const old = (folders ?? []).filter((f) => f.name.slice(0, 10) < limit).slice(0, 20);
  for (const folder of old) {
    const { data: files } = await storage.list(`incoming/${folder.name}`);
    if (files?.length) await storage.remove(files.map((x) => `incoming/${folder.name}/${x.name}`));
  }
}

/* ─── Public: submit an application ─────────────────────────────────────── */

const documentsSchema = z
  .array(z.object({ path: z.string().regex(INCOMING), name: z.string().min(1).max(200) }))
  .max(MAX_DOCUMENTS, `${MAX_DOCUMENTS} documents maximum.`);

export async function submitPartnershipApplication(_prev: ActionState, formData: FormData): Promise<ActionState> {
  // Bots fill every field, including this invisible one.
  if (String(formData.get("site_web") ?? "").trim() !== "") return { ok: true, data: { reference: null } };

  const parsed = parseInput(
    applicationSchema.extend({
      consent: checkboxSchema.refine(Boolean, "Veuillez accepter le traitement de vos données pour envoyer la candidature."),
    }),
    formData,
  );
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors, message: "Certaines informations sont à compléter." };
  const d = parsed.data;

  let documents: z.infer<typeof documentsSchema>;
  try {
    const raw = JSON.parse(String(formData.get("documents") ?? "[]"));
    const docs = documentsSchema.safeParse(raw);
    if (!docs.success) return { ok: false, message: "Les documents joints ne sont pas valides. Retirez-les et ajoutez-les à nouveau." };
    documents = docs.data;
  } catch {
    return { ok: false, message: "Les documents joints ne sont pas valides." };
  }

  const ip = await clientIp();
  if (!(await rateLimit(`partnership:${ip}`, 5, 60 * 60)) || !(await rateLimit(`partnership:${d.contact_email}`, 3, 24 * 60 * 60))) {
    return { ok: false, message: messageFor("rate_limited") };
  }

  // Verify each uploaded file (real PDF, size) and move it under the application.
  const id = randomUUID();
  const admin = createAdminClient();
  const storage = admin.storage.from(BUCKET);
  const verified: Array<{ path: string; name: string; mime: string; size: number }> = [];
  for (const doc of documents) {
    const { data: blob, error } = await storage.download(doc.path);
    if (error || !blob) return rejectDocument(doc.path, `Le document « ${doc.name} » est introuvable. Ajoutez-le à nouveau.`);
    const head = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
    if (blob.size > MAX_DOCUMENT_BYTES || !isPdf(head)) {
      await storage.remove([doc.path]);
      return rejectDocument(doc.path, `« ${doc.name} » n’est pas un document PDF valide : il a été retiré. Vous pouvez envoyer la candidature sans lui ou joindre un autre PDF.`);
    }
    const target = `applications/${id}/${doc.path.split("/").pop()}`;
    const moved = await storage.move(doc.path, target);
    if (moved.error) return { ok: false, message: "Les documents n’ont pas pu être enregistrés. Réessayez." };
    verified.push({ path: target, name: doc.name.slice(0, 200), mime: DOCUMENT_MIME, size: blob.size });
  }

  const { data: reference, error } = await admin.rpc("submit_partnership_application", {
    p_id: id,
    p: { ...d, consent: undefined },
    p_documents: verified,
  });
  if (error) {
    console.error("[partnerships] submit", error.message);
    return { ok: false, message: "La candidature n’a pas pu être enregistrée. Réessayez dans quelques minutes." };
  }

  await notify(String(reference), d).catch((e) => console.error("[partnerships] notify", e));
  revalidatePath("/admin/partenariats");
  return { ok: true, data: { reference: String(reference) } };
}

/** A refused document: the form removes it and goes back to the Documents step. */
function rejectDocument(path: string, message: string): ActionState {
  return { ok: false, message, fieldErrors: { documents: message }, data: { rejectedPath: path } };
}

/** Confirmation to the applicant and alert to the partnership team (when e-mail is configured). */
async function notify(reference: string, d: z.output<typeof applicationSchema>) {
  const field = INTERVENTION_FIELDS[d.intervention_field].name;
  const confirmation = await sendEmail({
    to: d.contact_email,
    subject: `Candidature de partenariat reçue — ${reference}`,
    text: `Bonjour ${d.contact_name},\n\nLa Fondation Sanady a bien reçu la candidature de partenariat de ${d.org_name} (référence ${reference}, domaine : ${field}).\nL’équipe partenariats l’étudiera et reviendra vers vous.\n\nFondation Sanady — contact@sanady.org`,
    html: `<p>Bonjour ${esc(d.contact_name)},</p><p>La Fondation Sanady a bien reçu la candidature de partenariat de <strong>${esc(d.org_name)}</strong> (référence <strong>${reference}</strong>, domaine : ${esc(field)}).</p><p>L’équipe partenariats l’étudiera et reviendra vers vous.</p><p>Fondation Sanady — contact@sanady.org</p>`,
  });
  if (confirmation.notConfigured) return;

  const { data } = await createAdminClient()
    .from("platform_roles")
    .select("profile:profiles!platform_roles_user_id_fkey(email, status)")
    .in("role", ["sanady_admin", "partnership_coordinator", "partnership_manager"]);
  const emails = ((data ?? []) as unknown as Array<{ profile: { email: string; status: string } | null }>)
    .filter((r) => r.profile?.status === "active")
    .map((r) => r.profile!.email);
  // No personal data in the alert: the team reads it in the administration.
  for (const to of new Set(emails)) {
    await sendEmail({
      to,
      subject: `Nouvelle candidature de partenariat — ${reference}`,
      text: `Une nouvelle candidature de partenariat (${reference}, domaine : ${field}) est arrivée. Consultez-la dans l’administration SANADY, rubrique Partenariats.`,
      html: `<p>Une nouvelle candidature de partenariat (<strong>${reference}</strong>, domaine : ${esc(field)}) est arrivée.</p><p>Consultez-la dans l’administration SANADY, rubrique Partenariats.</p>`,
    });
  }
}
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ─── Partnership team ──────────────────────────────────────────────────── */

async function call(fn: string, args: Record<string, unknown>, paths: string[], success: string): Promise<ActionState> {
  await requirePartnershipStaff();
  const { error } = await (await createClient()).rpc(fn, args);
  if (error) return { ok: false, message: errorMessage(error) };
  for (const p of paths) revalidatePath(p);
  return { ok: true, message: success };
}

const APP_STATUSES = ["under_review", "declined", "spam", "withdrawn"] as const;

export async function setApplicationStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseInput(
    z.object({ id: uuidSchema, status: z.enum(APP_STATUSES, "Statut invalide."), note: optionalText(1000) }),
    formData,
  );
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const { id, status, note } = parsed.data;
  return call("set_partnership_application_status", { p_app: id, p_status: status, p_note: note ?? null }, ["/admin/partenariats", `/admin/partenariats/candidatures/${id}`], "Statut mis à jour.");
}

export async function createPartnerFromApplication(applicationId: string): Promise<ActionState> {
  await requirePartnershipStaff();
  const id = uuidSchema.safeParse(applicationId);
  if (!id.success) return { ok: false, message: messageFor("not_found") };
  const { data, error } = await (await createClient()).rpc("create_partner_from_application", { p_app: id.data });
  if (error) return { ok: false, message: errorMessage(error) };
  revalidatePath("/admin/partenariats");
  redirect(`/admin/partenariats/organisations/${data as string}`);
}

const list = (formData: FormData, name: string) => formData.getAll(name).map(String);

export async function saveOrganization(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePartnershipStaff();
  const parsed = parseInput(
    z.object({
      id: z.union([uuidSchema, z.literal("")]).optional(),
      name: z.string().trim().min(2, "Veuillez saisir le nom de l’organisation.").max(200),
      org_type: z.enum(Object.keys(ORG_TYPES) as [keyof typeof ORG_TYPES], "Choisissez un type."),
      country: optionalText(80),
      city: optionalText(100),
      website: optionalText(300),
      sector: optionalText(150),
      description: optionalText(2000),
    }),
    formData,
  );
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const { id, ...fields } = parsed.data;
  const p = {
    ...fields,
    fields: list(formData, "fields").filter((f) => f in INTERVENTION_FIELDS),
    contributions: list(formData, "contributions").filter((c) => c in CONTRIBUTION_TYPES),
  };
  const { data, error } = await (await createClient()).rpc("save_partner_organization", { p_id: id || null, p });
  if (error) return { ok: false, message: errorMessage(error) };
  revalidatePath("/admin/partenariats/organisations");
  if (!id) redirect(`/admin/partenariats/organisations/${data as string}`);
  revalidatePath(`/admin/partenariats/organisations/${id}`);
  return { ok: true, message: "Fiche enregistrée." };
}

export async function setPartnerStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseInput(
    z.object({
      id: uuidSchema,
      status: z.enum(Object.keys(PIPELINE) as [keyof typeof PIPELINE], "Choisissez une étape."),
      note: optionalText(1000),
    }),
    formData,
  );
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const { id, status, note } = parsed.data;
  return call("set_partner_status", { p_org: id, p_status: status, p_note: note ?? null }, ["/admin/partenariats/organisations", `/admin/partenariats/organisations/${id}`], `Étape « ${PIPELINE[status]} » enregistrée.`);
}

export async function saveContact(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseInput(
    z.object({
      id: z.union([uuidSchema, z.literal("")]).optional(),
      organization_id: uuidSchema,
      full_name: z.string().trim().min(2, "Veuillez saisir le nom.").max(150),
      job_title: optionalText(150),
      email: z.union([emailSchema, z.literal("")]).optional(),
      phone: optionalText(40),
      is_primary: checkboxSchema,
    }),
    formData,
  );
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const { id, organization_id, ...p } = parsed.data;
  return call("save_partner_contact", { p_id: id || null, p_org: organization_id, p }, [`/admin/partenariats/organisations/${organization_id}`], "Contact enregistré.");
}

export async function deleteContact(contactId: string, organizationId: string): Promise<ActionState> {
  return call("delete_partner_contact", { p_id: contactId }, [`/admin/partenariats/organisations/${organizationId}`], "Contact supprimé.");
}

export async function addNote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseInput(
    z.object({
      application_id: z.union([uuidSchema, z.literal("")]).optional(),
      organization_id: z.union([uuidSchema, z.literal("")]).optional(),
      body: z.string().trim().min(1, "Écrivez la note.").max(4000, "4000 caractères maximum."),
    }),
    formData,
  );
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const { application_id, organization_id, body } = parsed.data;
  const path = application_id ? `/admin/partenariats/candidatures/${application_id}` : `/admin/partenariats/organisations/${organization_id}`;
  return call("add_partnership_note", { p_application: application_id || null, p_organization: organization_id || null, p_body: body }, [path], "Note ajoutée.");
}

export async function saveTask(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseInput(
    z.object({
      organization_id: uuidSchema,
      title: z.string().trim().min(2, "Décrivez la tâche.").max(200),
      due_on: z.union([z.iso.date("Date invalide."), z.literal("")]).optional(),
      assigned_to: z.union([uuidSchema, z.literal("")]).optional(),
    }),
    formData,
  );
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const d = parsed.data;
  return call(
    "save_partnership_task",
    { p_id: null, p_org: d.organization_id, p_title: d.title, p_due_on: d.due_on || null, p_assigned_to: d.assigned_to || null },
    [`/admin/partenariats/organisations/${d.organization_id}`, "/admin/partenariats"],
    "Tâche ajoutée.",
  );
}

export async function setTaskDone(taskId: string, done: boolean, organizationId: string): Promise<ActionState> {
  return call("set_partnership_task_done", { p_id: taskId, p_done: done }, [`/admin/partenariats/organisations/${organizationId}`, "/admin/partenariats"], done ? "Tâche terminée." : "Tâche rouverte.");
}

/* ─── Phase 3: educational needs and projects seeking partners ─────────── */

export async function saveNeed(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePartnershipStaff();
  const id = String(formData.get("id") ?? "");
  const parsed = parseInput(needSchema, formData);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors, message: "Certaines informations sont à compléter." };
  const { data, error } = await (await createClient()).rpc("save_educational_need", { p_id: id || null, p: parsed.data });
  if (error) return { ok: false, message: errorMessage(error) };
  revalidatePath("/admin/partenariats/besoins");
  if (!id) redirect(`/admin/partenariats/besoins/${data as string}`);
  revalidatePath(`/admin/partenariats/besoins/${id}`);
  return { ok: true, message: "Besoin enregistré." };
}

export async function setNeedStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseInput(
    z.object({ id: uuidSchema, status: z.enum(Object.keys(NEED_STATUS) as [NeedStatus], "Choisissez un statut."), note: optionalText(1000) }),
    formData,
  );
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const { id, status, note } = parsed.data;
  return call("set_need_status", { p_need: id, p_status: status, p_note: note ?? null }, ["/admin/partenariats/besoins", `/admin/partenariats/besoins/${id}`], `Statut « ${NEED_STATUS[status].label} » enregistré.`);
}

export async function createOpportunityFromNeed(needId: string): Promise<ActionState> {
  await requirePartnershipStaff();
  if (!uuidSchema.safeParse(needId).success) return { ok: false, message: messageFor("not_found") };
  const { data, error } = await (await createClient()).rpc("create_opportunity_from_need", { p_need: needId });
  if (error) return { ok: false, message: errorMessage(error) };
  revalidatePath("/admin/partenariats/opportunites");
  redirect(`/admin/partenariats/opportunites/${data as string}`);
}

export async function saveOpportunity(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePartnershipStaff();
  const id = String(formData.get("id") ?? "");
  const parsed = parseInput(opportunitySchema, formData);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors, message: "Certaines informations sont à compléter." };
  const contribution_types = list(formData, "contribution_types").filter((c) => c in CONTRIBUTION_TYPES);
  if (!contribution_types.length) return { ok: false, fieldErrors: { contribution_types: "Choisissez au moins un type de contribution." } };
  const { data, error } = await (await createClient()).rpc("save_partnership_opportunity", {
    p_id: id || null,
    p: { ...parsed.data, contribution_types },
  });
  if (error) return { ok: false, message: errorMessage(error) };
  revalidatePath("/admin/partenariats/opportunites");
  if (!id) redirect(`/admin/partenariats/opportunites/${data as string}`);
  revalidatePath(`/admin/partenariats/opportunites/${id}`);
  return { ok: true, message: "Projet enregistré." };
}

export async function setOpportunityStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseInput(
    z.object({ id: uuidSchema, status: z.enum(Object.keys(OPPORTUNITY_STATUS) as [OpportunityStatus], "Choisissez un statut."), note: optionalText(1000) }),
    formData,
  );
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const { id, status, note } = parsed.data;
  const result = await call(
    "set_opportunity_status",
    { p_opportunity: id, p_status: status, p_note: note ?? null },
    ["/admin/partenariats/opportunites", `/admin/partenariats/opportunites/${id}`, "/partenariats", "/partenariats/opportunites"],
    `Statut « ${OPPORTUNITY_STATUS[status].label} » enregistré.`,
  );
  return result;
}

export async function addTargetNote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseInput(
    z.object({
      need_id: z.union([uuidSchema, z.literal("")]).optional(),
      opportunity_id: z.union([uuidSchema, z.literal("")]).optional(),
      body: z.string().trim().min(1, "Écrivez la note.").max(4000, "4000 caractères maximum."),
    }),
    formData,
  );
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const { need_id, opportunity_id, body } = parsed.data;
  const path = need_id ? `/admin/partenariats/besoins/${need_id}` : `/admin/partenariats/opportunites/${opportunity_id}`;
  return call("add_partnership_target_note", { p_need: need_id || null, p_opportunity: opportunity_id || null, p_body: body }, [path], "Note ajoutée.");
}
