import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { createEnrollmentCode, createInvitationToken, hashToken, normalizeEnrollmentCode } = await import("@/lib/tokens");
const { formatDuration, formatPercent, formatScore, formatClock, initials, plural } = await import("@/lib/format");
const { emailSchema, parseInput, passwordSchema, safeRedirectPath } = await import("@/lib/validation");
const { errorMessage, messageFor } = await import("@/lib/errors");
const { z } = await import("zod");

describe("tokens", () => {
  it("creates 256-bit invitation tokens and stores only a SHA-256 hash", () => {
    const { token, hash } = createInvitationToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).toBe(hash);
    expect(createInvitationToken().token).not.toBe(token);
  });

  it("creates unambiguous enrollment codes matching the database format", () => {
    for (let i = 0; i < 200; i++) {
      expect(createEnrollmentCode()).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    }
  });

  it("normalizes user-typed codes", () => {
    expect(normalizeEnrollmentCode("k7qm 2hxp-rw9d")).toBe("K7QM-2HXP-RW9D");
    expect(normalizeEnrollmentCode("short")).toBeNull();
  });
});

describe("French formatting", () => {
  it("formats durations, scores and clocks", () => {
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(120)).toBe("2 h");
    expect(formatDuration(270)).toBe("4 h 30");
    expect(formatDuration(null)).toBe("—");
    expect(formatPercent(0.7).replace(/\s/g, " ")).toBe("70 %");
    expect(formatScore(66.67).replace(/\s/g, " ")).toBe("66,7 %");
    expect(formatClock(3725)).toBe("1:02:05");
    expect(formatClock(65)).toBe("1:05");
  });

  it("builds initials and plurals", () => {
    expect(initials("Amina Benali")).toBe("AB");
    expect(initials("", "y.alaoui@ecole.ma")).toBe("YA");
    expect(plural(1, "leçon")).toBe("1 leçon");
    expect(plural(3, "leçon")).toBe("3 leçons");
  });
});

describe("validation", () => {
  it("normalizes e-mail addresses", () => {
    expect(emailSchema.parse("  Prof@Ecole.MA ")).toBe("prof@ecole.ma");
    expect(emailSchema.safeParse("pas-un-email").success).toBe(false);
  });

  it("enforces the password policy", () => {
    expect(passwordSchema.safeParse("court1").success).toBe(false);
    expect(passwordSchema.safeParse("seulementdeslettres").success).toBe(false);
    expect(passwordSchema.safeParse("Enseigner2026").success).toBe(true);
  });

  it("returns the first error per field from FormData", () => {
    const fd = new FormData();
    fd.set("email", "x");
    const res = parseInput(z.object({ email: emailSchema, name: z.string().min(1, "Requis") }), fd);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.fieldErrors.email).toBe("Adresse e-mail invalide.");
      expect(res.fieldErrors.name).toBeDefined();
    }
  });

  it("rejects open redirects", () => {
    expect(safeRedirectPath("/espace/formations")).toBe("/espace/formations");
    expect(safeRedirectPath("//evil.example")).toBe("/");
    expect(safeRedirectPath("https://evil.example")).toBe("/");
    expect(safeRedirectPath("/\\evil.example")).toBe("/");
  });
});

describe("error mapping", () => {
  it("maps database codes to French messages and hides unknown errors", () => {
    expect(errorMessage({ message: "attempts_exhausted" })).toContain("trois tentatives");
    expect(errorMessage({ message: "relation \"x\" does not exist" })).toContain("erreur inattendue");
    expect(errorMessage({ code: "23505", message: "duplicate key" })).toBe("Cet élément existe déjà.");
    expect(messageFor("quiz_locked")).toContain("leçons obligatoires");
  });
});
