import { describe, expect, it } from "vitest";
import { enterpriseNextSteps, lineTotal, proposalNextSteps } from "@/lib/enterprise";
import { enterpriseRequestSchema, lineSchema } from "@/lib/enterprise-schema";

const manager = { manager: true, signatory: false };
const approver = { manager: false, signatory: true };

describe("enterprise pipeline (mirrors the database)", () => {
  it("lets only an approver sign, after institutional approval", () => {
    expect(enterpriseNextSteps("institutional_approval", manager)).not.toContain("contract_signed");
    expect(enterpriseNextSteps("institutional_approval", approver)).toEqual(["contract_signed"]);
    expect(enterpriseNextSteps("negotiation", approver)).toEqual([]);
  });
  it("closes the early steps once signed", () => {
    expect(enterpriseNextSteps("contract_signed", manager)).toEqual(["onboarding"]);
    expect(enterpriseNextSteps("active_service", manager)).toEqual(["renewal"]);
    expect(enterpriseNextSteps("renewal", manager)).toEqual(["active_service"]);
  });
});

describe("proposals", () => {
  it("are approved by an approver and sent by the manager", () => {
    expect(proposalNextSteps("internal_review", manager)).toEqual(["draft"]);
    expect(proposalNextSteps("internal_review", approver)).toEqual(["approved"]);
    expect(proposalNextSteps("approved", manager)).toEqual(["sent", "draft"]);
    expect(proposalNextSteps("sent", manager)).toEqual(["accepted", "declined", "expired"]);
  });
  it("compute line totals without floating-point drift", () => {
    expect(lineTotal({ quantity: "3", unit_price: "0.1" })).toBe(0.3);
    expect(lineTotal({ quantity: "6", unit_price: "4500" })).toBe(27000);
  });
  it("accept French-formatted amounts in lines", () => {
    const r = lineSchema.safeParse({ category: "video_production", label: "Vidéos", quantity: "2", unit_price: "4 500,50" });
    expect(r.success && r.data.unit_price).toBe("4500.50");
    expect(lineSchema.safeParse({ category: "other", label: "X y", quantity: "0", unit_price: "1" }).success).toBe(false);
  });
});

describe("enterprise request schema", () => {
  const valid = {
    org_name: "Industrie Exemple",
    org_type: "entreprise",
    country: "Maroc",
    employee_count: "250-999",
    contact_name: "Leila Haddad",
    contact_title: "DRH",
    contact_email: "leila@industrie.ma",
    service: "sur_mesure",
    topic: "Sécurité au travail",
    target_population: "Opérateurs",
    outcomes: "Former les opérateurs aux règles de sécurité avant l’audit.",
    existing_content: "none",
    language: "fr",
  };
  it("accepts a complete request", () => {
    expect(enterpriseRequestSchema.safeParse({ ...valid, learner_count: "1 200" }).data?.learner_count).toBe("1200");
  });
  it("rejects unknown services and sizes", () => {
    expect(enterpriseRequestSchema.safeParse({ ...valid, service: "publicite" }).success).toBe(false);
    expect(enterpriseRequestSchema.safeParse({ ...valid, employee_count: "beaucoup" }).success).toBe(false);
  });
});
