import { NextResponse } from "next/server";
import { displayName } from "@/lib/format";
import { renderTeacherReportPdf } from "@/lib/pdf/report";
import { uuidSchema } from "@/lib/validation";
import { getViewer } from "@/server/auth";
import { buildTeacherReport } from "@/server/queries/institution";
import { rateLimit } from "@/server/rate-limit";

/** Individual progress report (PDF) for an institution administrator. */
export async function GET(_request: Request, ctx: RouteContext<"/api/rapports/[institutionId]/[userId]">) {
  const { institutionId, userId } = await ctx.params;
  if (!uuidSchema.safeParse(institutionId).success || !uuidSchema.safeParse(userId).success) {
    return new NextResponse("Introuvable", { status: 404 });
  }

  const viewer = await getViewer();
  if (!viewer) return new NextResponse("Authentification requise", { status: 401 });
  const institution = viewer.adminInstitutions.find((i) => i.id === institutionId);
  if (!institution) return new NextResponse("Accès refusé", { status: 403 });
  if (!(await rateLimit(`report:${viewer.id}`, 60, 10 * 60))) return new NextResponse("Trop de demandes", { status: 429 });

  const report = await buildTeacherReport(institution, userId, displayName(viewer.profile));
  if (!report) return new NextResponse("Introuvable", { status: 404 });

  const bytes = await renderTeacherReportPdf(report);
  const slug = report.teacher.name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="rapport-${slug || "enseignant"}-${date}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
