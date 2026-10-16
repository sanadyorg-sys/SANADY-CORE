/**
 * Reusable service plans: prepared by the enterprise manager, activated by
 * an approver (they carry prices), applied to draft proposals, carried into
 * the contract (pricing model, limits, support terms).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb, uid } from "./harness";

let db: TestDb;
let manager: string;
let approver: string;
let production: string;
let org: string;
let plan: string;

const PLAN = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    name: `Plateforme PME ${uid()}`,
    service: "plateforme",
    currency: "MAD",
    pricing_model: "annual_subscription",
    learner_limit: "50",
    storage_limit_gb: "10",
    support_level: "Réponse sous 2 jours ouvrés",
    support_commitments: "Assistance par l’espace Assistance, du lundi au vendredi.",
    ...extra,
  });
const LINE = (label: string, price: string) => JSON.stringify({ category: "platform_access", label, quantity: "12", unit: "mois", unit_price: price });

async function proposal(currency = "MAD") {
  const [{ id }] = (await db.sql<{ id: string }>(
    `insert into public.enterprise_proposals (reference, organization_id, title, service, currency) values ($1, $2, 'Proposition plateforme', 'sur_mesure', $3) returning id`,
    [`PROP-T-${uid()}`, org, currency],
  )) as [{ id: string }];
  return id;
}

beforeAll(async () => {
  db = await TestDb.create();
  const admin = await db.createAdmin();
  const other = await db.createAdmin();
  const staff = async (role: string) => {
    const id = await db.createUser(`${role}.${uid()}@sanady.test`);
    await db.rpc(admin, "set_platform_role", [id, role]);
    return id;
  };
  manager = await staff("enterprise_manager");
  production = await staff("production_manager");
  approver = await staff("partnership_manager");
  await db.rpc(other, "set_partnership_signatory", [approver, true]);
  [{ id: org }] = (await db.sql<{ id: string }>(`insert into public.partner_organizations (name, org_type, enterprise_status) values ('Client PME', 'entreprise', 'active_service') returning id`)) as [{ id: string }];
});
afterAll(async () => db?.close());

describe("service plans (brief V3)", () => {
  it("are prepared by the enterprise manager and activated by an approver", async () => {
    expect(await db.rpcError(production, "save_service_plan", [null, PLAN()])).toMatch(/forbidden/);
    plan = await db.rpc<string>(manager, "save_service_plan", [null, PLAN()]);
    expect(await db.rpcError(approver, "set_plan_status", [plan, "active"])).toMatch(/plan_lines_required/);
    await db.rpc(manager, "save_plan_line", [plan, LINE("Accès à la plateforme", "2000")]);
    await db.rpc(manager, "save_plan_line", [plan, JSON.stringify({ category: "setup_fee", label: "Mise en place", quantity: "1", unit_price: "3000" })]);
    expect(await db.rpcError(manager, "set_plan_status", [plan, "active"])).toMatch(/forbidden/);
    await db.rpc(approver, "set_plan_status", [plan, "active"]);
    // An active plan's lines are locked; changing the plan sends it back to draft.
    expect(await db.rpcError(manager, "save_plan_line", [plan, LINE("Autre", "1")])).toMatch(/plan_locked/);
    const [p] = await db.sql<{ status: string; approved_by: string }>(`select status, approved_by from public.enterprise_service_plans where id = $1`, [plan]);
    expect(p).toMatchObject({ status: "active", approved_by: approver });
  });

  it("are applied to draft proposals only, never across currencies", async () => {
    const draft = await proposal();
    const n = await db.rpc<number>(manager, "apply_plan_to_proposal", [draft, plan]);
    expect(n).toBe(2);
    const lines = await db.sql<{ label: string; unit_price: string }>(`select label, unit_price from public.enterprise_proposal_lines where proposal_id = $1 order by position`, [draft]);
    expect(lines.map((l) => l.label)).toEqual(["Accès à la plateforme", "Mise en place"]);
    const [pr] = await db.sql<{ plan_id: string; service: string }>(`select plan_id, service from public.enterprise_proposals where id = $1`, [draft]);
    expect(pr).toMatchObject({ plan_id: plan, service: "plateforme" });

    const euro = await proposal("EUR");
    await db.sql(`insert into public.enterprise_proposal_lines (proposal_id, category, label, quantity, unit_price) values ($1, 'other', 'Conseil', 1, 500)`, [euro]);
    expect(await db.rpcError(manager, "apply_plan_to_proposal", [euro, plan])).toMatch(/currency_mismatch/);
    await db.sql(`update public.enterprise_proposals set status = 'sent' where id = $1`, [euro]);
    expect(await db.rpcError(manager, "apply_plan_to_proposal", [euro, plan])).toMatch(/invalid_transition/);

    // A plan back in draft cannot be applied.
    await db.rpc(manager, "set_plan_status", [plan, "draft"]);
    expect(await db.rpcError(manager, "apply_plan_to_proposal", [await proposal(), plan])).toMatch(/plan_inactive/);
    await db.rpc(approver, "set_plan_status", [plan, "active"]);
  });

  it("carry their pricing model, limits and support terms into the contract", async () => {
    const pr = await proposal();
    await db.rpc(manager, "apply_plan_to_proposal", [pr, plan]);
    await db.sql(`update public.enterprise_proposals set status = 'accepted' where id = $1`, [pr]);
    const contract = await db.rpc<string>(manager, "create_contract_from_proposal", [pr]);
    const [c] = await db.sql<{ pricing_model: string; learner_limit: number; storage_limit_gb: string; support_commitments: string }>(
      `select pricing_model, learner_limit, storage_limit_gb, support_commitments from public.enterprise_contracts where id = $1`,
      [contract],
    );
    expect(c!.pricing_model).toBe("annual_subscription");
    expect(c!.learner_limit).toBe(50);
    expect(Number(c!.storage_limit_gb)).toBe(10);
    expect(c!.support_commitments).toMatch(/^Réponse sous 2 jours ouvrés\nAssistance/);
    const [{ n }] = (await db.sql<{ n: number }>(`select count(*)::int n from public.enterprise_contract_lines where contract_id = $1`, [contract])) as [{ n: number }];
    expect(n).toBe(2);
  });

  it("are archived and restored by the manager", async () => {
    await db.rpc(manager, "set_plan_status", [plan, "archived"]);
    expect(await db.rpcError(manager, "save_service_plan", [plan, PLAN()])).toMatch(/plan_archived/);
    await db.rpc(manager, "set_plan_status", [plan, "draft"]);
    const [p] = await db.sql<{ status: string }>(`select status from public.enterprise_service_plans where id = $1`, [plan]);
    expect(p!.status).toBe("draft");
  });
});
