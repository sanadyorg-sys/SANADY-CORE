/**
 * Reports: real counts, administrator-only platform report, and an
 * institution report limited to the courses that institution assigned.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb, answersFor, buildCourse, completeLessons, newToken, uid, type BuiltCourse } from "./harness";

let db: TestDb;
let admin: string;

beforeAll(async () => {
  db = await TestDb.create();
  admin = await db.createAdmin();
});
afterAll(async () => db?.close());

const SIMPLE = { modules: [{ lessons: [{ kind: "pdf" as const, pages: 2 }], questions: [{ kind: "single" as const, options: [true, false] }] }] };
const today = new Date().toISOString().slice(0, 10);
const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

async function institutionWithAdmin() {
  const inst = await db.as(admin, async (q) => {
    const [row] = await q<{ id: string }>(
      `insert into public.institutions (name, identifier, type, contact_email) values ($1, $2, 'college', 'c@college.test') returning id`,
      [`Collège ${uid()}`, `COL-${uid().toUpperCase()}`],
    );
    return row!.id;
  });
  const email = `dir.${uid()}@college.test`;
  const { hash } = newToken();
  await db.rpc(admin, "create_invitation", ["institution_admin", email, inst, hash]);
  const director = await db.createUser(email);
  await db.rpc(null, "accept_invitation", [hash, director, false], "service_role");
  return { inst, director };
}

async function addTeacher(inst: string, director: string) {
  const email = `ens.${uid()}@college.test`;
  const { hash } = newToken();
  await db.rpc(director, "create_invitation", ["institution_teacher", email, inst, hash]);
  const teacher = await db.createUser(email);
  await db.rpc(null, "accept_invitation", [hash, teacher, true], "service_role");
  return teacher;
}

async function finish(teacher: string, course: BuiltCourse) {
  const mod = course.modules[0]!;
  await completeLessons(db, teacher, mod.lessonIds);
  const started = await db.rpc<{ attempt_id: string }>(teacher, "start_quiz_attempt", [mod.quizId]);
  await db.rpc(teacher, "submit_quiz_attempt", [started.attempt_id, JSON.stringify(answersFor(mod.questions, [true]))]);
}

type Report = {
  kpis: Record<string, number | string | null>;
  weekly: Array<{ week: string; active_teachers: number; completions: number }>;
  courses: Array<{ id: string; completed: number; certificates: number }>;
};

describe("platform report", () => {
  it("is reserved to SANADY administrators and validates the period", async () => {
    const teacher = await db.createUser(`t.${uid()}@e.test`);
    expect(await db.rpcError(teacher, "admin_report", [monthAgo, today])).toMatch(/forbidden/);
    expect(await db.rpcError(admin, "admin_report", [today, monthAgo])).toMatch(/invalid_input/);
    expect(await db.rpcError(admin, "admin_report", ["2020-01-01", today])).toMatch(/invalid_input/);
    expect(await db.rpcError(null, "admin_report", [monthAgo, today], "anon")).toMatch(/permission denied/);
  });

  it("counts completions, certificates and activity from real records", async () => {
    const course = await buildCourse(db, admin, SIMPLE);
    const teacher = await db.createUser(`r.${uid()}@e.test`);
    await db.rpc(admin, "grant_course_to_user", [course.courseId, teacher]);
    const before = await db.rpc<Report>(admin, "admin_report", [monthAgo, today]);
    await finish(teacher, course);
    const after = await db.rpc<Report>(admin, "admin_report", [monthAgo, today]);

    expect(Number(after.kpis.completions) - Number(before.kpis.completions)).toBe(1);
    expect(Number(after.kpis.certificates) - Number(before.kpis.certificates)).toBe(1);
    expect(Number(after.kpis.active_teachers)).toBeGreaterThanOrEqual(1);
    const row = after.courses.find((c) => c.id === course.courseId)!;
    expect(row).toMatchObject({ completed: 1, certificates: 1 });
    expect(after.weekly.length).toBeGreaterThanOrEqual(4);
    expect(after.weekly.reduce((s, w) => s + Number(w.completions), 0)).toBe(Number(after.kpis.completions));
  });
});

describe("institution report", () => {
  it("counts only courses the institution assigned, never personal learning", async () => {
    const { inst, director } = await institutionWithAdmin();
    const teacher = await addTeacher(inst, director);
    const assigned = await buildCourse(db, admin, SIMPLE);
    const personal = await buildCourse(db, admin, SIMPLE);
    await db.rpc(admin, "grant_course_to_institution", [assigned.courseId, inst]);
    await db.rpc(director, "assign_course", [inst, assigned.courseId, [teacher], null]);
    await db.rpc(admin, "grant_course_to_user", [personal.courseId, teacher]);

    await finish(teacher, personal);
    let report = await db.rpc<Report>(director, "institution_report", [inst, monthAgo, today]);
    expect(report.kpis).toMatchObject({ teachers: 1, assignments: 1, completed: 0, certificates: 0, active_teachers: 0 });
    expect(report.courses.map((c) => c.id)).toEqual([assigned.courseId]);

    await finish(teacher, assigned);
    report = await db.rpc<Report>(director, "institution_report", [inst, monthAgo, today]);
    expect(report.kpis).toMatchObject({ completed: 1, certificates: 1, active_teachers: 1, completions: 1 });
  });

  it("is refused to other institutions and to teachers", async () => {
    const a = await institutionWithAdmin();
    const b = await institutionWithAdmin();
    const teacher = await addTeacher(a.inst, a.director);
    expect(await db.rpcError(b.director, "institution_report", [a.inst, monthAgo, today])).toMatch(/forbidden/);
    expect(await db.rpcError(teacher, "institution_report", [a.inst, monthAgo, today])).toMatch(/forbidden/);
    expect(await db.rpc(admin, "institution_report", [a.inst, monthAgo, today])).toHaveProperty("kpis");
  });
});
