/**
 * Company assessment policies (brief V3 §12): approved per company space,
 * enforced by the quiz engine for the company's employees only; teachers
 * keep SANADY's rule (70 %, 3 attempts, answers after passing, certificate).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb, answersFor, buildCourse, completeLessons, uid, type BuiltCourse } from "./harness";

let db: TestDb;
let admin: string;
let manager: string;
let approver: string;
let production: string;
let tenant: string;
let inst: string;
let course: BuiltCourse;

const ONE_MODULE = {
  modules: [
    {
      lessons: [{ kind: "pdf" as const, pages: 2 }],
      questions: [
        { kind: "single" as const, options: [true, false] },
        { kind: "single" as const, options: [true, false] },
        { kind: "single" as const, options: [false, true] },
      ],
    },
  ],
};
const POLICY = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({ pass_threshold: 80, max_attempts: 2, feedback: "never", certificates: false, enforce_due_dates: true, note: "Contrat sécurité", ...extra });

async function employee(dueOn: string | null = null) {
  const u = await db.createUser(`emp.${uid()}@client.test`);
  await db.sql(`insert into public.institution_memberships (institution_id, user_id, role, source, consented_at) values ($1, $2, 'teacher', 'admin', now())`, [inst, u]);
  await db.rpc(admin, "grant_course_to_user", [course.courseId, u]);
  await db.sql(`alter table public.course_assignments disable trigger user`);
  await db.sql(`insert into public.course_assignments (institution_id, user_id, course_id, due_on) values ($1, $2, $3, $4)`, [inst, u, course.courseId, dueOn]);
  await db.sql(`alter table public.course_assignments enable trigger user`);
  return u;
}
const status = (u: string) => db.rpc<{ pass_threshold: number; max_attempts: number; company_policy: boolean; closed: boolean }>(u, "quiz_status", [course.modules[0]!.quizId]);
async function attempt(u: string, mask: boolean[]) {
  const s = await db.rpc<{ attempt_id: string; pass_threshold: number; max_attempts: number }>(u, "start_quiz_attempt", [course.modules[0]!.quizId]);
  const r = await db.rpc<{ passed: boolean; answers_revealed: boolean; certificate_issued: boolean; questions: Array<{ explanation: string | null; options: Array<Record<string, unknown>> }> }>(
    u, "submit_quiz_attempt", [s.attempt_id, JSON.stringify(answersFor(course.modules[0]!.questions, mask))],
  );
  return { start: s, result: r };
}

beforeAll(async () => {
  db = await TestDb.create();
  admin = await db.createAdmin();
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
  course = await buildCourse(db, admin, ONE_MODULE);
  await db.sql(`update public.questions set explanation = 'Parce que.' where quiz_id = $1`, [course.modules[0]!.quizId]);
  const [{ id: org }] = (await db.sql<{ id: string }>(`insert into public.partner_organizations (name, org_type, enterprise_status) values ('Société Évaluations', 'entreprise', 'active_service') returning id`)) as [{ id: string }];
  await db.sql(`select set_config('sanady.tenant_sync', 'on', false)`);
  [{ id: inst }] = (await db.sql<{ id: string }>(`insert into public.institutions (name, identifier, type, contact_email, kind) values ('Société Évaluations', $1, 'autre', 'e@e.test', 'enterprise') returning id`, [`ENT-${uid().toUpperCase()}`])) as [{ id: string }];
  [{ id: tenant }] = (await db.sql<{ id: string }>(`insert into public.enterprise_tenants (organization_id, institution_id, slug, display_name, service_plan, max_learners, status, activated_at) values ($1, $2, $3, 'Société Évaluations', 'complete', 50, 'active', now()) returning id`, [org, inst, `eval-${uid()}`])) as [{ id: string }];
  await db.sql(`select set_config('sanady.tenant_sync', '', false)`);
});
afterAll(async () => db?.close());

describe("company assessment policies (brief V3 §12)", () => {
  it("are prepared by the enterprise manager and apply only once an approver approves them", async () => {
    const e = await employee();
    expect(await db.rpcError(production, "save_assessment_policy", [tenant, POLICY()])).toMatch(/forbidden/);
    await expect(db.rpc(manager, "save_assessment_policy", [tenant, POLICY({ pass_threshold: 40 })])).rejects.toThrow(/check constraint/);
    await db.rpc(manager, "save_assessment_policy", [tenant, POLICY()]);
    expect(await status(e)).toMatchObject({ pass_threshold: 70, max_attempts: 3, company_policy: false });
    expect(await db.rpcError(manager, "approve_assessment_policy", [tenant])).toMatch(/forbidden/);
    await db.rpc(approver, "approve_assessment_policy", [tenant]);
    expect(await status(e)).toMatchObject({ pass_threshold: 80, max_attempts: 2, company_policy: true });
  });

  it("are enforced on the server: pass mark, attempts, hidden answers, no certificate", async () => {
    const e = await employee();
    await completeLessons(db, e, course.modules[0]!.lessonIds);
    // 2/3 = 66.7 % passes SANADY's 70 %? No — but here it must reach 80 %.
    const first = await attempt(e, [true, true, false]);
    expect(first.start).toMatchObject({ pass_threshold: 80, max_attempts: 2 });
    expect(first.result.passed).toBe(false);
    expect(first.result.answers_revealed).toBe(false);
    expect(first.result.questions.every((q) => q.explanation === null && q.options.every((o) => !("is_correct" in o)))).toBe(true);
    await attempt(e, [true, false, false]);
    expect(await db.rpcError(e, "start_quiz_attempt", [course.modules[0]!.quizId])).toMatch(/attempts_exhausted/);

    // A successful employee completes the course, without a certificate.
    const ok = await employee();
    await completeLessons(db, ok, course.modules[0]!.lessonIds);
    const pass = await attempt(ok, [true, true, true]);
    expect(pass.result.passed).toBe(true);
    expect(pass.result.certificate_issued).toBe(false);
    const [{ status: enr }] = (await db.sql<{ status: string }>(`select status from public.enrollments where user_id = $1 and course_id = $2`, [ok, course.courseId])) as [{ status: string }];
    expect(enr).toBe("completed");
    expect(await db.sql(`select 1 from public.certificates where user_id = $1`, [ok])).toEqual([]);
  });

  it("close new attempts after the assignment's due date when asked", async () => {
    const late = await employee("2020-01-31");
    await completeLessons(db, late, course.modules[0]!.lessonIds);
    expect((await status(late)).closed).toBe(true);
    expect(await db.rpcError(late, "start_quiz_attempt", [course.modules[0]!.quizId])).toMatch(/assessment_closed/);
  });

  it("never change the rule for SANADY's teachers", async () => {
    const teacher = await db.createUser(`prof.${uid()}@ecole.test`);
    await db.rpc(admin, "grant_course_to_user", [course.courseId, teacher]);
    await completeLessons(db, teacher, course.modules[0]!.lessonIds);
    expect(await status(teacher)).toMatchObject({ pass_threshold: 70, max_attempts: 3, company_policy: false });
    const t = await attempt(teacher, [true, true, true]);
    expect(t.start).toMatchObject({ pass_threshold: 70, max_attempts: 3 });
    expect(t.result.certificate_issued).toBe(true);
    expect(t.result.answers_revealed).toBe(true);
  });

  it("apply to new attempts only; a change needs a new approval", async () => {
    const e = await employee();
    await completeLessons(db, e, course.modules[0]!.lessonIds);
    const s = await db.rpc<{ attempt_id: string; pass_threshold: number }>(e, "start_quiz_attempt", [course.modules[0]!.quizId]);
    expect(s.pass_threshold).toBe(80);
    await db.rpc(manager, "save_assessment_policy", [tenant, POLICY({ pass_threshold: 90 })]);
    // Back to draft: SANADY's rule for new attempts; the open one keeps its 80 %.
    expect((await status(e)).pass_threshold).toBe(70);
    const r = await db.rpc<{ pass_threshold: number }>(e, "submit_quiz_attempt", [s.attempt_id, JSON.stringify(answersFor(course.modules[0]!.questions, [true, true, false]))]);
    expect(r.pass_threshold).toBe(80);
    await db.rpc(manager, "remove_assessment_policy", [tenant]);
    expect(await db.sql(`select 1 from public.enterprise_assessment_policies where tenant_id = $1`, [tenant])).toEqual([]);
  });
});
