"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ENTERPRISE_PIPELINE, ENTERPRISE_SERVICES, PROPOSAL_STATUS, REQUEST_STATUS, type EnterpriseStage, type ProposalStatus, type RequestStatus } from "@/lib/enterprise";
import { enterpriseRequestSchema, lineSchema, proposalSchema, tenantSchema } from "@/lib/enterprise-schema";
import { errorMessage, messageFor } from "@/lib/errors";
import { ORG_TYPES } from "@/lib/partnerships";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";
import { createInvitationToken } from "@/lib/tokens";
import { checkboxSchema, emailSchema, optionalText, parseInput, uuidSchema } from "@/lib/validation";
import { requireEnterpriseStaff } from "@/server/auth";
import { deliverInvitation } from "@/server/invitation-delivery";
import { sendEmail } from "@/server/email";
import { signedPdfUpload, verifyPdfUploads } from "@/server/pdf-upload";
import { clientIp, rateLimit } from "@/server/rate-limit";

/* ─── Public: enterprise request (E1) ──────────────────────────────────── */

export async function prepareEnterpriseUpload(input: { name: string; size: number; type: string }) {
  return signedPdfUpload("enterprise", input);
}

export async function submitEnterpriseRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (String(formData.get("site_web") ?? "").trim() !== "") return { ok: true, data: { reference: null } };

  const parsed = parseInput(
    enterpriseRequestSchema.extend({
      consent: checkboxSchema.refine(Boolean, "Veuillez accepter le traitement de vos données pour envoyer la demande."),
    }),
    formData,
  );
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors, message: "Certaines informations sont à compléter." };
  const d = parsed.data;

  const ip = await clientIp();
  if (!(await rateLimit(`enterprise:${ip}`, 5, 60 * 60)) || !(await rateLimit(`enterprise:${d.contact_email}`, 3, 24 * 60 * 60))) {
    return { ok: false, message: messageFor("rate_limited") };
  }

  const id = randomUUID();
  const uploads = await verifyPdfUploads("enterprise", formData, "requests", id);
  if (!uploads.ok) return uploads.state;

  const { data: reference, error } = await createAdminClient().rpc("submit_enterprise_request", {
    p_id: id,
    p: { ...d, consent: undefined },
    p_documents: uploads.documents,
  });
  if (error) {
    console.error("[enterprise] submit", error.message);
    return { ok: false, message: "La demande n’a pas pu être enregistrée. Réessayez dans quelques minutes." };
  }
  await notify(String(reference), d).catch((e) => console.error("[enterprise] notify", e));
  revalidatePath("/admin/partenariats/entreprises");
  return { ok: true, data: { reference: String(reference) } };
}

async function notify(reference: string, d: z.output<typeof enterpriseRequestSchema>) {
  const service = ENTERPRISE_SERVICES[d.service].label;
  const ack = await sendEmail({
    to: d.contact_email,
    subject: `Demande reçue — ${reference}`,
    text: `Bonjour ${d.contact_name},\n\nLa Fondation Sanady a bien reçu la demande de ${d.org_name} (référence ${reference}, ${service}). Ce service est en projet : l’équipe étudiera votre demande et reviendra vers vous, sans engagement de part et d’autre.\n\nFondation Sanady — contact@sanady.org`,
    html: `<p>Bonjour ${esc(d.contact_name)},</p><p>La Fondation Sanady a bien reçu la demande de <strong>${esc(d.org_name)}</strong> (référence <strong>${reference}</strong>, ${esc(service)}).</p><p>Ce service est en projet : l’équipe étudiera votre demande et reviendra vers vous, sans engagement de part et d’autre.</p><p>Fondation Sanady — contact@sanady.org</p>`,
  });
  if (ack.notConfigured) return;
  const { data } = await createAdminClient()
    .from("platform_roles")
    .select("profile:profiles!platform_roles_user_id_fkey(email, status)")
    .in("role", ["sanady_admin", "enterprise_manager"]);
  const emails = ((data ?? []) as unknown as Array<{ profile: { email: string; status: string } | null }>)
    .filter((r) => r.profile?.status === "active")
    .map((r) => r.profile!.email);
  for (const to of new Set(emails)) {
    await sendEmail({
      to,
      subject: `Nouvelle demande entreprise — ${reference}`,
      text: `Une nouvelle demande entreprise (${reference}, ${service}) est arrivée. Consultez-la dans l’administration SANADY, rubrique SANADY Enterprise.`,
      html: `<p>Une nouvelle demande entreprise (<strong>${reference}</strong>, ${esc(service)}) est arrivée.</p><p>Consultez-la dans l’administration SANADY, rubrique SANADY Enterprise.</p>`,
    });
  }
}
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ─── Enterprise team (E2) ──────────────────────────────────────────────── */

const BASE = "/admin/partenariats/entreprises";

async function call(fn: string, args: Record<string, unknown>, paths: string[], success: string): Promise<ActionState> {
  await requireEnterpriseStaff();
  const { error } = await (await createClient()).rpc(fn, args);
  if (error) return { ok: false, message: errorMessage(error) };
  for (const p of paths) revalidatePath(p);
  return { ok: true, message: success };
}

export async function setRequestStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseInput(z.object({ id: uuidSchema, status: z.enum(Object.keys(REQUEST_STATUS) as [RequestStatus]), note: optionalText(1000) }), formData);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const { id, status, note } = parsed.data;
  return call("set_enterprise_request_status", { p_request: id, p_status: status, p_note: note ?? null }, [BASE, `${BASE}/demandes/${id}`], "Statut mis à jour.");
}

export async function createClientFromRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireEnterpriseStaff();
  const parsed = parseInput(z.object({ id: uuidSchema, organization_id: z.union([uuidSchema, z.literal("")]).optional() }), formData);
  if (!parsed.ok) return { ok: false, message: messageFor("not_found") };
  const { data, error } = await (await createClient()).rpc("create_enterprise_client", { p_request: parsed.data.id, p_organization: parsed.data.organization_id || null });
  if (error) return { ok: false, message: errorMessage(error) };
  revalidatePath(BASE);
  redirect(`${BASE}/clients/${data as string}`);
}

export async function saveClient(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireEnterpriseStaff();
  const parsed = parseInput(
    z.object({
      id: z.union([uuidSchema, z.literal("")]).optional(),
      name: z.string().trim().min(2, "Veuillez saisir le nom de l’organisation.").max(200).optional(),
      org_type: z.enum(Object.keys(ORG_TYPES) as [keyof typeof ORG_TYPES]).optional(),
      country: optionalText(80),
      city: optionalText(100),
      website: optionalText(300),
      sector: optionalText(150),
      employee_count: z.union([z.enum(["1-49", "50-249", "250-999", "1000+"]), z.literal("")]).optional(),
      manager_id: z.union([uuidSchema, z.literal("")]).optional(),
    }),
    formData,
  );
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const { id, ...p } = parsed.data;
  if (!id && (!p.name || !p.org_type)) {
    const fieldErrors: Record<string, string> = {};
    if (!p.name) fieldErrors.name = "Veuillez saisir le nom de l’organisation.";
    if (!p.org_type) fieldErrors.org_type = "Choisissez un type.";
    return { ok: false, fieldErrors };
  }
  const services = formData.getAll("services").map(String).filter((s) => s in ENTERPRISE_SERVICES);
  const { data, error } = await (await createClient()).rpc("save_enterprise_client", { p_org: id || null, p: { ...p, services } });
  if (error) return { ok: false, message: errorMessage(error) };
  revalidatePath(`${BASE}/clients`);
  if (!id) redirect(`${BASE}/clients/${data as string}`);
  revalidatePath(`${BASE}/clients/${id}`);
  return { ok: true, message: "Fiche enregistrée." };
}

export async function setClientStage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseInput(z.object({ id: uuidSchema, status: z.enum(Object.keys(ENTERPRISE_PIPELINE) as [EnterpriseStage]), note: optionalText(1000) }), formData);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const { id, status, note } = parsed.data;
  return call("set_enterprise_status", { p_org: id, p_status: status, p_note: note ?? null }, [`${BASE}/clients`, `${BASE}/clients/${id}`], `Étape « ${ENTERPRISE_PIPELINE[status]} » enregistrée.`);
}

export async function saveProposal(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireEnterpriseStaff();
  const id = String(formData.get("id") ?? "");
  const org = String(formData.get("organization_id") ?? "");
  const parsed = parseInput(proposalSchema, formData);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const request = String(formData.get("request_id") ?? "");
  const { data, error } = await (await createClient()).rpc("save_enterprise_proposal", {
    p_id: id || null,
    p_org: org || null,
    p: { ...parsed.data, request_id: request || null },
  });
  if (error) return { ok: false, message: errorMessage(error) };
  revalidatePath(`${BASE}/propositions`);
  if (!id) redirect(`${BASE}/propositions/${data as string}`);
  revalidatePath(`${BASE}/propositions/${id}`);
  return { ok: true, message: "Proposition enregistrée." };
}

export async function saveLine(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const proposal = String(formData.get("proposal_id") ?? "");
  if (!uuidSchema.safeParse(proposal).success) return { ok: false, message: messageFor("not_found") };
  const parsed = parseInput(lineSchema, formData);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  return call("save_proposal_line", { p_id: null, p_proposal: proposal, p: parsed.data }, [`${BASE}/propositions/${proposal}`], "Ligne ajoutée.");
}

export async function deleteLine(lineId: string, proposalId: string): Promise<ActionState> {
  return call("delete_proposal_line", { p_id: lineId }, [`${BASE}/propositions/${proposalId}`], "Ligne supprimée.");
}

export async function setProposalStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseInput(z.object({ id: uuidSchema, status: z.enum(Object.keys(PROPOSAL_STATUS) as [ProposalStatus]), note: optionalText(1000) }), formData);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const { id, status, note } = parsed.data;
  return call("set_proposal_status", { p_proposal: id, p_status: status, p_note: note ?? null }, [`${BASE}/propositions`, `${BASE}/propositions/${id}`], `Statut « ${PROPOSAL_STATUS[status].label} » enregistré.`);
}

export async function addEnterpriseNote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseInput(
    z.object({
      organization_id: z.union([uuidSchema, z.literal("")]).optional(),
      request_id: z.union([uuidSchema, z.literal("")]).optional(),
      proposal_id: z.union([uuidSchema, z.literal("")]).optional(),
      body: z.string().trim().min(1, "Écrivez la note.").max(4000),
    }),
    formData,
  );
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const { organization_id: o, request_id: r, proposal_id: p, body } = parsed.data;
  const path = o ? `${BASE}/clients/${o}` : r ? `${BASE}/demandes/${r}` : `${BASE}/propositions/${p}`;
  return call("add_enterprise_note", { p_org: o || null, p_request: r || null, p_proposal: p || null, p_body: body }, [path], "Note ajoutée.");
}

export async function saveEnterpriseTask(_prev: ActionState, formData: FormData): Promise<ActionState> {
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
    "save_enterprise_task",
    { p_org: d.organization_id, p_title: d.title, p_due_on: d.due_on || null, p_assigned_to: d.assigned_to || null },
    [`${BASE}/clients/${d.organization_id}`, BASE],
    "Tâche ajoutée.",
  );
}

export async function setEnterpriseTaskDone(taskId: string, done: boolean, organizationId: string): Promise<ActionState> {
  return call("set_enterprise_task_done", { p_id: taskId, p_done: done }, [`${BASE}/clients/${organizationId}`, BASE], done ? "Tâche terminée." : "Tâche rouverte.");
}

/** Contacts are shared with the partnership record (same table, same function). */
export async function saveEnterpriseContact(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseInput(
    z.object({
      organization_id: uuidSchema,
      full_name: z.string().trim().min(2, "Veuillez saisir le nom.").max(150),
      job_title: optionalText(150),
      email: z.union([z.email("Adresse e-mail invalide."), z.literal("")]).optional(),
      phone: optionalText(40),
      is_primary: checkboxSchema,
    }),
    formData,
  );
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const { organization_id, ...p } = parsed.data;
  return call("save_partner_contact", { p_id: null, p_org: organization_id, p }, [`${BASE}/clients/${organization_id}`], "Contact enregistré.");
}

/* ─── Phase E3: company learning spaces ────────────────────────────────── */

const SPACES = `${BASE}/espaces`;
const spacePaths = (id: string, organizationId?: string) =>
  [SPACES, `${SPACES}/${id}`, ...(organizationId ? [`${BASE}/clients/${organizationId}`] : [])];

/** Request a workspace (contract signed) or update its configuration. */
export async function saveTenant(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireEnterpriseStaff();
  const id = String(formData.get("id") ?? "");
  const organizationId = uuidSchema.safeParse(formData.get("organization_id"));
  if (!organizationId.success) return { ok: false, message: messageFor("not_found") };
  const parsed = parseInput(tenantSchema, formData);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors, message: "Certaines informations sont à compléter." };
  const { data, error } = await (await createClient()).rpc("save_enterprise_tenant", {
    p_id: id || null,
    p_org: organizationId.data,
    p: parsed.data,
  });
  if (error) return { ok: false, message: errorMessage(error) };
  for (const path of spacePaths(data as string, organizationId.data)) revalidatePath(path);
  if (!id) redirect(`${SPACES}/${data as string}`);
  return { ok: true, message: "Configuration enregistrée." };
}

export async function authorizeTenant(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseInput(z.object({ id: uuidSchema, decision: z.enum(["authorize", "refuse"]), note: optionalText(1000) }), formData);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const { id, decision, note } = parsed.data;
  return call(
    "authorize_enterprise_tenant",
    { p_tenant: id, p_authorize: decision === "authorize", p_note: note ?? null },
    spacePaths(id),
    decision === "authorize" ? "Création de l’espace autorisée." : "Demande d’espace refusée.",
  );
}

export async function generateWorkspace(tenantId: string): Promise<ActionState> {
  if (!uuidSchema.safeParse(tenantId).success) return { ok: false, message: messageFor("not_found") };
  return call("generate_enterprise_workspace", { p_tenant: tenantId }, spacePaths(tenantId), "Espace généré : invitez maintenant l’administrateur de l’entreprise.");
}

export async function confirmTenantSecurity(tenantId: string): Promise<ActionState> {
  if (!uuidSchema.safeParse(tenantId).success) return { ok: false, message: messageFor("not_found") };
  return call("confirm_tenant_security", { p_tenant: tenantId }, spacePaths(tenantId), "Contrôles de sécurité enregistrés.");
}

export async function authorizeTenantExport(tenantId: string): Promise<ActionState> {
  if (!uuidSchema.safeParse(tenantId).success) return { ok: false, message: messageFor("not_found") };
  return call("authorize_tenant_export", { p_tenant: tenantId }, spacePaths(tenantId), "Export des données autorisé.");
}

export async function scheduleTenantDeletion(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseInput(z.object({ id: uuidSchema, deletion_due_on: z.iso.date("Date invalide.") }), formData);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  return call("schedule_tenant_deletion", { p_tenant: parsed.data.id, p_date: parsed.data.deletion_due_on }, spacePaths(parsed.data.id), "Date de suppression enregistrée.");
}

const TENANT_ACTIONS = { active: "Espace activé.", suspended: "Espace suspendu.", offboarding: "Fin de contrat enregistrée.", closed: "Espace fermé." } as const;

export async function setTenantStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseInput(
    z.object({ id: uuidSchema, status: z.enum(["active", "suspended", "offboarding", "closed"], "Choisissez une action."), note: optionalText(2000) }),
    formData,
  );
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const { id, status, note } = parsed.data;
  if (status === "offboarding" && !note) return { ok: false, fieldErrors: { note: "Indiquez la date et le motif de la fin du contrat." } };
  return call("set_tenant_status", { p_tenant: id, p_status: status, p: { note: note ?? "" } }, spacePaths(id), TENANT_ACTIONS[status]);
}

/** Step 4: invites the company administrator (the e-mail, or a link to pass on). */
export async function inviteTenantAdmin(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireEnterpriseStaff();
  const parsed = parseInput(z.object({ id: uuidSchema, email: emailSchema }), formData);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const supabase = await createClient();
  const { data: tenant } = await supabase.from("enterprise_tenants").select("institution_id, display_name").eq("id", parsed.data.id).maybeSingle();
  const t = tenant as { institution_id: string | null; display_name: string } | null;
  const { token, hash } = createInvitationToken();
  const { data: invitationId, error } = await supabase.rpc("invite_tenant_admin", { p_tenant: parsed.data.id, p_email: parsed.data.email, p_token_hash: hash });
  if (error) return { ok: false, message: errorMessage(error) };
  const { data: settings } = await supabase.from("platform_settings").select("invitation_validity_days").maybeSingle();
  const days = (settings as { invitation_validity_days: number } | null)?.invitation_validity_days ?? 14;
  const result = await deliverInvitation({
    invitationId: invitationId as string,
    kind: "institution_admin",
    email: parsed.data.email,
    token,
    institutionId: t?.institution_id ?? null,
    known: { institutionName: t?.display_name ?? "votre entreprise", expiresAt: new Date(Date.now() + days * 86400000).toISOString() },
  });
  for (const path of spacePaths(parsed.data.id)) revalidatePath(path);
  return result;
}
