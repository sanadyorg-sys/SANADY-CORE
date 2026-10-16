import { NextResponse } from "next/server";
import { publicEnv } from "@/lib/env";
import { renderCertificatePdf } from "@/lib/pdf/certificate";
import { createAdminClient } from "@/lib/supabase/admin";
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
  const [{ data: cert }, { data: settings }, { data: style }] = await Promise.all([
    supabase.from("certificates").select("*").eq("id", certificateId).maybeSingle(),
    supabase.from("platform_settings").select("*").maybeSingle(),
    // Courses owned by a company workspace follow its document wording.
    supabase.rpc("certificate_style", { p_certificate: certificateId }),
  ]);
  const company = style as { kind: "certificat" | "attestation"; organization: string; logo_path: string | null } | null;
  const certificate = cert as Certificate | null;
  if (!certificate) return new NextResponse("Introuvable", { status: 404 });
  if (certificate.revoked_at) return new NextResponse("Ce certificat a été révoqué.", { status: 410 });

  // certificate_style already decided this person may see the company's styling.
  let organizationLogo: { bytes: Uint8Array; type: "png" | "jpg" } | null = null;
  if (company?.logo_path) {
    const { data: file } = await createAdminClient().storage.from("enterprise-logos").download(company.logo_path);
    if (file) organizationLogo = { bytes: new Uint8Array(await file.arrayBuffer()), type: company.logo_path.endsWith(".png") ? "png" : "jpg" };
  }

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
    kind: company?.kind ?? "certificat",
    organization: company?.organization ?? null,
    organizationLogo,
  });

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${company?.kind === "attestation" ? "attestation" : "certificat"}-${certificate.certificate_number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
