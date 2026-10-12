import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";
import { NeedForm } from "@/components/partnerships/target-forms";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Drawer } from "@/components/ui/overlay";
import { Badge, Card, PageHeader } from "@/components/ui/surface";
import { LinkTabs } from "@/components/ui/tabs";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { displayName, formatRelative } from "@/lib/format";
import { INTERVENTION_FIELDS, NEED_PRIORITY, NEED_STATUS, formatAmount, type NeedStatus } from "@/lib/partnerships";
import { requirePartnershipStaff } from "@/server/auth";
import { institutionsForNeeds, listNeeds, partnershipTeam } from "@/server/queries/partnerships";

export const metadata: Metadata = { title: "Besoins éducatifs" };

const TABS: Array<{ key: string; label: string; status?: NeedStatus }> = [
  { key: "tous", label: "Tous" },
  { key: "identifies", label: "Identifiés", status: "identified" },
  { key: "revue", label: "En revue", status: "internal_review" },
  { key: "valides", label: "Validés", status: "approved" },
  { key: "clos", label: "Non retenus ou clos", status: "closed" },
];

export default async function NeedsPage(props: PageProps<"/admin/partenariats/besoins">) {
  const viewer = await requirePartnershipStaff();
  const sp = await props.searchParams;
  const tab = TABS.find((t) => t.key === sp.onglet) ?? TABS[0]!;
  const [rows, institutions, team] = await Promise.all([listNeeds({ status: tab.status }), institutionsForNeeds(), partnershipTeam()]);
  const shown = tab.key === "clos" ? rows.concat(await listNeeds({ status: "rejected" })) : rows;

  return (
    <>
      <PageHeader
        title="Besoins éducatifs"
        description="Registre interne : un besoin validé par la Fondation peut donner lieu à un projet publié. Un besoin n’est jamais rendu public de lui-même."
        actions={
          <Drawer
            title="Nouveau besoin"
            width="max-w-xl"
            trigger={
              <Button>
                <Plus aria-hidden /> Nouveau besoin
              </Button>
            }
          >
            <div className="p-5">
              <NeedForm institutions={institutions} team={team.filter((m) => m.id !== viewer.id)} />
            </div>
          </Drawer>
        }
      />
      <LinkTabs className="mb-4" activeHref={`/admin/partenariats/besoins?onglet=${tab.key}`} items={TABS.map((t) => ({ href: `/admin/partenariats/besoins?onglet=${t.key}`, label: t.label }))} />
      {shown.length === 0 ? (
        <Card>
          <EmptyState icon={ClipboardList} title="Aucun besoin" description="Enregistrez les besoins identifiés sur le terrain, avec leur justification éducative." />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table caption="Besoins éducatifs">
            <THead>
              <TR>
                <TH>Besoin</TH>
                <TH>Domaine</TH>
                <TH>Priorité</TH>
                <TH>Statut</TH>
                <TH align="right">Coût estimé</TH>
                <TH>Mise à jour</TH>
              </TR>
            </THead>
            <TBody>
              {shown.map((n) => (
                <TR key={n.id}>
                  <TD>
                    <Link href={`/admin/partenariats/besoins/${n.id}`} className="font-semibold text-ink-900 hover:text-accent-700 hover:underline">
                      {n.title}
                    </Link>
                    <span className="block text-caption text-ink-500">
                      {n.reference}
                      {n.institution ? ` · ${n.institution.name}` : ""}
                      {n.responsible ? ` · ${displayName(n.responsible)}` : ""}
                    </span>
                  </TD>
                  <TD>{INTERVENTION_FIELDS[n.intervention_field]?.name}</TD>
                  <TD>
                    <Badge tone={NEED_PRIORITY[n.priority].tone}>{NEED_PRIORITY[n.priority].label}</Badge>
                  </TD>
                  <TD>
                    <Badge tone={NEED_STATUS[n.status].tone}>{NEED_STATUS[n.status].label}</Badge>
                  </TD>
                  <TD align="right" className="tabular">{formatAmount(n.estimated_cost, n.currency) ?? "—"}</TD>
                  <TD>{formatRelative(n.updated_at)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </>
  );
}
