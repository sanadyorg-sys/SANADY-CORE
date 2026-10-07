/**
 * Scenario 15 (individual progress report generation) and certificate PDF.
 * The generated files are parsed back with pdf.js to verify their content.
 */
import { describe, expect, it } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { renderCertificatePdf } from "@/lib/pdf/certificate";
import { pdfSafe, wrapText } from "@/lib/pdf/common";
import { renderTeacherReportPdf, type TeacherReportData } from "@/lib/pdf/report";
import { PDFDocument, StandardFonts } from "pdf-lib";

async function extractText(bytes: Uint8Array) {
  const doc = await getDocument({ data: bytes.slice(), useSystemFonts: false, isEvalSupported: false }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    pages.push(content.items.map((it) => ("str" in it ? it.str : "")).join(" "));
  }
  return { numPages: doc.numPages, text: pages.join("\n") };
}

describe("certificate PDF", () => {
  it("contains the recipient, course, number and verification link", async () => {
    const bytes = await renderCertificatePdf({
      certificateNumber: "SND-2026-4F7A21C9",
      recipientName: "Khadija El Amrani",
      courseTitle: "Évaluation formative et différenciation pédagogique en classe",
      durationMinutes: 270,
      completedAt: "2026-10-05T10:00:00Z",
      issuedAt: "2026-10-05T10:00:00Z",
      issuerName: "SANADY",
      signatoryName: "Direction pédagogique",
      signatoryTitle: "SANADY",
      verificationUrl: "https://sanady.example.org/verifier/0123456789abcdef0123456789abcdef",
    });
    expect(bytes.byteLength).toBeGreaterThan(2000);
    const { numPages, text } = await extractText(bytes);
    expect(numPages).toBe(1);
    expect(text).toContain("Khadija El Amrani");
    expect(text).toContain("SND-2026-4F7A21C9");
    expect(text).toContain("CERTIFICAT DE FIN DE FORMATION");
    expect(text).toContain("Évaluation formative");
    expect(text).toContain("4 h 30");
    expect(text).toContain("sanady.example.org/verifier/");
    expect(text).toContain("ne constitue ni un diplôme");
  });

  it("never fails on characters outside the PDF standard encoding", async () => {
    const bytes = await renderCertificatePdf({
      certificateNumber: "SND-2026-00000000",
      recipientName: "Ïsmaël Ōhara — محمد",
      courseTitle: "Titre avec espace fine %",
      durationMinutes: null,
      completedAt: "2026-01-01T00:00:00Z",
      issuedAt: "2026-01-01T00:00:00Z",
      issuerName: "SANADY",
      verificationUrl: "https://x.test/verifier/abc",
    });
    const { text } = await extractText(bytes);
    expect(text).toContain("Ïsmaël Ohara");
  });
});

describe("individual progress report PDF", () => {
  const base: TeacherReportData = {
    institutionName: "Lycée Ibn Khaldoun",
    generatedAt: "2026-10-07T09:00:00Z",
    generatedBy: "Nadia Berrada",
    teacher: { name: "Youssef Alaoui", email: "y.alaoui@ecole.ma", jobTitle: "Professeur de physique", joinedAt: "2026-09-01T00:00:00Z" },
    courses: [
      {
        title: "Gestion de classe bienveillante",
        assignedAt: "2026-09-02T00:00:00Z",
        dueOn: "2026-12-15",
        status: "in_progress",
        mandatoryLessons: 8,
        completedLessons: 5,
        quizzesTotal: 3,
        quizzesPassed: 1,
        lastActivityAt: "2026-10-06T00:00:00Z",
        certificate: null,
        modules: [
          { title: "Poser un cadre", lessonsCompleted: 3, lessonsTotal: 3, quiz: { attempts: 1, maxAttempts: 3, bestScore: 85, passed: true } },
          { title: "Prévenir les conflits", lessonsCompleted: 2, lessonsTotal: 3, quiz: { attempts: 3, maxAttempts: 3, bestScore: 60, passed: false } },
          { title: "Évaluer le climat de classe", lessonsCompleted: 0, lessonsTotal: 2, quiz: { attempts: 0, maxAttempts: 3, bestScore: null, passed: false } },
        ],
      },
    ],
  };

  it("summarises lessons, assessments and certification separately", async () => {
    const { text, numPages } = await extractText(await renderTeacherReportPdf(base));
    expect(numPages).toBe(1);
    expect(text).toContain("Rapport de progression individuel");
    expect(text).toContain("Youssef Alaoui");
    expect(text).toContain("Lycée Ibn Khaldoun");
    expect(text).toContain("5/8");
    expect(text).toContain("1/3");
    expect(text).toContain("Non délivré");
    expect(text).toContain("Évaluation réussie (85 %)");
    expect(text).toContain("3/3 tentatives");
    expect(text).toContain("Évaluation non tentée");
    expect(text).toContain("Document confidentiel");
  });

  it("paginates long reports and numbers every page", async () => {
    const many = {
      ...base,
      courses: Array.from({ length: 12 }, (_, i) => ({ ...base.courses[0]!, title: `Formation ${i + 1}` })),
    };
    const { numPages, text } = await extractText(await renderTeacherReportPdf(many));
    expect(numPages).toBeGreaterThan(1);
    expect(text).toContain(`Page ${numPages} / ${numPages}`);
  });

  it("handles a teacher with no assigned course", async () => {
    const { text } = await extractText(await renderTeacherReportPdf({ ...base, courses: [] }));
    expect(text).toContain("Aucune formation n’est actuellement affectée");
  });
});

describe("pdf text helpers", () => {
  it("transliterates or replaces non-encodable characters", () => {
    expect(pdfSafe("Ōsaka 70 %")).toBe("Osaka 70 %");
    expect(pdfSafe("محمد")).toBe("????");
    expect(pdfSafe("Œuvre « élève » – été")).toBe("Œuvre « élève » – été");
  });

  it("wraps text within the requested width", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const lines = wrapText("Une phrase assez longue pour être répartie sur plusieurs lignes distinctes", font, 12, 120);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(font.widthOfTextAtSize(line, 12)).toBeLessThanOrEqual(120);
  });
});
