import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, ArrowLeft, BadgeCheck, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { ActionButton } from "@/components/common/action-button";
import { LineForm } from "@/components/enterprise/admin-forms";
import { PlanForm } from "@/components/enterprise/plan-forms";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/overlay";
import { Alert, Badge, Card, CardBody, CardHeader, DescriptionList, PageHeader } from "@/components/ui/surface";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { displayName, formatDateTime } from "@/lib/format";
import { ENTERPRISE_SERVICES, LINE_CATEGORIES, PLAN_STATUS, PRICING_MODELS, lineTotal, type PricingModel } from "@/lib/enterprise";
import { formatAmount } from "@/lib/partnerships";
import { uuidSchema } from "@/lib/validation";
import { deletePlanLine, setPlanStatus } from "@/server/actions/plans";
import { requireEnterpriseStaff } from "@/server/auth";
import { enterpriseActor } from "@/server/queries/enterprise";
import { getPlan } from "@/server/queries/plans";

export const metadata: Metadata = { title: "Formule de service — Enterprise" };

const num = (v: string | number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(Number(v));

export default async function PlanPage(props: PageProps<"/admin/partenariats/entreprises/formules/[planId]">) {
  const viewer = await requireEnterpriseStaff();
  const { planId } = await props.params;
  if (!uuidSchema.safeParse(planId).success) notFound();
  const [p, actor] = await Promise.all([getPlan(planId), enterpriseActor(viewer)]);
  if (!p) notFound();
  const editable = actor.manager && p.status === "draft";
  const total = p.lines.reduce((t, l) => t + lineTotal(l), 0);

  return (
    <>
      <Link href="/admin/partenariats/entreprises/formules" className="mb-3 inline-flex items-center gap-1.5 text-label text-ink-600 hover:text-ink-900">
        <ArrowLeft className="size-4" aria-hidden /> Formules de service
      </Link>
      <PageHeader
        title={p.name}
        description={`${ENTERPRISE_SERVICES[p.service].label} · ${PRICING_MODELS[p.pricing_model as PricingModel] ?? p.pricing_model} · ${p.currency}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={PLAN_STATUS[p.status].tone}>{PLAN_STATUS[p.status].label}</Badge>
            {actor.manager && p.status !== "archived" ? (
              <Drawer
                title="Modifier la formule"
                width="max-w-xl"
                trigger={
                  <Button variant="secondary" size="sm">
                    <Pencil aria-hidden /> Modifier
                  </Button>
                }
              >
                <div className="p-5">
                  <PlanForm plan={p} />
                </div>
              </Drawer>
            ) : null}
          </div>
        }
      />
      {p.status === "draft" ? (
        <Alert tone="warning" className="mb-4">
          Brouillon : la formule ne peut pas encore être appliquée. Un approbateur doit l’approuver (il faut au moins une ligne).
        </Alert>
      ) : null}
      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader title="Limites et support" description="Reprises dans le contrat préparé à partir de la proposition." />
            <CardBody>
              <DescriptionList
                items={[
                  { term: "Collaborateurs", value: p.learner_limit ?? "—" },
                  { term: "Stockage", value: p.storage_limit_gb ? `${num(p.storage_limit_gb)} Go` : "—" },
                  { term: "Vidéo", value: p.video_minutes_limit ? `${num(p.video_minutes_limit)} min` : "—" },
                  { term: "Niveau de support", value: p.support_level ?? "—" },
                ]}
              />
              {p.support_commitments ? <p className="mt-3 whitespace-pre-line text-label text-ink-700">{p.support_commitments}</p> : null}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Approbation" />
            <CardBody className="space-y-3">
              {p.status === "active" && p.approved_at ? (
                <p className="text-label text-ink-700">
                  Approuvée le {formatDateTime(p.approved_at)}
                  {p.approver ? ` par ${displayName(p.approver)}` : ""}.
                </p>
              ) : null}
              <div className="flex flex-col gap-2">
                {actor.signatory && p.status === "draft" ? (
                  <ActionButton variant="primary" action={setPlanStatus.bind(null, p.id, "active")}>
                    <BadgeCheck aria-hidden /> Approuver la formule
                  </ActionButton>
                ) : null}
                {actor.manager && p.status === "active" ? (
                  <ActionButton action={setPlanStatus.bind(null, p.id, "draft")}>
                    <RotateCcw aria-hidden /> Repasser en brouillon pour la modifier
                  </ActionButton>
                ) : null}
                {actor.manager && p.status !== "archived" ? (
                  <ActionButton
                    variant="ghost"
                    action={setPlanStatus.bind(null, p.id, "archived")}
                    confirm={{ title: "Archiver la formule ?", description: "Elle ne sera plus proposée. Les propositions qui l’utilisent ne changent pas.", confirmLabel: "Archiver la formule", tone: "primary" }}
                  >
                    <Archive aria-hidden /> Archiver
                  </ActionButton>
                ) : null}
                {actor.manager && p.status === "archived" ? (
                  <ActionButton action={setPlanStatus.bind(null, p.id, "draft")}>
                    <RotateCcw aria-hidden /> Rétablir (brouillon)
                  </ActionButton>
                ) : null}
              </div>
            </CardBody>
          </Card>
        </div>
          <Card className="overflow-hidden">
            <CardHeader title="Lignes" description="Reprises telles quelles dans la proposition, où elles restent modifiables." />
            {p.lines.length ? (
              <Table caption="Lignes de la formule">
                <THead>
                  <TR>
                    <TH>Prestation</TH>
                    <TH align="right">Quantité</TH>
                    <TH align="right">Prix unitaire</TH>
                    <TH align="right">Total</TH>
                    {editable ? (
                      <TH align="right">
                        <span className="sr-only">Actions</span>
                      </TH>
                    ) : null}
                  </TR>
                </THead>
                <TBody>
                  {p.lines.map((l) => (
                    <TR key={l.id}>
                      <TD>
                        <span className="font-medium text-ink-900">{l.label}</span>
                        <span className="block text-caption text-ink-500">{LINE_CATEGORIES[l.category]}</span>
                      </TD>
                      <TD align="right" className="tabular">
                        {num(l.quantity)} {l.unit ?? ""}
                      </TD>
                      <TD align="right" className="tabular">
                        {formatAmount(l.unit_price, p.currency)}
                      </TD>
                      <TD align="right" className="tabular font-semibold">
                        {formatAmount(lineTotal(l), p.currency)}
                      </TD>
                      {editable ? (
                        <TD align="right">
                          <ActionButton variant="danger-ghost" action={deletePlanLine.bind(null, l.id, p.id)}>
                            <Trash2 aria-hidden /> <span className="sr-only">Supprimer {l.label}</span>
                          </ActionButton>
                        </TD>
                      ) : null}
                    </TR>
                  ))}
                  <TR>
                    <TD className="font-bold text-ink-900">Total (hors taxes)</TD>
                    <TD />
                    <TD />
                    <TD align="right" className="tabular text-section font-bold text-ink-900">
                      {formatAmount(total, p.currency)}
                    </TD>
                    {editable ? <TD /> : null}
                  </TR>
                </TBody>
              </Table>
            ) : (
              <CardBody>
                <p className="text-body text-ink-600">Aucune ligne pour l’instant.</p>
              </CardBody>
            )}
            {editable ? (
              <CardBody className="border-t border-line">
                <LineForm planId={p.id} currency={p.currency} />
              </CardBody>
            ) : null}
          </Card>
          {p.description ? (
            <Card>
              <CardHeader title="Description" />
              <CardBody>
                <p className="whitespace-pre-line text-body text-ink-800">{p.description}</p>
              </CardBody>
            </Card>
          ) : null}
      </div>
    </>
  );
}
