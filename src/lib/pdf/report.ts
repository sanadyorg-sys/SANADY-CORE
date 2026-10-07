import { PDFDocument, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import { COLORS, pdfDate, pdfPercent, pdfSafe, truncateToWidth, wrapText } from "./common";

export interface ReportModule {
  title: string;
  lessonsCompleted: number;
  lessonsTotal: number;
  quiz: { attempts: number; maxAttempts: number; bestScore: number | null; passed: boolean } | null;
}

export interface ReportCourse {
  title: string;
  assignedAt: string;
  dueOn: string | null;
  status: "not_started" | "in_progress" | "completed";
  mandatoryLessons: number;
  completedLessons: number;
  quizzesTotal: number;
  quizzesPassed: number;
  lastActivityAt: string | null;
  certificate: { number: string; issuedAt: string } | null;
  modules: ReportModule[];
}

export interface TeacherReportData {
  institutionName: string;
  generatedAt: string;
  generatedBy: string;
  teacher: { name: string; email: string; jobTitle: string | null; joinedAt: string };
  courses: ReportCourse[];
}

const STATUS_LABEL: Record<ReportCourse["status"], string> = {
  not_started: "Non commencée",
  in_progress: "En cours",
  completed: "Terminée",
};

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 48;

/**
 * Individual teacher progress report (A4 portrait, multi-page).
 * Only assignment-scoped data is passed in: the caller retrieves it under
 * the institution administrator's RLS context.
 */
export async function renderTeacherReportPdf(data: TeacherReportData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(pdfSafe(`Rapport de progression — ${data.teacher.name}`));
  pdf.setAuthor(pdfSafe(data.institutionName));
  pdf.setCreator("SANADY");
  pdf.setProducer("SANADY");
  pdf.setCreationDate(new Date(data.generatedAt));

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const contentWidth = A4[0] - MARGIN * 2;

  let page: PDFPage = pdf.addPage(A4);
  let y = 0;

  const header = () => {
    const { height } = page.getSize();
    page.drawRectangle({ x: 0, y: height - 6, width: A4[0], height: 6, color: COLORS.navy });
    page.drawText("S A N A D Y", { x: MARGIN, y: height - 40, size: 10, font: bold, color: COLORS.navy });
    const right = pdfSafe("Rapport individuel de progression");
    page.drawText(right, { x: A4[0] - MARGIN - regular.widthOfTextAtSize(right, 8.5), y: height - 40, size: 8.5, font: regular, color: COLORS.muted });
    page.drawLine({ start: { x: MARGIN, y: height - 52 }, end: { x: A4[0] - MARGIN, y: height - 52 }, thickness: 0.5, color: COLORS.line });
    y = height - 76;
  };
  header();

  const ensure = (needed: number) => {
    if (y - needed < MARGIN + 30) {
      page = pdf.addPage(A4);
      header();
    }
  };

  const text = (value: string, opts: { x?: number; size?: number; font?: PDFFont; color?: typeof COLORS.ink; maxWidth?: number } = {}) => {
    const size = opts.size ?? 10;
    const font = opts.font ?? regular;
    const lines = opts.maxWidth ? wrapText(value, font, size, opts.maxWidth) : [pdfSafe(value)];
    for (const line of lines) {
      ensure(size + 4);
      page.drawText(line, { x: opts.x ?? MARGIN, y, size, font, color: opts.color ?? COLORS.ink });
      y -= size + 4;
    }
  };

  // ─── Title block ────────────────────────────────────────────────────────
  text("Rapport de progression individuel", { size: 18, font: bold, color: COLORS.navy });
  y -= 2;
  text(`${data.institutionName} · généré le ${pdfDate(data.generatedAt)} par ${data.generatedBy}`, {
    size: 9,
    color: COLORS.muted,
    maxWidth: contentWidth,
  });
  y -= 12;

  // ─── Teacher card ───────────────────────────────────────────────────────
  const cardHeight = 64;
  ensure(cardHeight);
  page.drawRectangle({ x: MARGIN, y: y - cardHeight + 12, width: contentWidth, height: cardHeight, color: COLORS.canvas, borderColor: COLORS.line, borderWidth: 0.5 });
  const cardTop = y;
  page.drawText(pdfSafe(data.teacher.name), { x: MARGIN + 14, y: cardTop - 8, size: 13, font: bold, color: COLORS.ink });
  page.drawText(pdfSafe(data.teacher.email), { x: MARGIN + 14, y: cardTop - 24, size: 9, font: regular, color: COLORS.muted });
  page.drawText(pdfSafe([data.teacher.jobTitle, `Affilié(e) depuis le ${pdfDate(data.teacher.joinedAt)}`].filter(Boolean).join(" · ")), {
    x: MARGIN + 14,
    y: cardTop - 38,
    size: 9,
    font: regular,
    color: COLORS.muted,
  });
  y -= cardHeight + 10;

  // ─── Summary table ──────────────────────────────────────────────────────
  text("Synthèse des formations affectées", { size: 12, font: bold });
  y -= 4;

  if (data.courses.length === 0) {
    text("Aucune formation n’est actuellement affectée à cet enseignant par l’établissement.", { size: 10, color: COLORS.muted, maxWidth: contentWidth });
  } else {
    const cols = [
      { label: "Formation", width: 190 },
      { label: "Statut", width: 72 },
      { label: "Leçons", width: 54 },
      { label: "Évaluations", width: 64 },
      { label: "Certificat", width: contentWidth - 190 - 72 - 54 - 64 },
    ];
    const row = (cells: string[], opts: { header?: boolean } = {}) => {
      ensure(22);
      if (opts.header) page.drawRectangle({ x: MARGIN, y: y - 6, width: contentWidth, height: 18, color: COLORS.navyLight });
      let x = MARGIN + 6;
      cells.forEach((cell, i) => {
        const font = opts.header || i === 0 ? bold : regular;
        const size = opts.header ? 7.5 : 8.5;
        page.drawText(truncateToWidth(opts.header ? cell.toUpperCase() : cell, font, size, cols[i]!.width - 10), {
          x,
          y,
          size,
          font,
          color: opts.header ? COLORS.navy : COLORS.ink,
        });
        x += cols[i]!.width;
      });
      y -= 20;
      if (!opts.header) page.drawLine({ start: { x: MARGIN, y: y + 13 }, end: { x: MARGIN + contentWidth, y: y + 13 }, thickness: 0.4, color: COLORS.line });
    };
    row(cols.map((c) => c.label), { header: true });
    for (const c of data.courses) {
      row([
        c.title,
        STATUS_LABEL[c.status],
        `${c.completedLessons}/${c.mandatoryLessons}`,
        `${c.quizzesPassed}/${c.quizzesTotal}`,
        c.certificate ? c.certificate.number : "Non délivré",
      ]);
    }
    y -= 10;

    // ─── Course details ───────────────────────────────────────────────────
    for (const c of data.courses) {
      ensure(80);
      y -= 6;
      text(c.title, { size: 11.5, font: bold, color: COLORS.navy, maxWidth: contentWidth });
      const meta = [
        `Affectée le ${pdfDate(c.assignedAt)}`,
        c.dueOn ? `échéance ${pdfDate(c.dueOn)}` : null,
        `dernière activité : ${c.lastActivityAt ? pdfDate(c.lastActivityAt) : "aucune"}`,
        c.certificate ? `certificat délivré le ${pdfDate(c.certificate.issuedAt)}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      text(meta, { size: 8.5, color: COLORS.muted, maxWidth: contentWidth });
      y -= 2;

      for (const [i, m] of c.modules.entries()) {
        ensure(30);
        const moduleTitle = truncateToWidth(`${i + 1}. ${m.title}`, regular, 9, 200);
        page.drawText(moduleTitle, { x: MARGIN + 8, y, size: 9, font: regular, color: COLORS.ink });
        page.drawText(pdfSafe(`Leçons ${m.lessonsCompleted}/${m.lessonsTotal}`), { x: MARGIN + 212, y, size: 8.5, font: regular, color: COLORS.muted });
        const quizText = m.quiz
          ? m.quiz.passed
            ? `Évaluation réussie (${pdfPercent(m.quiz.bestScore)})`
            : m.quiz.attempts === 0
              ? "Évaluation non tentée"
              : `Non validée · ${m.quiz.attempts}/${m.quiz.maxAttempts} tentatives · meilleur ${pdfPercent(m.quiz.bestScore)}`
          : "—";
        page.drawText(truncateToWidth(quizText, regular, 8.5, contentWidth - 280), {
          x: MARGIN + 280,
          y,
          size: 8.5,
          font: regular,
          color: m.quiz?.passed ? COLORS.success : m.quiz && m.quiz.attempts >= m.quiz.maxAttempts ? COLORS.danger : COLORS.muted,
        });
        y -= 15;
      }
      y -= 6;
    }
  }

  // ─── Method note ────────────────────────────────────────────────────────
  y -= 8;
  ensure(60);
  text("Note de lecture", { size: 9, font: bold });
  text(
    "La progression mesure les leçons obligatoires terminées ; les évaluations exigent un score minimal de 70 % (trois tentatives par module). Le suivi du visionnage indique une activité et ne mesure ni l’attention ni la compréhension. Ce rapport ne porte que sur les formations affectées par l’établissement.",
    { size: 8, color: COLORS.muted, maxWidth: contentWidth },
  );

  // ─── Footer on every page ───────────────────────────────────────────────
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    const left = pdfSafe("Document confidentiel — usage interne de l’établissement.");
    p.drawText(left, { x: MARGIN, y: 26, size: 7.5, font: regular, color: COLORS.muted });
    const right = `Page ${i + 1} / ${pages.length}`;
    p.drawText(right, { x: A4[0] - MARGIN - regular.widthOfTextAtSize(right, 7.5), y: 26, size: 7.5, font: regular, color: COLORS.muted });
  });

  return pdf.save();
}
