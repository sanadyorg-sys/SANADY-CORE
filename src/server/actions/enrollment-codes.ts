"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { errorMessage, messageFor } from "@/lib/errors";
import { serverEnv } from "@/lib/server-env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createEnrollmentCode, createInvitationToken, normalizeEnrollmentCode } from "@/lib/tokens";
import type { ActionState } from "@/lib/types";
import { checkboxSchema, emailSchema, optionalText, parseInput, uuidSchema } from "@/lib/validation";
import { getViewer } from "@/server/auth";
import { invitationEmail, sendEmail } from "@/server/email";
import { clientIp, rateLimit } from "@/server/rate-limit";

const codeField = z
  .string()
  .transform((v, ctx) => {
    const code = normalizeEnrollmentCode(v);
    if (!code) {
      ctx.addIssue({ code: "custom", message: "Le code comporte 12 caractères, par exemple K7QM-2HXP-RW9D." });
      return z.NEVER;
    }
    return code;
  });

type CodeState = "valid" | "revoked" | "expired" | "exhausted" | "institution_inactive";

/** Signed-in teacher joins an institution with a code. */
export async function redeemEnrollmentCode(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseInput(z.object({ code: codeField, consent: checkboxSchema }), formData);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  if (!parsed.data.consent) return { ok: false, fieldErrors: { consent: messageFor("consent_required") } };

  const viewer = await getViewer();
  if (!viewer) redirect("/connexion?suite=/rejoindre");
  if (!(await rateLimit(`code-redeem:${viewer.id}`, 10, 15 * 60))) return { ok: false, message: messageFor("rate_limited") };

  const supabase = await createClient();
  const { error } = await supabase.rpc("redeem_enrollment_code", { p_code: parsed.data.code, p_consent: true });
  if (error) return { ok: false, message: errorMessage(error) };

  revalidatePath("/espace", "layout");
  return { ok: true, message: "Vous avez rejoint l’établissement. Les formations qu’il vous affectera apparaîtront dans votre espace." };
}

/**
 * Person without a session: validates the code, then e-mails a single-use
 * link bound to that code. Ownership of the address is proven by opening it.
 */
export async function requestJoinWithCode(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseInput(z.object({ code: codeField, email: emailSchema }), formData);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const { code, email } = parsed.data;

  const ip = await clientIp();
  const allowed =
    (await rateLimit(`code-join:ip:${ip}`, 10, 15 * 60)) &&
    (await rateLimit(`code-join:code:${code}`, 100, 60 * 60)) &&
    (await rateLimit(`code-join:email:${email}`, 3, 60 * 60));
  if (!allowed) return { ok: false, message: messageFor("rate_limited") };

  if (!serverEnv.resendApiKey) {
    return {
      ok: false,
      message:
        "L’inscription par code est momentanément indisponible (envoi d’e-mails non configuré). Contactez votre établissement.",
    };
  }

  const admin = createAdminClient();
  const { data } = await admin.rpc("describe_enrollment_code", { p_code: code });
  const described = data as { institution_name: string; state: CodeState } | null;
  if (!described) return { ok: false, fieldErrors: { code: messageFor("invalid_code") } };
  if (described.state !== "valid") {
    const key = described.state === "exhausted" ? "code_exhausted" : described.state === "institution_inactive" ? "institution_inactive" : `code_${described.state}`;
    return { ok: false, fieldErrors: { code: messageFor(key) } };
  }

  const { token, hash } = createInvitationToken();
  const { data: invitationId, error } = await admin.rpc("create_code_invitation", {
    p_code: code,
    p_email: email,
    p_token_hash: hash,
  });
  if (error) return { ok: false, message: errorMessage(error) };

  const { data: inv } = await admin.from("invitations").select("expires_at").eq("id", invitationId as string).single();
  const mail = invitationEmail({
    kind: "institution_teacher",
    token,
    institutionName: described.institution_name,
    expiresAt: (inv as { expires_at: string }).expires_at,
  });
  const sent = await sendEmail({ to: email, subject: mail.subject, html: mail.html, text: mail.text });
  if (!sent.sent) {
    return { ok: false, message: "L’e-mail de confirmation n’a pas pu être envoyé. Veuillez réessayer dans quelques minutes." };
  }
  await admin.rpc("mark_invitation_sent", { p_invitation: invitationId as string });

  return {
    ok: true,
    message: `Un e-mail de confirmation a été envoyé à ${email}. Ouvrez le lien qu’il contient pour finaliser votre inscription auprès de ${described.institution_name}.`,
  };
}

/* ─── Management (institution administrators, SANADY administrators) ────── */

export async function createEnrollmentCodeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseInput(
    z.object({
      institution_id: uuidSchema,
      label: optionalText(120),
      max_uses: z.coerce.number().int("Nombre entier attendu.").min(1, "Minimum 1.").max(5000, "Maximum 5 000."),
      expires_on: z.iso.date("Date invalide."),
    }),
    formData,
  );
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const { institution_id, label, max_uses, expires_on } = parsed.data;

  // End of the chosen day, Morocco time (UTC+1, no DST since 2018 apart from Ramadan adjustments).
  const expiresAt = new Date(`${expires_on}T23:59:59+01:00`);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    return { ok: false, fieldErrors: { expires_on: messageFor("invalid_expiry") } };
  }

  const supabase = await createClient();
  // Retry on the (astronomically unlikely) code collision.
  for (let i = 0; i < 3; i++) {
    const { error } = await supabase.rpc("create_enrollment_code", {
      p_institution: institution_id,
      p_code: createEnrollmentCode(),
      p_label: label ?? null,
      p_max_uses: max_uses,
      p_expires_at: expiresAt.toISOString(),
    });
    if (!error) {
      revalidatePath(`/etablissement/${institution_id}/enseignants`);
      revalidatePath(`/admin/etablissements/${institution_id}`);
      return { ok: true, message: "Code d’inscription créé." };
    }
    if (error.code !== "23505") return { ok: false, message: errorMessage(error) };
  }
  return { ok: false, message: messageFor("generic") };
}

export async function revokeEnrollmentCodeAction(codeId: string, institutionId: string): Promise<ActionState> {
  const id = uuidSchema.safeParse(codeId);
  if (!id.success) return { ok: false, message: messageFor("not_found") };
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_enrollment_code", { p_code_id: id.data });
  if (error) return { ok: false, message: errorMessage(error) };
  revalidatePath(`/etablissement/${institutionId}/enseignants`);
  revalidatePath(`/admin/etablissements/${institutionId}`);
  return { ok: true, message: "Code désactivé." };
}
