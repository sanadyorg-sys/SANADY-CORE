import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: () => undefined }));
import { notificationEmail } from "@/server/notifications";

const KINDS: Array<[string, Record<string, unknown>, RegExp]> = [
  ["course_assigned", { course: "Gestion de classe", institution: "École A", course_id: "c1", due_on: "2026-11-01" }, /\/espace\/formations\/c1/],
  ["assignment_due", { course: "Gestion de classe", course_id: "c1", due_on: "2026-11-01" }, /\/espace\/formations\/c1/],
  ["certificate_issued", { course: "Gestion de classe" }, /\/espace\/certificats/],
  ["support_opened", { reference: "SUP-2026-0001", subject: "Accès", company: "Société", request_id: "r1", priority: "urgent" }, /\/assistance\/r1/],
  ["support_reply", { reference: "SUP-2026-0001", subject: "Accès", institution_id: "i1", request_id: "r1" }, /\/etablissement\/i1\/assistance\/r1/],
  ["support_client_reply", { reference: "SUP-2026-0001", subject: "Accès", company: "Société", request_id: "r1" }, /\/assistance\/r1/],
  ["portal_message_to_team", { organization: "Partenaire", organization_id: "o1" }, /\/organisations\/o1/],
  ["portal_message_to_partner", {}, /\/espace-partenaire\/messages/],
  ["report_shared", { title: "Rapport 2026" }, /\/espace-partenaire\/rapports/],
  ["approval_needed", { what: "contract", id: "k1", reference: "CTR-2026-0001", title: "Contrat" }, /\/contrats\/k1/],
  ["renewal_due", { contract_id: "k1", reference: "CTR-2026-0001", title: "Contrat", end_on: "2026-12-31" }, /\/contrats\/k1/],
  ["deletion_due", { tenant_id: "t1", space: "Société", due_on: "2026-11-30", days: 30 }, /\/espaces\/t1#suppression/],
  ["deletion_confirmed", { tenant_id: "t1", space: "Société", execute_after: "2026-12-01" }, /\/espaces\/t1#suppression/],
  ["deletion_executed", { tenant_id: "t1", space: "Société" }, /certificat-suppression/],
];

describe("notification e-mails", () => {
  it.each(KINDS)("%s has a subject, a greeting and the right link", (kind, payload, link) => {
    const m = notificationEmail(kind, payload, "Amina Benali")!;
    expect(m.subject.length).toBeGreaterThan(5);
    expect(m.html).toContain("Bonjour Amina Benali,");
    expect(m.html).toMatch(link);
    expect(m.text).toMatch(link);
  });

  it("escapes what people typed, and marks deletion notices as always sent", () => {
    const m = notificationEmail("support_opened", { reference: "SUP-1", subject: "<script>alert(1)</script>", company: "A&B", request_id: "r" }, "<b>X</b>")!;
    expect(m.html).not.toContain("<script>");
    expect(m.html).toContain("&lt;script&gt;");
    expect(m.html).toContain("A&amp;B");
    expect(notificationEmail("deletion_due", { tenant_id: "t", space: "S", due_on: "2026-11-30", days: 7 }, "X")!.text).toMatch(/toujours envoyé/);
    expect(notificationEmail("course_assigned", { course: "C", institution: "I", course_id: "c" }, "X")!.text).toMatch(/désactiver ces notifications/);
    expect(notificationEmail("unknown_kind", {}, "X")).toBeNull();
  });
});
