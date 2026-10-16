import type { Metadata } from "next";
import Link from "next/link";
import { Package, Plus } from "lucide-react";
import { PlanForm } from "@/components/enterprise/plan-forms";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Drawer } from "@/components/ui/overlay";
import { Alert, Badge, Card, PageHeader } from "@/components/ui/surface";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ENTERPRISE_SERVICES, PLAN_STATUS, PRICING_MODELS, lineTotal, type PricingModel } from "@/lib/enterprise";
import { formatAmount } from "@/lib/partnerships";
import { requireEnterpriseStaff } from "@/server/auth";
import { enterpriseActor } from "@/server/queries/enterprise";
import { listPlans } from "@/server/queries/plans";

export const metadata: Metadata = { title: "Formules de service — Enterprise" };

export default async function PlansPage() {
  const viewer = await requireEnterpriseStaff();
  const [plans, actor] = await Promise.all([listPlans(), enterpriseActor(viewer)]);
  return (
    <>
      <PageHeader
        title="Formules de service"
        description="Offres types réutilisables : lignes chiffrées, modèle de tarification, limites et support. Une formule s’applique à une proposition en brouillon."
        actions={
          actor.manager ? (
            <Drawer
              title="Nouvelle formule"
              width="max-w-xl"
              trigger={
                <Button>
                  <Plus aria-hidden /> Nouvelle formule
                </Button>
              }
            >
              <div className="p-5">
                <PlanForm />
              </div>
            </Drawer>
          ) : null
        }
      />
      <Alert tone="info" className="mb-4">
        Activité proposée. Les prix d’une formule sont saisis par l’équipe — aucun n’est fixé par la plateforme — et une formule n’est utilisable qu’une fois approuvée par un approbateur.
      </Alert>
      {plans.length === 0 ? (
        <Card>
          <EmptyState icon={Package} title="Aucune formule" description="Créez une formule pour préparer plus vite les propositions." />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table caption="Formules de service">
            <THead>
              <TR>
                <TH>Formule</TH>
                <TH>Tarification</TH>
                <TH align="right">Total des lignes</TH>
                <TH>Statut</TH>
              </TR>
            </THead>
            <TBody>
              {plans.map((p) => (
                <TR key={p.id}>
                  <TD>
                    <Link href={`/admin/partenariats/entreprises/formules/${p.id}`} className="font-semibold text-ink-900 hover:text-accent-700 hover:underline">
                      {p.name}
                    </Link>
                    <span className="block text-caption text-ink-500">
                      {ENTERPRISE_SERVICES[p.service].label} · {p.lines.length} ligne(s)
                    </span>
                  </TD>
                  <TD>{PRICING_MODELS[p.pricing_model as PricingModel] ?? p.pricing_model}</TD>
                  <TD align="right" className="tabular">
                    {formatAmount(p.lines.reduce((t, l) => t + lineTotal(l), 0), p.currency)}
                  </TD>
                  <TD>
                    <Badge tone={PLAN_STATUS[p.status].tone}>{PLAN_STATUS[p.status].label}</Badge>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </>
  );
}
