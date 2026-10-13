import { NextResponse } from "next/server";
import { renderPartnerReportPdf, reportPdfData } from "@/lib/pdf/partner-report";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation";
import { getViewer } from "@/server/auth";
import type { PartnerReportData } from "@/server/queries/impact";

/**
 * A report already shared with the partner's organisation, for its portal
 * members (public.portal_report_data checks membership and status).
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/espace-partenaire/rapports/[reportId]">) {
  const { reportId } = await ctx.params;
  if (!uuidSchema.safeParse(reportId).success) return new NextResponse("Introuvable", { status: 404 });
  const viewer = await getViewer();
  if (!viewer) return new NextResponse("Authentification requise", { status: 401 });
  const { data, error } = await (await createClient()).rpc("portal_report_data", { p_report: reportId });
  if (error || !data) return new NextResponse("Introuvable", { status: 404 });
  const d = data as PartnerReportData;
  const bytes = await renderPartnerReportPdf(reportPdfData(d));
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="rapport-${d.report.reference}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
