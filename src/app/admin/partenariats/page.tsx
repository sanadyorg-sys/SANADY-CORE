import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, Handshake, Search } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Input, Select } from "@/components/ui/field";
import { Badge, Card, CardHeader, PageHeader, StatTile } from "@/components/ui/surface";
import { LinkTabs } from "@/components/ui/tabs";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { displayName, formatDate, formatDateTime, formatRelative } from "@/lib/format";
import { APPLICATION_STATUS, CONTRIBUTION_TYPES, FIELD_SLUGS, INTERVENTION_FIELDS, ORG_TYPES, type ApplicationStatus } from "@/lib/partnerships";
import { requirePartnershipStaff } from "@/server/auth";
import { partnershipWatchlist } from "@/server/queries/agreements";
import { applicationCounts, listApplications, openTasks, purgeExpiredApplications } from "@/server/queries/partnerships";

export const metadata: Metadata = { title: "Partenariats — candidatures" };

const TABS = {
  ouvertes: { label: "À traiter", status: "open" },
  creees: { label: "Fiches créées", status: "accepted" },
  "non-retenues": { label: "Non retenues", status: "declined" },
  retirees: { label: "Retirées", status: "withdrawn" },
  indesirables: { label: "Indésirables", status: "spam" },
} as const;

export default async function PartnershipInboxPage(props: PageProps<"/admin/partenariats">) {
  await requirePartnershipStaff();
  const sp = await props.searchParams;
  const tab = (typeof sp.onglet === "string" && sp.onglet in TABS ? sp.onglet : "ouvertes") as keyof typeof TABS;
  const field = typeof sp.domaine === "string" && sp.domaine in INTERVENTION_FIELDS ? sp.domaine : "";
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";

  await purgeExpiredApplications().catch((e) => console.error("[partnerships] retention", e));
  const [rows, counts, tasks, watch] = await Promise.all([
    listApplications({ status: TABS[tab].status as ApplicationStatus | "open", field: field || undefined, q: q || undefined }),
    applicationCounts(),
    openTasks(),
    partnershipWatchlist(),
  ]);
  const watchCount = watch ? watch.renewals.length + watch.milestones.length + watch.contributions.length : 0;
  const open = (counts.received ?? 0) + (counts.under_review ?? 0);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader
        title="Partenariats & Coopération"
        description="Candidatures reçues depuis la page publique /partenariats (non publiée tant que la Fondation ne l’a pas validée)."
        actions={
          <Link href="/admin/partenariats/organisations" className={buttonClasses({ variant: "secondary" })}>
            Organisations partenaires
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatTile label="Nouvelles candidatures" value={counts.received ?? 0} />
        <StatTile label="En cours d’examen" value={counts.under_review ?? 0} />
        <StatTile label="Fiches organisation créées" value={counts.accepted ?? 0} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <LinkTabs
            className="mb-4"
            activeHref={`/admin/partenariats?onglet=${tab}`}
            items={(Object.keys(TABS) as Array<keyof typeof TABS>).map((k) => ({
              href: `/admin/partenariats?onglet=${k}`,
              label: TABS[k].label,
              count: k === "ouvertes" ? open : undefined,
            }))}
          />
          <form className="mb-4 flex flex-wrap items-end gap-3" role="search">
            <input type="hidden" name="onglet" value={tab} />
            <label className="relative min-w-56 flex-1">
              <span className="sr-only">Rechercher</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" aria-hidden />
              <Input name="q" defaultValue={q} placeholder="Organisation, référence, contact…" className="pl-9" />
            </label>
            <label>
              <span className="sr-only">Domaine</span>
              <Select name="domaine" defaultValue={field}>
                <option value="">Tous les domaines</option>
                {FIELD_SLUGS.map((s) => (
                  <option key={s} value={s}>
                    {INTERVENTION_FIELDS[s].name}
                  </option>
                ))}
              </Select>
            </label>
            <button type="submit" className={buttonClasses({ variant: "secondary" })}>
              Filtrer
            </button>
          </form>

          {rows.length === 0 ? (
            <Card>
              <EmptyState
                icon={Handshake}
                title={tab === "ouvertes" ? "Aucune candidature à traiter" : "Aucune candidature"}
                description="Les organisations proposent un partenariat depuis la page publique « Partenariats & Coopération »."
              />
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <Table caption="Candidatures de partenariat">
                <THead>
                  <TR>
                    <TH>Organisation</TH>
                    <TH>Domaine</TH>
                    <TH>Contribution</TH>
                    <TH>Statut</TH>
                    <TH>Reçue</TH>
                  </TR>
                </THead>
                <TBody>
                  {rows.map((r) => (
                    <TR key={r.id}>
                      <TD>
                        <Link href={`/admin/partenariats/candidatures/${r.id}`} className="font-semibold text-ink-900 hover:text-accent-700 hover:underline">
                          {r.org_name}
                        </Link>
                        <span className="block text-caption text-ink-500">
                          {r.reference} · {ORG_TYPES[r.org_type]} · {r.country}
                        </span>
                      </TD>
                      <TD>{INTERVENTION_FIELDS[r.intervention_field]?.name ?? r.intervention_field}</TD>
                      <TD>{CONTRIBUTION_TYPES[r.contribution_type]}</TD>
                      <TD>
                        <Badge tone={APPLICATION_STATUS[r.status].tone}>{APPLICATION_STATUS[r.status].label}</Badge>
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
        {watch && (watchCount || watch.approvals) ? (
          <Card>
            <CardHeader title="À surveiller" description={watch.approvals ? `${watch.approvals} élément(s) en attente d’un approbateur` : "Échéances des conventions et contributions"} />
            <ul className="divide-y divide-line">
              {watch.renewals.map((r) => (
                <li key={`r-${r.id}`} className="px-5 py-3">
                  <Link href={`/admin/partenariats/conventions/${r.id}`} className="font-medium text-ink-900 hover:text-accent-700 hover:underline">
                    Renouvellement : {r.title}
                  </Link>
                  <span className="block text-caption text-warning-700">
                    {r.organization} · fin le {formatDate(r.end_on)}
                  </span>
                </li>
              ))}
              {watch.milestones.map((m) => (
                <li key={`m-${m.id}`} className="px-5 py-3">
                  <Link href={`/admin/partenariats/conventions/${m.agreement_id}`} className="font-medium text-ink-900 hover:text-accent-700 hover:underline">
                    {m.title}
                  </Link>
                  <span className={m.due_on < today ? "block text-caption font-semibold text-danger-600" : "block text-caption text-ink-500"}>
                    {m.reference} · {m.due_on < today ? "en retard — " : ""}
                    {formatDate(m.due_on)}
                  </span>
                </li>
              ))}
              {watch.contributions.map((c) => (
                <li key={`c-${c.id}`} className="px-5 py-3">
                  <Link href={`/admin/partenariats/contributions/${c.id}`} className="font-medium text-ink-900 hover:text-accent-700 hover:underline">
                    Contribution attendue : {c.description}
                  </Link>
                  <span className="block text-caption font-semibold text-danger-600">
                    {c.organization} · attendue le {formatDate(c.expected_on)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
        <Card>
          <CardHeader title="Tâches de suivi" description="Les prochaines échéances" />
          {tasks.length ? (
            <ul className="divide-y divide-line">
              {tasks.map((t) => {
                const late = t.due_on && t.due_on < today;
                return (
                  <li key={t.id} className="px-5 py-3">
                    <Link href={`/admin/partenariats/organisations/${t.organization_id}`} className="font-medium text-ink-900 hover:text-accent-700 hover:underline">
                      {t.title}
                    </Link>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-caption text-ink-500">
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
