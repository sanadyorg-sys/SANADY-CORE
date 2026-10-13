import { PDFDocument, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import { FOUNDATION } from "@/lib/institution";
import { ATTRIBUTIONS, CONTRIBUTION_KINDS, CONTRIBUTION_STAGE, dimensionLabel, formatAmount, type Attribution, type ContributionKind, type ContributionStage, type MetricType } from "@/lib/partnerships";
import { BRAND_LOGO_PNG_BASE64 } from "./brand-logo";
import { COLORS, pdfDate, pdfSafe, wrapText } from "./common";

/**
 * Partner impact report (brief V2 §13), generated on demand from verified
 * data only (public.partner_report_data). Aggregates only: no teacher or
 * student is named. The 12 sections of the brief, in order.
 */

export interface PartnerReportPdfData {
  reference: string;
  title: string;
  periodStart: string;
  periodEnd: string;
  approved: { by: string | null; at: string | null } | null;
  draft: boolean;
  organization: { name: string; place: string | null };
  agreements: Array<{ reference: string; title: string; objectives: string; field: string; startOn: string | null; endOn: string | null }>;
  projects: Array<{ reference: string; title: string }>;
  contributions: Array<{
    kind: ContributionKind;
    description: string;
    stage: ContributionStage;
    currency: string;
    amountPledged: string | null;
    amountReceived: string | null;
    item: string | null;
    quantity: number | null;
    hoursPledged: string | null;
    hoursDelivered: string | null;
  }>;
  milestones: Array<{ title: string; doneAt: string }>;
  activities: string | null;
  metrics: Array<{ field: string; dimension: string; label: string | null; type: MetricType; value: string; unit: string | null; method: string; attribution: Attribution }>;
  challenges: string | null;
  futureOpportunities: string | null;
  generatedAt: string;
}

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 48;
const number = (v: string | number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(Number(v));

export async function renderPartnerReportPdf(data: PartnerReportPdfData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(pdfSafe(`${data.title} — ${data.organization.name}`));
  pdf.setAuthor(FOUNDATION.name);
  pdf.setCreator("SANADY");
  pdf.setProducer("SANADY");
  pdf.setCreationDate(new Date(data.generatedAt));

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await pdf.embedPng(Buffer.from(BRAND_LOGO_PNG_BASE64, "base64"));
  const width = A4[0] - MARGIN * 2;

  let page: PDFPage = pdf.addPage(A4);
  let y = 0;
  const header = () => {
    const { height } = page.getSize();
    page.drawRectangle({ x: 0, y: height - 6, width: A4[0], height: 6, color: COLORS.accent });
    page.drawImage(logo, { x: MARGIN, y: height - 50, width: (logo.width / logo.height) * 30, height: 30 });
    const right = pdfSafe(`Rapport au partenaire · ${data.reference}`);
    page.drawText(right, { x: A4[0] - MARGIN - regular.widthOfTextAtSize(right, 8.5), y: height - 40, size: 8.5, font: regular, color: COLORS.muted });
    page.drawLine({ start: { x: MARGIN, y: height - 52 }, end: { x: A4[0] - MARGIN, y: height - 52 }, thickness: 0.5, color: COLORS.line });
    if (data.draft) {
      const mark = "BROUILLON — NON APPROUVÉ";
      page.drawText(pdfSafe(mark), { x: MARGIN, y: height - 66, size: 8, font: bold, color: COLORS.danger });
    }
    y = height - 82;
  };
  header();
  const ensure = (needed: number) => {
    if (y - needed < MARGIN + 24) {
      page = pdf.addPage(A4);
      header();
    }
  };
  const text = (value: string, opts: { size?: number; font?: PDFFont; color?: typeof COLORS.ink; indent?: number; gap?: number } = {}) => {
    const size = opts.size ?? 9.5;
    const font = opts.font ?? regular;
    for (const line of wrapText(value, font, size, width - (opts.indent ?? 0))) {
      ensure(size + 4);
      page.drawText(line, { x: MARGIN + (opts.indent ?? 0), y, size, font, color: opts.color ?? COLORS.ink });
      y -= size + (opts.gap ?? 4);
    }
  };
  let n = 0;
  const section = (title: string) => {
    n += 1;
    y -= 10;
    ensure(40);
    page.drawText(pdfSafe(`${n}. ${title}`), { x: MARGIN, y, size: 12, font: bold, color: COLORS.brand });
    y -= 6;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + 36, y }, thickness: 1.2, color: COLORS.accent });
    y -= 14;
  };
  const bullet = (value: string) => {
    ensure(14);
    page.drawText("•", { x: MARGIN + 2, y, size: 9.5, font: bold, color: COLORS.accentText });
    text(value, { indent: 12 });
  };
  const none = (value = "Aucun élément vérifié pour cette période.") => text(value, { color: COLORS.muted });

  // Title
  text(data.title, { size: 18, font: bold, color: COLORS.brand });
  text(`${data.organization.name} · du ${pdfDate(data.periodStart)} au ${pdfDate(data.periodEnd)}`, { size: 10, color: COLORS.muted });
  if (data.approved?.at) text(`Approuvé${data.approved.by ? ` par ${data.approved.by}` : ""} le ${pdfDate(data.approved.at)} · généré le ${pdfDate(data.generatedAt)}`, { size: 8.5, color: COLORS.muted });

  section("La Fondation Sanady");
  text(`${FOUNDATION.name} — ${FOUNDATION.status}. ${FOUNDATION.summary}`);
  y -= 2;
  text(`Mission : ${FOUNDATION.mission}`, { color: COLORS.muted });

  section("Organisation partenaire");
  text(data.organization.name, { font: bold });
  if (data.organization.place) text(data.organization.place, { color: COLORS.muted });

  section("Objectifs du partenariat");
  if (data.agreements.length) {
    for (const a of data.agreements) {
      text(`${a.title} (${a.reference})`, { font: bold });
      text(a.objectives);
      if (a.startOn && a.endOn) text(`Période : du ${pdfDate(a.startOn)} au ${pdfDate(a.endOn)}`, { color: COLORS.muted });
      y -= 4;
    }
  } else none("Aucune convention signée sur ce périmètre.");

  section("Domaine d’intervention soutenu");
  const fields = [...new Set([...data.agreements.map((a) => a.field), ...data.metrics.map((m) => m.field)])];
  if (fields.length) fields.forEach((f) => bullet(f));
  else none();

  section("Projets soutenus");
  if (data.projects.length) data.projects.forEach((p) => bullet(`${p.title} (${p.reference})`));
  else none("Aucun projet publié rattaché.");

  const describe = (c: PartnerReportPdfData["contributions"][number], received: boolean) => {
    if (c.kind === "financial") return received ? formatAmount(c.amountReceived, c.currency) ?? "—" : formatAmount(c.amountPledged, c.currency) ?? "—";
    if (c.kind === "material") return [c.quantity ? `${c.quantity} ×` : null, c.item].filter(Boolean).join(" ");
    return received ? `${c.hoursDelivered ?? "—"} h réalisées` : `${c.hoursPledged ?? "—"} h prévues`;
  };

  section("Contributions convenues");
  if (data.contributions.length) data.contributions.forEach((c) => bullet(`${CONTRIBUTION_KINDS[c.kind]} — ${c.description} : ${describe(c, false)}`));
  else none("Aucune contribution enregistrée.");

  section("Contributions reçues");
  const received = data.contributions.filter((c) => c.stage === "delivered" || c.stage === "verified");
  if (received.length)
    received.forEach((c) => bullet(`${CONTRIBUTION_KINDS[c.kind]} — ${c.description} : ${describe(c, true)} (${CONTRIBUTION_STAGE[c.stage].label.toLowerCase()})`));
  else none("Aucune contribution reçue à ce jour : les promesses ne sont pas comptées comme reçues.");

  section("Activités réalisées");
  if (data.milestones.length) data.milestones.forEach((m) => bullet(`${m.title} — réalisée le ${pdfDate(m.doneAt)}`));
  if (data.activities) text(data.activities);
  if (!data.milestones.length && !data.activities) none();

  const outputs = data.metrics.filter((m) => m.type === "output");
  const outcomes = data.metrics.filter((m) => m.type === "outcome");
  const metric = (m: PartnerReportPdfData["metrics"][number]) => {
    bullet(`${dimensionLabel(m.dimension, m.label)} : ${number(m.value)}${m.unit ? ` ${m.unit}` : ""} — ${m.field}`);
    text(`Mesure : ${m.method} · ${ATTRIBUTIONS[m.attribution]}`, { indent: 12, size: 8, color: COLORS.muted });
  };

  section("Bénéficiaires vérifiés et réalisations");
  if (outputs.length) outputs.forEach(metric);
  else none();

  section("Résultats mesurés");
  if (outcomes.length) outcomes.forEach(metric);
  else none("Aucun résultat à long terme vérifié pour cette période (les réalisations ci-dessus ne préjugent pas des résultats).");

  section("Difficultés et limites");
  text(data.challenges || "Non renseigné.", { color: data.challenges ? COLORS.ink : COLORS.muted });

  section("Perspectives de coopération");
  text(data.futureOpportunities || "Non renseigné.", { color: data.futureOpportunities ? COLORS.ink : COLORS.muted });

  y -= 12;
  text(
    "Ce rapport ne présente que des données vérifiées par la Fondation Sanady et des chiffres agrégés : aucun élève ni enseignant n’y est nommé. Les résultats ne sont attribués au partenariat que dans la mesure indiquée pour chaque indicateur.",
    { size: 7.5, color: COLORS.muted },
  );

  // Page numbers
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    const label = `${i + 1} / ${pages.length}`;
    p.drawText(label, { x: A4[0] - MARGIN - regular.widthOfTextAtSize(label, 8), y: 28, size: 8, font: regular, color: COLORS.muted });
  });
  return pdf.save();
}
