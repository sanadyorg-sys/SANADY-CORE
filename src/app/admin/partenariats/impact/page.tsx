import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, CalendarClock, FilePenLine, Handshake, HandCoins, Megaphone, Sprout, Users } from "lucide-react";
import { MetricReviewForm } from "@/components/partnerships/impact-forms";
import { EmptyState } from "@/components/ui/feedback";
import { Alert, Badge, Card, CardBody, CardHeader, PageHeader, StatTile } from "@/components/ui/surface";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { ATTRIBUTIONS, INTERVENTION_FIELDS, METRIC_STATUS, METRIC_TYPES, PIPELINE, dimensionLabel, formatAmount, type PipelineStatus } from "@/lib/partnerships";
import { requirePartnershipStaff } from "@/server/auth";
import { listMetrics, partnershipDashboard, platformRecounts } from "@/server/queries/impact";
import { pipelineActor } from "@/server/queries/partnerships";

export const metadata: Metadata = { title: "Impact des partenariats" };

const num = (v: string | number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(Number(v));

export default async function ImpactPage() {
  const viewer = await requirePartnershipStaff();
  const [d, pending, rejected, actor] = await Promise.all([
    partnershipDashboard(),
    listMetrics({ status: "reported" }),
    listMetrics({ status: "rejected" }),
    pipelineActor(viewer),
  ]);
  const recounts = await platformRecounts(pending.filter((m) => m.source === "platform").map((m) => m.id));
  if (!d) return null;
  const pipelineTotal = Object.values(d.pipeline).reduce((a, b) => a + Number(b), 0);

  return (
    <>
      <PageHeader
        title="Impact des partenariats"
        description="Chiffres réels de la plateforme et indicateurs vérifiés par un approbateur. Aucun résultat n’est attribué automatiquement à un partenariat."
      />

      <section className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4" aria-label="Indicateurs clés">
        <StatTile label="Partenaires en discussion" value={d.prospects} detail={`${d.applications_open} candidature(s) à traiter`} icon={Users} />
        <StatTile label="Partenariats actifs" value={d.active_partnerships} detail={`${d.agreements_signed} convention(s) signée(s)`} icon={Handshake} />
        <StatTile label="Projets publiés" value={d.projects_published} detail={`${d.projects_closed} clôturé(s)`} icon={Megaphone} />
        <StatTile label="Renouvellements à préparer" value={d.renewals} detail={`${d.follow_ups} tâche(s) de suivi ouverte(s)`} icon={CalendarClock} />
      </section>

      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader title="Contributions reçues" description="Montants réellement reçus ; les promesses ne sont pas comptées ici." />
          {d.received.length ? (
            <Table caption="Contributions financières reçues par devise">
              <THead>
                <TR>
                  <TH>Devise</TH>
                  <TH align="right">Reçu</TH>
                  <TH align="right">dont vérifié</TH>
                </TR>
              </THead>
              <TBody>
                {d.received.map((r) => (
                  <TR key={r.currency}>
                    <TD>{r.currency}</TD>
                    <TD align="right">{formatAmount(r.received, r.currency)}</TD>
                    <TD align="right">{r.verified ? formatAmount(r.verified, r.currency) : "—"}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          ) : (
            <CardBody>
              <p className="text-body text-ink-600">Aucune contribution financière reçue pour l’instant.</p>
            </CardBody>
          )}
          <CardBody className="border-t border-line">
            <p className="flex items-center gap-2 text-label text-ink-700">
              <HandCoins className="size-4 text-ink-500" aria-hidden /> {d.in_kind} contribution(s) en nature ou d’expertise reçue(s).{" "}
              <Link href="/admin/partenariats/contributions" className="text-accent-700 hover:underline">
                Voir les contributions
              </Link>
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Par domaine d’intervention" description="Conventions signées et projets publiés (ou clôturés)." />
          <Table caption="Partenariats par domaine d’intervention">
            <THead>
              <TR>
                <TH>Domaine</TH>
                <TH align="right">Conventions</TH>
                <TH align="right">Projets</TH>
              </TR>
            </THead>
            <TBody>
              {d.by_field.map((f) => (
                <TR key={f.slug}>
                  <TD>{f.field}</TD>
                  <TD align="right">{f.agreements}</TD>
                  <TD align="right">{f.projects}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      </div>

      {pipelineTotal ? (
        <Card className="mt-6">
          <CardHeader title="Étapes des partenariats" description={`${pipelineTotal} organisation(s) suivie(s)`} />
          <CardBody>
            <ul className="space-y-2">
              {(Object.keys(PIPELINE) as PipelineStatus[])
                .filter((s) => d.pipeline[s])
                .map((s) => {
                  const n = Number(d.pipeline[s]);
                  return (
                    <li key={s} className="grid grid-cols-[minmax(0,180px)_minmax(0,1fr)_2.5rem] items-center gap-3 text-label">
                      <span className="truncate text-ink-700">{PIPELINE[s]}</span>
                      <span className="h-2 rounded-full bg-ink-100" aria-hidden>
                        <span className="block h-2 rounded-full bg-accent-600" style={{ width: `${Math.max(4, (n / pipelineTotal) * 100)}%` }} />
                      </span>
                      <span className="text-right tabular-nums text-ink-900">{n}</span>
                    </li>
                  );
                })}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      <Card className="mt-6">
        <CardHeader title="Indicateurs d’impact vérifiés" description="Somme des indicateurs vérifiés, par domaine. Réalisations et résultats à long terme restent séparés." />
        {d.verified_metrics.length ? (
          <Table caption="Indicateurs d’impact vérifiés">
            <THead>
              <TR>
                <TH>Domaine</TH>
                <TH>Indicateur</TH>
                <TH>Type</TH>
                <TH align="right">Valeur</TH>
              </TR>
            </THead>
            <TBody>
              {d.verified_metrics.map((m, i) => (
                <TR key={i}>
                  <TD>{m.field}</TD>
                  <TD>{dimensionLabel(m.dimension, m.label)}</TD>
                  <TD>{m.type === "output" ? "Réalisation" : "Résultat"}</TD>
                  <TD align="right" className="tabular-nums">
                    {num(m.value)}
                    {m.unit ? ` ${m.unit}` : ""}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        ) : (
          <EmptyState icon={Sprout} title="Aucun indicateur vérifié" description="Les indicateurs se saisissent depuis la fiche d’une organisation partenaire, puis sont vérifiés par un approbateur." />
        )}
      </Card>

      <Card className="mt-6">
        <CardHeader title="À vérifier" description={`${pending.length} indicateur(s) en attente d’un approbateur`} />
        {pending.length ? (
          <ul className="divide-y divide-line">
            {pending.map((m) => (
              <li key={m.id} className="space-y-3 px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-ink-900">
                      {dimensionLabel(m.dimension, m.label)} : {num(m.value)}
                      {m.unit ? ` ${m.unit}` : ""}
                    </p>
                    <p className="text-caption text-ink-500">
                      {m.organization?.name} · {INTERVENTION_FIELDS[m.intervention_field]?.name} · {METRIC_TYPES[m.metric_type]} · du {formatDate(m.period_start)} au {formatDate(m.period_end)}
                      {m.agreement ? ` · ${m.agreement.reference}` : ""}
                    </p>
                    <p className="mt-1 text-label text-ink-700">Méthode : {m.method}</p>
                    {m.source === "platform" && recounts[m.id] !== undefined ? (
                      <p className={recounts[m.id] === Number(m.value) ? "text-label font-medium text-success-700" : "text-label font-medium text-warning-700"}>
                        Recalculé aujourd’hui : {num(String(recounts[m.id]))}
                        {recounts[m.id] === Number(m.value) ? " — identique" : " — différent (données mises à jour depuis ; renvoyez pour recalcul si besoin)"}
                      </p>
                    ) : null}
                    <p className="text-label text-ink-700">{ATTRIBUTIONS[m.attribution]}</p>
                  </div>
                  <Badge tone={METRIC_STATUS[m.status].tone}>{METRIC_STATUS[m.status].label}</Badge>
                </div>
                {actor.signatory ? <MetricReviewForm id={m.id} /> : null}
              </li>
            ))}
          </ul>
        ) : (
          <CardBody>
            <p className="flex items-center gap-2 text-body text-ink-600">
              <BadgeCheck className="size-4" aria-hidden /> Rien à vérifier.
            </p>
          </CardBody>
        )}
      </Card>

      {rejected.length ? (
        <Alert tone="warning" className="mt-6">
          {rejected.length} indicateur(s) à corriger :{" "}
          {rejected.map((m, i) => (
            <span key={m.id}>
              {i ? ", " : ""}
              <Link href={`/admin/partenariats/organisations/${m.organization_id}#impact`} className="font-medium underline">
                {m.organization?.name} — {dimensionLabel(m.dimension, m.label)}
              </Link>
            </span>
          ))}
          .
        </Alert>
      ) : null}

      <p className="mt-6 flex items-center gap-2 text-caption text-ink-500">
        <FilePenLine className="size-3.5" aria-hidden /> Les rapports aux partenaires reprennent uniquement les indicateurs vérifiés :{" "}
        <Link href="/admin/partenariats/rapports" className="text-accent-700 hover:underline">
          Rapports aux partenaires
        </Link>
      </p>
    </>
  );
}
