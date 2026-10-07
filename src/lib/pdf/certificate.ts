import { PDFDocument, StandardFonts } from "pdf-lib";
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
}

/**
 * Printable A4 landscape certificate with a verification QR code.
 * Wording deliberately makes no claim of accreditation or professional
 * recognition: it attests completion and assessment success on SANADY.
 */
export async function renderCertificatePdf(data: CertificateData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(pdfSafe(`Certificat ${data.certificateNumber}`));
  pdf.setAuthor(pdfSafe(data.issuerName));
  pdf.setSubject(pdfSafe(data.courseTitle));
  pdf.setCreator("SANADY");
  pdf.setProducer("SANADY");
  pdf.setCreationDate(new Date(data.issuedAt));

  const page = pdf.addPage([841.89, 595.28]); // A4 landscape
  const { width, height } = page.getSize();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const center = (text: string, y: number, size: number, font = regular, color = COLORS.ink) => {
    const safe = pdfSafe(text);
    page.drawText(safe, { x: (width - font.widthOfTextAtSize(safe, size)) / 2, y, size, font, color });
  };

  // Frame
  page.drawRectangle({ x: 0, y: 0, width, height, color: COLORS.white });
  page.drawRectangle({ x: 22, y: 22, width: width - 44, height: height - 44, borderColor: COLORS.brand, borderWidth: 1.6 });
  page.drawRectangle({ x: 30, y: 30, width: width - 60, height: height - 60, borderColor: COLORS.accent, borderWidth: 0.5 });
  page.drawRectangle({ x: 22, y: height - 30, width: width - 44, height: 8, color: COLORS.accent });

  // Official logo (never recoloured or stretched: scaled by height only).
  const logo = await pdf.embedPng(Buffer.from(BRAND_LOGO_PNG_BASE64, "base64"));
  const logoHeight = 52;
  const logoWidth = (logo.width / logo.height) * logoHeight;
  page.drawImage(logo, { x: (width - logoWidth) / 2, y: height - 100, width: logoWidth, height: logoHeight });
  center("Plateforme de formation et de développement professionnel des enseignants", height - 116, 9, regular, COLORS.muted);

  center("CERTIFICAT DE FIN DE FORMATION", height - 160, 24, bold, COLORS.brand);
  page.drawLine({
    start: { x: width / 2 - 40, y: height - 176 },
    end: { x: width / 2 + 40, y: height - 176 },
    thickness: 1.2,
    color: COLORS.accent,
  });

  center("Ce certificat est décerné à", height - 210, 12, regular, COLORS.muted);
  const nameSize = bold.widthOfTextAtSize(pdfSafe(data.recipientName), 30) > width - 200 ? 22 : 30;
  center(data.recipientName, height - 250, nameSize, bold, COLORS.ink);

  center("pour avoir suivi l’intégralité de la formation", height - 286, 12, regular, COLORS.muted);
  const titleLines = wrapText(`« ${data.courseTitle} »`, bold, 17, width - 220).slice(0, 2);
  titleLines.forEach((line, i) => center(line, height - 316 - i * 22, 17, bold, COLORS.brand));
  const afterTitle = height - 316 - (titleLines.length - 1) * 22;
  center("et réussi l’ensemble de ses évaluations (score minimal de 70 % par module).", afterTitle - 26, 12, regular, COLORS.muted);

  // Facts row
  const factsY = 128;
  const facts: Array<[string, string]> = [
    ["Date d’achèvement", pdfDate(data.completedAt)],
    ["Durée indicative", pdfDuration(data.durationMinutes)],
    ["Numéro du certificat", data.certificateNumber],
  ];
  const colWidth = 170;
  const startX = 70;
  facts.forEach(([label, value], i) => {
    const x = startX + i * colWidth;
    page.drawText(pdfSafe(label.toUpperCase()), { x, y: factsY + 18, size: 7.5, font: bold, color: COLORS.muted });
    page.drawText(pdfSafe(value), { x, y: factsY, size: 11, font: i === 2 ? bold : regular, color: COLORS.ink });
  });

  // Signatory
  const sigX = startX;
  const sigY = 72;
  page.drawLine({ start: { x: sigX, y: sigY + 14 }, end: { x: sigX + 200, y: sigY + 14 }, thickness: 0.5, color: COLORS.line });
  page.drawText(pdfSafe(data.signatoryName || data.issuerName), { x: sigX, y: sigY, size: 10, font: bold, color: COLORS.ink });
  page.drawText(pdfSafe(data.signatoryTitle || "Organisme émetteur"), { x: sigX, y: sigY - 13, size: 8.5, font: regular, color: COLORS.muted });
  page.drawText(pdfSafe(`Délivré le ${pdfDate(data.issuedAt)}`), { x: sigX + 230, y: sigY, size: 8.5, font: regular, color: COLORS.muted });

  // Verification QR code
  const qrSize = 92;
  const qrPng = await QRCode.toBuffer(data.verificationUrl, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 360,
    color: { dark: "#1C1917", light: "#FFFFFF" },
  });
  const qr = await pdf.embedPng(qrPng);
  const qrX = width - 70 - qrSize;
  const qrY = 84;
  page.drawImage(qr, { x: qrX, y: qrY, width: qrSize, height: qrSize });
  const verifyLabel = "Vérifier l’authenticité";
  page.drawText(pdfSafe(verifyLabel), {
    x: qrX + (qrSize - bold.widthOfTextAtSize(pdfSafe(verifyLabel), 7.5)) / 2,
    y: qrY - 11,
    size: 7.5,
    font: bold,
    color: COLORS.accentText,
  });
  const urlText = pdfSafe(data.verificationUrl.replace(/^https?:\/\//, ""));
  const urlSize = Math.min(6.5, (qrSize + 120) / Math.max(1, regular.widthOfTextAtSize(urlText, 1)));
  page.drawText(urlText, {
    x: qrX + qrSize - regular.widthOfTextAtSize(urlText, urlSize),
    y: qrY - 21,
    size: urlSize,
    font: regular,
    color: COLORS.muted,
  });

  wrapText(
    "Ce certificat atteste le suivi complet d’une formation sur la plateforme SANADY et la réussite de ses évaluations. Il ne constitue ni un diplôme ni une certification professionnelle réglementée.",
    regular,
    6.5,
    width - 140,
  ).forEach((line, i) => center(line, 40 - i * 8.5, 6.5, regular, COLORS.muted));

  return pdf.save();
}
