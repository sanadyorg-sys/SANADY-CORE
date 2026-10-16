/**
 * Deletion of a company space's data: never automatic — proposed, the
 * organisation warned and given its data, confirmed by a second person,
 * 30 days to cancel, then carried out by the server with a certificate.
 * Accounting and the organisation are kept. Plus the automatic monthly
 * usage reading.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb, uid } from "./harness";

let db: TestDb;
let manager: string;
let approver: string;
let production: string;
let org: string;
let inst: string;
let tenant: string;
let employee: string;
let teacherElsewhere: string;
let deletion: string;
let course: string;
let invoice: string;

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
  [{ id: org }] = (await db.sql<{ id: string }>(`insert into public.partner_organizations (name, org_type, enterprise_status) values ('Société Fin', 'entreprise', 'active_service') returning id`)) as [{ id: string }];
  await db.sql(`select set_config('sanady.tenant_sync', 'on', false)`);
  [{ id: inst }] = (await db.sql<{ id: string }>(`insert into public.institutions (name, identifier, type, contact_email, kind) values ('Société Fin', $1, 'autre', 'f@f.test', 'enterprise') returning id`, [`ENT-${uid().toUpperCase()}`])) as [{ id: string }];
  [{ id: tenant }] = (await db.sql<{ id: string }>(
    `insert into public.enterprise_tenants (organization_id, institution_id, slug, display_name, service_plan, max_learners, status, activated_at, closed_at, export_authorized_at, deletion_due_on)
     values ($1, $2, $3, 'Société Fin', 'complete', 20, 'closed', now() - interval '1 year', now(), now(), current_date + 10) returning id`,
    [org, inst, `fin-${uid()}`],
  )) as [{ id: string }];
  const [{ id: school }] = (await db.sql<{ id: string }>(`insert into public.institutions (name, identifier, type, contact_email) values ('École voisine', $1, 'autre', 'e@e.test') returning id`, [`EC-${uid().toUpperCase()}`])) as [{ id: string }];
  await db.sql(`select set_config('sanady.tenant_sync', '', false)`);
  employee = await db.createUser(`emp.${uid()}@fin.test`);
  teacherElsewhere = await db.createUser(`prof.${uid()}@ecole.test`);
  for (const u of [employee, teacherElsewhere]) await db.sql(`insert into public.institution_memberships (institution_id, user_id, role, source, consented_at, status, revoked_at) values ($1, $2, 'teacher', 'admin', now(), 'revoked', now())`, [inst, u]);
  await db.sql(`insert into public.institution_memberships (institution_id, user_id, role, source, consented_at) values ($1, $2, 'teacher', 'admin', now())`, [school, teacherElsewhere]);
  [{ id: course }] = (await db.sql<{ id: string }>(`insert into public.courses (title, ownership, owner_institution_id) values ('Formation propre à la société', 'company', $1) returning id`, [inst])) as [{ id: string }];
  await db.sql(`insert into public.enrollments (user_id, course_id, status, completed_at) values ($1, $2, 'completed', now())`, [employee, course]);
  await db.sql(`insert into storage.buckets (id, name) values ('course-media', 'course-media') on conflict do nothing`);
  await db.sql(`insert into storage.objects (bucket_id, name) values ('course-media', $1)`, [`${course}/video.mp4`]);
  const [{ id: contract }] = (await db.sql<{ id: string }>(
    `insert into public.enterprise_contracts (reference, organization_id, tenant_id, title, service, pricing_model, currency, status) values ($1, $2, $3, 'Contrat clos', 'complete', 'fixed_fee', 'MAD', 'closed') returning id`,
    [`CTR-F-${uid()}`, org, tenant],
  )) as [{ id: string }];
  [{ id: invoice }] = (await db.sql<{ id: string }>(`insert into public.enterprise_invoices (contract_id, external_reference, category, amount, currency, issued_on) values ($1, 'FA-1', 'setup', 1000, 'MAD', current_date - 60) returning id`, [contract])) as [{ id: string }];
});
afterAll(async () => db?.close());

describe("deleting a company space's data", () => {
  it("is proposed by the enterprise manager, and can be cancelled", async () => {
    expect(await db.rpcError(production, "propose_data_deletion", [tenant, "Fin du contrat et délai écoulé"])).toMatch(/forbidden/);
    const first = await db.rpc<string>(manager, "propose_data_deletion", [tenant, "Fin du contrat et délai écoulé"]);
    expect(await db.rpcError(manager, "propose_data_deletion", [tenant, "Deuxième proposition"])).toMatch(/duplicate key|unique/);
    await db.rpc(approver, "cancel_data_deletion", [first, "La société renouvelle finalement"]);
    deletion = await db.rpc<string>(manager, "propose_data_deletion", [tenant, "Fin du contrat et délai écoulé"]);
  });

  it("cannot be confirmed before the organisation is warned and given its data, nor by the person who proposed it", async () => {
    expect(await db.rpcError(manager, "confirm_data_deletion", [deletion, "Je confirme"])).toMatch(/forbidden/);
    expect(await db.rpcError(approver, "confirm_data_deletion", [deletion, "Je confirme"])).toMatch(/deletion_blocked/);
    expect(await db.rpc<string[]>(approver, "deletion_blockers", [deletion])).toEqual(expect.arrayContaining(["notice", "delivery", "date", "unpaid"]));
    await db.rpc(manager, "record_deletion_step", [deletion, "notice", JSON.stringify({ date: new Date().toISOString().slice(0, 10), recipient: "Mme Directrice RH — rh@fin.test" })]);
    await db.rpc(manager, "record_deletion_step", [deletion, "delivery", JSON.stringify({ date: new Date().toISOString().slice(0, 10), method: "Export CSV remis par e-mail sécurisé" })]);
    // A hold blocks everything.
    await db.rpc(approver, "set_deletion_hold", [deletion, "Litige en cours sur la dernière facture"]);
    expect(await db.rpc<string[]>(approver, "deletion_blockers", [deletion])).toEqual(expect.arrayContaining(["hold"]));
    await db.rpc(approver, "set_deletion_hold", [deletion, ""]);
    // The invoice is paid, the date comes.
    await db.sql(`insert into public.enterprise_payments (invoice_id, amount, received_on, method) values ($1, 1000, current_date, 'transfer')`, [invoice]);
    expect(await db.rpc<string[]>(approver, "deletion_blockers", [deletion])).toEqual(["date"]);
    await db.sql(`update public.enterprise_tenants set deletion_due_on = current_date where id = $1`, [tenant]);
    expect(await db.rpc<string[]>(approver, "deletion_blockers", [deletion])).toEqual([]);
    // Four eyes: the person who proposed cannot confirm, even as an approver.
    await db.sql(`update public.data_deletions set proposed_by = $2 where id = $1`, [deletion, approver]);
    expect(await db.rpcError(approver, "confirm_data_deletion", [deletion, "Je confirme"])).toMatch(/four_eyes/);
    await db.sql(`update public.data_deletions set proposed_by = $2 where id = $1`, [deletion, manager]);
  });

  it("waits 30 days after confirmation, then the server carries it out with a certificate", async () => {
    await db.rpc(approver, "confirm_data_deletion", [deletion, "Délai contractuel écoulé, données remises"]);
    expect(await db.rpcError(approver, "execute_due_deletions", [])).toMatch(/permission denied/);
    expect(await db.rpc(null, "execute_due_deletions", [], "service_role")).toEqual([]);
    await db.sql(`update public.data_deletions set execute_after = now() - interval '1 minute' where id = $1`, [deletion]);
    // A hold placed during the 30 days still stops it.
    await db.rpc(manager, "set_deletion_hold", [deletion, "Demande de l’organisation de conserver"]);
    expect(await db.rpc(null, "execute_due_deletions", [], "service_role")).toEqual([]);
    await db.rpc(manager, "set_deletion_hold", [deletion, ""]);

    const out = await db.rpc<Array<{ files: string[] }>>(null, "execute_due_deletions", [], "service_role");
    expect(out).toHaveLength(1);
    expect(out[0]!.files).toContain(`${course}/video.mp4`);
    const [d] = await db.sql<{ status: string; certificate: { deleted: Record<string, number>; confirmed_by: string } }>(`select status, certificate from public.data_deletions where id = $1`, [deletion]);
    expect(d!.status).toBe("executed");
    expect(d!.certificate.deleted).toMatchObject({ accounts: 1, memberships: 1, courses: 1 });

    // Deleted: the employee's account, the company's course, the space. Kept: the teacher elsewhere, the organisation, accounting.
    expect(await db.sql(`select 1 from auth.users where id = $1`, [employee])).toEqual([]);
    expect(await db.sql(`select 1 from auth.users where id = $1`, [teacherElsewhere])).toHaveLength(1);
    expect(await db.sql(`select 1 from public.institution_memberships where user_id = $1 and institution_id = $2`, [teacherElsewhere, inst])).toEqual([]);
    expect(await db.sql(`select 1 from public.courses where id = $1`, [course])).toEqual([]);
    expect(await db.sql(`select 1 from public.institutions where id = $1`, [inst])).toEqual([]);
    expect(await db.sql(`select 1 from public.partner_organizations where id = $1`, [org])).toHaveLength(1);
    expect(await db.sql(`select 1 from public.enterprise_invoices where id = $1`, [invoice])).toHaveLength(1);
    const [t] = await db.sql<{ data_deleted_at: string | null; institution_id: string | null }>(`select data_deleted_at, institution_id from public.enterprise_tenants where id = $1`, [tenant]);
    expect(t!.data_deleted_at).not.toBeNull();
    expect(t!.institution_id).toBeNull();
  });
});

describe("automatic monthly usage reading", () => {
  it("records last month once for each running company space (server only)", async () => {
    await db.sql(`select set_config('sanady.tenant_sync', 'on', false)`);
    const [{ id: i2 }] = (await db.sql<{ id: string }>(`insert into public.institutions (name, identifier, type, contact_email, kind) values ('Société Active', $1, 'autre', 'a@a.test', 'enterprise') returning id`, [`ENT-${uid().toUpperCase()}`])) as [{ id: string }];
    const [{ id: t2 }] = (await db.sql<{ id: string }>(`insert into public.enterprise_tenants (organization_id, institution_id, slug, display_name, service_plan, max_learners, status, activated_at) values ($1, $2, $3, 'Société Active', 'complete', 5, 'active', now() - interval '3 months') returning id`, [org, i2, `act-${uid()}`])) as [{ id: string }];
    await db.sql(`select set_config('sanady.tenant_sync', '', false)`);
    expect(await db.rpcError(manager, "auto_record_usage", [])).toMatch(/permission denied/);
    expect(await db.rpc<number>(null, "auto_record_usage", [], "service_role")).toBeGreaterThanOrEqual(1);
    expect(await db.rpc<number>(null, "auto_record_usage", [], "service_role")).toBe(0);
    const [r] = await db.sql<{ recorded_by: string | null }>(`select recorded_by from public.enterprise_usage_records where tenant_id = $1`, [t2]);
    expect(r!.recorded_by).toBeNull();
  });
});
