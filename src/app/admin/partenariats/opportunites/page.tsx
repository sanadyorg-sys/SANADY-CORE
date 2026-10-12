import type { Metadata } from "next";
import Link from "next/link";
import { Megaphone, Plus } from "lucide-react";
import { OpportunityForm } from "@/components/partnerships/target-forms";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Drawer } from "@/components/ui/overlay";
import { Badge, Card, PageHeader } from "@/components/ui/surface";
import { LinkTabs } from "@/components/ui/tabs";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDate, formatRelative } from "@/lib/format";
import { INTERVENTION_FIELDS, OPPORTUNITY_STATUS, type OpportunityStatus } from "@/lib/partnerships";
import { requirePartnershipStaff } from "@/server/auth";
import { listOpportunities } from "@/server/queries/partnerships";

export const metadata: Metadata = { title: "Projets à la recherche de partenaires" };

const TABS: Array<{ key: string; label: string; status?: OpportunityStatus }> = [
  { key: "tous", label: "Tous" },
  { key: "brouillons", label: "Brouillons", status: "draft" },
  { key: "revue", label: "En revue", status: "internal_review" },
  { key: "approuves", label: "À publier", status: "approved" },
  { key: "publies", label: "Publiés", status: "published" },
  { key: "clotures", label: "Clôturés", status: "closed" },
  { key: "archives", label: "Archivés", status: "archived" },
];

export default async function OpportunitiesPage(props: PageProps<"/admin/partenariats/opportunites">) {
  await requirePartnershipStaff();
  const sp = await props.searchParams;
  const tab = TABS.find((t) => t.key === sp.onglet) ?? TABS[0]!;
  const rows = await listOpportunities({ status: tab.status });
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader
        title="Projets à la recherche de partenaires"
        description="Brouillon → revue interne → approbation (approbateur habilité) → publication sur /partenariats/opportunites → clôture."
        actions={
          <Drawer
            title="Nouveau projet"
            description="Créé en brouillon, non public. Vous pouvez aussi partir d’un besoin validé."
            width="max-w-2xl"
            trigger={
              <Button>
                <Plus aria-hidden /> Nouveau projet
              </Button>
            }
          >
            <div className="p-5">
              <OpportunityForm />
            </div>
          </Drawer>
        }
      />
      <LinkTabs className="mb-4" activeHref={`/admin/partenariats/opportunites?onglet=${tab.key}`} items={TABS.map((t) => ({ href: `/admin/partenariats/opportunites?onglet=${t.key}`, label: t.label }))} />
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={Megaphone} title="Aucun projet" description="Préparez un projet à partir d’un besoin validé, ou créez-en un nouveau." />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table caption="Projets à la recherche de partenaires">
            <THead>
              <TR>
                <TH>Projet</TH>
                <TH>Domaine</TH>
                <TH>Statut</TH>
                <TH>Date limite</TH>
                <TH>Mise à jour</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((o) => (
                <TR key={o.id}>
                  <TD>
                    <Link href={`/admin/partenariats/opportunites/${o.id}`} className="font-semibold text-ink-900 hover:text-accent-700 hover:underline">
                      {o.title}
                    </Link>
                    <span className="block text-caption text-ink-500">{o.reference}</span>
                  </TD>
                  <TD>{INTERVENTION_FIELDS[o.intervention_field]?.name}</TD>
                  <TD>
                    <Badge tone={OPPORTUNITY_STATUS[o.status].tone}>{OPPORTUNITY_STATUS[o.status].label}</Badge>
                  </TD>
                  <TD className={o.status === "published" && o.deadline && o.deadline < today ? "font-semibold text-danger-600" : undefined}>
                    {o.deadline ? formatDate(o.deadline) : "—"}
                  </TD>
                  <TD>{formatRelative(o.updated_at)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </>
  );
}
