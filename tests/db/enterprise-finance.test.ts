/**
 * SANADY Enterprise, phase E6: financial foundation. Invoices and payments
 * are recorded (never issued or collected by the platform); contracted,
 * invoiced, received and outstanding stay separate per currency; payments
 * are confirmed by someone else than who recorded them; commercial amounts
 * never mix with partnership contributions.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb, uid } from "./harness";

let db: TestDb;
let manager: string;
let production: string;
let approver: string;
let partnership: string;
let org: string;
let contract: string;

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
  partnership = await staff("partnership_coordinator");
  await db.rpc(other, "set_partnership_signatory", [approver, true]);
  // One organisation, both a partner and a client.
  [{ id: org }] = (await db.sql<{ id: string }>(`insert into public.partner_organizations (name, org_type, status, enterprise_status) values ($1, 'entreprise', 'implementation', 'active_service') returning id`, [`Double ${uid()}`])) as [{ id: string }];
  [{ id: contract }] = (await db.sql<{ id: string }>(
    `insert into public.enterprise_contracts (reference, organization_id, title, service, pricing_model, currency, start_on, end_on, status, signed_on)
     values ($1, $2, 'Contrat plateforme', 'plateforme', 'annual_subscription', 'MAD', '2026-01-15', '2026-12-31', 'active', '2026-01-10') returning id`,
    [`CTR-T-${uid()}`, org],
  )) as [{ id: string }];
  await db.sql(`insert into public.enterprise_contract_lines (contract_id, category, label, quantity, unit_price) values ($1, 'platform_access', 'Accès', 12, 2000)`, [contract]);
  await db.sql(`insert into public.partnership_contributions (organization_id, kind, description, currency, amount_pledged, amount_received, received_on, stage) values ($1, 'financial', 'Don bourses', 'MAD', 10000, 10000, '2026-03-01', 'verified')`, [org]);
});
afterAll(async () => db?.close());

const INVOICE = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({ external_reference: "FA-2026-001", category: "platform_subscription", amount: "12000", issued_on: "2026-02-01", due_on: "2026-03-01", ...extra });

describe("finance (brief V3 §17–18)", () => {
  let invoice: string;

  it("records invoices of signed contracts only, in the contract's currency", async () => {
    const [{ id: draft }] = (await db.sql<{ id: string }>(
      `insert into public.enterprise_contracts (reference, organization_id, title, service, pricing_model, currency) values ($1, $2, 'Brouillon de contrat', 'plateforme', 'fixed_fee', 'EUR') returning id`,
      [`CTR-D-${uid()}`, org],
    )) as [{ id: string }];
    expect(await db.rpcError(manager, "record_invoice", [draft, INVOICE()])).toMatch(/contract_not_signed/);
    expect(await db.rpcError(production, "record_invoice", [contract, INVOICE()])).toMatch(/forbidden/);
    invoice = await db.rpc<string>(manager, "record_invoice", [contract, INVOICE({ currency: "EUR" })]);
    const [i] = await db.sql<{ currency: string }>(`select currency from public.enterprise_invoices where id = $1`, [invoice]);
    expect(i!.currency).toBe("MAD");
    expect(await db.rpcError(manager, "record_invoice", [contract, INVOICE()])).toMatch(/already_exists/);
  });

  it("never records more than is due, and confirms payments with four eyes", async () => {
    expect(await db.rpcError(manager, "record_payment", [invoice, JSON.stringify({ amount: "15000", received_on: "2026-02-10" })])).toMatch(/payment_exceeds_invoice/);
    const pay = await db.rpc<string>(manager, "record_payment", [invoice, JSON.stringify({ amount: "8000", received_on: "2026-02-10", method: "transfer" })]);
    expect(await db.rpcError(manager, "confirm_payment", [pay])).toMatch(/forbidden/);
    await db.rpc(approver, "confirm_payment", [pay]);
    expect(await db.rpcError(manager, "cancel_invoice", [invoice, "Avoir émis"])).toMatch(/invoice_paid/);
  });

  it("keeps contracted, invoiced, received, confirmed and outstanding apart; margins from costs", async () => {
    await db.rpc(manager, "record_cost", [JSON.stringify({ category: "video_hosting", description: "Mux février", amount: "500", currency: "MAD", incurred_on: "2026-02-28", contract_id: contract })]);
    await db.rpc(manager, "record_cost", [JSON.stringify({ category: "trainer_compensation", description: "Estimation formateurs", amount: "2000", currency: "MAD", incurred_on: "2026-03-15", is_estimate: true })]);
    const f = await db.rpc<{ by_currency: Array<Record<string, string>>; contracts: Array<Record<string, string>>; costs_by_category: unknown[] }>(manager, "enterprise_finance", ["2026-01-01", "2026-12-31"]);
    const mad = f.by_currency.find((x) => x.currency === "MAD")!;
    expect(Number(mad.contracted)).toBe(24000);
    expect(Number(mad.invoiced)).toBe(12000);
    expect(Number(mad.received)).toBe(8000);
    expect(Number(mad.confirmed)).toBe(8000);
    expect(Number(mad.outstanding)).toBe(4000);
    expect(Number(mad.costs_actual)).toBe(500);
    expect(Number(mad.costs_estimated)).toBe(2000);
    const c = f.contracts.find((x) => x.id === contract)!;
    expect(Number(c.direct_costs)).toBe(500);
    expect(await db.rpcError(production, "enterprise_finance", ["2026-01-01", "2026-12-31"])).toMatch(/forbidden/);
  });

  it("shows both relationships of an organisation, never added together", async () => {
    const r = await db.rpc<{ partnership: { contributions_received: Array<{ amount: string }> }; enterprise: { invoiced: Array<{ amount: string }> | null; contracts: number } }>(manager, "organization_relationships", [org]);
    expect(Number(r.partnership.contributions_received[0]!.amount)).toBe(10000);
    expect(Number(r.enterprise.invoiced![0]!.amount)).toBe(12000);
    // Partnership staff see the commercial side without its amounts.
    const p = await db.rpc<{ enterprise: { invoiced: unknown; contracts: number } }>(partnership, "organization_relationships", [org]);
    expect(p.enterprise.invoiced).toBeNull();
    expect(Number(p.enterprise.contracts)).toBe(1);
    expect(await db.as(partnership, (q) => q(`select 1 from public.enterprise_invoices`))).toEqual([]);
  });
});
