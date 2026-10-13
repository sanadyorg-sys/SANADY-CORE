/**
 * Partner impact report PDF (partnerships phase 5): the 12 sections of the
 * brief, verified figures kept apart (outputs / outcomes), promises never
 * shown as received. Parsed back with pdf.js.
 */
import { describe, expect, it } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { renderPartnerReportPdf, type PartnerReportPdfData } from "@/lib/pdf/partner-report";

async function extractText(bytes: Uint8Array) {
  const doc = await getDocument({ data: bytes.slice(), useSystemFonts: false, isEvalSupported: false }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    pages.push(content.items.map((it) => ("str" in it ? it.str : "")).join(" "));
  }
  return { numPages: doc.numPages, text: pages.join("\n").replace(/\s+/g, " ") };
}

const DATA: PartnerReportPdfData = {
  reference: "RAP-2026-0001",
  title: "Rapport du premier trimestre",
  periodStart: "2026-10-01",
  periodEnd: "2026-12-31",
  approved: { by: "Responsable QA", at: "2027-01-10T10:00:00Z" },
  draft: false,
  organization: { name: "Fondation Exemple", place: "Casablanca, Maroc" },
  agreements: [{ reference: "CONV-2026-0001", title: "Soutien scolaire au collège", objectives: "Accompagner 200 élèves en mathématiques.", field: "Soutien scolaire", startOn: "2026-10-01", endOn: "2027-06-30" }],
  projects: [{ reference: "OPP-2026-0001", title: "Cours de soutien à Tanger" }],
  contributions: [
    { kind: "financial", description: "Bourses 2026-2027", stage: "verified", currency: "MAD", amountPledged: "50000", amountReceived: "30000", item: null, quantity: null, hoursPledged: null, hoursDelivered: null },
    { kind: "material", description: "Ordinateurs", stage: "pledged", currency: "MAD", amountPledged: null, amountReceived: null, item: "Ordinateurs portables", quantity: 20, hoursPledged: null, hoursDelivered: null },
  ],
  milestones: [{ title: "Bilan du premier mois", doneAt: "2026-11-02T10:00:00Z" }],
  activities: "Séances hebdomadaires dans deux collèges.",
  metrics: [
    { field: "Soutien scolaire", dimension: "students_supported", label: null, type: "output", value: "176", unit: "élèves", method: "Listes de présence des séances.", attribution: "direct" },
  ],
  challenges: "Absences pendant les examens.",
  futureOpportunities: "Étendre à un troisième collège.",
  generatedAt: "2027-01-12T10:00:00Z",
};

describe("partner report PDF", () => {
  it("follows the 12 sections and keeps promised and received apart", async () => {
    const { text } = await extractText(await renderPartnerReportPdf(DATA));
    for (const s of ["1. La Fondation Sanady", "2. Organisation partenaire", "3. Objectifs du partenariat", "4. Domaine", "5. Projets soutenus", "6. Contributions convenues", "7. Contributions reçues", "8. Activités réalisées", "9. Bénéficiaires vérifiés", "10. Résultats mesurés", "11. Difficultés et limites", "12. Perspectives"]) {
      expect(text).toContain(s);
    }
    expect(text).toContain("Élèves accompagnés : 176 élèves");
    expect(text).toContain("30 000 MAD");
    // The pledged computers are agreed but not received.
    const received = text.slice(text.indexOf("7. Contributions reçues"), text.indexOf("8. Activités"));
    expect(received).not.toContain("Ordinateurs");
    expect(text).toContain("Aucun résultat à long terme vérifié");
    expect(text).not.toContain("BROUILLON");
  });
  it("marks drafts", async () => {
    const { text } = await extractText(await renderPartnerReportPdf({ ...DATA, draft: true, approved: null, metrics: [], contributions: [] }));
    expect(text).toContain("BROUILLON");
    expect(text).toContain("les promesses ne sont pas comptées comme reçues");
  });
});
