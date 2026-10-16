import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { PDFDocument } from "pdf-lib";
import { BRAND_LOGO_PNG_BASE64 } from "@/lib/pdf/brand-logo";
import { renderCertificatePdf } from "@/lib/pdf/certificate";
import { LOGO_MAX_BYTES, checkLogo } from "@/server/logo";

const png = new Uint8Array(Buffer.from(BRAND_LOGO_PNG_BASE64, "base64"));

describe("company logo check", () => {
  it("accepts a real PNG and reports its size", async () => {
    const r = await checkLogo(png);
    expect(r.ok && r.type === "png" && r.width > 0).toBe(true);
  });

  it("refuses SVG, a file merely renamed, a broken image and an oversize file", async () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    expect(await checkLogo(svg)).toMatchObject({ ok: false });
    expect(await checkLogo(new TextEncoder().encode("%PDF-1.7 fake"))).toMatchObject({ ok: false });
    expect(await checkLogo(png.slice(0, 40))).toMatchObject({ ok: false, message: expect.stringMatching(/n’a pas pu être lue/) });
    const big = new Uint8Array(LOGO_MAX_BYTES + 1);
    big.set(png.slice(0, 8));
    expect(await checkLogo(big)).toMatchObject({ ok: false, message: "Le logo dépasse 1 Mo." });
  });

  it("is drawn on the certificate beside the Foundation logo", async () => {
    const base = { certificateNumber: "SND-2026-ABCDEF12", recipientName: "Employé", courseTitle: "Sécurité", durationMinutes: 60, completedAt: "2026-10-01", issuedAt: "2026-10-01", issuerName: "Fondation Sanady", verificationUrl: "https://example.org/verifier/x", kind: "attestation" as const, organization: "Société" };
    const without = await PDFDocument.load(await renderCertificatePdf(base));
    const withLogo = await PDFDocument.load(await renderCertificatePdf({ ...base, organizationLogo: { bytes: png, type: "png" } }));
    const images = (d: PDFDocument) => d.context.enumerateIndirectObjects().filter(([, o]) => String((o as { dict?: Map<unknown, unknown> }).dict?.get?.(d.context.obj("Subtype")) ?? "") === "/Image").length;
    expect(images(withLogo)).toBeGreaterThan(images(without));
  });
});
