import { NextResponse } from "next/server";
import { publicEnv } from "@/lib/env";
import { renderCertificatePdf } from "@/lib/pdf/certificate";
import { createClient } from "@/lib/supabase/server";
import type { Certificate, PlatformSettings } from "@/lib/types";
import { uuidSchema } from "@/lib/validation";
import { getViewer } from "@/server/auth";

/**
 * Generates the certificate PDF on demand. Access is decided by RLS on
 * `certificates` (owner, SANADY admins, or the assigning institution).
 * Generation is deterministic: the same certificate always yields the same
 * document; nothing is stored, so there is nothing to duplicate.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/certificats/[certificateId]">) {
  const { certificateId } = await ctx.params;
  if (!uuidSchema.safeParse(certificateId).success) return new NextResponse("Introuvable", { status: 404 });

  const viewer = await getViewer();
  if (!viewer) return new NextResponse("Authentification requise", { status: 401 });

  const supabase = await createClient();
  const [{ data: cert }, { data: settings }] = await Promise.all([
    supabase.from("certificates").select("*").eq("id", certificateId).maybeSingle(),
    supabase.from("platform_settings").select("*").maybeSingle(),
  ]);
  const certificate = cert as Certificate | null;
  if (!certificate) return new NextResponse("Introuvable", { status: 404 });
  if (certificate.revoked_at) return new NextResponse("Ce certificat a été révoqué.", { status: 410 });

  const s = settings as PlatformSettings | null;
  const bytes = await renderCertificatePdf({
    certificateNumber: certificate.certificate_number,
    recipientName: certificate.recipient_name,
    courseTitle: certificate.course_title,
    durationMinutes: certificate.course_duration_minutes,
    completedAt: certificate.completed_at,
    issuedAt: certificate.issued_at,
    issuerName: s?.certificate_issuer_name ?? "SANADY",
    signatoryName: s?.certificate_signatory_name,
    signatoryTitle: s?.certificate_signatory_title,
    verificationUrl: `${publicEnv.appUrl}/verifier/${certificate.verification_code}`,
  });

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="certificat-${certificate.certificate_number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
