import { ATTRIBUTIONS, CONTRIBUTION_KINDS, CONTRIBUTION_STAGE, INTERVENTION_FIELDS, METRIC_TYPES, dimensionLabel, type Attribution, type ContributionKind, type ContributionStage, type InterventionField, type MetricType } from "@/lib/partnerships";
import { createClient } from "@/lib/supabase/server";
import { csvResponse, toCsv } from "@/server/csv";
import { getViewer } from "@/server/auth";
import { partnershipDashboard } from "@/server/queries/impact";

/**
 * CSV exports of partnership impact for one year. Checked twice: a 2FA
 * session here, and the database (partnership_dashboard and RLS) for the
 * partnership team and approvers only. Indicators are aggregates: no
 * teacher or student is ever named.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/exports/partenariats/[report]">) {
  const viewer = await getViewer();
  if (!viewer || viewer.aal !== "aal2") return new Response("Accès refusé.", { status: 401 });
  if (!(await partnershipDashboard())) return new Response("Accès refusé.", { status: 403 });
  const { report } = await ctx.params;
  const annee = new URL(request.url).searchParams.get("annee") ?? "";
  const year = /^\d{4}$/.test(annee) ? Number(annee) : new Date().getFullYear();
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const supabase = await createClient();
  const n = (v: string | number | null | undefined) => (v === null || v === undefined || v === "" ? null : Number(v));

  if (report === "indicateurs") {
    // Verified indicators whose period overlaps the year.
    const { data, error } = await supabase
      .from("partnership_impact_metrics")
      .select("intervention_field, dimension, label, metric_type, value, unit, period_start, period_end, method, attribution, source, verified_at, organization:partner_organizations(name), agreement:partnership_agreements(reference)")
      .eq("status", "verified")
      .lte("period_start", to)
      .gte("period_end", from)
      .order("period_start");
    if (error) return new Response("Export impossible.", { status: 500 });
    const rows = (data ?? []) as unknown as Array<{
      intervention_field: InterventionField; dimension: string; label: string | null; metric_type: MetricType; value: string; unit: string | null; period_start: string; period_end: string;
      method: string; attribution: Attribution; source: string; verified_at: string | null; organization: { name: string } | null; agreement: { reference: string } | null;
    }>;
    return csvResponse(
      `sanady-partenariats-indicateurs_${year}.csv`,
      toCsv(
        ["Partenaire", "Convention", "Domaine", "Indicateur", "Type", "Valeur", "Unité", "Du", "Au", "Part du partenariat", "Origine", "Méthode", "Vérifié le"],
        rows.map((r) => [
          r.organization?.name, r.agreement?.reference, INTERVENTION_FIELDS[r.intervention_field]?.name, dimensionLabel(r.dimension, r.label), METRIC_TYPES[r.metric_type], n(r.value), r.unit,
          r.period_start, r.period_end, ATTRIBUTIONS[r.attribution], r.source === "platform" ? "Calculé depuis SANADY" : "Saisi par l’équipe", r.method, r.verified_at?.slice(0, 10),
        ]),
      ),
    );
  }

  if (report === "contributions") {
    // Contributions received (or delivered) during the year; pledges are not money received.
    const { data, error } = await supabase
      .from("partnership_contributions")
      .select("kind, description, currency, amount_pledged, amount_received, received_on, item, quantity, estimated_value, hours_delivered, stage, organization:partner_organizations(name), agreement:partnership_agreements(reference)")
      .in("stage", ["delivered", "verified"])
      .gte("received_on", from)
      .lte("received_on", to)
      .order("received_on");
    if (error) return new Response("Export impossible.", { status: 500 });
    const rows = (data ?? []) as unknown as Array<{
      kind: ContributionKind; description: string; currency: string; amount_pledged: string | null; amount_received: string | null; received_on: string | null; item: string | null;
      quantity: number | null; estimated_value: string | null; hours_delivered: string | null; stage: ContributionStage; organization: { name: string } | null; agreement: { reference: string } | null;
    }>;
    return csvResponse(
      `sanady-partenariats-contributions_${year}.csv`,
      toCsv(
        ["Partenaire", "Convention", "Type", "Description", "Reçue le", "Montant reçu", "Devise", "Montant promis", "Matériel", "Quantité", "Valeur estimée", "Heures réalisées", "Étape"],
        rows.map((r) => [
          r.organization?.name, r.agreement?.reference, CONTRIBUTION_KINDS[r.kind], r.description, r.received_on, n(r.amount_received), r.kind === "financial" ? r.currency : null, n(r.amount_pledged),
          r.item, r.quantity, n(r.estimated_value), n(r.hours_delivered), CONTRIBUTION_STAGE[r.stage].label,
        ]),
      ),
    );
  }

  return new Response("Introuvable", { status: 404 });
}
