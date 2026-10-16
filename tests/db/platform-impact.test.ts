/**
 * Impact indicators computed from platform data: the team chooses the scope
 * and the link to the partnership; the database computes the figure, which
 * an approver verifies as any other. Aggregates only; consenting teachers
 * of schools only.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb, buildCourse, uid } from "./harness";

let db: TestDb;
let coordinator: string;
let approver: string;
let enterprise: string;
let org: string;
let agreement: string;
let school: string;
let otherSchool: string;
let company: string;
let courseA: string;
let courseB: string;

const institution = async (name: string, kind = "school") =>
  (await db.sql<{ id: string }>(`insert into public.institutions (name, identifier, type, contact_email, kind) values ($1, $2, 'autre', 'x@y.test', $3) returning id`, [name, `I-${uid().toUpperCase()}`, kind]))[0]!.id;

async function teacher(inst: string, consented = true) {
  const id = await db.createUser(`t.${uid()}@sanady.test`);
  await db.sql(`alter table public.institution_memberships disable trigger user`);
  await db.sql(`insert into public.institution_memberships (institution_id, user_id, role, source, consented_at) values ($1, $2, $3, 'admin', $4)`, [inst, id, consented ? "teacher" : "admin", consented ? new Date().toISOString() : null]);
  await db.sql(`alter table public.institution_memberships enable trigger user`);
  return id;
}
async function complete(user: string, course: string, on: string, certificate = false) {
  await db.sql(`insert into public.enrollments (user_id, course_id, status, enrolled_at, completed_at, last_activity_at) values ($1, $2, 'completed', $3, $3, $3)`, [user, course, `${on}T10:00:00Z`]);
  if (certificate)
    await db.sql(
      `insert into public.certificates (user_id, course_id, certificate_number, verification_code, recipient_name, course_title, completed_at, issued_at)
       values ($1, $2, $3, $4, 'X', 'Y', $5, $5)`,
      [user, course, `SND-2026-${uid().toUpperCase()}`, `${uid()}${uid()}${uid()}${uid()}`, `${on}T10:00:00Z`],
    );
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
  coordinator = await staff("partnership_coordinator");
  approver = await staff("partnership_manager");
  await db.rpc(other, "set_partnership_signatory", [approver, true]);
  enterprise = await staff("enterprise_manager");
  org = (await db.sql<{ id: string }>(`insert into public.partner_organizations (name, org_type, status) values ($1, 'fondation', 'implementation') returning id`, [`Partenaire ${uid()}`]))[0]!.id;
  agreement = await db.rpc<string>(coordinator, "save_partnership_agreement", [null, org, JSON.stringify({ title: "Formation continue 2026", intervention_field: "formation-continue", objectives: "Former les enseignants des écoles partenaires.", start_on: "2026-01-01", end_on: "2026-12-31" })]);
  const spec = { modules: [{ lessons: [{ kind: "pdf" as const }], questions: [{ kind: "single" as const, options: [true, false] }] }] };
  courseA = (await buildCourse(db, admin, spec)).courseId;
  courseB = (await buildCourse(db, admin, spec)).courseId;
  school = await institution("École A");
  otherSchool = await institution("École B");
  await db.sql(`select set_config('sanady.tenant_sync', 'on', false)`);
  company = await institution("Société C", "enterprise");
  await db.sql(`select set_config('sanady.tenant_sync', '', false)`);

  // École A: t1 finishes A and B (one certificate), t2 finishes A, t3 finishes A outside the period.
  const [t1, t2, t3] = [await teacher(school), await teacher(school), await teacher(school)];
  await complete(t1, courseA, "2026-03-10", true);
  await complete(t1, courseB, "2026-04-02");
  await complete(t2, courseA, "2026-05-20");
  await complete(t3, courseA, "2025-11-30");
  // École A, no consent (school admin): not counted. École B: one teacher.
  await complete(await teacher(school, false), courseA, "2026-03-11");
  await complete(await teacher(otherSchool), courseB, "2026-06-01");
});
afterAll(async () => db?.close());

const measure = (who: string, m: string, inst: string[], courses: string[] = []) =>
  db.rpc<{ value: number; small: boolean }>(who, "platform_impact_measure", [m, `{${inst.join(",")}}`, `{${courses.join(",")}}`, "2026-01-01", "2026-12-31"]);

describe("impact from platform data", () => {
  it("counts consenting teachers of the chosen schools, over the period", async () => {
    expect((await measure(coordinator, "teachers_trained", [school])).value).toBe(2);
    expect((await measure(coordinator, "trainings_completed", [school])).value).toBe(3);
    expect((await measure(coordinator, "trainings_completed", [school], [courseA])).value).toBe(2);
    expect((await measure(coordinator, "certificates_issued", [school])).value).toBe(1);
    expect((await measure(coordinator, "teachers_trained", [school, otherSchool])).value).toBe(3);
    expect((await measure(coordinator, "participating_schools", [school, otherSchool])).value).toBe(2);
    // Small counts are flagged.
    expect((await measure(coordinator, "teachers_trained", [school])).small).toBe(true);
  });

  it("never reaches company workspaces, and is for the partnership team only", async () => {
    expect(await db.rpcError(coordinator, "platform_impact_measure", ["teachers_trained", `{${company}}`, "{}", "2026-01-01", "2026-12-31"])).toMatch(/invalid_input/);
    expect(await db.rpcError(coordinator, "platform_impact_measure", ["teachers_trained", "{}", "{}", "2026-01-01", "2026-12-31"])).toMatch(/scope_required/);
    expect(await db.rpcError(enterprise, "platform_impact_measure", ["teachers_trained", `{${school}}`, "{}", "2026-01-01", "2026-12-31"])).toMatch(/forbidden/);
  });

  it("saves a computed figure the team cannot type over, verified by an approver", async () => {
    const p = { agreement_id: agreement, intervention_field: "formation-continue", measure: "teachers_trained", institution_ids: [school], course_ids: [], period_start: "2026-01-01", period_end: "2026-12-31", attribution: "direct", value: "999" };
    const id = await db.rpc<string>(coordinator, "record_platform_metric", [null, org, JSON.stringify(p)]);
    const [m] = await db.sql<{ value: string; source: string; status: string; method: string }>(`select value, source, status, method from public.partnership_impact_metrics where id = $1`, [id]);
    expect(Number(m!.value)).toBe(2);
    expect(m!.source).toBe("platform");
    expect(m!.status).toBe("reported");
    expect(m!.method).toMatch(/Calculé à partir des données de la plateforme SANADY.*École A/);
    expect(await db.rpcError(coordinator, "save_impact_metric", [id, org, JSON.stringify({ ...p, dimension: "teachers_trained", metric_type: "output", method: "Saisie manuelle du chiffre." })])).toMatch(/metric_computed/);

    // The approver sees the figure recomputed today, then verifies it.
    await complete(await teacher(school), courseB, "2026-07-01");
    expect(await db.rpc<number>(approver, "platform_metric_recount", [id])).toBe(3);
    await db.rpc(coordinator, "record_platform_metric", [id, org, JSON.stringify(p)]);
    const [again] = await db.sql<{ value: string }>(`select value from public.partnership_impact_metrics where id = $1`, [id]);
    expect(Number(again!.value)).toBe(3);
    await db.rpc(approver, "set_metric_status", [id, "verified", null]);
    expect(await db.rpcError(coordinator, "record_platform_metric", [id, org, JSON.stringify(p)])).toMatch(/metric_locked/);
  });

  it("lists the schools and courses to choose from, and suggests a project's school", async () => {
    const scope = await db.rpc<{ institutions: Array<{ id: string }>; courses: Array<{ id: string }> }>(coordinator, "platform_impact_scope", []);
    expect(scope.institutions.map((i) => i.id)).toContain(school);
    expect(scope.institutions.map((i) => i.id)).not.toContain(company);
    expect(scope.courses.map((c) => c.id)).toEqual(expect.arrayContaining([courseA, courseB]));
  });
});
