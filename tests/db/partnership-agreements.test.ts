/**
 * Partenariats & Coopération, phase 4: agreements, contributions, milestones
 * and renewal reminders. Approval and the recording of a signature belong to
 * approvers only; a pledge is never counted as money received.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb, uid } from "./harness";

let db: TestDb;
let admin: string;
let coordinator: string;
let approver: string;
let enterprise: string;
let teacher: string;
let org: string;

async function staff(role: string) {
  const id = await db.createUser(`${role}.${uid()}@sanady.test`);
  await db.rpc(admin, "set_platform_role", [id, role]);
  return id;
}
const AGREEMENT = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    title: "Convention de soutien scolaire",
    intervention_field: "soutien-scolaire",
    objectives: "Soutenir 200 élèves de collège en mathématiques pendant l’année scolaire.",
    start_on: "2026-11-01",
    end_on: "2027-06-30",
    renewal_notice_days: "60",
    ...extra,
  });
async function addDoc(user: string, agreement: string | null, contribution: string | null, kind: string) {
  const folder = agreement ? `agreements/${agreement}` : `contributions/${contribution}`;
  return db.rpc<string>(user, "add_partnership_document", [agreement, contribution, kind, `${folder}/${uid()}.pdf`, "doc.pdf", 1000]);
}

beforeAll(async () => {
  db = await TestDb.create();
  admin = await db.createAdmin();
  const other = await db.createAdmin();
  coordinator = await staff("partnership_coordinator");
  approver = await staff("partnership_manager");
  await db.rpc(other, "set_partnership_signatory", [approver, true]);
  enterprise = await staff("enterprise_manager");
  teacher = await db.createUser(`prof.${uid()}@sanady.test`);
  const [o] = await db.sql<{ id: string }>(`insert into public.partner_organizations (name, org_type, status) values ($1, 'fondation', 'negotiation') returning id`, [`Fondation ${uid()}`]);
  org = o!.id;
});
afterAll(async () => db?.close());

async function field() {
  const [f] = await db.sql<{ slug: string }>(`select slug from public.intervention_fields order by position limit 1`);
  return f!.slug;
}

describe("agreements (brief V2 §11)", () => {
  it("are drafted by partnership staff, approved and recorded as signed by an approver only", async () => {
    const slug = await field();
    expect(await db.rpcError(enterprise, "save_partnership_agreement", [null, org, AGREEMENT({ intervention_field: slug })])).toMatch(/forbidden/);
    const id = await db.rpc<string>(coordinator, "save_partnership_agreement", [null, org, AGREEMENT({ intervention_field: slug })]);
    const [a] = await db.sql<{ reference: string; status: string }>(`select reference, status from public.partnership_agreements where id = $1`, [id]);
    expect(a!.reference).toMatch(/^CONV-\d{4}-\d{4}$/);
    await db.rpc(coordinator, "set_agreement_status", [id, "internal_review", "{}"]);
    expect(await db.rpcError(coordinator, "save_partnership_agreement", [id, org, AGREEMENT({ intervention_field: slug })])).toMatch(/agreement_locked/);
    expect(await db.rpcError(coordinator, "set_agreement_status", [id, "approved", "{}"])).toMatch(/forbidden/);
    expect(await db.rpcError(admin, "set_agreement_status", [id, "approved", "{}"])).toMatch(/forbidden/);
    await db.rpc(approver, "set_agreement_status", [id, "approved", "{}"]);

    // No signature without the signed copy and its date; never simulated.
    expect(await db.rpcError(approver, "set_agreement_status", [id, "signed", JSON.stringify({ signed_on: "2026-10-10" })])).toMatch(/signed_document_required/);
    expect(await db.rpcError(coordinator, "add_partnership_document", [id, null, "signed", `agreements/${id}/x.pdf`, "x.pdf", 10])).toMatch(/forbidden/);
    await addDoc(approver, id, null, "signed");
    expect(await db.rpcError(approver, "set_agreement_status", [id, "signed", "{}"])).toMatch(/signed_date_required/);
    expect(await db.rpcError(coordinator, "set_agreement_status", [id, "signed", JSON.stringify({ signed_on: "2026-10-10" })])).toMatch(/forbidden/);
    await db.rpc(approver, "set_agreement_status", [id, "signed", JSON.stringify({ signed_on: "2026-10-10" })]);
    await db.rpc(coordinator, "set_agreement_status", [id, "active", "{}"]);
    const [signed] = await db.sql<{ status: string; signed_on: string; signed_recorded_by: string }>(
      `select status, signed_on::text, signed_recorded_by from public.partnership_agreements where id = $1`, [id]);
    expect(signed).toEqual({ status: "active", signed_on: "2026-10-10", signed_recorded_by: approver });

    // Signed copies cannot be deleted; documents need the right folder.
    const [doc] = await db.sql<{ id: string }>(`select id from public.partnership_documents where agreement_id = $1 and kind = 'signed'`, [id]);
    expect(await db.rpcError(coordinator, "delete_partnership_document", [doc!.id])).toMatch(/document_locked/);
    expect(await db.rpcError(coordinator, "add_partnership_document", [id, null, "supporting", `applications/${id}/x.pdf`, "x.pdf", 10])).toMatch(/invalid_input/);
  });

  it("are read by partnership staff and approvers only", async () => {
    const count = (u: string) => db.as(u, (q) => q<{ n: number }>(`select count(*)::int n from public.partnership_agreements`)).then((r) => r[0]!.n);
    expect(await count(coordinator)).toBeGreaterThan(0);
    expect(await count(approver)).toBeGreaterThan(0);
    expect(await count(enterprise)).toBe(0);
    expect(await count(teacher)).toBe(0);
  });
});

describe("milestones and renewal reminders", () => {
  it("list agreements to renew, milestones due and late contributions", async () => {
    const slug = await field();
    const id = await db.rpc<string>(coordinator, "save_partnership_agreement", [null, org, AGREEMENT({ intervention_field: slug, end_on: "2026-12-01" })]);
    await db.sql(`update public.partnership_agreements set status = 'active' where id = $1`, [id]);
    await db.rpc(coordinator, "save_partnership_milestone", [null, id, "Bilan du premier trimestre", new Date().toISOString().slice(0, 10), null]);
    const late = await db.rpc<string>(coordinator, "save_partnership_contribution", [null, org, JSON.stringify({ kind: "material", description: "Ordinateurs portables", item: "Ordinateurs", quantity: "20", expected_on: "2026-01-15" })]);
    const w = await db.rpc<{ renewals: Array<{ id: string }>; milestones: Array<{ agreement_id: string }>; contributions: Array<{ id: string }> }>(coordinator, "partnership_watchlist", []);
    expect(w.renewals.map((r) => r.id)).toContain(id);
    expect(w.milestones.map((m) => m.agreement_id)).toContain(id);
    expect(w.contributions.map((c) => c.id)).toContain(late);
    expect(await db.rpc(enterprise, "partnership_watchlist", [])).toBeNull();
  });
});

describe("contributions (brief V2 §9)", () => {
  it("never count a pledge as received, and are verified by an approver with evidence", async () => {
    const id = await db.rpc<string>(coordinator, "save_partnership_contribution", [null, org, JSON.stringify({ kind: "financial", description: "Bourses d’études 2027", amount_pledged: "50000", currency: "MAD" })]);
    await expect(
      db.rpc(coordinator, "save_partnership_contribution", [null, org, JSON.stringify({ kind: "financial", description: "Sans montant" })]),
    ).rejects.toThrow(/check constraint/);
    await db.rpc(coordinator, "set_contribution_stage", [id, "committed", "{}"]);
    expect(await db.rpcError(coordinator, "set_contribution_stage", [id, "delivered", "{}"])).toMatch(/delivery_details_required/);
    await db.rpc(coordinator, "set_contribution_stage", [id, "delivered", JSON.stringify({ amount_received: "30000", received_on: "2026-10-01" })]);
    const [c] = await db.sql<{ amount_pledged: string; amount_received: string }>(`select amount_pledged::text, amount_received::text from public.partnership_contributions where id = $1`, [id]);
    expect(c).toEqual({ amount_pledged: "50000.00", amount_received: "30000.00" });

    expect(await db.rpcError(approver, "set_contribution_stage", [id, "verified", "{}"])).toMatch(/evidence_required/);
    await addDoc(coordinator, null, id, "evidence");
    expect(await db.rpcError(coordinator, "set_contribution_stage", [id, "verified", "{}"])).toMatch(/forbidden/);
    await db.rpc(approver, "set_contribution_stage", [id, "verified", "{}"]);
    expect(await db.rpcError(coordinator, "save_partnership_contribution", [id, org, JSON.stringify({ kind: "financial", description: "Changé", amount_pledged: "1" })])).toMatch(/contribution_locked/);

    const totals = await db.as(coordinator, (q) =>
      q<{ stage: string; pledged: string; received: string | null }>(`select stage::text, pledged::text, received::text from public.contribution_totals($1) where kind = 'financial'`, [org]),
    );
    expect(totals).toEqual([{ stage: "verified", pledged: "50000.00", received: "30000.00" }]);
  });

  it("are cancelled with a reason only", async () => {
    const id = await db.rpc<string>(coordinator, "save_partnership_contribution", [null, org, JSON.stringify({ kind: "expertise", description: "Mentorat de professeurs", expertise_category: "Pédagogie numérique", hours_pledged: "40" })]);
    expect(await db.rpcError(coordinator, "set_contribution_stage", [id, "cancelled", "{}"])).toMatch(/comment_required/);
    await db.rpc(coordinator, "set_contribution_stage", [id, "cancelled", JSON.stringify({ note: "Partenaire indisponible" })]);
    const h = await db.sql<{ to_status: string }>(`select to_status from public.partnership_status_history where contribution_id = $1 order by created_at`, [id]);
    expect(h.map((x) => x.to_status)).toEqual(["pledged", "cancelled"]);
  });
});
