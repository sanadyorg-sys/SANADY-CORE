import { Card, CardBody, CardHeader } from "@/components/ui/surface";
import { ENTERPRISE_PIPELINE, type EnterpriseStage } from "@/lib/enterprise";
import { PIPELINE, formatAmount, type PipelineStatus } from "@/lib/partnerships";
import type { Relationships } from "@/server/queries/finance";

/**
 * One organisation, two relationships (brief V3 §25): partnership
 * (donations, cooperation) and SANADY Enterprise (paid services). Shown side
 * by side, never added together: a purchase is not a donation.
 */
export function RelationshipCard({ r }: { r: Relationships }) {
  const money = (rows: Array<{ currency: string; amount: string }> | null) =>
    rows && rows.length ? rows.map((x) => formatAmount(x.amount, x.currency)).join(" · ") : "—";
  return (
    <Card>
      <CardHeader title="Relation avec la Fondation" description="Partenariat et services aux entreprises restent séparés : un achat n’est jamais un don." />
      <CardBody className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-line p-3">
          <h3 className="text-label font-semibold text-ink-800">Partenariat</h3>
          <dl className="mt-2 space-y-1 text-label text-ink-700">
            <div className="flex justify-between gap-2">
              <dt>Étape</dt>
              <dd className="text-right text-ink-900">{r.partnership.status ? PIPELINE[r.partnership.status as PipelineStatus] : "Aucun partenariat"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Conventions signées</dt>
              <dd className="text-ink-900">{r.partnership.agreements}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Dons reçus</dt>
              <dd className="text-right text-ink-900">{money(r.partnership.contributions_received)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Contributions en nature</dt>
              <dd className="text-ink-900">{r.partnership.in_kind}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Indicateurs d’impact vérifiés</dt>
              <dd className="text-ink-900">{r.partnership.verified_metrics}</dd>
            </div>
          </dl>
        </div>
        <div className="rounded-xl border border-line p-3">
          <h3 className="text-label font-semibold text-ink-800">SANADY Enterprise</h3>
          <dl className="mt-2 space-y-1 text-label text-ink-700">
            <div className="flex justify-between gap-2">
              <dt>Étape</dt>
              <dd className="text-right text-ink-900">{r.enterprise.status ? ENTERPRISE_PIPELINE[r.enterprise.status as EnterpriseStage] : "Aucune relation"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Contrats signés</dt>
              <dd className="text-ink-900">{r.enterprise.contracts}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Espaces de formation</dt>
              <dd className="text-ink-900">{r.enterprise.workspaces}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Formations sur mesure</dt>
              <dd className="text-ink-900">{r.enterprise.projects}</dd>
            </div>
            {r.enterprise.invoiced ? (
              <div className="flex justify-between gap-2">
                <dt>Facturé (services)</dt>
                <dd className="text-right text-ink-900">{money(r.enterprise.invoiced)}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      </CardBody>
    </Card>
  );
}
