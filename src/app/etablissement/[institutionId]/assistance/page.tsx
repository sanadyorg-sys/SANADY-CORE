import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LifeBuoy, Plus } from "lucide-react";
import { SupportRequestForm } from "@/components/enterprise/support-forms";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Drawer } from "@/components/ui/overlay";
import { Alert, Badge, Card, PageHeader } from "@/components/ui/surface";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatRelative } from "@/lib/format";
import { SUPPORT_CATEGORIES, SUPPORT_STATUS } from "@/lib/enterprise";
import { requireInstitutionAdmin } from "@/server/auth";
import { listSupportRequests, tenantSupportLevel } from "@/server/queries/support";

export const metadata: Metadata = { title: "Assistance" };

/** Company workspaces: support requests to the SANADY Enterprise team. */
export default async function WorkspaceSupportPage(props: PageProps<"/etablissement/[institutionId]/assistance">) {
  const { institutionId } = await props.params;
  const { institution } = await requireInstitutionAdmin(institutionId);
  if (institution.kind !== "enterprise") notFound();
  const [rows, supportLevel] = await Promise.all([listSupportRequests({ institution: institutionId }), tenantSupportLevel(institutionId)]);

  return (
    <>
      <PageHeader
        title="Assistance"
        description="Vos demandes à l’équipe SANADY : accès, problème technique, contenu, nouvelle formation…"
        actions={
          <Drawer
            title="Nouvelle demande"
            description="L’équipe SANADY vous répond ici. Vos collaborateurs s’adressent à vous ; vous transmettez leurs demandes."
            width="max-w-xl"
            trigger={
              <Button>
                <Plus aria-hidden /> Nouvelle demande
              </Button>
            }
          >
            <div className="p-5">
              <SupportRequestForm institutionId={institutionId} />
            </div>
          </Drawer>
        }
      />
      {supportLevel ? (
        <Alert tone="info" className="mb-4">
          Niveau de support prévu à votre contrat : {supportLevel}
        </Alert>
      ) : null}
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={LifeBuoy} title="Aucune demande" description="Ouvrez une demande pour toute question sur votre espace de formation." />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table caption="Demandes d’assistance">
            <THead>
              <TR>
                <TH>Demande</TH>
                <TH>Type</TH>
                <TH>Statut</TH>
                <TH>Mise à jour</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.id}>
                  <TD>
                    <Link href={`/etablissement/${institutionId}/assistance/${r.id}`} className="font-semibold text-ink-900 hover:text-accent-700 hover:underline">
                      {r.subject}
                    </Link>
                    <span className="block text-caption text-ink-500">
                      {r.reference}
                      {r.priority === "urgent" ? " · urgente" : ""}
                    </span>
                  </TD>
                  <TD>{SUPPORT_CATEGORIES[r.category]}</TD>
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
    </>
  );
}
