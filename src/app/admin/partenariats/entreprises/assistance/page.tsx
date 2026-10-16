import type { Metadata } from "next";
import Link from "next/link";
import { AlarmClock, Inbox, LifeBuoy, Timer, TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/ui/feedback";
import { Badge, Card, CardBody, CardHeader, PageHeader, StatTile } from "@/components/ui/surface";
import { LinkTabs } from "@/components/ui/tabs";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { displayName, formatRelative } from "@/lib/format";
import { SUPPORT_CATEGORIES, SUPPORT_STATUS, type SupportStatus } from "@/lib/enterprise";
import { requireEnterpriseStaff } from "@/server/auth";
import { listSupportRequests, supportOverview } from "@/server/queries/support";

export const metadata: Metadata = { title: "Assistance — Enterprise" };

const BASE = "/admin/partenariats/entreprises/assistance";
const TABS: Array<{ key: string; label: string; status?: "active" | SupportStatus }> = [
  { key: "en-cours", label: "À traiter", status: "active" },
  { key: "attente", label: "En attente de l’entreprise", status: "waiting_client" },
  { key: "resolues", label: "Résolues", status: "resolved" },
  { key: "fermees", label: "Fermées", status: "closed" },
  { key: "toutes", label: "Toutes" },
];

export default async function SupportInboxPage(props: PageProps<"/admin/partenariats/entreprises/assistance">) {
  await requireEnterpriseStaff();
  const sp = await props.searchParams;
  const tab = TABS.find((t) => t.key === sp.onglet) ?? TABS[0]!;
  const [rows, o] = await Promise.all([listSupportRequests({ status: tab.status }), supportOverview()]);
  // « À traiter » leaves out what waits for the company.
  const shown = tab.status === "active" ? rows.filter((r) => r.status !== "waiting_client") : rows;

  return (
    <>
      <PageHeader title="Assistance" description="Demandes des administrateurs d’entreprise. Les notes internes ne sont jamais visibles par l’entreprise." />
      {o ? (
        <section className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4" aria-label="Charge du support">
          <StatTile label="À traiter" value={o.open} detail={`${o.waiting_client} en attente de l’entreprise`} icon={Inbox} />
          <StatTile label="Urgentes sans réponse" value={o.urgent_unanswered} detail="Priorité « urgente », aucune réponse encore" icon={AlarmClock} />
          <StatTile
            label="Première réponse (médiane)"
            value={o.median_first_response_hours === null ? "—" : `${o.median_first_response_hours.toLocaleString("fr-FR")} h`}
            detail="Sur les 90 derniers jours"
            icon={Timer}
          />
          <StatTile label="Incidents (90 jours)" value={o.incidents_90_days} detail={`${o.last_30_days} demande(s) sur 30 jours · ${o.resolved_90_days} résolue(s) sur 90 jours`} icon={TriangleAlert} />
        </section>
      ) : null}
      <LinkTabs className="mb-4" activeHref={`${BASE}?onglet=${tab.key}`} items={TABS.map((t) => ({ href: `${BASE}?onglet=${t.key}`, label: t.label }))} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
        {shown.length === 0 ? (
          <Card>
            <EmptyState icon={LifeBuoy} title="Aucune demande" description="Les demandes des entreprises apparaissent ici." />
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <Table caption="Demandes d’assistance">
              <THead>
                <TR>
                  <TH>Demande</TH>
                  <TH>Entreprise</TH>
                  <TH>Statut</TH>
                  <TH>Mise à jour</TH>
                </TR>
              </THead>
              <TBody>
                {shown.map((r) => (
                  <TR key={r.id}>
                    <TD>
                      <Link href={`${BASE}/${r.id}`} className="font-semibold text-ink-900 hover:text-accent-700 hover:underline">
                        {r.subject}
                      </Link>
                      <span className="block text-caption text-ink-500">
                        {r.reference} · {SUPPORT_CATEGORIES[r.category]}
                        {r.assignee ? ` · ${displayName(r.assignee)}` : " · non attribuée"}
                      </span>
                      {r.priority === "urgent" && !r.first_response_at ? <span className="block text-caption font-semibold text-danger-600">Urgente — sans réponse</span> : null}
                    </TD>
                    <TD>{r.tenant?.display_name ?? "—"}</TD>
                    <TD>
                      <Badge tone={SUPPORT_STATUS[r.status].tone}>{SUPPORT_STATUS[r.status].label}</Badge>
                    </TD>
                    <TD>{formatRelative(r.updated_at)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>
        )}
        {o && o.by_tenant.length ? (
          <Card className="self-start">
            <CardHeader title="Par entreprise" description="90 derniers jours" />
            <CardBody>
              <ul className="space-y-2">
                {o.by_tenant.map((t) => (
                  <li key={t.tenant_id} className="flex items-center justify-between gap-2 text-label">
                    <Link href={`/admin/partenariats/entreprises/espaces/${t.tenant_id}`} className="min-w-0 truncate text-ink-800 hover:text-accent-700 hover:underline">
                      {t.tenant}
                    </Link>
                    <span className="shrink-0 tabular-nums text-ink-600">
                      {t.open} ouverte(s) / {t.total}
                    </span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        ) : null}
      </div>
    </>
  );
}
