"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { errorMessage, messageFor } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createInvitationToken } from "@/lib/tokens";
import type { ActionState, InstitutionType } from "@/lib/types";
import { emailSchema, optionalText, parseInput, uuidSchema } from "@/lib/validation";
import { requireSanadyAdmin } from "@/server/auth";
import { invitationEmail, invitationLink, sendEmail } from "@/server/email";

const INSTITUTION_TYPES = [
  "ecole_primaire",
  "college",
  "lycee",
  "groupe_scolaire",
  "etablissement_superieur",
  "centre_formation",
  "direction_provinciale",
  "association",
  "autre",
] as const satisfies readonly InstitutionType[];

const institutionFields = {
  name: z.string().trim().min(2, "Nom trop court.").max(200),
  identifier: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9][A-Z0-9-]{1,39}$/, "Majuscules, chiffres et tirets uniquement (2 à 40 caractères), par ex. LYC-CASA-012."),
  type: z.enum(INSTITUTION_TYPES, "Type d’établissement invalide."),
  city: optionalText(120),
  contact_email: emailSchema,
  contact_phone: optionalText(30),
};

/* ─── Institutions ─────────────────────────────────────────────────────── */

export async function createInstitution(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSanadyAdmin();
  const parsed = parseInput(
    z.object({ ...institutionFields, admin_email: z.union([emailSchema, z.literal("")]).optional() }),
    formData,
  );
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const { admin_email, ...fields } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("institutions")
    .insert({ ...fields, city: fields.city ?? null, contact_phone: fields.contact_phone ?? null })
    .select("id, name")
    .single();
  if (error) {
    return error.code === "23505"
      ? { ok: false, fieldErrors: { identifier: "Cet identifiant est déjà utilisé." } }
      : { ok: false, message: errorMessage(error) };
  }
  const institution = data as { id: string; name: string };

  const href = `/admin/etablissements/${institution.id}`;
  revalidatePath("/admin/etablissements");
  if (!admin_email) return { ok: true, message: "Établissement créé.", data: { href } };

  const { token, hash } = createInvitationToken();
  const { data: invitationId, error: invError } = await supabase.rpc("create_invitation", {
    p_kind: "institution_admin",
    p_email: admin_email,
    p_institution: institution.id,
    p_token_hash: hash,
  });
  if (invError) {
    return { ok: true, message: `Établissement créé, mais l’invitation n’a pas pu être émise : ${errorMessage(invError)}`, data: { href } };
  }
  const { data: inv } = await supabase.from("invitations").select("expires_at").eq("id", invitationId as string).single();
  const mail = invitationEmail({
    kind: "institution_admin",
    token,
    institutionName: institution.name,
    expiresAt: (inv as { expires_at: string }).expires_at,
  });
  const sent = await sendEmail({ to: admin_email, subject: mail.subject, html: mail.html, text: mail.text });
  if (sent.sent) {
    await createAdminClient().rpc("mark_invitation_sent", { p_invitation: invitationId as string });
    return { ok: true, message: `Établissement créé. Invitation envoyée à ${admin_email}.`, data: { href } };
  }
  // The link is returned to the form and displayed once — never put in a URL.
  return {
    ok: true,
    message: "Établissement créé. L’e-mail d’invitation n’a pas été envoyé : transmettez le lien ci-dessous à l’administrateur désigné.",
    data: { href, link: invitationLink(token) },
  };
}

export async function updateInstitution(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSanadyAdmin();
  const parsed = parseInput(z.object({ id: uuidSchema, ...institutionFields }), formData);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const { id, ...fields } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("institutions")
    .update({ ...fields, city: fields.city ?? null, contact_phone: fields.contact_phone ?? null })
    .eq("id", id);
  if (error) {
    return error.code === "23505"
      ? { ok: false, fieldErrors: { identifier: "Cet identifiant est déjà utilisé." } }
      : { ok: false, message: errorMessage(error) };
  }
  revalidatePath(`/admin/etablissements/${id}`);
  revalidatePath("/admin/etablissements");
  return { ok: true, message: "Établissement enregistré." };
}

export async function setInstitutionStatus(institutionId: string, status: "active" | "suspended"): Promise<ActionState> {
  await requireSanadyAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("institutions").update({ status }).eq("id", institutionId);
  if (error) return { ok: false, message: errorMessage(error) };
  revalidatePath(`/admin/etablissements/${institutionId}`);
  revalidatePath("/admin/etablissements");
  return {
    ok: true,
    message:
      status === "suspended"
        ? "Établissement suspendu : son espace et les accès par affectation sont désactivés."
        : "Établissement réactivé.",
  };
}

/* ─── Accounts ─────────────────────────────────────────────────────────── */

export async function setUserStatus(userId: string, status: "active" | "suspended"): Promise<ActionState> {
  const viewer = await requireSanadyAdmin();
  if (userId === viewer.id) return { ok: false, message: messageFor("cannot_change_own_status") };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_user_status", { p_user: userId, p_status: status });
  if (error) return { ok: false, message: errorMessage(error) };

  // Also block sign-in at the authentication layer (and end sessions on refresh).
  const { error: banError } = await createAdminClient().auth.admin.updateUserById(userId, {
    ban_duration: status === "suspended" ? "876000h" : "none",
  });
  if (banError) console.error("[admin] ban update failed", banError.code);

  revalidatePath(`/admin/enseignants/${userId}`);
  revalidatePath("/admin/enseignants");
  return { ok: true, message: status === "suspended" ? "Compte suspendu." : "Compte réactivé." };
}

export async function removePlatformAdmin(userId: string): Promise<ActionState> {
  const viewer = await requireSanadyAdmin();
  if (userId === viewer.id) return { ok: false, message: "Vous ne pouvez pas retirer votre propre rôle." };
  const supabase = await createClient();
  const { error } = await supabase.from("platform_roles").delete().eq("user_id", userId);
  if (error) return { ok: false, message: errorMessage(error) };
  revalidatePath("/admin/administrateurs");
  return { ok: true, message: "Rôle d’administrateur retiré." };
}

/* ─── Assessment & certificates ────────────────────────────────────────── */

export async function resetQuizAttempts(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSanadyAdmin();
  const parsed = parseInput(
    z.object({
      quiz_id: uuidSchema,
      user_id: uuidSchema,
      reason: z.string().trim().min(5, "Indiquez un motif (5 caractères minimum).").max(500),
    }),
    formData,
  );
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reset_quiz_attempts", {
    p_quiz: parsed.data.quiz_id,
    p_user: parsed.data.user_id,
    p_reason: parsed.data.reason,
  });
  if (error) return { ok: false, message: errorMessage(error) };
  revalidatePath("/admin/suivi");
  revalidatePath(`/admin/enseignants/${parsed.data.user_id}`);
  return { ok: true, message: `Tentatives réinitialisées (${Number(data)} annulée${Number(data) > 1 ? "s" : ""}). L’enseignant dispose de nouveau de trois tentatives.` };
}

export async function revokeCertificate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSanadyAdmin();
  const parsed = parseInput(
    z.object({ certificate_id: uuidSchema, reason: z.string().trim().min(5, "Indiquez un motif (5 caractères minimum).").max(500) }),
    formData,
  );
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_certificate", { p_certificate: parsed.data.certificate_id, p_reason: parsed.data.reason });
  if (error) return { ok: false, message: errorMessage(error) };
  revalidatePath("/admin/certificats");
  return { ok: true, message: "Certificat révoqué. La page de vérification l’indique désormais." };
}

/* ─── Settings ─────────────────────────────────────────────────────────── */

export async function updateSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireSanadyAdmin();
  const parsed = parseInput(
    z.object({
      inactivity_threshold_days: z.coerce.number().int().min(3, "Minimum 3 jours.").max(180, "Maximum 180 jours."),
      invitation_validity_days: z.coerce.number().int().min(1, "Minimum 1 jour.").max(30, "Maximum 30 jours."),
      certificate_issuer_name: z.string().trim().min(2, "Nom trop court.").max(120),
      certificate_signatory_name: optionalText(120),
      certificate_signatory_title: optionalText(120),
      support_email: z.union([emailSchema, z.literal("")]),
    }),
    formData,
  );
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("platform_settings")
    .update({
      inactivity_threshold_days: d.inactivity_threshold_days,
      invitation_validity_days: d.invitation_validity_days,
      certificate_issuer_name: d.certificate_issuer_name,
      certificate_signatory_name: d.certificate_signatory_name ?? null,
      certificate_signatory_title: d.certificate_signatory_title ?? null,
      support_email: d.support_email || null,
      updated_by: viewer.id,
    })
    .eq("id", true);
  if (error) return { ok: false, message: errorMessage(error) };
  revalidatePath("/admin/parametres");
  return { ok: true, message: "Paramètres enregistrés." };
}
