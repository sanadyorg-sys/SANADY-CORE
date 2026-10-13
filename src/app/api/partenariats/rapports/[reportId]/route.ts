import { NextResponse } from "next/server";
import { renderPartnerReportPdf, reportPdfData } from "@/lib/pdf/partner-report";
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
  const bytes = await renderPartnerReportPdf(reportPdfData(d));
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="rapport-${d.report.reference}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
