"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { errorMessage, messageFor } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createInvitationToken, hashToken } from "@/lib/tokens";
import type { ActionState, InvitationKind } from "@/lib/types";
import { checkboxSchema, emailSchema, nameSchema, parseInput, passwordSchema, uuidSchema } from "@/lib/validation";
import { getViewer, homeFor } from "@/server/auth";
import { invitationEmail, invitationLink, sendEmail } from "@/server/email";
import { clientIp, rateLimit } from "@/server/rate-limit";
import type { InvitationDescription } from "@/server/queries/invitations";

/* ─── Acceptance: new account ──────────────────────────────────────────── */

export async function acceptInvitationWithNewAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseInput(
    z
      .object({
        token: z.string().min(20).max(100),
        first_name: nameSchema("prénom"),
        last_name: nameSchema("nom"),
        password: passwordSchema,
        confirm: z.string(),
        consent: checkboxSchema,
        privacy: checkboxSchema.refine((v) => v, "Veuillez confirmer avoir pris connaissance de la notice."),
      })
      .refine((v) => v.password === v.confirm, { message: "Les mots de passe ne correspondent pas.", path: ["confirm"] }),
    formData,
  );
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const input = parsed.data;

  if (!(await rateLimit(`invite-accept:${await clientIp()}`, 10, 15 * 60))) {
    return { ok: false, message: messageFor("rate_limited") };
  }

  const admin = createAdminClient();
  const tokenHash = hashToken(input.token);
  const { data: description } = await admin.rpc("describe_invitation", { p_token_hash: tokenHash });
  const invitation = description as InvitationDescription | null;
  if (!invitation) return { ok: false, message: messageFor("invitation_not_found") };
  if (invitation.state !== "valid") return { ok: false, message: messageFor(`invitation_${invitation.state === "accepted" ? "already_accepted" : invitation.state}`) };
  if (invitation.account_exists) {
    return { ok: false, message: "Un compte existe déjà pour cette adresse. Connectez-vous pour accepter l’invitation." };
  }
  if (invitation.kind === "institution_teacher" && !input.consent) {
    return { ok: false, fieldErrors: { consent: messageFor("consent_required") } };
  }

  // The e-mail address is proven by possession of the token sent to it.
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: invitation.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { first_name: input.first_name, last_name: input.last_name },
  });
  if (createError || !created.user) {
    console.error("[invitation] createUser failed", createError?.code);
    return {
      ok: false,
      message:
        createError?.code === "email_exists"
          ? "Un compte existe déjà pour cette adresse. Connectez-vous pour accepter l’invitation."
          : createError?.code === "weak_password"
            ? "Ce mot de passe est trop faible ou figure dans une liste de mots de passe compromis. Choisissez-en un autre."
            : "Le compte n’a pas pu être créé. Veuillez réessayer.",
    };
  }

  const { error: acceptError } = await admin.rpc("accept_invitation", {
    p_token_hash: tokenHash,
    p_user: created.user.id,
    p_consent: input.consent,
  });
  if (acceptError) {
    // Compensate: never leave an account without a consumed invitation.
    await admin.auth.admin.deleteUser(created.user.id);
    return { ok: false, message: errorMessage(acceptError) };
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email: invitation.email, password: input.password });
  if (signInError) redirect("/connexion?motif=session");

  await supabase.rpc("complete_onboarding", {
    p_first_name: input.first_name,
    p_last_name: input.last_name,
    p_job_title: null,
    p_subject_area: null,
  });

  const viewer = await getViewer();
  redirect(viewer ? homeFor(viewer) : "/");
}

/* ─── Acceptance: existing, signed-in account ──────────────────────────── */

export async function acceptInvitationAsCurrentUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseInput(z.object({ token: z.string().min(20).max(100), consent: checkboxSchema }), formData);
  if (!parsed.ok) return { ok: false, message: messageFor("invitation_not_found") };

  const viewer = await getViewer();
  if (!viewer) redirect(`/connexion?suite=${encodeURIComponent(`/invitation/${parsed.data.token}`)}`);

  const admin = createAdminClient();
  const tokenHash = hashToken(parsed.data.token);
  const { data } = await admin.rpc("describe_invitation", { p_token_hash: tokenHash });
  const invitation = data as InvitationDescription | null;
  if (!invitation) return { ok: false, message: messageFor("invitation_not_found") };
  if (invitation.email !== viewer.email) return { ok: false, message: messageFor("invitation_email_mismatch") };
  if (invitation.kind === "institution_teacher" && !parsed.data.consent) {
    return { ok: false, fieldErrors: { consent: messageFor("consent_required") } };
  }

  const { error } = await admin.rpc("accept_invitation", {
    p_token_hash: tokenHash,
    p_user: viewer.id,
    p_consent: parsed.data.consent,
  });
  if (error) return { ok: false, message: errorMessage(error) };

  if (invitation.kind === "institution_admin" && invitation.institution_id) {
    redirect(`/etablissement/${invitation.institution_id}`);
  }
  if (invitation.kind === "platform_admin") redirect("/admin");
  redirect(viewer.profile.onboarded_at ? "/espace" : "/bienvenue");
}

/* ─── Creation (SANADY admins, institution admins) ─────────────────────── */

async function deliverInvitation(params: {
  invitationId: string;
  kind: InvitationKind;
  email: string;
  token: string;
  institutionId: string | null;
}): Promise<ActionState> {
  const supabase = await createClient();
  const [{ data: inv }, { data: inst }] = await Promise.all([
    supabase.from("invitations").select("expires_at").eq("id", params.invitationId).single(),
    params.institutionId
      ? supabase.from("institutions").select("name").eq("id", params.institutionId).single()
      : Promise.resolve({ data: null }),
  ]);

  const mail = invitationEmail({
    kind: params.kind,
    token: params.token,
    institutionName: (inst as { name: string } | null)?.name,
    expiresAt: (inv as { expires_at: string } | null)?.expires_at ?? new Date().toISOString(),
  });
  const result = await sendEmail({ to: params.email, subject: mail.subject, html: mail.html, text: mail.text });

  if (result.sent) {
    await createAdminClient().rpc("mark_invitation_sent", { p_invitation: params.invitationId });
    return { ok: true, message: `Invitation envoyée à ${params.email}.` };
  }
  // Honest fallback: the invitation exists but no e-mail left the platform.
  return {
    ok: true,
    message: result.notConfigured
      ? "Invitation créée. L’envoi d’e-mails n’est pas configuré : transmettez le lien ci-dessous à la personne invitée."
      : "Invitation créée, mais l’e-mail n’a pas pu être envoyé. Transmettez le lien ci-dessous ou réessayez plus tard.",
    data: { link: invitationLink(params.token), emailFailed: true },
  };
}

export async function createInvitation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseInput(
    z.object({
      kind: z.enum(["platform_admin", "teacher", "institution_admin", "institution_teacher"]),
      email: emailSchema,
      institution_id: z.union([uuidSchema, z.literal("")]).optional(),
    }),
    formData,
  );
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const { kind, email } = parsed.data;
  const institutionId = parsed.data.institution_id || null;

  const viewer = await getViewer();
  if (!viewer) return { ok: false, message: messageFor("not_authenticated") };
  if (!(await rateLimit(`invite-create:${viewer.id}`, 200, 60 * 60))) {
    return { ok: false, message: messageFor("rate_limited") };
  }

  const { token, hash } = createInvitationToken();
  const supabase = await createClient();
  const { data: invitationId, error } = await supabase.rpc("create_invitation", {
    p_kind: kind,
    p_email: email,
    p_institution: institutionId,
    p_token_hash: hash,
  });
  if (error) return { ok: false, message: errorMessage(error) };

  const result = await deliverInvitation({ invitationId: invitationId as string, kind, email, token, institutionId });
  revalidatePath("/admin/invitations");
  if (institutionId) revalidatePath(`/etablissement/${institutionId}/enseignants`);
  return result;
}

/** Issues a fresh token for an open invitation (the previous link stops working). */
export async function reissueInvitation(invitationId: string): Promise<ActionState> {
  const id = uuidSchema.safeParse(invitationId);
  if (!id.success) return { ok: false, message: messageFor("not_found") };

  const supabase = await createClient();
  const { data: inv } = await supabase
    .from("invitations")
    .select("id, kind, email, institution_id, accepted_at, revoked_at, enrollment_code_id")
    .eq("id", id.data)
    .maybeSingle();
  const invitation = inv as { kind: InvitationKind; email: string; institution_id: string | null; accepted_at: string | null; enrollment_code_id: string | null } | null;
  if (!invitation) return { ok: false, message: messageFor("not_found") };
  if (invitation.accepted_at) return { ok: false, message: messageFor("invitation_already_accepted") };
  if (invitation.enrollment_code_id) {
    return { ok: false, message: "Cette demande provient d’un code d’inscription : la personne doit renouveler sa demande." };
  }

  const { token, hash } = createInvitationToken();
  const { data: newId, error } = await supabase.rpc("create_invitation", {
    p_kind: invitation.kind,
    p_email: invitation.email,
    p_institution: invitation.institution_id,
    p_token_hash: hash,
  });
  if (error) return { ok: false, message: errorMessage(error) };

  const result = await deliverInvitation({
    invitationId: newId as string,
    kind: invitation.kind,
    email: invitation.email,
    token,
    institutionId: invitation.institution_id,
  });
  revalidatePath("/admin/invitations");
  if (invitation.institution_id) revalidatePath(`/etablissement/${invitation.institution_id}/enseignants`);
  return result;
}

export async function revokeInvitation(invitationId: string): Promise<ActionState> {
  const id = uuidSchema.safeParse(invitationId);
  if (!id.success) return { ok: false, message: messageFor("not_found") };
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_invitation", { p_invitation: id.data });
  if (error) return { ok: false, message: errorMessage(error) };
  revalidatePath("/admin/invitations");
  revalidatePath("/etablissement", "layout");
  return { ok: true, message: "Invitation annulée." };
}
