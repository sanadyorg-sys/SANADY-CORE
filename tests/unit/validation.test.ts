import { describe, expect, it } from "vitest";
import { z } from "zod";
import { checkboxSchema, parseInput } from "@/lib/validation";

describe("checkboxSchema", () => {
  const schema = z.object({ title: z.string(), flag: checkboxSchema });

  it("treats an unticked checkbox (absent from FormData) as false", () => {
    const form = new FormData();
    form.set("title", "x");
    expect(parseInput(schema, form)).toEqual({ ok: true, data: { title: "x", flag: false } });
  });

  it("treats a ticked checkbox as true", () => {
    const form = new FormData();
    form.set("title", "x");
    form.set("flag", "on");
    expect(parseInput(schema, form)).toEqual({ ok: true, data: { title: "x", flag: true } });
  });

  it("still lets a required consent be enforced with refine", () => {
    const consent = z.object({ consent: checkboxSchema.refine(Boolean, "Requis") });
    expect(parseInput(consent, new FormData())).toEqual({ ok: false, fieldErrors: { consent: "Requis" } });
  });
});
