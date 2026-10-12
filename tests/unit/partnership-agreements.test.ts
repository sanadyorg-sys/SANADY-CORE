import { describe, expect, it } from "vitest";
import { agreementNextSteps, contributionAmount, contributionNextSteps } from "@/lib/partnerships";
import { contributionSchema } from "@/lib/partnerships-schema";

const staff = { staff: true, manager: false, signatory: false };
const approver = { staff: false, manager: false, signatory: true };

describe("agreements (mirrors the database)", () => {
  it("leave approval and the recorded signature to approvers", () => {
    expect(agreementNextSteps("internal_review", staff)).toEqual(["draft"]);
    expect(agreementNextSteps("internal_review", approver)).toEqual(["approved"]);
    expect(agreementNextSteps("approved", approver)).toEqual(["signed"]);
    expect(agreementNextSteps("approved", staff)).toEqual(["draft"]);
    expect(agreementNextSteps("signed", staff)).toEqual(["active"]);
  });
});

describe("contributions", () => {
  it("are verified by approvers only", () => {
    expect(contributionNextSteps("delivered", staff)).toEqual(["cancelled"]);
    expect(contributionNextSteps("delivered", approver)).toEqual(["verified"]);
    expect(contributionNextSteps("verified", staff)).toEqual([]);
  });
  it("never present a pledge as received", () => {
    const base = { currency: "MAD", quantity: null, item: null, hours_pledged: null, hours_delivered: null };
    const plain = (s: string) => s.replace(/\s/g, " ");
    expect(plain(contributionAmount({ ...base, kind: "financial", amount_pledged: "50000", amount_received: null }))).toBe("50 000 MAD promis");
    expect(plain(contributionAmount({ ...base, kind: "financial", amount_pledged: "50000", amount_received: "30000" }))).toBe("30 000 MAD reçus sur 50 000 MAD promis");
  });
  it("require what each kind needs", () => {
    expect(contributionSchema.safeParse({ kind: "financial", description: "Bourses 2027" }).success).toBe(false);
    expect(contributionSchema.safeParse({ kind: "financial", description: "Bourses 2027", amount_pledged: "50 000" }).data?.amount_pledged).toBe("50000");
    expect(contributionSchema.safeParse({ kind: "expertise", description: "Mentorat", hours_pledged: "12,5", expertise_category: "Pédagogie" }).data?.hours_pledged).toBe("12.5");
  });
});
