import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { BRAND_LOGO_PNG_BASE64 } from "./brand-logo";
import { COLORS, pdfDate, pdfDuration, pdfSafe, wrapText } from "./common";

export interface CertificateData {
  certificateNumber: string;
  recipientName: string;
  courseTitle: string;
  durationMinutes: number | null;
  completedAt: string;
  issuedAt: string;
  issuerName: string;
  signatoryName?: string | null;
  signatoryTitle?: string | null;
  verificationUrl: string;
  /** Company workspaces may issue an « attestation de formation » (SANADY Enterprise). */
  kind?: "certificat" | "attestation";
  /** Company that ordered the training, shown on its employees' documents. */
  organization?: string | null;
}

/**
 * Printable A4 landscape certificate with academic prestige styling and verification QR code.
 * Features:
 * - Subtle ivory parchment background with multi-tier gold and charcoal borders
 * - Classical serif typography (Times-Roman) paired with crisp modern sans-serif (Helvetica)
 * - Vector corner filigree ornaments and background guilloche security watermark
 * - Vector gold/orange official security rosette seal
 * - Pedagogical validation statement complying with non-regulated training disclosure.
 */
export async function renderCertificatePdf(data: CertificateData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(pdfSafe(`Certificat ${data.certificateNumber}`));
  pdf.setAuthor(pdfSafe(data.issuerName));
  pdf.setSubject(pdfSafe(data.courseTitle));
  pdf.setCreator("Fondation Sanady");
  pdf.setProducer("Fondation Sanady");
  pdf.setCreationDate(new Date(data.issuedAt));

  const page = pdf.addPage([841.89, 595.28]); // A4 landscape
  const { width, height } = page.getSize();

  // Typography: Classical academic serif + crisp sans-serif metadata
  const timesBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const timesItalic = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const helvetica = await pdf.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // Harmonious bespoke color palette for certificate
  const parchment = rgb(0.996, 0.993, 0.988);
  const parchmentInner = rgb(1, 1, 1);
  const charcoal = rgb(0.11, 0.10, 0.09); // #1C1917
  const gold = rgb(0.85, 0.58, 0.15); // #D97706
  const goldLight = rgb(0.99, 0.96, 0.91); // #FEF3C7
  const orange = rgb(0.976, 0.353, 0.02); // #F95A05
  const orangeDark = rgb(0.722, 0.247, 0.0); // #B83F00
  const warmBorder = rgb(0.89, 0.86, 0.82); // #E3E0DB
  const softMuted = rgb(0.43, 0.41, 0.38); // #6E6962

  const center = (text: string, y: number, size: number, font = helvetica, color = COLORS.ink) => {
    const safe = pdfSafe(text);
    const textWidth = font.widthOfTextAtSize(safe, size);
    page.drawText(safe, { x: (width - textWidth) / 2, y, size, font, color });
  };

  // 1. Canvas Background
  page.drawRectangle({ x: 0, y: 0, width, height, color: parchment });

  // 2. Multi-tier Classical Diploma Frame
  // Outer Charcoal Border
  page.drawRectangle({
    x: 18,
    y: 18,
    width: width - 36,
    height: height - 36,
    borderColor: charcoal,
    borderWidth: 2,
    color: parchment,
  });

  // Intermediate Hairline
  page.drawRectangle({
    x: 23,
    y: 23,
    width: width - 46,
    height: height - 46,
    borderColor: warmBorder,
    borderWidth: 0.6,
  });

  // Inner Orange/Gold Filigree Border
  page.drawRectangle({
    x: 27,
    y: 27,
    width: width - 54,
    height: height - 54,
    borderColor: orange,
    borderWidth: 1.2,
    color: parchmentInner,
  });

  // Secondary Inset Guide
  page.drawRectangle({
    x: 32,
    y: 32,
    width: width - 64,
    height: height - 64,
    borderColor: rgb(0.94, 0.91, 0.86),
    borderWidth: 0.5,
  });

  // 3. Classical Corner Quadrant Ornaments (TL, TR, BL, BR)
  const drawCornerFlourish = (cx: number, cy: number, dx: number, dy: number) => {
    // Nested square corner ornaments
    page.drawRectangle({
      x: cx - 5,
      y: cy - 5,
      width: 10,
      height: 10,
      color: charcoal,
    });
    page.drawRectangle({
      x: cx - 2.5,
      y: cy - 2.5,
      width: 5,
      height: 5,
      color: orange,
    });
    // Horizontal pinstripe extension
    page.drawLine({
      start: { x: cx + dx * 8, y: cy },
      end: { x: cx + dx * 34, y: cy },
      thickness: 1,
      color: gold,
    });
    // Vertical pinstripe extension
    page.drawLine({
      start: { x: cx, y: cy + dy * 8 },
      end: { x: cx, y: cy + dy * 34 },
      thickness: 1,
      color: gold,
    });
  };

  drawCornerFlourish(27, height - 27, 1, -1); // Top-Left
  drawCornerFlourish(width - 27, height - 27, -1, -1); // Top-Right
  drawCornerFlourish(27, 27, 1, 1); // Bottom-Left
  drawCornerFlourish(width - 27, 27, -1, 1); // Bottom-Right

  // 4. Subtle Background Security Watermark (Guilloche Rosette)
  const watermarkCenter = { x: width / 2, y: height / 2 - 14 };
  const watermarkRings = [190, 145, 105, 68];
  for (const radius of watermarkRings) {
    page.drawCircle({
      x: watermarkCenter.x,
      y: watermarkCenter.y,
      size: radius,
      borderColor: rgb(0.965, 0.955, 0.94),
      borderWidth: 0.5,
    });
  }

  // 5. Official Fondation Sanady Logo (Centered, Scaled with Perfect Proportions)
  const logo = await pdf.embedPng(Buffer.from(BRAND_LOGO_PNG_BASE64, "base64"));
  const logoHeight = 46;
  const logoWidth = (logo.width / logo.height) * logoHeight;
  page.drawImage(logo, {
    x: (width - logoWidth) / 2,
    y: height - 90,
    width: logoWidth,
    height: logoHeight,
  });

  // Institution Sub-header
  const headerSubtitle = "DÉVELOPPEMENT PROFESSIONNEL DES ENSEIGNANTS • PLATEFORME SANADY";
  center(headerSubtitle, height - 105, 7.5, helveticaBold, softMuted);

  // Decorative Rule with Center Diamond
  const dividerY = height - 118;
  page.drawLine({
    start: { x: width / 2 - 140, y: dividerY },
    end: { x: width / 2 - 16, y: dividerY },
    thickness: 0.8,
    color: gold,
  });
  page.drawLine({
    start: { x: width / 2 + 16, y: dividerY },
    end: { x: width / 2 + 140, y: dividerY },
    thickness: 0.8,
    color: gold,
  });
  // Center Diamond
  page.drawRectangle({
    x: width / 2 - 3.5,
    y: dividerY - 3.5,
    width: 7,
    height: 7,
    rotate: degrees(45),
    color: orange,
  });

  // 6. Main Diploma Title
  const attestation = data.kind === "attestation";
  center(attestation ? "ATTESTATION DE FORMATION" : "CERTIFICAT DE FIN DE FORMATION", height - 156, 24, timesBold, charcoal);

  // Title underline accent
  page.drawLine({
    start: { x: width / 2 - 50, y: height - 168 },
    end: { x: width / 2 + 50, y: height - 168 },
    thickness: 1.4,
    color: orange,
  });

  // 7. Recipient Lead-in & Name
  center(attestation ? "Cette attestation est délivrée à" : "Ce certificat est décerné à", height - 200, 11.5, timesItalic, softMuted);

  const recipientName = data.recipientName;
  const nameSafe = pdfSafe(recipientName);
  let nameSize = 28;
  if (timesBold.widthOfTextAtSize(nameSafe, nameSize) > width - 240) {
    nameSize = 22;
  }
  center(recipientName, height - 236, nameSize, timesBold, charcoal);

  // Elegant decorative underline flourish below recipient name
  const nameWidth = Math.min(320, timesBold.widthOfTextAtSize(nameSafe, nameSize) + 40);
  page.drawLine({
    start: { x: (width - nameWidth) / 2, y: height - 248 },
    end: { x: (width + nameWidth) / 2, y: height - 248 },
    thickness: 0.7,
    color: gold,
  });

  // 8. Course Narrative & Achievement Statement
  center("pour avoir suivi avec succès l’intégralité de la formation", height - 272, 11, timesItalic, softMuted);

  const titleLines = wrapText(`« ${data.courseTitle} »`, timesBold, 17, width - 220).slice(0, 2);
  titleLines.forEach((line, i) => {
    center(line, height - 298 - i * 22, 17, timesBold, orangeDark);
  });
  const afterTitleY = height - 298 - (titleLines.length - 1) * 22;

  center(
    "et réussi l’évaluation de chacun de ses modules (70 % de bonnes réponses au minimum).",
    afterTitleY - 24,
    10,
    timesItalic,
    softMuted,
  );

  // 9. Verified Facts & Academic Record Card
  const cardY = 136;
  const cardHeight = 44;
  const cardX = 72;
  const cardWidth = width - 144;

  // Crisp background panel for credentials
  page.drawRectangle({
    x: cardX,
    y: cardY,
    width: cardWidth,
    height: cardHeight,
    color: rgb(0.985, 0.98, 0.97),
    borderColor: warmBorder,
    borderWidth: 0.7,
  });

  const facts: Array<{ label: string; value: string; isBold?: boolean }> = [
    { label: "DATE D’ACHÈVEMENT", value: pdfDate(data.completedAt) },
    { label: "DURÉE", value: pdfDuration(data.durationMinutes) },
    { label: "NUMÉRO DE CERTIFICAT", value: data.certificateNumber, isBold: true },
    { label: "STATUT", value: "FORMATION VALIDÉE", isBold: true },
  ];

  const colWidth = cardWidth / facts.length;
  facts.forEach((fact, i) => {
    const colX = cardX + i * colWidth + 14;
    page.drawText(pdfSafe(fact.label), {
      x: colX,
      y: cardY + 26,
      size: 7,
      font: helveticaBold,
      color: i === 3 ? orangeDark : softMuted,
    });
    page.drawText(pdfSafe(fact.value), {
      x: colX,
      y: cardY + 11,
      size: 10,
      font: fact.isBold ? helveticaBold : helvetica,
      color: i === 3 ? COLORS.success : charcoal,
    });

    if (i > 0) {
      page.drawLine({
        start: { x: cardX + i * colWidth, y: cardY + 7 },
        end: { x: cardX + i * colWidth, y: cardY + cardHeight - 7 },
        thickness: 0.5,
        color: warmBorder,
      });
    }
  });

  // 10. Bottom Section: Tri-part Balance
  // Left: Official Signatory
  const sigX = 72;
  const sigY = 74;

  // Signatory simulated flourish line
  page.drawLine({
    start: { x: sigX, y: sigY + 18 },
    end: { x: sigX + 210, y: sigY + 18 },
    thickness: 0.8,
    color: charcoal,
  });
  page.drawText(pdfSafe(data.signatoryName || data.issuerName), {
    x: sigX,
    y: sigY + 4,
    size: 10.5,
    font: timesBold,
    color: charcoal,
  });
  page.drawText(pdfSafe(data.signatoryTitle || "Organisme émetteur — Fondation Sanady"), {
    x: sigX,
    y: sigY - 10,
    size: 8,
    font: helvetica,
    color: softMuted,
  });
  page.drawText(pdfSafe(`Délivré le ${pdfDate(data.issuedAt)}`), {
    x: sigX,
    y: sigY - 21,
    size: 7.5,
    font: helvetica,
    color: softMuted,
  });

  // Center: Official Security Rosette Medallion
  const sealCenter = { x: width / 2, y: 78 };
  // Outer decorative circle
  page.drawCircle({
    x: sealCenter.x,
    y: sealCenter.y,
    size: 34,
    color: goldLight,
    borderColor: gold,
    borderWidth: 1.5,
  });
  // Inner ring
  page.drawCircle({
    x: sealCenter.x,
    y: sealCenter.y,
    size: 27,
    borderColor: orange,
    borderWidth: 0.7,
  });
  // Central disc
  page.drawCircle({
    x: sealCenter.x,
    y: sealCenter.y,
    size: 21,
    color: rgb(1, 1, 1),
    borderColor: gold,
    borderWidth: 0.5,
  });

  // Medallion micro-text & star
  const sealTopText = "FONDATION SANADY";
  const sealTopWidth = helveticaBold.widthOfTextAtSize(sealTopText, 4.5);
  page.drawText(sealTopText, {
    x: sealCenter.x - sealTopWidth / 2,
    y: sealCenter.y + 10,
    size: 4.5,
    font: helveticaBold,
    color: softMuted,
  });

  const sealMidText = attestation ? "ATTESTATION" : "CERTIFICAT";
  const sealMidWidth = helveticaBold.widthOfTextAtSize(sealMidText, 5.5);
  page.drawText(sealMidText, {
    x: sealCenter.x - sealMidWidth / 2,
    y: sealCenter.y - 1,
    size: 5.5,
    font: helveticaBold,
    color: orangeDark,
  });

  const sealBotText = "VÉRIFIABLE";
  const sealBotWidth = helveticaBold.widthOfTextAtSize(sealBotText, 4.5);
  page.drawText(sealBotText, {
    x: sealCenter.x - sealBotWidth / 2,
    y: sealCenter.y - 10,
    size: 4.5,
    font: helveticaBold,
    color: COLORS.success,
  });

  // Right: Cryptographic QR Code Verification Card
  const qrBoxWidth = 140;
  const qrBoxHeight = 84;
  const qrBoxX = width - 72 - qrBoxWidth;
  const qrBoxY = 46;

  // Clean QR card background
  page.drawRectangle({
    x: qrBoxX,
    y: qrBoxY,
    width: qrBoxWidth,
    height: qrBoxHeight,
    color: rgb(1, 1, 1),
    borderColor: warmBorder,
    borderWidth: 0.6,
  });

  // Generate crisp QR code
  const qrSize = 58;
  const qrPng = await QRCode.toBuffer(data.verificationUrl, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 260,
    color: { dark: "#1C1917", light: "#FFFFFF" },
  });
  const qr = await pdf.embedPng(qrPng);
  page.drawImage(qr, {
    x: qrBoxX + 8,
    y: qrBoxY + 13,
    width: qrSize,
    height: qrSize,
  });

  // QR Side Text
  const qrTextX = qrBoxX + qrSize + 14;
  page.drawText(pdfSafe("VÉRIFICATION"), {
    x: qrTextX,
    y: qrBoxY + 54,
    size: 6.5,
    font: helveticaBold,
    color: orangeDark,
  });
  page.drawText(pdfSafe("Scan QR Code"), {
    x: qrTextX,
    y: qrBoxY + 43,
    size: 6.5,
    font: helvetica,
    color: softMuted,
  });
  page.drawText(pdfSafe("pour vérifier"), {
    x: qrTextX,
    y: qrBoxY + 34,
    size: 6.5,
    font: helvetica,
    color: softMuted,
  });
  page.drawText(pdfSafe("l'authenticité."), {
    x: qrTextX,
    y: qrBoxY + 25,
    size: 6.5,
    font: helvetica,
    color: softMuted,
  });

  const urlDomain = (() => {
    try {
      return `${new URL(data.verificationUrl).host}/verifier`;
    } catch {
      return "verifier";
    }
  })();
  page.drawText(pdfSafe(urlDomain), {
    x: qrBoxX + 8,
    y: qrBoxY + 4,
    size: 5.5,
    font: helvetica,
    color: softMuted,
  });

  // 11. Regulatory & Pedagogical Disclaimer
  wrapText(
    `${attestation ? "Cette attestation" : "Ce certificat"} atteste le suivi complet d’une formation sur la plateforme SANADY${data.organization ? ` (espace ${data.organization})` : ""} et la réussite de ses évaluations. Il ne constitue ni un diplôme ni une certification professionnelle réglementée. Vérification en ligne : ${data.verificationUrl.replace(/^https?:\/\//, "")}`,
    helvetica,
    5.8,
    width - 190,
  ).forEach((line, i) => {
    // Inside the frame, below the signature, seal and QR blocks.
    center(line, 38 - i * 7, 5.8, helvetica, rgb(0.55, 0.53, 0.50));
  });

  return pdf.save();
}
