import { describe, expect, it } from "vitest";
import { fillTemplate, missingPlaceholders } from "@/lib/partnerships";
import { messageSchema } from "@/lib/partnerships-schema";

describe("communication templates", () => {
  const vars = { organisation: "Association Exemple", contact: "Salma Idrissi", interlocuteur: "Nadia B.", reference: "", date: "16 octobre 2026" };

  it("fills the known placeholders and leaves empty ones visible", () => {
    const out = fillTemplate("Bonjour {{contact}}, merci à {{ organisation }} ({{reference}}) — {{date}}", vars);
    expect(out).toBe("Bonjour Salma Idrissi, merci à Association Exemple ({{reference}}) — 16 octobre 2026");
    expect(missingPlaceholders(out)).toEqual(["reference"]);
  });

  it("keeps unknown placeholders so they are caught before sending", () => {
    const out = fillTemplate("Montant : {{montant}} — {{montant}}", vars);
    expect(missingPlaceholders(out)).toEqual(["montant"]);
    expect(missingPlaceholders("Aucun champ")).toEqual([]);
  });

  it("accepts only the three sending channels", () => {
    const base = { organization_id: "00000000-0000-4000-8000-000000000000", subject: "Objet", body: "Texte du message" };
    expect(messageSchema.safeParse({ ...base, channel: "copy" }).success).toBe(true);
    expect(messageSchema.safeParse({ ...base, channel: "sms" }).success).toBe(false);
  });
});
