import { describe, expect, it } from "vitest";
import { platformMetricSchema } from "@/lib/partnerships-schema";

const ID = "00000000-0000-4000-8000-000000000001";
const base = {
  agreement_id: ID,
  intervention_field: "formation-continue",
  measure: "teachers_trained",
  institution_ids: [ID],
  course_ids: [],
  period_start: "2026-01-01",
  period_end: "2026-12-31",
  attribution: "shared",
};

describe("indicator computed from platform data", () => {
  it("needs a school, a link to the partnership and a valid period", () => {
    expect(platformMetricSchema.safeParse(base).success).toBe(true);
    expect(platformMetricSchema.safeParse({ ...base, institution_ids: [] }).success).toBe(false);
    expect(platformMetricSchema.safeParse({ ...base, agreement_id: "" }).success).toBe(false);
    expect(platformMetricSchema.safeParse({ ...base, period_end: "2025-12-31" }).success).toBe(false);
    expect(platformMetricSchema.safeParse({ ...base, measure: "students_supported" }).success).toBe(false);
  });

  it("never carries a typed value", () => {
    const r = platformMetricSchema.safeParse({ ...base, value: "999" });
    expect(r.success && "value" in r.data).toBe(false);
  });
});
