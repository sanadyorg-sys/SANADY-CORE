/**
 * Company logo: uploaded by the enterprise manager into a private bucket,
 * readable by the company's members and the Enterprise team only, carried
 * on the documents of the company's own courses.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb, uid } from "./harness";

let db: TestDb;
let manager: string;
let production: string;
let employee: string;
let outsider: string;
let tenant: string;
let inst: string;

beforeAll(async () => {
  db = await TestDb.create();
  const admin = await db.createAdmin();
  const staff = async (role: string) => {
    const id = await db.createUser(`${role}.${uid()}@sanady.test`);
    await db.rpc(admin, "set_platform_role", [id, role]);
    return id;
  };
  manager = await staff("enterprise_manager");
  production = await staff("production_manager");
  await db.sql(`insert into storage.buckets (id, name) values ('enterprise-logos', 'enterprise-logos') on conflict do nothing`);
  const [{ id: org }] = (await db.sql<{ id: string }>(`insert into public.partner_organizations (name, org_type, enterprise_status) values ('Société Logo', 'entreprise', 'active_service') returning id`)) as [{ id: string }];
  await db.sql(`select set_config('sanady.tenant_sync', 'on', false)`);
  [{ id: inst }] = (await db.sql<{ id: string }>(`insert into public.institutions (name, identifier, type, contact_email, kind) values ('Société Logo', $1, 'autre', 'l@l.test', 'enterprise') returning id`, [`ENT-${uid().toUpperCase()}`])) as [{ id: string }];
  [{ id: tenant }] = (await db.sql<{ id: string }>(`insert into public.enterprise_tenants (organization_id, institution_id, slug, display_name, service_plan, max_learners, status, activated_at) values ($1, $2, $3, 'Société Logo', 'complete', 20, 'active', now()) returning id`, [org, inst, `logo-${uid()}`])) as [{ id: string }];
  await db.sql(`select set_config('sanady.tenant_sync', '', false)`);
  employee = await db.createUser(`emp.${uid()}@logo.test`);
  await db.sql(`insert into public.institution_memberships (institution_id, user_id, role, source, consented_at) values ($1, $2, 'teacher', 'admin', now())`, [inst, employee]);
  outsider = await db.createUser(`out.${uid()}@other.test`);
});
afterAll(async () => db?.close());

describe("company logo", () => {
  it("is uploaded and recorded by the enterprise manager only", async () => {
    const path = `${tenant}/logo-1.png`;
    await expect(db.as(production, (q) => q(`insert into storage.objects (bucket_id, name) values ('enterprise-logos', $1)`, [path]))).rejects.toThrow(/row-level security/);
    await db.as(manager, (q) => q(`insert into storage.objects (bucket_id, name) values ('enterprise-logos', $1)`, [path]));
    expect(await db.rpcError(production, "set_tenant_logo", [tenant, path])).toMatch(/forbidden/);
    // A path outside the company's folder, or a file that was never uploaded, is refused.
    expect(await db.rpcError(manager, "set_tenant_logo", [tenant, `${tenant}/logo-2.png`])).toMatch(/invalid_input/);
    expect(await db.rpc<string | null>(manager, "set_tenant_logo", [tenant, path])).toBeNull();
    const [t] = await db.sql<{ logo_path: string }>(`select logo_path from public.enterprise_tenants where id = $1`, [tenant]);
    expect(t!.logo_path).toBe(path);
  });

  it("is seen by the company's members and the team, nobody else", async () => {
    const read = (who: string) => db.as(who, (q) => q(`select name from storage.objects where bucket_id = 'enterprise-logos'`));
    expect(await read(employee)).toHaveLength(1);
    expect(await read(production)).toHaveLength(1);
    expect(await read(outsider)).toHaveLength(0);
    expect(await db.rpc<string | null>(employee, "tenant_logo", [inst])).toBe(`${tenant}/logo-1.png`);
    expect(await db.rpc<string | null>(outsider, "tenant_logo", [inst])).toBeNull();
  });

  it("is carried on the documents of the company's courses", async () => {
    const [{ id: course }] = (await db.sql<{ id: string }>(`insert into public.courses (title, ownership, owner_institution_id) values ('Formation de la société', 'company', $1) returning id`, [inst])) as [{ id: string }];
    const [{ id: cert }] = (await db.sql<{ id: string }>(
      `insert into public.certificates (user_id, course_id, certificate_number, verification_code, recipient_name, course_title, completed_at) values ($1, $2, 'SND-2026-ABCDEF12', $3, 'Employé', 'Formation de la société', now()) returning id`,
      [employee, course, `${uid()}${uid()}${uid()}${uid()}`],
    )) as [{ id: string }];
    const style = await db.rpc<{ logo_path: string; organization: string }>(employee, "certificate_style", [cert]);
    expect(style).toMatchObject({ logo_path: `${tenant}/logo-1.png`, organization: "Société Logo" });
    // Removing it returns the old path, so the file can be deleted.
    expect(await db.rpc<string>(manager, "set_tenant_logo", [tenant, null])).toBe(`${tenant}/logo-1.png`);
  });
});
