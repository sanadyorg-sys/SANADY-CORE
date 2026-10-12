import type { Metadata } from "next";
import Link from "next/link";
import { Briefcase, Plus } from "lucide-react";
import { ClientForm } from "@/components/enterprise/admin-forms";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Drawer } from "@/components/ui/overlay";
import { Badge, Card, PageHeader } from "@/components/ui/surface";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { cn } from "@/lib/cn";
import { displayName, formatRelative } from "@/lib/format";
import { EMPLOYEE_COUNTS, ENTERPRISE_ORDER, ENTERPRISE_PIPELINE, ENTERPRISE_SERVICES, enterpriseStageTone, type EnterpriseStage } from "@/lib/enterprise";
import { requireEnterpriseStaff } from "@/server/auth";
import { enterpriseActor, enterpriseTeam, listClients } from "@/server/queries/enterprise";

export const metadata: Metadata = { title: "Clients et prospects — Enterprise" };

export default async function ClientsPage(props: PageProps<"/admin/partenariats/entreprises/clients">) {
  const viewer = await requireEnterpriseStaff();
  const sp = await props.searchParams;
  const stage = typeof sp.etape === "string" && sp.etape in ENTERPRISE_PIPELINE ? sp.etape : "";
  const [all, team, actor] = await Promise.all([listClients({}), enterpriseTeam(), enterpriseActor(viewer)]);
  const list = stage ? all.filter((c) => c.enterprise_status === stage) : all;
  const byStage = new Map<EnterpriseStage, number>();
  for (const c of all) byStage.set(c.enterprise_status, (byStage.get(c.enterprise_status) ?? 0) + 1);

  return (
    <>
      <PageHeader
        title="Clients et prospects"
        description="Pipeline des services entreprise, du prospect au renouvellement. Une organisation peut aussi être partenaire : les deux relations restent distinctes."
        actions={
          actor.manager ? (
            <Drawer
              title="Nouveau prospect"
              width="max-w-xl"
              trigger={
                <Button>
                  <Plus aria-hidden /> Nouveau prospect
                </Button>
              }
            >
              <div className="p-5">
                <ClientForm team={team.filter((m) => m.id !== viewer.id)} />
              </div>
            </Drawer>
          ) : null
        }
      />
      <nav aria-label="Étapes du pipeline" className="mb-6 overflow-x-auto pb-1">
        <ol className="flex min-w-max gap-2">
          {ENTERPRISE_ORDER.map((s, i) => {
            const n = byStage.get(s) ?? 0;
            const active = stage === s;
            return (
              <li key={s}>
                <Link
                  href={active ? "/admin/partenariats/entreprises/clients" : `/admin/partenariats/entreprises/clients?etape=${s}`}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-3 py-2 text-label transition-colors",
                    active ? "border-accent-600 bg-accent-50 text-accent-900" : "border-line bg-surface text-ink-700 hover:border-line-strong",
                  )}
                >
                  {i < 11 ? <span className="tabular text-caption text-ink-500">{i + 1}.</span> : null}
                  {ENTERPRISE_PIPELINE[s]}
                  <span className={cn("tabular rounded-full px-1.5 text-caption font-semibold", n ? "bg-ink-100 text-ink-800" : "text-ink-400")}>{n}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      </nav>
      {list.length === 0 ? (
        <Card>
          <EmptyState icon={Briefcase} title={all.length ? "Aucun client à cette étape" : "Aucun client ni prospect"} description="Créez le suivi depuis une demande, ou ajoutez un prospect identifié." />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table caption="Clients et prospects">
            <THead>
              <TR>
                <TH>Organisation</TH>
                <TH>Services</TH>
                <TH>Étape</TH>
                <TH>Responsable</TH>
                <TH>Mise à jour</TH>
              </TR>
            </THead>
            <TBody>
              {list.map((c) => (
                <TR key={c.id}>
                  <TD>
                    <Link href={`/admin/partenariats/entreprises/clients/${c.id}`} className="font-semibold text-ink-900 hover:text-accent-700 hover:underline">
                      {c.name}
                    </Link>
                    <span className="block text-caption text-ink-500">
                      {c.employee_count ? `${EMPLOYEE_COUNTS[c.employee_count as keyof typeof EMPLOYEE_COUNTS]} salariés` : "Effectif non renseigné"}
                      {c.status ? " · aussi partenaire" : ""}
                    </span>
                  </TD>
                  <TD className="text-label">{c.enterprise_services.map((s) => ENTERPRISE_SERVICES[s].short).join(", ") || "—"}</TD>
                  <TD>
                    <Badge tone={enterpriseStageTone(c.enterprise_status)}>{ENTERPRISE_PIPELINE[c.enterprise_status]}</Badge>
                  </TD>
                  <TD>{c.manager ? displayName(c.manager) : "—"}</TD>
                  <TD>{formatRelative(c.updated_at)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </>
  );
}
