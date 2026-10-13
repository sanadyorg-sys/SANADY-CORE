import type { Metadata } from "next";
import Link from "next/link";
import { Trash2, Wallet } from "lucide-react";
import { ActionButton } from "@/components/common/action-button";
import { CostForm } from "@/components/enterprise/finance-forms";
import { EmptyState } from "@/components/ui/feedback";
import { Alert, Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/surface";
import { LinkTabs } from "@/components/ui/tabs";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { COST_CATEGORIES, INFRASTRUCTURE_COSTS, PAYMENT_METHODS, REVENUE_CATEGORIES } from "@/lib/enterprise";
import { formatAmount } from "@/lib/partnerships";
import { confirmPayment, deleteCost } from "@/server/actions/finance";
import { requireEnterpriseStaff } from "@/server/auth";
import { enterpriseActor } from "@/server/queries/enterprise";
import { contractOptions, enterpriseFinance, listCosts, unconfirmedPayments } from "@/server/queries/finance";

export const metadata: Metadata = { title: "Finances — Enterprise" };

export default async function FinancePage(props: PageProps<"/admin/partenariats/entreprises/finances">) {
  const viewer = await requireEnterpriseStaff();
  const actor = await enterpriseActor(viewer);
  if (!actor.manager && !actor.signatory) {
    return (
      <>
        <PageHeader title="Finances" />
        <Alert tone="info">Les données financières sont réservées au responsable entreprises, aux administrateurs SANADY et aux approbateurs.</Alert>
      </>
    );
  }
  const sp = await props.searchParams;
  const thisYear = new Date().getFullYear();
  const year = typeof sp.annee === "string" && /^\d{4}$/.test(sp.annee) ? Number(sp.annee) : thisYear;
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const [f, costs, pending, contracts] = await Promise.all([enterpriseFinance(from, to), listCosts(from, to), unconfirmedPayments(), contractOptions()]);
  if (!f) return null;
  const amount = (v: string | number | null | undefined, cur: string) => formatAmount(Number(v ?? 0), cur) ?? `0 ${cur}`;
  const infra = (cur: string) =>
    f.costs_by_category.filter((c) => c.currency === cur && INFRASTRUCTURE_COSTS.includes(c.category)).reduce((s, c) => s + Number(c.actual ?? 0) + Number(c.estimated ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Finances"
        description="Montants enregistrés depuis la comptabilité de la Fondation. La plateforme n’émet aucune facture et n’encaisse aucun paiement."
      />
      <Alert tone="info" className="mb-4">
        Activité proposée. Les marges et coûts par collaborateur sont des <strong>estimations</strong>, pas des résultats comptables audités. Les montants ne sont jamais convertis
        d’une devise à l’autre, ni additionnés aux dons des partenariats.
      </Alert>
      <LinkTabs
        className="mb-6"
        activeHref={`/admin/partenariats/entreprises/finances?annee=${year}`}
        items={[thisYear - 1, thisYear, thisYear + 1].map((y) => ({ href: `/admin/partenariats/entreprises/finances?annee=${y}`, label: String(y) }))}
      />

      {f.by_currency.length === 0 ? (
        <Card>
          <EmptyState icon={Wallet} title="Aucune donnée financière" description="Les factures, paiements et coûts enregistrés apparaîtront ici." />
        </Card>
      ) : (
        <div className="space-y-6">
          {f.by_currency.map((c) => {
            const invoiced = Number(c.invoiced);
            const direct = Number(c.costs_actual) + Number(c.costs_estimated);
            const infraCost = infra(c.currency);
            return (
              <Card key={c.currency}>
                <CardHeader title={`En ${c.currency}`} description={`Du ${formatDate(f.from)} au ${formatDate(f.to)}`} />
                <CardBody>
                  <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                    {[
                      ["Contracté", c.contracted, "Contrats signés démarrant sur la période"],
                      ["Facturé", c.invoiced, "Factures enregistrées (hors annulées)"],
                      ["Reçu", c.received, "Paiements enregistrés"],
                      ["dont confirmé", c.confirmed, "Vérifié par un approbateur"],
                      ["Reste dû", c.outstanding, Number(c.overdue) ? `dont ${amount(c.overdue, c.currency)} en retard` : "Factures non soldées"],
                      ["Coûts", direct, `${amount(c.costs_actual, c.currency)} réels · ${amount(c.costs_estimated, c.currency)} estimés`],
                    ].map(([label, value, hint]) => (
                      <div key={label as string} className="rounded-xl border border-line p-3">
                        <dt className="text-caption text-ink-500">{label}</dt>
                        <dd className="mt-1 text-body font-semibold tabular-nums text-ink-900">{amount(value as string, c.currency)}</dd>
                        <dd className="mt-0.5 text-caption text-ink-500">{hint}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <p className="rounded-xl bg-ink-50 px-3 py-2 text-label text-ink-700">
                      <strong>Marge de contribution estimée</strong> : {amount(invoiced - direct, c.currency)} (facturé − coûts réels et estimés). Estimation, non auditée.
                    </p>
                    <p className="rounded-xl bg-ink-50 px-3 py-2 text-label text-ink-700">
                      <strong>Coût d’infrastructure par collaborateur actif (estimation)</strong> :{" "}
                      {f.active_learner_months > 0 ? `${amount(Math.round((infraCost / f.active_learner_months) * 100) / 100, c.currency)} par mois-collaborateur` : "pas de relevé d’utilisation sur la période"}.
                    </p>
                  </div>
                </CardBody>
              </Card>
            );
          })}

          <Card>
            <CardHeader title="Par contrat" description="Montants cumulés depuis la signature." />
            {f.contracts.length ? (
              <Table caption="Situation financière par contrat">
                <THead>
                  <TR>
                    <TH>Contrat</TH>
                    <TH align="right">Contracté</TH>
                    <TH align="right">Facturé</TH>
                    <TH align="right">Reçu</TH>
                    <TH align="right">Coûts directs</TH>
                  </TR>
                </THead>
                <TBody>
                  {f.contracts.map((c) => (
                    <TR key={c.id}>
                      <TD>
                        <Link href={`/admin/partenariats/entreprises/contrats/${c.id}`} className="font-medium text-ink-900 hover:text-accent-700 hover:underline">
                          {c.reference}
                        </Link>
                        <span className="block text-caption text-ink-500">{c.organization}</span>
                      </TD>
                      <TD align="right">{amount(c.contracted, c.currency)}</TD>
                      <TD align="right">{amount(c.invoiced, c.currency)}</TD>
                      <TD align="right">{amount(c.received, c.currency)}</TD>
                      <TD align="right">{amount(c.direct_costs, c.currency)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            ) : (
              <CardBody>
                <p className="text-body text-ink-600">Aucun contrat signé.</p>
              </CardBody>
            )}
          </Card>

          <Card>
            <CardHeader title="Revenus par catégorie" description="Facturé sur la période." />
            {f.revenue_by_category.length ? (
              <Table caption="Revenus par catégorie">
                <THead>
                  <TR>
                    <TH>Catégorie</TH>
                    <TH align="right">Facturé</TH>
                  </TR>
                </THead>
                <TBody>
                  {f.revenue_by_category.map((r) => (
                    <TR key={`${r.currency}-${r.category}`}>
                      <TD>{REVENUE_CATEGORIES[r.category]}</TD>
                      <TD align="right">{amount(r.invoiced, r.currency)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            ) : (
              <CardBody>
                <p className="text-body text-ink-600">Aucune facture sur la période.</p>
              </CardBody>
            )}
          </Card>
        </div>
      )}

      <Card className="mt-6">
        <CardHeader title="Paiements à confirmer" description="Vérification avec le relevé bancaire, par une autre personne que celle qui a saisi le paiement." />
        {pending.length ? (
          <ul className="divide-y divide-line">
            {pending.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-ink-900">
                    {amount(p.amount, p.invoice?.currency ?? "MAD")} · facture {p.invoice?.external_reference}
                  </p>
                  <p className="text-caption text-ink-500">
                    Reçu le {formatDate(p.received_on)} · {PAYMENT_METHODS[p.method as keyof typeof PAYMENT_METHODS] ?? p.method}
                    {p.bank_reference ? ` · réf. ${p.bank_reference}` : ""}
                    {p.invoice?.contract ? ` · ${p.invoice.contract.reference}` : ""}
                  </p>
                </div>
                {(actor.signatory || viewer.isSanadyAdmin) && p.recorded_by !== viewer.id ? (
                  <ActionButton action={confirmPayment.bind(null, p.id, p.invoice?.contract?.id ?? null)}>Confirmer</ActionButton>
                ) : (
                  <Badge>En attente</Badge>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <CardBody>
            <p className="text-body text-ink-600">Aucun paiement à confirmer.</p>
          </CardBody>
        )}
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <Card>
          <CardHeader title={`Coûts ${year}`} description="Réels (factures de fournisseurs) ou estimés." />
          {costs.length ? (
            <ul className="divide-y divide-line">
              {costs.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-medium text-ink-900">
                      {c.description} {c.is_estimate ? <Badge tone="warning">Estimation</Badge> : null}
                    </p>
                    <p className="text-caption text-ink-500">
                      {COST_CATEGORIES[c.category]} · {formatDate(c.incurred_on)}
                      {c.contract ? ` · ${c.contract.reference}` : " · coût général"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums text-body text-ink-900">{amount(c.amount, c.currency)}</span>
                    {actor.manager ? (
                      <ActionButton variant="danger-ghost" action={deleteCost.bind(null, c.id)} confirm={{ title: "Supprimer ce coût ?", description: c.description, confirmLabel: "Supprimer" }}>
                        <Trash2 aria-hidden /> <span className="sr-only">Supprimer {c.description}</span>
                      </ActionButton>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <CardBody>
              <p className="text-body text-ink-600">Aucun coût enregistré sur la période.</p>
            </CardBody>
          )}
        </Card>
        {actor.manager ? (
          <Card className="self-start">
            <CardHeader title="Nouveau coût" />
            <CardBody>
              <CostForm contracts={contracts} />
            </CardBody>
          </Card>
        ) : null}
      </div>
    </>
  );
}
