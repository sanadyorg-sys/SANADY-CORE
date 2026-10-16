import { COST_CATEGORIES, CONTRACT_STATUS, PAYMENT_METHODS, REVENUE_CATEGORIES, type ContractStatus, type CostCategory, type RevenueCategory } from "@/lib/enterprise";
import { createClient } from "@/lib/supabase/server";
import { csvResponse, toCsv } from "@/server/csv";
import { getViewer } from "@/server/auth";
import { enterpriseFinance } from "@/server/queries/finance";

/**
 * CSV exports of SANADY Enterprise finances for one year (for the
 * Foundation's accountant). Checked twice: a 2FA session here, and the
 * database (enterprise_finance and RLS) for the finance readers only —
 * enterprise manager, SANADY administrators, approvers.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/exports/entreprises/[report]">) {
  const viewer = await getViewer();
  if (!viewer || viewer.aal !== "aal2") return new Response("Accès refusé.", { status: 401 });
  const { report } = await ctx.params;
  const annee = new URL(request.url).searchParams.get("annee") ?? "";
  const year = /^\d{4}$/.test(annee) ? Number(annee) : new Date().getFullYear();
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const overview = await enterpriseFinance(from, to);
  if (!overview) return new Response("Accès refusé.", { status: 403 });
  const supabase = await createClient();
  const n = (v: string | number | null | undefined) => (v === null || v === undefined || v === "" ? null : Number(v));

  if (report === "factures") {
    const { data, error } = await supabase
      .from("enterprise_invoices")
      .select("external_reference, category, description, amount, currency, issued_on, due_on, cancelled_at, cancel_reason, contract:enterprise_contracts(reference, organization:partner_organizations(name)), payments:enterprise_payments(amount)")
      .gte("issued_on", from)
      .lte("issued_on", to)
      .order("issued_on");
    if (error) return new Response("Export impossible.", { status: 500 });
    const rows = (data ?? []) as unknown as Array<{
      external_reference: string; category: RevenueCategory; description: string | null; amount: string; currency: string; issued_on: string; due_on: string | null;
      cancelled_at: string | null; cancel_reason: string | null; contract: { reference: string; organization: { name: string } | null } | null; payments: Array<{ amount: string }>;
    }>;
    return csvResponse(
      `sanady-entreprises-factures_${year}.csv`,
      toCsv(
        ["N° de facture", "Contrat", "Client", "Catégorie", "Description", "Montant", "Devise", "Émise le", "Échéance", "Reçu", "Reste dû", "Statut", "Motif d’annulation"],
        rows.map((r) => {
          const received = r.payments.reduce((s, p) => s + Number(p.amount), 0);
          return [
            r.external_reference, r.contract?.reference, r.contract?.organization?.name, REVENUE_CATEGORIES[r.category], r.description, n(r.amount), r.currency, r.issued_on, r.due_on,
            received, r.cancelled_at ? 0 : Math.round((Number(r.amount) - received) * 100) / 100, r.cancelled_at ? "Annulée" : "Valide", r.cancel_reason,
          ];
        }),
      ),
    );
  }

  if (report === "paiements") {
    const { data, error } = await supabase
      .from("enterprise_payments")
      .select("amount, received_on, method, bank_reference, confirmed_at, invoice:enterprise_invoices!inner(external_reference, currency, contract:enterprise_contracts(reference))")
      .gte("received_on", from)
      .lte("received_on", to)
      .order("received_on");
    if (error) return new Response("Export impossible.", { status: 500 });
    const rows = (data ?? []) as unknown as Array<{ amount: string; received_on: string; method: keyof typeof PAYMENT_METHODS; bank_reference: string | null; confirmed_at: string | null; invoice: { external_reference: string; currency: string; contract: { reference: string } | null } }>;
    return csvResponse(
      `sanady-entreprises-paiements_${year}.csv`,
      toCsv(
        ["Reçu le", "Montant", "Devise", "Facture", "Contrat", "Moyen", "Référence bancaire", "Confirmé"],
        rows.map((r) => [r.received_on, n(r.amount), r.invoice.currency, r.invoice.external_reference, r.invoice.contract?.reference, PAYMENT_METHODS[r.method], r.bank_reference, r.confirmed_at ? `Oui (${r.confirmed_at.slice(0, 10)})` : "Non"]),
      ),
    );
  }

  if (report === "couts") {
    const { data, error } = await supabase
      .from("enterprise_costs")
      .select("incurred_on, category, description, amount, currency, is_estimate, contract:enterprise_contracts(reference)")
      .gte("incurred_on", from)
      .lte("incurred_on", to)
      .order("incurred_on");
    if (error) return new Response("Export impossible.", { status: 500 });
    const rows = (data ?? []) as unknown as Array<{ incurred_on: string; category: CostCategory; description: string; amount: string; currency: string; is_estimate: boolean; contract: { reference: string } | null }>;
    return csvResponse(
      `sanady-entreprises-couts_${year}.csv`,
      toCsv(
        ["Date", "Catégorie", "Description", "Montant", "Devise", "Nature", "Contrat"],
        rows.map((r) => [r.incurred_on, COST_CATEGORIES[r.category], r.description, n(r.amount), r.currency, r.is_estimate ? "Estimation" : "Réel", r.contract?.reference ?? "Coût général"]),
      ),
    );
  }

  if (report === "contrats") {
    return csvResponse(
      `sanady-entreprises-contrats_${year}.csv`,
      toCsv(
        ["Contrat", "Intitulé", "Client", "Statut", "Devise", "Contracté", "Facturé (cumul)", "Reçu (cumul)", "Coûts directs (cumul)"],
        overview.contracts.map((c) => [c.reference, c.title, c.organization, CONTRACT_STATUS[c.status as ContractStatus]?.label ?? c.status, c.currency, n(c.contracted), n(c.invoiced), n(c.received), n(c.direct_costs)]),
      ),
    );
  }

  return new Response("Introuvable", { status: 404 });
}
