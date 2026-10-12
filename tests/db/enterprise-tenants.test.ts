/**
 * SANADY Enterprise, phase E3: company learning spaces. A workspace is an
 * institution of kind « enterprise »; it is created only for a client whose
 * contract was signed, after an approver's authorisation, and activated only
 * when the ten provisioning steps are met. Companies never see each other,
 * private courses never cross tenants, and employees stay out of the SANADY
 * teacher statistics.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb, buildCourse, newToken, uid } from "./harness";

let db: TestDb;
let admin: string;
let approver: string;
let manager: string;
let production: string;

const SPEC = { modules: [{ lessons: [{ kind: "pdf" as const }], questions: [{ kind: "single" as const, options: [true, false] }] }] };

async function staff(role: string) {
  const id = await db.createUser(`${role}.${uid()}@sanady.test`);
  await db.rpc(admin, "set_platform_role", [id, role]);
  return id;
}
async function clientOrg(stage = "contract_signed") {
  const [o] = await db.sql<{ id: string }>(
    `insert into public.partner_organizations (name, org_type, status, enterprise_status) values ($1, 'entreprise', null, $2) returning id`,
    [`Société ${uid()}`, stage],
  );
  return o!.id;
}
const config = (slug: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    display_name: `Espace ${slug}`,
    slug,
    service_plan: "plateforme",
    max_learners: "2",
    storage_allowance_gb: "5",
    contract_start_on: "2026-01-01",
    contract_end_on: "2030-12-31",
    ...extra,
  });

/** Invites and accepts; returns the new user's id. */
async function join(inviter: string, kind: string, inst: string, rpc = "create_invitation", tenant?: string) {
  const user = await db.createUser(`${kind}.${uid()}@client.test`);
  const [{ email }] = (await db.sql<{ email: string }>(`select email from public.profiles where id = $1`, [user])) as [{ email: string }];
  const { hash } = newToken();
  if (rpc === "invite_tenant_admin") await db.rpc(inviter, rpc, [tenant, email, hash]);
  else await db.rpc(inviter, rpc, [kind, email, inst, hash]);
  await db.rpc(null, "accept_invitation", [hash, user, kind === "institution_teacher"], "service_role");
  return user;
}

/** A fully provisioned, active workspace with its company administrator. */
async function activeTenant() {
  const org = await clientOrg();
  const slug = `societe-${uid()}`;
  const tenant = await db.rpc<string>(manager, "save_enterprise_tenant", [null, org, config(slug)]);
  await db.rpc(approver, "authorize_enterprise_tenant", [tenant, true, null]);
  const inst = await db.rpc<string>(manager, "generate_enterprise_workspace", [tenant]);
  const director = await join(manager, "institution_admin", inst, "invite_tenant_admin", tenant);
  const course = await buildCourse(db, admin, SPEC);
  await db.rpc(admin, "grant_course_to_institution", [course.courseId, inst]);
  await db.rpc(admin, "confirm_tenant_security", [tenant]);
  await db.rpc(manager, "set_tenant_status", [tenant, "active", "{}"]);
  return { org, tenant, inst, director, courseId: course.courseId };
}

beforeAll(async () => {
  db = await TestDb.create();
  admin = await db.createAdmin();
  const other = await db.createAdmin();
  approver = await staff("partnership_manager");
  await db.rpc(other, "set_partnership_signatory", [approver, true]);
  manager = await staff("enterprise_manager");
  production = await staff("production_manager");
});
afterAll(async () => db?.close());

describe("provisioning (brief §9)", () => {
  it("starts only for a client whose contract was signed, by the enterprise manager", async () => {
    const early = await clientOrg("negotiation");
    expect(await db.rpcError(manager, "save_enterprise_tenant", [null, early, config(`tot-${uid()}`)])).toMatch(/contract_not_signed/);
    const org = await clientOrg();
    expect(await db.rpcError(production, "save_enterprise_tenant", [null, org, config(`prod-${uid()}`)])).toMatch(/forbidden/);
    const t = await db.rpc<string>(manager, "save_enterprise_tenant", [null, org, config(`ok-${uid()}`)]);
    expect(await db.rpcError(manager, "save_enterprise_tenant", [null, org, config(`bis-${uid()}`)])).toMatch(/tenant_exists/);
    await expect(db.rpc(manager, "save_enterprise_tenant", [null, await clientOrg(), config("Bad Slug!")])).rejects.toThrow(/check constraint/);
    const [row] = await db.sql<{ status: string; institution_id: string | null }>(`select status, institution_id from public.enterprise_tenants where id = $1`, [t]);
    expect(row).toEqual({ status: "requested", institution_id: null });
  });

  it("needs an approver's authorisation before any workspace exists", async () => {
    const t = await db.rpc<string>(manager, "save_enterprise_tenant", [null, await clientOrg(), config(`auth-${uid()}`)]);
    expect(await db.rpcError(manager, "authorize_enterprise_tenant", [t, true, null])).toMatch(/forbidden/);
    expect(await db.rpcError(admin, "authorize_enterprise_tenant", [t, true, null])).toMatch(/forbidden/);
    expect(await db.rpcError(manager, "generate_enterprise_workspace", [t])).toMatch(/invalid_transition/);
    await db.rpc(approver, "authorize_enterprise_tenant", [t, true, "Contrat vérifié"]);
    const inst = await db.rpc<string>(manager, "generate_enterprise_workspace", [t]);
    const [i] = await db.sql<{ kind: string; status: string; identifier: string }>(`select kind, status, identifier from public.institutions where id = $1`, [inst]);
    expect(i).toMatchObject({ kind: "enterprise", status: "active" });
    expect(i!.identifier).toMatch(/^ENT-AUTH-/);
  });

  it("refuses enterprise institutions or status changes outside the functions", async () => {
    const err = await db
      .as(admin, (q) => q(`insert into public.institutions (name, identifier, type, contact_email, kind) values ('X Y', 'XY-${uid().toUpperCase()}', 'autre', 'x@y.test', 'enterprise')`))
      .catch((e: Error) => e.message);
    expect(err).toMatch(/forbidden/);
    const { inst } = await activeTenant();
    const err2 = await db.as(admin, (q) => q(`update public.institutions set status = 'suspended' where id = $1`, [inst])).catch((e: Error) => e.message);
    expect(err2).toMatch(/tenant_managed/);
    const err3 = await db.as(admin, (q) => q(`update public.institutions set kind = 'school' where id = $1`, [inst])).catch((e: Error) => e.message);
    expect(err3).toMatch(/invalid_input/);
  });

  it("activates only when the ten steps are met; employees only once active", async () => {
    const org = await clientOrg();
    const t = await db.rpc<string>(manager, "save_enterprise_tenant", [null, org, config(`steps-${uid()}`, { storage_allowance_gb: "" })]);
    await db.rpc(approver, "authorize_enterprise_tenant", [t, true, null]);
    const inst = await db.rpc<string>(manager, "generate_enterprise_workspace", [t]);
    expect(await db.rpcError(manager, "set_tenant_status", [t, "active", "{}"])).toMatch(/checklist_incomplete/);

    const director = await join(manager, "institution_admin", inst, "invite_tenant_admin", t);
    // No employee before activation.
    const { hash } = newToken();
    expect(await db.rpcError(director, "create_invitation", ["institution_teacher", `e.${uid()}@client.test`, inst, hash])).toMatch(/tenant_inactive/);

    const course = await buildCourse(db, admin, SPEC);
    await db.rpc(admin, "grant_course_to_institution", [course.courseId, inst]);
    expect(await db.rpcError(manager, "confirm_tenant_security", [t])).toMatch(/forbidden/);
    await db.rpc(admin, "confirm_tenant_security", [t]);
    let steps = await db.rpc<Record<string, boolean>>(manager, "tenant_checklist", [t]);
    expect(steps).toMatchObject({ contract_signed: true, authorized: true, workspace: true, admin_assigned: true, catalog: true, security: true, welcome_sent: true, storage: false, active: false });
    expect(await db.rpcError(manager, "set_tenant_status", [t, "active", "{}"])).toMatch(/checklist_incomplete/);

    await db.rpc(manager, "save_enterprise_tenant", [t, org, config(await slugOf(t))]);
    await db.rpc(manager, "set_tenant_status", [t, "active", "{}"]);
    steps = await db.rpc<Record<string, boolean>>(manager, "tenant_checklist", [t]);
    expect(steps.active).toBe(true);
    // The address is fixed once the workspace exists.
    expect(await db.rpcError(manager, "save_enterprise_tenant", [t, org, config(`autre-${uid()}`)])).toMatch(/invalid_input/);
  });
});

async function slugOf(tenant: string) {
  const [r] = await db.sql<{ slug: string }>(`select slug from public.enterprise_tenants where id = $1`, [tenant]);
  return r!.slug;
}

describe("employees and limits (brief §10)", () => {
  it("never exceed the authorised number of learners (open invitations hold a seat)", async () => {
    const { inst, director } = await activeTenant(); // max 2
    await join(director, "institution_teacher", inst);
    const { hash } = newToken();
    await db.rpc(director, "create_invitation", ["institution_teacher", `wait.${uid()}@client.test`, inst, hash]);
    const third = newToken();
    expect(await db.rpcError(director, "create_invitation", ["institution_teacher", `full.${uid()}@client.test`, inst, third.hash])).toMatch(/tenant_full/);
    const usage = await db.rpc<{ employees: number; invited: number; admins: number }>(manager, "tenant_usage", [(await tenantOf(inst))]);
    expect(usage).toMatchObject({ employees: 1, invited: 1, admins: 1 });
  });

  it("are grouped in departments chosen at invitation", async () => {
    const { inst, director } = await activeTenant();
    const dep = await db.rpc<string>(director, "save_department", [null, inst, "Production"]);
    expect(await db.rpcError(director, "save_department", [null, inst, "production"])).toMatch(/department_exists/);
    const user = await db.createUser(`dep.${uid()}@client.test`);
    const [{ email }] = (await db.sql<{ email: string }>(`select email from public.profiles where id = $1`, [user])) as [{ email: string }];
    const { hash } = newToken();
    const invitation = await db.rpc<string>(director, "create_invitation", ["institution_teacher", email, inst, hash]);
    const other = await activeTenant();
    const foreign = await db.rpc<string>(other.director, "save_department", [null, other.inst, "Logistique"]);
    expect(await db.rpcError(director, "set_invitation_department", [invitation, foreign])).toMatch(/invalid_input/);
    expect(await db.rpcError(other.director, "set_invitation_department", [invitation, foreign])).toMatch(/forbidden/);
    await db.rpc(director, "set_invitation_department", [invitation, dep]);
    await db.rpc(null, "accept_invitation", [hash, user, true], "service_role");
    const [m] = await db.sql<{ department_id: string }>(`select department_id from public.institution_memberships where user_id = $1`, [user]);
    expect(m!.department_id).toBe(dep);
    // A school institution has no departments.
    const [school] = await db.sql<{ id: string }>(`insert into public.institutions (name, identifier, type, contact_email) values ('École', $1, 'lycee', 'e@e.test') returning id`, [`LYC-${uid().toUpperCase()}`]);
    expect(await db.rpcError(admin, "save_department", [null, school!.id, "Maths"])).toMatch(/invalid_input/);
  });
});

async function tenantOf(inst: string) {
  const [r] = await db.sql<{ id: string }>(`select id from public.enterprise_tenants where institution_id = $1`, [inst]);
  return r!.id;
}

describe("isolation between companies (brief §8, §27)", () => {
  it("a company never sees another company's employees, invitations, reports or workspace", async () => {
    const a = await activeTenant();
    const b = await activeTenant();
    const employeeB = await join(b.director, "institution_teacher", b.inst);
    const seen = await db.as(a.director, async (q) => ({
      members: await q(`select 1 from public.institution_memberships where institution_id = $1`, [b.inst]),
      invitations: await q(`select 1 from public.invitations where institution_id = $1`, [b.inst]),
      tenant: await q(`select 1 from public.enterprise_tenants where id = $1`, [b.tenant]),
      profile: await q(`select 1 from public.profiles where id = $1`, [employeeB]),
      institution: await q(`select 1 from public.institutions where id = $1`, [b.inst]),
    }));
    expect(seen).toEqual({ members: [], invitations: [], tenant: [], profile: [], institution: [] });
    expect(await db.rpcError(a.director, "institution_report", [b.inst, "2026-01-01", "2026-12-31"])).toMatch(/forbidden/);
    expect(await db.rpcError(a.director, "assign_course", [b.inst, b.courseId, [employeeB], null])).toMatch(/forbidden/);
    expect(await db.rpcError(a.director, "tenant_usage", [b.tenant])).toMatch(/forbidden/);
    // Its own workspace record is visible to the company administrator.
    expect(await db.as(a.director, (q) => q(`select 1 from public.enterprise_tenants where id = $1`, [a.tenant]))).toHaveLength(1);
  });

  it("a company-private course is never granted to another tenant, a school or the public catalogue", async () => {
    const a = await activeTenant();
    const b = await activeTenant();
    const course = await buildCourse(db, admin, SPEC, { title: "Sécurité — Société A" });
    await db.rpc(admin, "set_course_ownership", [course.courseId, "company", a.inst, true]);
    await db.rpc(admin, "grant_course_to_institution", [course.courseId, a.inst]);
    expect(await db.rpcError(admin, "grant_course_to_institution", [course.courseId, b.inst])).toMatch(/course_private_to_tenant/);
    const outsider = await db.createUser(`out.${uid()}@sanady.test`);
    expect(await db.rpcError(admin, "grant_course_to_user", [course.courseId, outsider])).toMatch(/course_private_to_tenant/);
    const listed = await db.as(admin, (q) => q(`update public.courses set public_listing = true where id = $1`, [course.courseId])).catch((e: Error) => e.message);
    expect(listed).toMatch(/check constraint/);
    // A course already shared elsewhere cannot become private to one company.
    const shared = await buildCourse(db, admin, SPEC);
    await db.rpc(admin, "grant_course_to_institution", [shared.courseId, b.inst]);
    expect(await db.rpcError(admin, "set_course_ownership", [shared.courseId, "company", a.inst, true])).toMatch(/course_private_to_tenant/);
    // Only course staff set ownership; owners must be company workspaces.
    expect(await db.rpcError(manager, "set_course_ownership", [shared.courseId, "company", a.inst, false])).toMatch(/forbidden/);
  });
});

describe("separation from the SANADY teacher environment", () => {
  it("employees are not counted as teachers and do not reach the teachers' library", async () => {
    const before = await db.rpc<{ kpis: { teachers: number; institutions: number } }>(admin, "admin_report", ["2026-01-01", "2026-12-31"]);
    const t = await activeTenant();
    const employee = await join(t.director, "institution_teacher", t.inst);
    const after = await db.rpc<{ kpis: { teachers: number; institutions: number } }>(admin, "admin_report", ["2026-01-01", "2026-12-31"]);
    // The company administrator and the employee are not SANADY teachers.
    expect(after.kpis.teachers).toBe(before.kpis.teachers);
    expect(after.kpis.institutions).toBe(before.kpis.institutions);
    const [r] = await db.sql<{ only: boolean }>(`select private.is_enterprise_only_user($1) as only`, [employee]);
    expect(r!.only).toBe(true);
    // A teacher who also works for a company stays a teacher.
    const [school] = await db.sql<{ id: string }>(`insert into public.institutions (name, identifier, type, contact_email) values ('Lycée', $1, 'lycee', 'l@l.test') returning id`, [`LYC-${uid().toUpperCase()}`]);
    await db.sql(`insert into public.institution_memberships (institution_id, user_id, role, source, consented_at) values ($1, $2, 'teacher', 'admin', now())`, [school!.id, employee]);
    const [r2] = await db.sql<{ only: boolean }>(`select private.is_enterprise_only_user($1) as only`, [employee]);
    expect(r2!.only).toBe(false);
  });
});

describe("offboarding (brief §20)", () => {
  it("records the end, stops new employees, schedules deletion and revokes access — never deletes at once", async () => {
    const t = await activeTenant();
    const employee = await join(t.director, "institution_teacher", t.inst);
    const { hash } = newToken();
    await db.rpc(t.director, "create_invitation", ["institution_teacher", `late.${uid()}@client.test`, t.inst, hash]);

    expect(await db.rpcError(manager, "set_tenant_status", [t.tenant, "offboarding", "{}"])).toMatch(/invalid_input/);
    await db.rpc(manager, "set_tenant_status", [t.tenant, "offboarding", JSON.stringify({ note: "Fin du contrat au 31/12" })]);
    const [open] = await db.sql<{ n: number }>(`select count(*)::int n from public.invitations where institution_id = $1 and accepted_at is null and revoked_at is null`, [t.inst]);
    expect(open!.n).toBe(0);
    const again = newToken();
    expect(await db.rpcError(t.director, "create_invitation", ["institution_teacher", `new.${uid()}@client.test`, t.inst, again.hash])).toMatch(/tenant_inactive/);

    expect(await db.rpcError(manager, "authorize_tenant_export", [t.tenant])).toMatch(/forbidden/);
    await db.rpc(approver, "authorize_tenant_export", [t.tenant]);
    expect(await db.rpcError(manager, "set_tenant_status", [t.tenant, "closed", "{}"])).toMatch(/deletion_date_required/);
    expect(await db.rpcError(manager, "schedule_tenant_deletion", [t.tenant, "2020-01-01"])).toMatch(/invalid_input/);
    await db.rpc(manager, "schedule_tenant_deletion", [t.tenant, "2031-06-30"]);
    await db.rpc(manager, "set_tenant_status", [t.tenant, "closed", "{}"]);

    const [inst] = await db.sql<{ status: string }>(`select status from public.institutions where id = $1`, [t.inst]);
    expect(inst!.status).toBe("suspended");
    const [m] = await db.sql<{ status: string }>(`select status from public.institution_memberships where user_id = $1 and institution_id = $2`, [employee, t.inst]);
    expect(m!.status).toBe("revoked");
    // Records are kept until the scheduled date.
    const [kept] = await db.sql<{ n: number }>(`select count(*)::int n from public.course_permissions where institution_id = $1`, [t.inst]);
    expect(kept!.n).toBeGreaterThan(0);
    const history = await db.sql<{ to_status: string }>(`select to_status from public.enterprise_history where tenant_id = $1 order by created_at`, [t.tenant]);
    expect(history.map((h) => h.to_status)).toEqual(
      expect.arrayContaining(["requested", "authorized", "provisioning", "active", "offboarding", "export_authorized", "deletion_scheduled", "closed"]),
    );
  });
});
