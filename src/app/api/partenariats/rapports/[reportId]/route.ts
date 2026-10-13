import { NextResponse } from "next/server";
import { renderPartnerReportPdf } from "@/lib/pdf/partner-report";
import { uuidSchema } from "@/lib/validation";
import { getViewer } from "@/server/auth";
import { partnerReportData } from "@/server/queries/impact";

/**
 * Partner impact report PDF, generated on demand from verified data
 * (public.partner_report_data decides who may read it: partnership staff
 * and approvers, two-factor sessions only). A draft is marked as such.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/partenariats/rapports/[reportId]">) {
  const { reportId } = await ctx.params;
  if (!uuidSchema.safeParse(reportId).success) return new NextResponse("Introuvable", { status: 404 });
  const viewer = await getViewer();
  if (!viewer || viewer.aal !== "aal2") return new NextResponse("Accès refusé.", { status: 401 });

  const d = await partnerReportData(reportId);
  if (!d) return new NextResponse("Introuvable", { status: 404 });
  const bytes = await renderPartnerReportPdf({
    reference: d.report.reference,
    title: d.report.title,
    periodStart: d.report.period_start,
    periodEnd: d.report.period_end,
    approved: d.report.approved_at ? { by: d.approver, at: d.report.approved_at } : null,
    draft: d.report.status === "draft",
    organization: { name: d.organization.name, place: [d.organization.city, d.organization.country].filter(Boolean).join(", ") || null },
    agreements: d.agreements.map((a) => ({ reference: a.reference, title: a.title, objectives: a.objectives, field: a.field, startOn: a.start_on, endOn: a.end_on })),
    projects: d.projects,
    contributions: d.contributions.map((c) => ({
      kind: c.kind,
      description: c.description,
      stage: c.stage,
      currency: c.currency,
      amountPledged: c.amount_pledged,
      amountReceived: c.amount_received,
      item: c.item,
      quantity: c.quantity,
      hoursPledged: c.hours_pledged,
      hoursDelivered: c.hours_delivered,
    })),
    milestones: d.milestones.map((m) => ({ title: m.title, doneAt: m.done_at })),
    activities: d.report.activities,
    metrics: d.metrics.map((m) => ({ field: m.field, dimension: m.dimension, label: m.label, type: m.type, value: m.value, unit: m.unit, method: m.method, attribution: m.attribution })),
    challenges: d.report.challenges,
    futureOpportunities: d.report.future_opportunities,
    generatedAt: new Date().toISOString(),
  });
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="rapport-${d.report.reference}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
