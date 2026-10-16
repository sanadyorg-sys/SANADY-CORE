import Link from "next/link";
import { Check, Circle, Download, PauseCircle, Printer, ShieldCheck } from "lucide-react";
import { ActionButton } from "@/components/common/action-button";
import { NoticeText, ReasonForm, StepForm } from "@/components/enterprise/deletion-forms";
import { Alert, Badge, Card, CardBody, CardHeader } from "@/components/ui/surface";
import { cn } from "@/lib/cn";
import { displayName, formatDate, formatDateTime } from "@/lib/format";
import { cancelDeletion, confirmDeletion, holdDeletion, proposeDeletion, recordDataDelivery, recordDeletionNotice, releaseDeletionHold } from "@/server/actions/deletion";
import type { DataDeletion, TenantDetail } from "@/server/queries/enterprise";

/**
 * « Suppression des données » of a company space. Nothing is ever deleted
 * automatically: proposal, written notice, data handed over, confirmation
 * by a second person, 30 days to cancel, then a deletion certificate.
 */

const BLOCKERS: Record<string, string> = {
  notice: "L’avis écrit à l’organisation n’est pas encore enregistré.",
  delivery: "La remise des données à l’organisation n’est pas encore enregistrée.",
  hold: "La suppression est suspendue.",
  date: "La date de suppression prévue n’est pas encore arrivée.",
  not_closed: "L’espace n’est pas fermé.",
  contract: "Un contrat de cet espace est encore en cours.",
  unpaid: "Une facture de l’organisation n’est pas soldée.",
};

const STATUS = {
  proposed: { label: "Proposée", tone: "warning" },
  confirmed: { label: "Confirmée — délai de 30 jours", tone: "danger" },
  cancelled: { label: "Annulée", tone: "neutral" },
  executed: { label: "Effectuée", tone: "neutral" },
} as const;

function Step({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full", done ? "bg-success-600 text-white" : "border border-line-strong text-ink-400")}>
        {done ? <Check className="size-3" aria-hidden /> : <Circle className="size-2" aria-hidden />}
      </span>
      <div className="min-w-0 flex-1 text-label text-ink-800">{children}</div>
    </li>
  );
}

export function noticeText(t: TenantDetail, sender: string) {
  const due = t.deletion_due_on ? formatDate(t.deletion_due_on) : "[date]";
  return `Objet : suppression des données de votre espace de formation SANADY « ${t.display_name} »

Madame, Monsieur,

Votre contrat avec la Fondation Sanady pour l’espace de formation « ${t.display_name} » est arrivé à son terme. Conformément au contrat, les données de cet espace seront supprimées à partir du ${due}.

Seront supprimés : les comptes de vos collaborateurs utilisés uniquement pour cet espace, leurs progressions, résultats et attestations, les formations propres à votre entreprise et leurs fichiers, ainsi que vos demandes d’assistance.
Seront conservés : les documents contractuels et comptables, et des totaux d’utilisation sans aucun nom.

Si vous souhaitez recevoir vos données avant cette date, ou si vous avez une raison de les conserver plus longtemps (renouvellement, obligation légale, désaccord), merci de nous répondre avant le ${due}. Rien ne sera supprimé avant votre réponse ou l’échéance, et un certificat de suppression vous sera remis.

Bien cordialement,
${sender}
Fondation Sanady`;
}

export function DeletionCard({
  tenant: t,
  deletion: d,
  blockers,
  actor,
  viewerId,
  viewerName,
}: {
  tenant: TenantDetail;
  deletion: DataDeletion | null;
  blockers: string[];
  actor: { manager: boolean; signatory: boolean; admin: boolean };
  viewerId: string;
  viewerName: string;
}) {
  const open = d && (d.status === "proposed" || d.status === "confirmed");
  const canDecide = actor.signatory || actor.admin;
  const canAct = actor.manager || canDecide;

  return (
    <Card id="suppression">
      <CardHeader
        title="Suppression des données"
        description="Jamais automatique : l’organisation est prévenue et reçoit ses données, une deuxième personne confirme, puis 30 jours restent pour annuler."
        actions={d ? <Badge tone={STATUS[d.status].tone}>{STATUS[d.status].label}</Badge> : null}
      />
      <CardBody className="space-y-5">
        {t.data_deleted_at && d?.certificate ? (
          <div className="space-y-3">
            <Alert tone="info" title="Certificat de suppression">
              Données de l’espace « {d.certificate.space} » ({d.certificate.organisation}) supprimées le {formatDateTime(d.certificate.executed_at)}.
            </Alert>
            <ul className="grid gap-x-6 gap-y-1 text-label text-ink-700 sm:grid-cols-2">
              <li>Comptes supprimés : {d.certificate.deleted.accounts}</li>
              <li>Rattachements retirés : {d.certificate.deleted.memberships}</li>
              <li>Formations de l’entreprise : {d.certificate.deleted.courses}</li>
              <li>Fichiers : {d.certificate.deleted.files}</li>
              <li>Demandes d’assistance : {d.certificate.deleted.support_requests}</li>
              <li>Avis envoyé le {formatDate(d.certificate.notice_sent_on)} ; données remises le {formatDate(d.certificate.data_delivered_on)}</li>
            </ul>
            <p className="text-caption text-ink-500">
              Proposée par {d.certificate.proposed_by ?? "—"}, confirmée par {d.certificate.confirmed_by ?? "—"} le {formatDateTime(d.certificate.confirmed_at)}. Conservé : {d.certificate.kept}
            </p>
            <Link href={`/admin/partenariats/entreprises/espaces/${t.id}/certificat-suppression`} className="inline-flex items-center gap-1.5 text-label font-medium text-accent-700 hover:underline">
              <Printer className="size-4" aria-hidden /> Version imprimable à remettre à l’organisation
            </Link>
          </div>
        ) : !open ? (
          <div className="space-y-3">
            {d?.status === "cancelled" ? (
              <p className="text-label text-ink-600">
                Dernière proposition annulée le {d.cancelled_at ? formatDateTime(d.cancelled_at) : "—"} : {d.cancel_reason}
              </p>
            ) : null}
            {t.status === "closed" && t.export_authorized_at && t.deletion_due_on ? (
              actor.manager ? (
                <ReasonForm action={proposeDeletion.bind(null, t.id)} label="Motif" hint={`Date prévue : ${formatDate(t.deletion_due_on)}. Rien n’est supprimé à ce stade.`} submit="Proposer la suppression" />
              ) : (
                <p className="text-label text-ink-600">Le responsable entreprises peut proposer la suppression (date prévue : {formatDate(t.deletion_due_on)}).</p>
              )
            ) : (
              <p className="text-label text-ink-600">
                Possible une fois le contrat terminé, l’export autorisé, la date de suppression fixée et l’espace fermé.
                {t.deletion_due_on ? ` Date prévue : ${formatDate(t.deletion_due_on)}.` : ""}
              </p>
            )}
          </div>
        ) : (
          <>
            <ol className="space-y-4">
              <Step done>
                Proposée {d.proposer ? `par ${displayName(d.proposer)} ` : ""}le {formatDateTime(d.proposed_at)} — {d.reason}
              </Step>
              <Step done={Boolean(d.notice_sent_on)}>
                <p className="font-medium">Avis écrit à l’organisation</p>
                {d.notice_sent_on ? (
                  <p className="text-ink-600">
                    Envoyé le {formatDate(d.notice_sent_on)} à {d.notice_recipient}
                  </p>
                ) : actor.manager && d.status === "proposed" ? (
                  <div className="mt-2 space-y-3">
                    <NoticeText text={noticeText(t, viewerName)} />
                    <StepForm action={recordDeletionNotice.bind(null, t.id, d.id)} kind="notice" />
                  </div>
                ) : (
                  <p className="text-ink-500">En attente.</p>
                )}
              </Step>
              <Step done={Boolean(d.data_delivered_on)}>
                <p className="font-medium">Données remises à l’organisation</p>
                {d.data_delivered_on ? (
                  <p className="text-ink-600">
                    Le {formatDate(d.data_delivered_on)} — {d.delivery_method}
                  </p>
                ) : actor.manager && d.status === "proposed" ? (
                  <div className="mt-2 space-y-2">
                    <a href={`/api/espaces/${t.id}/export`} className="inline-flex items-center gap-1.5 text-label font-medium text-accent-700 hover:underline">
                      <Download className="size-4" aria-hidden /> Télécharger l’export complet (ZIP) à remettre
                    </a>
                    <StepForm action={recordDataDelivery.bind(null, t.id, d.id)} kind="delivery" />
                  </div>
                ) : (
                  <p className="text-ink-500">En attente.</p>
                )}
              </Step>
              <Step done={d.status === "confirmed"}>
                <p className="font-medium">Confirmation par une deuxième personne (approbateur ou administrateur)</p>
                {d.status === "confirmed" ? (
                  <p className="text-ink-600">
                    Par {d.confirmer ? displayName(d.confirmer) : "—"} le {d.confirmed_at ? formatDateTime(d.confirmed_at) : "—"} — {d.confirm_reason}. Suppression à partir du{" "}
                    <strong>{d.execute_after ? formatDate(d.execute_after) : "—"}</strong>.
                  </p>
                ) : blockers.length ? (
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-warning-700">
                    {blockers.map((b) => (
                      <li key={b}>{BLOCKERS[b] ?? b}</li>
                    ))}
                  </ul>
                ) : canDecide && d.proposed_by !== viewerId ? (
                  <div className="mt-2">
                    <ReasonForm action={confirmDeletion.bind(null, t.id, d.id)} label="Motif de la confirmation" hint="30 jours resteront pour annuler ou suspendre." submit={<><ShieldCheck aria-hidden /> Confirmer la suppression</>} variant="danger" />
                  </div>
                ) : (
                  <p className="text-ink-500">Tout est prêt : un approbateur ou un administrateur, autre que la personne qui l’a proposée, peut confirmer.</p>
                )}
              </Step>
            </ol>

            {d.hold_reason ? (
              <Alert tone="warning" title="Suspendue">
                {d.hold_reason}
                {canAct ? (
                  <span className="mt-2 block">
                    <ActionButton action={releaseDeletionHold.bind(null, t.id, d.id)}>Lever la suspension</ActionButton>
                  </span>
                ) : null}
              </Alert>
            ) : null}

            {canAct ? (
              <div className="grid gap-4 border-t border-line pt-4 md:grid-cols-2">
                {!d.hold_reason ? (
                  <ReasonForm action={holdDeletion.bind(null, t.id, d.id)} label="Suspendre (renouvellement, désaccord, demande légale…)" submit={<><PauseCircle aria-hidden /> Suspendre</>} />
                ) : null}
                <ReasonForm action={cancelDeletion.bind(null, t.id, d.id)} label="Annuler la suppression" submit="Annuler la suppression" />
              </div>
            ) : null}
          </>
        )}
      </CardBody>
    </Card>
  );
}
