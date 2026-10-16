import type { Metadata } from "next";
import Link from "next/link";
import { Briefcase, CalendarClock } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Alert, Badge, Card, CardHeader, PageHeader, StatTile } from "@/components/ui/surface";
import { LinkTabs } from "@/components/ui/tabs";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { displayName, formatDate, formatDateTime, formatRelative } from "@/lib/format";
import { EMPLOYEE_COUNTS, ENTERPRISE_SERVICES, REQUEST_STATUS, type RequestStatus } from "@/lib/enterprise";
import { requireEnterpriseStaff } from "@/server/auth";
import { runHousekeeping } from "@/server/housekeeping";
import { enterpriseWatchlist, listClients, listProposals, listRequests, openEnterpriseTasks, requestCounts } from "@/server/queries/enterprise";

export const metadata: Metadata = { title: "SANADY Enterprise — demandes" };

const TABS: Record<string, { label: string; status: RequestStatus | "open" }> = {
  ouvertes: { label: "À traiter", status: "open" },
  clients: { label: "Clients créés", status: "converted" },
  "non-retenues": { label: "Non retenues", status: "declined" },
  retirees: { label: "Retirées", status: "withdrawn" },
  indesirables: { label: "Indésirables", status: "spam" },
};

export default async function EnterpriseInboxPage(props: PageProps<"/admin/partenariats/entreprises">) {
  await requireEnterpriseStaff();
  const sp = await props.searchParams;
  const tab = typeof sp.onglet === "string" && sp.onglet in TABS ? sp.onglet : "ouvertes";
  // Fallback for the daily job: readings, confirmed deletions due, retention purge.
  await runHousekeeping().catch((e) => console.error("[enterprise] housekeeping", e));
  const [rows, counts, tasks, clients, proposals, watch] = await Promise.all([
    listRequests({ status: TABS[tab]!.status }),
    requestCounts(),
    openEnterpriseTasks(),
    listClients({}),
    listProposals({}),
    enterpriseWatchlist(),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const active = clients.filter((c) => c.enterprise_status === "active_service").length;
  const pending = proposals.filter((p) => ["draft", "internal_review", "approved", "sent"].includes(p.status)).length;

  return (
    <>
      <PageHeader
        title="SANADY Enterprise"
        description="Demandes de formation des organisations, reçues depuis /partenariats/entreprises (page non publiée)."
        actions={
          <Link href="/admin/partenariats/entreprises/clients" className={buttonClasses({ variant: "secondary" })}>
            Clients et prospects
          </Link>
        }
      />
      <Alert tone="warning" title="Activité en projet" className="mb-6">
        Les services aux entreprises ne sont pas encore autorisés par la Fondation (statuts, fiscalité, comptabilité : voir docs/enterprise/plan.md). Aucune
        proposition ne doit être envoyée ni aucun contrat signé avant cette autorisation.
      </Alert>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Nouvelles demandes" value={counts.received ?? 0} />
        <StatTile label="Demandes qualifiées" value={counts.qualified ?? 0} />
        <StatTile label="Propositions en cours" value={pending} />
        <StatTile label="Clients en service actif" value={active} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <LinkTabs
            className="mb-4"
            activeHref={`/admin/partenariats/entreprises?onglet=${tab}`}
            items={Object.entries(TABS).map(([k, t]) => ({
              href: `/admin/partenariats/entreprises?onglet=${k}`,
              label: t.label,
              count: k === "ouvertes" ? (counts.received ?? 0) + (counts.qualified ?? 0) : undefined,
            }))}
          />
          {rows.length === 0 ? (
            <Card>
              <EmptyState icon={Briefcase} title="Aucune demande" description="Les organisations décrivent leur besoin depuis la page SANADY Enterprise." />
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <Table caption="Demandes entreprises">
                <THead>
                  <TR>
                    <TH>Organisation</TH>
                    <TH>Service</TH>
                    <TH>Besoin</TH>
                    <TH>Statut</TH>
                    <TH>Reçue</TH>
                  </TR>
                </THead>
                <TBody>
                  {rows.map((r) => (
                    <TR key={r.id}>
                      <TD>
                        <Link href={`/admin/partenariats/entreprises/demandes/${r.id}`} className="font-semibold text-ink-900 hover:text-accent-700 hover:underline">
                          {r.org_name}
                        </Link>
                        <span className="block text-caption text-ink-500">
                          {r.reference} · {EMPLOYEE_COUNTS[r.employee_count as keyof typeof EMPLOYEE_COUNTS]} salariés
                        </span>
                      </TD>
                      <TD>{ENTERPRISE_SERVICES[r.service].short}</TD>
                      <TD>
                        {r.topic}
                        {r.learner_count ? <span className="block text-caption text-ink-500">{r.learner_count} apprenants</span> : null}
                      </TD>
                      <TD>
                        <Badge tone={REQUEST_STATUS[r.status].tone}>{REQUEST_STATUS[r.status].label}</Badge>
                      </TD>
                      <TD>
                        <span title={formatDateTime(r.created_at)}>{formatRelative(r.created_at)}</span>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </Card>
          )}
        </div>
        <div className="space-y-6 self-start">
        {watch && (watch.renewals.length || watch.overages.length || watch.approvals || watch.support_waiting || watch.deletions.length) ? (
          <Card>
            <CardHeader title="À surveiller" description={watch.approvals ? `${watch.approvals} contrat(s) en attente d’un approbateur` : "Renouvellements et dépassements"} />
            <ul className="divide-y divide-line">
              {watch.support_waiting ? (
                <li className="px-5 py-3">
                  <Link href="/admin/partenariats/entreprises/assistance" className="font-medium text-ink-900 hover:text-accent-700 hover:underline">
                    Assistance : {watch.support_waiting} demande(s) à traiter
                  </Link>
                  {watch.support_urgent ? <span className="block text-caption font-semibold text-danger-600">dont {watch.support_urgent} urgente(s) sans réponse</span> : null}
                </li>
              ) : null}
              {watch.deletions.map((d) => (
                <li key={`d-${d.tenant_id}`} className="px-5 py-3">
                  <Link href={`/admin/partenariats/entreprises/espaces/${d.tenant_id}#suppression`} className="font-medium text-ink-900 hover:text-accent-700 hover:underline">
                    Suppression des données : {d.tenant}
                  </Link>
                  <span className={d.status === "confirmed" || d.due_on <= today ? "block text-caption font-semibold text-danger-600" : "block text-caption text-warning-700"}>
                    {d.on_hold
                      ? "Suspendue"
                      : d.status === "confirmed"
                        ? `Confirmée — exécution à partir du ${d.execute_after ? formatDate(d.execute_after) : "—"}`
                        : d.status === "proposed"
                          ? `Proposée — date prévue le ${formatDate(d.due_on)}`
                          : d.due_on <= today
                            ? `Date prévue dépassée (${formatDate(d.due_on)}) : à proposer ou reporter`
                            : `Prévue le ${formatDate(d.due_on)} : prévenir l’organisation`}
                  </span>
                </li>
              ))}
              {watch.renewals.map((r) => (
                <li key={`r-${r.id}`} className="px-5 py-3">
                  <Link href={`/admin/partenariats/entreprises/contrats/${r.id}`} className="font-medium text-ink-900 hover:text-accent-700 hover:underline">
                    Renouvellement : {r.title}
                  </Link>
                  <span className="block text-caption text-warning-700">
                    {r.organization} · fin le {formatDate(r.end_on)}
                  </span>
                </li>
              ))}
              {watch.overages.map((o) => (
                <li key={`o-${o.id}`} className="px-5 py-3">
                  <Link href={`/admin/partenariats/entreprises/espaces/${o.tenant_id}#utilisation`} className="font-medium text-ink-900 hover:text-accent-700 hover:underline">
                    Dépassement à examiner : {o.tenant}
                  </Link>
                  <span className="block text-caption text-danger-600">Relevé de {new Date(o.period).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</span>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
        <Card>
          <CardHeader title="Tâches de suivi" />
          {tasks.length ? (
            <ul className="divide-y divide-line">
              {tasks.map((t) => {
                const late = t.due_on && t.due_on < today;
                return (
                  <li key={t.id} className="px-5 py-3">
                    <Link href={`/admin/partenariats/entreprises/clients/${t.organization_id}`} className="font-medium text-ink-900 hover:text-accent-700 hover:underline">
                      {t.title}
                    </Link>
                    <span className="mt-0.5 flex flex-wrap gap-x-2 text-caption text-ink-500">
                      {t.organization?.name}
                      {t.due_on ? (
                        <span className={late ? "inline-flex items-center gap-1 font-semibold text-danger-600" : "inline-flex items-center gap-1"}>
                          <CalendarClock className="size-3.5" aria-hidden /> {late ? "En retard — " : ""}
                          {formatDate(t.due_on)}
                        </span>
                      ) : null}
                      {t.assignee ? <span>· {displayName(t.assignee)}</span> : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-5 pb-5 text-body text-ink-600">Aucune tâche ouverte.</p>
          )}
        </Card>
        </div>
      </div>
    </>
  );
}
