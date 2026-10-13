/**
 * Partenariats & Coopération, phase 5: impact indicators, partner reports
 * and the dashboard. Only figures verified by an approver reach a report;
 * outputs and outcomes stay apart; reports hold aggregates only.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb, uid } from "./harness";

let db: TestDb;
let coordinator: string;
let approver: string;
let enterprise: string;
let org: string;
let agreement: string;

const METRIC = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    agreement_id: agreement,
    intervention_field: "soutien-scolaire",
    dimension: "students_supported",
    metric_type: "output",
    value: "180",
    unit: "élèves",
    period_start: "2026-10-01",
    period_end: "2026-12-31",
    method: "Listes de présence des séances de soutien, tenues par les encadrants.",
    attribution: "direct",
    ...extra,
  });

beforeAll(async () => {
  db = await TestDb.create();
  const admin = await db.createAdmin();
  const other = await db.createAdmin();
  const staff = async (role: string) => {
    const id = await db.createUser(`${role}.${uid()}@sanady.test`);
    await db.rpc(admin, "set_platform_role", [id, role]);
    return id;
  };
  coordinator = await staff("partnership_coordinator");
  approver = await staff("partnership_manager");
  await db.rpc(other, "set_partnership_signatory", [approver, true]);
  enterprise = await staff("enterprise_manager");
  const [o] = await db.sql<{ id: string }>(`insert into public.partner_organizations (name, org_type, status) values ($1, 'entreprise', 'implementation') returning id`, [`Partenaire ${uid()}`]);
  org = o!.id;
  agreement = await db.rpc<string>(coordinator, "save_partnership_agreement", [null, org, JSON.stringify({ title: "Soutien scolaire 2026", intervention_field: "soutien-scolaire", objectives: "Accompagner 200 élèves de collège en mathématiques.", start_on: "2026-10-01", end_on: "2027-06-30" })]);
  await db.sql(`update public.partnership_agreements set status = 'active' where id = $1`, [agreement]);
});
afterAll(async () => db?.close());

describe("impact indicators (brief V2 §12)", () => {
  it("are reported by the team, attributed to an agreement or a project, and verified by an approver", async () => {
    expect(await db.rpcError(coordinator, "save_impact_metric", [null, org, METRIC({ agreement_id: "" })])).toMatch(/attribution_required/);
    await expect(db.rpc(coordinator, "save_impact_metric", [null, org, METRIC({ method: "court" })])).rejects.toThrow(/check constraint/);
    const id = await db.rpc<string>(coordinator, "save_impact_metric", [null, org, METRIC()]);
    expect(await db.rpcError(coordinator, "set_metric_status", [id, "verified", null])).toMatch(/forbidden/);
    expect(await db.rpcError(approver, "set_metric_status", [id, "rejected", null])).toMatch(/comment_required/);
    await db.rpc(approver, "set_metric_status", [id, "rejected", "Joindre les listes de présence"]);
    await db.rpc(coordinator, "save_impact_metric", [id, org, METRIC({ value: "176" })]);
    await db.rpc(approver, "set_metric_status", [id, "verified", null]);
    expect(await db.rpcError(coordinator, "save_impact_metric", [id, org, METRIC({ value: "500" })])).toMatch(/metric_locked/);
    expect(await db.as(enterprise, (q) => q(`select 1 from public.partnership_impact_metrics`))).toEqual([]);
  });
});

describe("partner reports (brief V2 §13)", () => {
  it("use verified figures only, for this partner only, and are approved before sharing", async () => {
    // An unverified figure and another partner's verified figure must not appear.
    await db.rpc(coordinator, "save_impact_metric", [null, org, METRIC({ dimension: "activities_delivered", value: "40", unit: "séances" })]);
    const [o2] = await db.sql<{ id: string }>(`insert into public.partner_organizations (name, org_type, status) values ($1, 'fondation', 'implementation') returning id`, [`Autre ${uid()}`]);
    const a2 = await db.rpc<string>(coordinator, "save_partnership_agreement", [null, o2!.id, JSON.stringify({ title: "Autre convention", intervention_field: "bourses", objectives: "Accompagner des bacheliers vers les bourses d’études." })]);
    const m2 = await db.rpc<string>(coordinator, "save_impact_metric", [null, o2!.id, METRIC({ agreement_id: a2, value: "999" })]);
    await db.rpc(approver, "set_metric_status", [m2, "verified", null]);

    const report = await db.rpc<string>(coordinator, "save_partner_report", [null, org, JSON.stringify({ title: "Rapport du premier trimestre", period_start: "2026-10-01", period_end: "2026-12-31", challenges: "Absences pendant la période des examens." })]);
    const data = await db.rpc<{ metrics: Array<{ value: number; dimension: string }>; agreements: unknown[]; report: { reference: string } }>(coordinator, "partner_report_data", [report]);
    expect(data.report.reference).toMatch(/^RAP-\d{4}-\d{4}$/);
    expect(data.metrics.map((m) => [m.dimension, Number(m.value)])).toEqual([["students_supported", 176]]);
    expect(data.agreements).toHaveLength(1);
    expect(JSON.stringify(data)).not.toMatch(/@sanady\.test/);

    expect(await db.rpcError(coordinator, "set_report_status", [report, "approved"])).toMatch(/forbidden/);
    expect(await db.rpcError(coordinator, "set_report_status", [report, "shared"])).toMatch(/invalid_transition/);
    await db.rpc(approver, "set_report_status", [report, "approved"]);
    expect(await db.rpcError(coordinator, "save_partner_report", [report, org, JSON.stringify({ title: "Modifié après approbation", period_start: "2026-10-01", period_end: "2026-12-31" })])).toMatch(/report_locked/);
    await db.rpc(coordinator, "set_report_status", [report, "shared"]);
    const [r] = await db.sql<{ status: string; shared_at: string | null }>(`select status, shared_at from public.partnership_reports where id = $1`, [report]);
    expect(r!.status).toBe("shared");
    expect(r!.shared_at).not.toBeNull();
  });
});

describe("partnership dashboard", () => {
  it("counts real records and verified figures only", async () => {
    const d = await db.rpc<{ agreements_signed: number; metrics_pending: number; verified_metrics: Array<{ value: number }> }>(coordinator, "partnership_dashboard", []);
    expect(Number(d.agreements_signed)).toBe(1);
    expect(Number(d.metrics_pending)).toBe(1);
    // Summed per field and dimension across partners (the 40 unverified sessions are left out).
    expect(d.verified_metrics.map((m) => Number(m.value))).toEqual([1175]);
    expect(await db.rpc(enterprise, "partnership_dashboard", [])).toBeNull();
  });
});
