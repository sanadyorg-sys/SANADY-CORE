import "server-only";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/server-env";
import type { InvitationKind } from "@/lib/types";

export interface EmailResult {
  sent: boolean;
  /** True when no e-mail provider is configured (development). */
  notConfigured?: boolean;
}

/**
 * Sends a transactional e-mail through Resend's HTTP API.
 * When RESEND_API_KEY is absent, nothing is sent and `notConfigured` is
 * returned: callers must surface this honestly — never pretend success.
 */
export async function sendEmail(message: { to: string; subject: string; html: string; text: string }): Promise<EmailResult> {
  const apiKey = serverEnv.resendApiKey;
  if (!apiKey) return { sent: false, notConfigured: true };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: serverEnv.emailFrom, ...message }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error("[email] provider rejected message", res.status, await res.text().catch(() => ""));
      return { sent: false };
    }
    return { sent: true };
  } catch (err) {
    console.error("[email] delivery failed", err);
    return { sent: false };
  }
}

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function layout(title: string, paragraphs: string[], cta: { label: string; url: string }, footnote: string) {
  const html = `<!doctype html>
<html lang="fr"><body style="margin:0;background:#f7f6f4;font-family:Inter,Segoe UI,Arial,sans-serif;color:#292522">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e3e0db;border-radius:8px">
<tr><td style="padding:20px 32px;border-bottom:1px solid #e3e0db"><img src="${publicEnv.appUrl}/brand/sanady-logo.png" alt="Fondation Sanady" height="44" style="display:block;height:44px;width:auto;border:0"></td></tr>
<tr><td style="padding:28px 32px">
<h1 style="margin:0 0 16px;font-size:20px;line-height:28px;color:#1a1715">${escape(title)}</h1>
${paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:24px">${p}</p>`).join("\n")}
<p style="margin:24px 0"><a href="${escape(cta.url)}" style="display:inline-block;background:#1c1917;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:6px">${escape(cta.label)}</a></p>
<p style="margin:0;font-size:13px;line-height:20px;color:#6e6962">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br><span style="word-break:break-all">${escape(cta.url)}</span></p>
</td></tr>
<tr><td style="padding:16px 32px;border-top:1px solid #e3e0db;font-size:12px;line-height:18px;color:#6e6962">${escape(footnote)}</td></tr>
</table></td></tr></table></body></html>`;
  const text = [title, "", ...paragraphs.map((p) => p.replace(/<[^>]+>/g, "")), "", `${cta.label} : ${cta.url}`, "", footnote].join("\n");
  return { html, text };
}

export function invitationLink(token: string) {
  return `${publicEnv.appUrl}/invitation/${encodeURIComponent(token)}`;
}

export function invitationEmail(params: {
  kind: InvitationKind;
  token: string;
  institutionName?: string | null;
  expiresAt: string;
}) {
  const url = invitationLink(params.token);
  const expiry = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Casablanca" }).format(
    new Date(params.expiresAt),
  );
  const inst = params.institutionName ? escape(params.institutionName) : "";
  const intro: Record<InvitationKind, { subject: string; title: string; body: string }> = {
    platform_admin: {
      subject: "Invitation à administrer la plateforme SANADY",
      title: "Vous êtes invité(e) à rejoindre l’équipe d’administration",
      body: "L’équipe SANADY vous invite à administrer la plateforme de formation et de développement professionnel des enseignants.",
    },
    teacher: {
      subject: "Votre invitation à la plateforme SANADY",
      title: "Bienvenue sur SANADY",
      body: "L’équipe SANADY vous invite à créer votre compte personnel sur la plateforme de formation et de développement professionnel des enseignants.",
    },
    institution_admin: {
      subject: `Administration de l’établissement ${params.institutionName ?? ""} sur SANADY`,
      title: "Activez votre espace établissement",
      body: `Vous avez été désigné(e) pour administrer l’établissement <strong>${inst}</strong> sur la plateforme SANADY.`,
    },
    institution_teacher: {
      subject: `${params.institutionName ?? "Votre établissement"} vous invite sur SANADY`,
      title: "Rejoignez votre établissement sur SANADY",
      body: `L’établissement <strong>${inst}</strong> vous invite à rejoindre son espace de formation sur SANADY.`,
    },
  };
  const c = intro[params.kind];
  const { html, text } = layout(
    c.title,
    [c.body, `Cette invitation est personnelle et valable jusqu’au <strong>${expiry}</strong>. Elle ne peut être utilisée qu’une seule fois.`],
    { label: "Accepter l’invitation", url },
    "Vous recevez ce message car une invitation a été émise à votre adresse. Si vous n’êtes pas concerné(e), ignorez simplement cet e-mail.",
  );
  return { subject: c.subject, html, text, url };
}
