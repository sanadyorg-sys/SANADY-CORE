import { describe, expect, it } from "vitest";
import { applicationSchema } from "@/lib/partnerships-schema";
import { allowedNextSteps, isPdf, safeFileName } from "@/lib/partnerships";

const bytes = (...b: number[]) => new Uint8Array([...b, 0, 0, 0, 0, 0, 0, 0, 0]);

describe("isPdf", () => {
  it("accepts real PDFs only, whatever the file name", () => {
    expect(isPdf(bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31))).toBe(true);
    expect(isPdf(bytes(0x4d, 0x5a, 0x90, 0x00))).toBe(false); // executable renamed .pdf
    expect(isPdf(bytes(0x50, 0x4b, 0x03, 0x04))).toBe(false); // ZIP / Word
    expect(isPdf(new Uint8Array([0x25, 0x50]))).toBe(false); // truncated
  });
});

describe("safeFileName", () => {
  it("keeps a readable, storage-safe name", () => {
    expect(safeFileName("Proposition de partenariat — Été 2026.pdf")).toBe("Proposition-de-partenariat-Ete-2026.pdf");
    expect(safeFileName("../../etc/passwd")).toBe("etc-passwd");
    expect(safeFileName("???")).toBe("document");
  });
});

describe("allowedNextSteps (mirrors the database)", () => {
  const coordinator = { staff: true, manager: false, signatory: false };
  const manager = { staff: true, manager: true, signatory: false };
  const approver = { staff: false, manager: false, signatory: true };

  it("only the manager submits for institutional validation", () => {
    expect(allowedNextSteps("negotiation", coordinator)).not.toContain("institutional_validation");
    expect(allowedNextSteps("negotiation", manager)).toContain("institutional_validation");
  });
  it("only an approver validates or rejects under validation", () => {
    expect(allowedNextSteps("institutional_validation", manager)).toEqual([]);
    expect(allowedNextSteps("institutional_validation", approver)).toEqual(["agreement_signed", "rejected"]);
  });
  it("then follows implementation, monitoring, renewal", () => {
    expect(allowedNextSteps("agreement_signed", coordinator)).toEqual(["implementation"]);
    expect(allowedNextSteps("implementation", coordinator)).toEqual(["monitoring", "renewal_or_closure"]);
    expect(allowedNextSteps("monitoring", coordinator)).toEqual(["renewal_or_closure"]);
  });
});

describe("applicationSchema", () => {
  const valid = {
    org_name: "Fondation Exemple",
    org_type: "fondation",
    country: "Maroc",
    org_description: "Une fondation engagée pour l’éducation au Maroc.",
    contact_name: "Samira Benali",
    contact_title: "Responsable RSE",
    contact_email: "Samira@Exemple.ma",
    intervention_field: "rehabilitation",
    contribution_type: "equipement",
    contribution: "Mobilier pour deux salles de classe.",
    cooperation: "Équiper deux salles de classe d’une école rurale partenaire.",
  };
  it("accepts a complete application and normalises it", () => {
    const r = applicationSchema.safeParse({ ...valid, website: "exemple.ma" });
    expect(r.success).toBe(true);
    expect(r.data?.contact_email).toBe("samira@exemple.ma");
    expect(r.data?.website).toBe("https://exemple.ma");
  });
  it("rejects an unknown field of intervention and short texts", () => {
    expect(applicationSchema.safeParse({ ...valid, intervention_field: "marketing" }).success).toBe(false);
    expect(applicationSchema.safeParse({ ...valid, cooperation: "Trop court" }).success).toBe(false);
  });
});
