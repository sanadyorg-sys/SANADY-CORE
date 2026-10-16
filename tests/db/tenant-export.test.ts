/**
 * End-of-contract export: only once authorised by an approver; the team,
 * approvers, administrators — and the company's administrator while the
 * space is still open. Every download is recorded.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb, uid } from "./harness";

let db: TestDb;
let manager: string;
let partnership: string;
let companyAdmin: string;
let employee: string;
let tenant: string;

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
  const [{ id: org }] = (await db.sql<{ id: string }>(`insert into public.partner_organizations (name, org_type, enterprise_status) values ('Société Export', 'entreprise', 'active_service') returning id`)) as [{ id: string }];
  await db.sql(`select set_config('sanady.tenant_sync', 'on', false)`);
  const [{ id: inst }] = (await db.sql<{ id: string }>(`insert into public.institutions (name, identifier, type, contact_email, kind) values ('Société Export', $1, 'autre', 'x@x.test', 'enterprise') returning id`, [`ENT-${uid().toUpperCase()}`])) as [{ id: string }];
  [{ id: tenant }] = (await db.sql<{ id: string }>(`insert into public.enterprise_tenants (organization_id, institution_id, slug, display_name, service_plan, max_learners, status, activated_at) values ($1, $2, $3, 'Société Export', 'complete', 20, 'active', now()) returning id`, [org, inst, `exp-${uid()}`])) as [{ id: string }];
  await db.sql(`select set_config('sanady.tenant_sync', '', false)`);
  companyAdmin = await db.createUser(`admin.${uid()}@export.test`);
  employee = await db.createUser(`emp.${uid()}@export.test`);
  await db.sql(`insert into public.institution_memberships (institution_id, user_id, role, source) values ($1, $2, 'admin', 'admin')`, [inst, companyAdmin]);
  await db.sql(`insert into public.institution_memberships (institution_id, user_id, role, source, consented_at) values ($1, $2, 'teacher', 'admin', now())`, [inst, employee]);
  await db.sql(`update public.enterprise_tenants set status = 'offboarding', offboarding_started_at = now() where id = $1`, [tenant]);
});
afterAll(async () => db?.close());

describe("end-of-contract export", () => {
  it("is closed until an approver authorises it", async () => {
    for (const who of [manager, companyAdmin]) expect(await db.rpc<boolean>(who, "can_export_tenant", [tenant])).toBe(false);
    expect(await db.rpcError(manager, "record_tenant_export", [tenant])).toMatch(/forbidden/);
  });

  it("is then open to the team and the company's administrator, never to employees or other teams", async () => {
    await db.sql(`update public.enterprise_tenants set export_authorized_at = now() where id = $1`, [tenant]);
    expect(await db.rpc<boolean>(manager, "can_export_tenant", [tenant])).toBe(true);
    expect(await db.rpc<boolean>(companyAdmin, "can_export_tenant", [tenant])).toBe(true);
    expect(await db.rpc<boolean>(employee, "can_export_tenant", [tenant])).toBe(false);
    expect(await db.rpc<boolean>(partnership, "can_export_tenant", [tenant])).toBe(false);
    await db.rpc(companyAdmin, "record_tenant_export", [tenant]);
    const [h] = await db.sql<{ to_status: string; changed_by: string }>(`select to_status, changed_by from public.enterprise_history where tenant_id = $1 order by created_at desc limit 1`, [tenant]);
    expect(h).toEqual({ to_status: "export_downloaded", changed_by: companyAdmin });
  });

  it("stays with the team once the space is closed", async () => {
    await db.sql(`update public.enterprise_tenants set status = 'closed', closed_at = now() where id = $1`, [tenant]);
    expect(await db.rpc<boolean>(companyAdmin, "can_export_tenant", [tenant])).toBe(false);
    expect(await db.rpc<boolean>(manager, "can_export_tenant", [tenant])).toBe(true);
  });
});
