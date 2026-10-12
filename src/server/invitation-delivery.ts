import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ActionState, InvitationKind } from "@/lib/types";
import { invitationEmail, invitationLink, sendEmail } from "@/server/email";

/**
 * Sends the invitation e-mail. When e-mail is not configured or fails, the
 * invitation still exists and the link is returned to the inviter.
 */
export async function deliverInvitation(params: {
  invitationId: string;
  kind: InvitationKind;
  email: string;
  token: string;
  institutionId: string | null;
  /** For inviters who cannot read the invitation or the institution (SANADY Enterprise). */
  known?: { institutionName: string; expiresAt: string };
}): Promise<ActionState> {
  const supabase = await createClient();
  const [{ data: inv }, { data: inst }] = params.known
    ? [{ data: { expires_at: params.known.expiresAt } }, { data: { name: params.known.institutionName } }]
    : await Promise.all([
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
