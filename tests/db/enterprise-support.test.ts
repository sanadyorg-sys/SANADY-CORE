/**
 * SANADY Enterprise support requests: opened by a company administrator,
 * answered by the Enterprise team; internal notes stay with the team; a
 * company never sees another company's requests.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb, uid } from "./harness";

let db: TestDb;
let manager: string;
let partnership: string;
let clientAdmin: string;
let otherAdmin: string;
let employee: string;
let inst: string;
let otherInst: string;

async function company(name: string) {
  const [{ id: org }] = (await db.sql<{ id: string }>(`insert into public.partner_organizations (name, org_type, enterprise_status) values ($1, 'entreprise', 'active_service') returning id`, [name])) as [{ id: string }];
  await db.sql(`select set_config('sanady.tenant_sync', 'on', false)`);
  const [{ id }] = (await db.sql<{ id: string }>(`insert into public.institutions (name, identifier, type, contact_email, kind) values ($1, $2, 'autre', 'c@c.test', 'enterprise') returning id`, [name, `ENT-${uid().toUpperCase()}`])) as [{ id: string }];
  await db.sql(`insert into public.enterprise_tenants (organization_id, institution_id, slug, display_name, service_plan, max_learners, status, activated_at) values ($1, $2, $3, $4, 'complete', 50, 'active', now())`, [org, id, `c-${uid()}`, name]);
  await db.sql(`select set_config('sanady.tenant_sync', '', false)`);
  return id;
}
async function member(institution: string, role: "admin" | "teacher") {
  const u = await db.createUser(`${role}.${uid()}@client.test`);
  await db.sql(`insert into public.institution_memberships (institution_id, user_id, role, source, consented_at) values ($1, $2, $3, 'admin', now())`, [institution, u, role]);
  return u;
}
const OPEN = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({ category: "access", priority: "urgent", subject: "Un collaborateur ne peut pas se connecter", body: "Depuis ce matin, Karim reçoit un message d’erreur à la connexion.", ...extra });

beforeAll(async () => {
  db = await TestDb.create();
  const admin = await db.createAdmin();
  const staff = async (role: string) => {
    const id = await db.createUser(`${role}.${uid()}@sanady.test`);
    await db.rpc(admin, "set_platform_role", [id, role]);
    return id;
  };
  manager = await staff("enterprise_manager");
  partnership = await staff("partnership_coordinator");
  inst = await company("Société A");
  otherInst = await company("Société B");
  clientAdmin = await member(inst, "admin");
  employee = await member(inst, "teacher");
  otherAdmin = await member(otherInst, "admin");
});
afterAll(async () => db?.close());

describe("support requests (brief V3)", () => {
  it("are opened by the company administrator only, with a reference", async () => {
    expect(await db.rpcError(employee, "open_support_request", [inst, OPEN()])).toMatch(/forbidden/);
    expect(await db.rpcError(otherAdmin, "open_support_request", [inst, OPEN()])).toMatch(/forbidden/);
    expect(await db.rpcError(clientAdmin, "open_support_request", [inst, OPEN({ body: "court" })])).toMatch(/invalid_input/);
    const id = await db.rpc<string>(clientAdmin, "open_support_request", [inst, OPEN()]);
    const [r] = await db.sql<{ reference: string; status: string }>(`select reference, status from public.enterprise_support_requests where id = $1`, [id]);
    expect(r!.reference).toMatch(/^SUP-\d{4}-\d{4}$/);
    expect(r!.status).toBe("open");
    // Another company and the partnership team see nothing.
    expect(await db.as(otherAdmin, (q) => q(`select 1 from public.enterprise_support_requests`))).toEqual([]);
    expect(await db.as(partnership, (q) => q(`select 1 from public.enterprise_support_requests`))).toEqual([]);
    expect(await db.as(employee, (q) => q(`select 1 from public.enterprise_support_requests`))).toEqual([]);
  });

  it("follow the conversation between the company and the team, internal notes hidden", async () => {
    const id = await db.rpc<string>(clientAdmin, "open_support_request", [inst, OPEN({ priority: "normal", category: "technical" })]);
    await db.rpc(manager, "post_support_message", [id, "Note : vérifier les journaux de connexion.", true]);
    let [r] = await db.sql<{ status: string; first_response_at: string | null }>(`select status, first_response_at from public.enterprise_support_requests where id = $1`, [id]);
    expect(r!.first_response_at).toBeNull();
    await db.rpc(manager, "post_support_message", [id, "Bonjour, nous regardons cela.", false]);
    [r] = await db.sql(`select status, first_response_at from public.enterprise_support_requests where id = $1`, [id]);
    expect(r!.status).toBe("in_progress");
    expect(r!.first_response_at).not.toBeNull();
    expect(await db.rpcError(clientAdmin, "post_support_message", [id, "Je veux une note interne.", true])).toMatch(/forbidden/);
    const seen = await db.as(clientAdmin, (q) => q<{ body: string }>(`select body from public.enterprise_support_messages where request_id = $1 order by created_at`, [id]));
    expect(seen.map((m) => m.body)).not.toContain("Note : vérifier les journaux de connexion.");
    expect(seen).toHaveLength(2);

    // Waiting for the company → its reply puts the request back in progress.
    await db.rpc(manager, "set_support_status", [id, "waiting_client"]);
    await db.rpc(clientAdmin, "post_support_message", [id, "Voici la capture d’écran demandée.", false]);
    [r] = await db.sql(`select status from public.enterprise_support_requests where id = $1`, [id]);
    expect(r!.status).toBe("in_progress");

    // Resolved → the company may reopen it or close it; the team closes only once resolved.
    expect(await db.rpcError(manager, "set_support_status", [id, "closed"])).toMatch(/invalid_transition/);
    await db.rpc(manager, "set_support_status", [id, "resolved"]);
    expect(await db.rpcError(clientAdmin, "set_support_status", [id, "waiting_client"])).toMatch(/invalid_transition/);
    await db.rpc(clientAdmin, "set_support_status", [id, "in_progress"]);
    await db.rpc(manager, "set_support_status", [id, "resolved"]);
    await db.rpc(clientAdmin, "set_support_status", [id, "closed"]);
    expect(await db.rpcError(clientAdmin, "post_support_message", [id, "Encore une question.", false])).toMatch(/support_closed/);
  });

  it("are assigned within the Enterprise team and counted for the workload", async () => {
    const [{ id }] = (await db.sql<{ id: string }>(`select id from public.enterprise_support_requests where priority = 'urgent' limit 1`)) as [{ id: string }];
    expect(await db.rpcError(manager, "assign_support_request", [id, partnership])).toMatch(/invalid_input/);
    await db.rpc(manager, "assign_support_request", [id, manager]);
    const o = await db.rpc<{ open: number; urgent_unanswered: number; by_tenant: Array<{ tenant: string }> }>(manager, "support_overview", []);
    expect(o.open).toBe(1);
    expect(o.urgent_unanswered).toBe(1);
    expect(o.by_tenant.map((t) => t.tenant)).toContain("Société A");
    expect(await db.rpcError(clientAdmin, "support_overview", [])).toMatch(/forbidden/);
    const w = await db.rpc<{ support_urgent: number }>(manager, "enterprise_watchlist", []);
    expect(w.support_urgent).toBe(1);
  });
});
