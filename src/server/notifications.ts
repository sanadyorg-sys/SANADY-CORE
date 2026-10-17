import "server-only";
import { after } from "next/server";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/server-env";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailLayout, sendEmail } from "@/server/email";

/**
 * Sends the e-mail outbox (public.notification_outbox), filled by the
 * database when events happen. Each message is claimed once, sent, and
 * marked sent or failed (retried later, 5 attempts at most). Without an
 * e-mail provider, nothing is claimed: messages wait until it is set up.
 * E-mails hold a short notice and a link — no score, no one else's data.
 */

type P = Record<string, unknown>;
const app = (path: string) => `${publicEnv.appUrl}${path}`;
const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const date = (v: unknown) => (typeof v === "string" && v ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Africa/Casablanca" }).format(new Date(v)) : "");
const FOOT = `Vous recevez ce message de la plateforme SANADY (Fondation Sanady). Vous pouvez désactiver ces notifications dans votre profil : ${app("/espace/profil")}`;
const FOOT_ESSENTIAL = "Message de la plateforme SANADY (Fondation Sanady) sur la gestion des données : il est toujours envoyé.";

export function notificationEmail(kind: string, p: P, name: string) {
  const hello = `Bonjour ${esc(name)},`;
  const m = (subject: string, title: string, lines: string[], cta: { label: string; url: string }, essential = false) => ({
    subject,
    ...emailLayout(title, [hello, ...lines], cta, essential ? FOOT_ESSENTIAL : FOOT),
  });
  switch (kind) {
    case "course_assigned":
      return m(`Nouvelle formation : ${p.course}`, "Une formation vous a été affectée", [
        `${esc(p.institution)} vous a affecté la formation <strong>${esc(p.course)}</strong>.`,
        ...(p.due_on ? [`À terminer avant le <strong>${date(p.due_on)}</strong>.`] : []),
      ], { label: "Commencer la formation", url: app(`/espace/formations/${p.course_id}`) });
    case "assignment_due":
      return m(`Rappel : ${p.course} à terminer le ${date(p.due_on)}`, "Votre formation arrive à échéance", [
        `La formation <strong>${esc(p.course)}</strong> est à terminer avant le <strong>${date(p.due_on)}</strong>.`,
      ], { label: "Reprendre la formation", url: app(`/espace/formations/${p.course_id}`) });
    case "certificate_issued":
      return m(`Votre document de fin de formation : ${p.course}`, "Félicitations, votre formation est terminée", [
        `Votre document de fin de formation pour <strong>${esc(p.course)}</strong> est disponible.`,
      ], { label: "Voir mes certificats", url: app("/espace/certificats") });
    case "support_opened":
      return m(`${p.priority === "urgent" ? "[Urgent] " : ""}Nouvelle demande d’assistance ${p.reference}`, "Nouvelle demande d’assistance", [
        `${esc(p.company)} a ouvert la demande <strong>${esc(p.reference)}</strong> : « ${esc(p.subject)} ».`,
      ], { label: "Ouvrir la demande", url: app(`/admin/partenariats/entreprises/assistance/${p.request_id}`) });
    case "support_client_reply":
      return m(`Réponse de l’entreprise — ${p.reference}`, "L’entreprise a répondu", [
        `${esc(p.company)} a répondu sur la demande <strong>${esc(p.reference)}</strong> : « ${esc(p.subject)} ».`,
      ], { label: "Ouvrir la demande", url: app(`/admin/partenariats/entreprises/assistance/${p.request_id}`) });
    case "support_reply":
      return m(`Réponse de l’équipe SANADY — ${p.reference}`, "L’équipe SANADY vous a répondu", [
        `Une réponse a été ajoutée à votre demande <strong>${esc(p.reference)}</strong> : « ${esc(p.subject)} ».`,
      ], { label: "Lire la réponse", url: app(`/etablissement/${p.institution_id}/assistance/${p.request_id}`) });
    case "portal_message_to_team":
      return m(`Nouveau message de ${p.organization}`, "Message dans l’espace partenaire", [
        `${esc(p.organization)} vous a écrit dans l’espace partenaire.`,
      ], { label: "Lire le message", url: app(`/admin/partenariats/organisations/${p.organization_id}`) });
    case "portal_message_to_partner":
      return m("Nouveau message de la Fondation Sanady", "Un message vous attend", [
        "L’équipe partenariats de la Fondation Sanady vous a écrit dans votre espace partenaire.",
      ], { label: "Lire le message", url: app("/espace-partenaire/messages") });
    case "report_shared":
      return m(`Rapport disponible : ${p.title}`, "Un rapport vous a été transmis", [
        `Le rapport <strong>${esc(p.title)}</strong> est disponible dans votre espace partenaire.`,
      ], { label: "Voir le rapport", url: app("/espace-partenaire/rapports") });
    case "approval_needed": {
      const what = p.what === "contract" ? "contrat" : "proposition";
      const path = p.what === "contract" ? `/admin/partenariats/entreprises/contrats/${p.id}` : `/admin/partenariats/entreprises/propositions/${p.id}`;
      return m(`À approuver : ${what} ${p.reference}`, `Un${p.what === "contract" ? "" : "e"} ${what} attend votre approbation`, [
        `${what === "contrat" ? "Le contrat" : "La proposition"} <strong>${esc(p.reference)}</strong> — ${esc(p.title)} — est en revue interne.`,
      ], { label: "Examiner", url: app(path) });
    }
    case "renewal_due":
      return m(`Renouvellement à préparer : ${p.reference}`, "Un contrat arrive à échéance", [
        `Le contrat <strong>${esc(p.reference)}</strong> — ${esc(p.title)} — se termine le <strong>${date(p.end_on)}</strong>.`,
      ], { label: "Voir le contrat", url: app(`/admin/partenariats/entreprises/contrats/${p.contract_id}`) });
    case "deletion_due":
      return m(`Suppression des données prévue : ${p.space}`, "Une date de suppression approche", [
        Number(p.days) > 0
          ? `La suppression des données de l’espace <strong>${esc(p.space)}</strong> est prévue le <strong>${date(p.due_on)}</strong> (dans ${esc(p.days)} jours).`
          : `La date de suppression des données de l’espace <strong>${esc(p.space)}</strong> est arrivée.`,
        "Rien n’est supprimé automatiquement : prévenez l’organisation, remettez-lui ses données, puis faites confirmer la suppression — ou reportez la date.",
      ], { label: "Ouvrir l’espace", url: app(`/admin/partenariats/entreprises/espaces/${p.tenant_id}#suppression`) }, true);
    case "deletion_confirmed":
      return m(`Suppression confirmée : ${p.space}`, "Une suppression de données a été confirmée", [
        `La suppression des données de l’espace <strong>${esc(p.space)}</strong> a été confirmée. Elle aura lieu à partir du <strong>${date(p.execute_after)}</strong>, sauf annulation ou suspension d’ici là.`,
      ], { label: "Ouvrir l’espace", url: app(`/admin/partenariats/entreprises/espaces/${p.tenant_id}#suppression`) }, true);
    case "deletion_executed":
      return m(`Données supprimées : ${p.space}`, "La suppression des données a été effectuée", [
        `Les données de l’espace <strong>${esc(p.space)}</strong> ont été supprimées. Le certificat de suppression est prêt à être remis à l’organisation.`,
      ], { label: "Voir le certificat", url: app(`/admin/partenariats/entreprises/espaces/${p.tenant_id}/certificat-suppression`) }, true);
    default:
      return null;
  }
}

export async function flushNotifications(limit = 25) {
  if (!serverEnv.resendApiKey) return { sent: 0, failed: 0, waiting: true };
  const db = createAdminClient();
  const { data, error } = await db.rpc("claim_notifications", { p_limit: limit });
  if (error) {
    console.error("[notifications] claim", error.message);
    return { sent: 0, failed: 0 };
  }
  let sent = 0;
  let failed = 0;
  for (const n of (data ?? []) as Array<{ id: string; kind: string; payload: P; email: string; name: string }>) {
    const mail = notificationEmail(n.kind, n.payload, n.name);
    if (!mail) {
      await db.rpc("complete_notification", { p_id: n.id, p_ok: false, p_error: `unknown kind ${n.kind}` });
      failed++;
      continue;
    }
    const r = await sendEmail({ to: n.email, subject: mail.subject, html: mail.html, text: mail.text });
    await db.rpc("complete_notification", { p_id: n.id, p_ok: r.sent, p_error: r.sent ? null : "provider" });
    if (r.sent) sent++;
    else failed++;
  }
  return { sent, failed };
}

/** Sends the outbox after the response, so a page is never slowed down by e-mail. */
export function flushNotificationsLater() {
  after(() => flushNotifications().catch((e) => console.error("[notifications] flush", e)));
}
