/**
 * Roles: training managers, trainers, institution supervisors and the
 * course review workflow. Every boundary is enforced by the database.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb, buildCourse, completeLessons, newToken, uid, type BuiltCourse } from "./harness";

let db: TestDb;
let admin: string;
let manager: string;

const SIMPLE = { modules: [{ lessons: [{ kind: "pdf" as const, pages: 2 }], questions: [{ kind: "single" as const, options: [true, false] }] }] };

async function staffUser(role: "training_manager" | "trainer") {
  const id = await db.createUser(`${role}.${uid()}@sanady.test`);
  await db.rpc(admin, "set_platform_role", [id, role]);
  return id;
}

beforeAll(async () => {
  db = await TestDb.create();
  admin = await db.createAdmin();
  manager = await staffUser("training_manager");
});
afterAll(async () => db?.close());

describe("training manager", () => {
  it("authors and publishes courses, from a two-factor session only", async () => {
    const [course] = await db.as(manager, (q) => q<{ id: string }>(`insert into public.courses (title) values ('Cours du responsable') returning id`));
    expect(course!.id).toBeTruthy();
    await expect(
      db.as(manager, (q) => q(`insert into public.courses (title) values ('Sans 2FA')`), "authenticated", "aal1"),
    ).rejects.toThrow(/row-level security/);
    const built = await buildCourse(db, admin, SIMPLE, { publish: false });
    await db.as(manager, (q) => q(`update public.courses set status = 'published' where id = $1`, [built.courseId]));
    const [row] = await db.sql<{ status: string }>(`select status from public.courses where id = $1`, [built.courseId]);
    expect(row!.status).toBe("published");
  });

  it("sees reports and learner progress but not institutions, users or the audit log", async () => {
    expect(await db.rpc(manager, "admin_report", ["2026-01-01", "2026-06-30"])).toHaveProperty("kpis");
    expect(await db.rpcError(manager, "set_platform_role", [manager, "trainer"])).toMatch(/forbidden/);
    await expect(
      db.as(manager, (q) => q(`insert into public.institutions (name, identifier, type, contact_email) values ('X', 'X-1', 'college', 'x@x.test')`)),
    ).rejects.toThrow(/row-level security/);
    expect(await db.as(manager, (q) => q(`select id from public.audit_logs limit 1`))).toEqual([]);
  });
});

describe("trainer", () => {
  let course: BuiltCourse;
  let other: BuiltCourse;
  let trainer: string;

  beforeAll(async () => {
    course = await buildCourse(db, admin, SIMPLE, { publish: false, title: "Cours du formateur" });
    other = await buildCourse(db, admin, SIMPLE, { publish: false, title: "Autre cours" });
    trainer = await staffUser("trainer");
    await db.rpc(manager, "assign_course_trainer", [course.courseId, trainer]);
  });

  it("reads and edits only the assigned course, including its answers", async () => {
    const visible = await db.as(trainer, (q) => q<{ id: string }>(`select id from public.courses where id = any($1::uuid[])`, [[course.courseId, other.courseId]]));
    expect(visible.map((r) => r.id)).toEqual([course.courseId]);
    const options = await db.as(trainer, (q) =>
      q(`select o.is_correct from public.question_options o where o.question_id = $1`, [course.modules[0]!.questions[0]!.id]),
    );
    expect(options).toHaveLength(2);

    const lesson = course.modules[0]!.lessonIds[0]!;
    expect(await db.as(trainer, (q) => q(`update public.lessons set title = 'Titre revu' where id = $1 returning id`, [lesson]))).toHaveLength(1);
    expect(
      await db.as(trainer, (q) => q(`update public.lessons set title = 'Intrus' where id = $1 returning id`, [other.modules[0]!.lessonIds[0]])),
    ).toEqual([]);
    await expect(db.as(trainer, (q) => q(`insert into public.courses (title) values ('Nouveau cours')`))).rejects.toThrow(/row-level security/);
  });

  it("cannot publish, list publicly or authorize a course", async () => {
    await expect(
      db.as(trainer, (q) => q(`update public.courses set status = 'published' where id = $1`, [course.courseId])),
    ).rejects.toThrow(/forbidden/);
    await expect(
      db.as(trainer, (q) => q(`update public.courses set public_listing = true where id = $1`, [course.courseId])),
    ).rejects.toThrow(/forbidden/);
    expect(await db.rpcError(trainer, "approve_course", [course.courseId])).toMatch(/forbidden/);
    const institution = await db.as(admin, async (q) => {
      const [r] = await q<{ id: string }>(`insert into public.institutions (name, identifier, type, contact_email) values ($1, $2, 'college', 'c@c.test') returning id`, [`Col ${uid()}`, `COL-${uid().toUpperCase()}`]);
      return r!.id;
    });
    expect(await db.rpcError(trainer, "grant_course_to_institution", [course.courseId, institution])).toMatch(/forbidden/);
  });

  it("goes through review: submit → locked → changes requested → resubmit → approved", async () => {
    await db.rpc(trainer, "submit_course_for_review", [course.courseId]);
    let [row] = await db.sql<{ status: string; submitted_by: string }>(`select status, submitted_by from public.courses where id = $1`, [course.courseId]);
    expect(row).toMatchObject({ status: "review", submitted_by: trainer });

    const lesson = course.modules[0]!.lessonIds[0]!;
    expect(await db.as(trainer, (q) => q(`update public.lessons set title = 'En revue' where id = $1 returning id`, [lesson]))).toEqual([]);
    expect(await db.rpcError(trainer, "request_course_changes", [course.courseId, "Je me corrige moi-même"])).toMatch(/forbidden/);

    await db.rpc(manager, "request_course_changes", [course.courseId, "Ajoutez une explication à la question 1."]);
    [row] = await db.sql(`select status, review_comment from public.courses where id = $1`, [course.courseId]);
    expect(row).toMatchObject({ status: "draft", review_comment: "Ajoutez une explication à la question 1." });
    expect(await db.as(trainer, (q) => q(`update public.lessons set title = 'Corrigé' where id = $1 returning id`, [lesson]))).toHaveLength(1);

    await db.rpc(trainer, "submit_course_for_review", [course.courseId]);
    await db.rpc(manager, "approve_course", [course.courseId]);
    [row] = await db.sql(`select status, review_comment, reviewed_by from public.courses where id = $1`, [course.courseId]);
    expect(row).toMatchObject({ status: "published", review_comment: null, reviewed_by: manager });
    expect(await db.as(trainer, (q) => q(`update public.lessons set title = 'Après publication' where id = $1 returning id`, [lesson]))).toEqual([]);
  });

  it("refuses to submit an incomplete course", async () => {
    const empty = await db.as(admin, async (q) => {
      const [r] = await q<{ id: string }>(`insert into public.courses (title) values ('Cours vide') returning id`);
      return r!.id;
    });
    await db.rpc(manager, "assign_course_trainer", [empty, trainer]);
    expect(await db.rpcError(trainer, "submit_course_for_review", [empty])).toMatch(/course_not_publishable/);
  });

  it("follows learners of the assigned course only, and appears on its public page", async () => {
    const learner = await db.createUser(`learner.${uid()}@e.test`);
    await db.rpc(admin, "grant_course_to_user", [course.courseId, learner]);
    await completeLessons(db, learner, course.modules[0]!.lessonIds);
    const progress = await db.as(trainer, (q) => q(`select id from public.lesson_progress where user_id = $1`, [learner]));
    expect(progress.length).toBeGreaterThan(0);
    const names = await db.as(trainer, (q) => q(`select id from public.profiles where id = $1`, [learner]));
    expect(names).toHaveLength(1);

    const published = await buildCourse(db, admin, SIMPLE);
    await db.rpc(admin, "grant_course_to_user", [published.courseId, learner]);
    await completeLessons(db, learner, published.modules[0]!.lessonIds);
    expect(await db.as(trainer, (q) => q(`select id from public.lesson_progress where user_id = $1 and course_id = $2`, [learner, published.courseId]))).toEqual([]);

    await db.as(manager, (q) => q(`update public.courses set public_listing = true where id = $1`, [course.courseId]));
    const page = await db.rpc<{ trainers: Array<{ name: string }> }>(null, "public_course", [course.courseId], "anon");
    expect(page.trainers).toHaveLength(1);
  });

  it("loses every right when the role is removed", async () => {
    await db.rpc(admin, "set_platform_role", [trainer, null]);
    expect(await db.as(trainer, (q) => q(`select id from public.courses where id = $1`, [other.courseId]))).toEqual([]);
    expect(await db.sql(`select 1 from public.course_trainers where user_id = $1`, [trainer])).toEqual([]);
  });
});

describe("platform roles management", () => {
  it("is reserved to administrators and never changes an administrator", async () => {
    const teacher = await db.createUser(`t.${uid()}@e.test`);
    expect(await db.rpcError(teacher, "set_platform_role", [teacher, "trainer"])).toMatch(/forbidden/);
    const otherAdmin = await db.createAdmin();
    expect(await db.rpcError(admin, "set_platform_role", [otherAdmin, "trainer"])).toMatch(/forbidden/);
    expect(await db.rpcError(admin, "set_platform_role", [teacher, "sanady_admin"])).toMatch(/invalid_input/);
    expect(await db.rpcError(manager, "assign_course_trainer", [(await buildCourse(db, admin, SIMPLE, { publish: false })).courseId, teacher])).toMatch(/not_a_trainer/);
  });
});

describe("institution supervisor", () => {
  it("reads the institution's teachers, progress and reports, and changes nothing", async () => {
    const inst = await db.as(admin, async (q) => {
      const [r] = await q<{ id: string }>(`insert into public.institutions (name, identifier, type, contact_email) values ($1, $2, 'college', 'c@c.test') returning id`, [`Collège ${uid()}`, `COL-${uid().toUpperCase()}`]);
      return r!.id;
    });
    const join = async (kind: string, inviter: string, consent: boolean) => {
      const email = `${kind}.${uid()}@c.test`;
      const t = newToken();
      await db.rpc(inviter, "create_invitation", [kind, email, inst, t.hash]);
      const user = await db.createUser(email);
      await db.rpc(null, "accept_invitation", [t.hash, user, consent], "service_role");
      return user;
    };
    const director = await join("institution_admin", admin, false);
    const supervisor = await join("institution_supervisor", director, false);
    const teacher = await join("institution_teacher", director, true);

    const assigned = await buildCourse(db, admin, SIMPLE);
    const personal = await buildCourse(db, admin, SIMPLE);
    await db.rpc(admin, "grant_course_to_institution", [assigned.courseId, inst]);
    await db.rpc(director, "assign_course", [inst, assigned.courseId, [teacher], null]);
    await db.rpc(admin, "grant_course_to_user", [personal.courseId, teacher]);
    await completeLessons(db, teacher, assigned.modules[0]!.lessonIds);
    await completeLessons(db, teacher, personal.modules[0]!.lessonIds);

    const summaries = await db.as(supervisor, (q) => q<{ user_id: string }>(`select user_id from public.institution_teacher_summaries($1)`, [inst]));
    expect(summaries.map((s) => s.user_id)).toEqual([teacher]);
    expect(await db.rpc(supervisor, "institution_report", [inst, "2026-01-01", "2026-12-31"])).toHaveProperty("kpis");
    const seen = await db.as(supervisor, (q) => q<{ course_id: string }>(`select course_id from public.lesson_progress where user_id = $1`, [teacher]));
    expect([...new Set(seen.map((r) => r.course_id))]).toEqual([assigned.courseId]);

    expect(await db.rpcError(supervisor, "assign_course", [inst, assigned.courseId, [teacher], null])).toMatch(/forbidden/);
    expect(await db.rpcError(supervisor, "create_invitation", ["institution_teacher", `x.${uid()}@c.test`, inst, newToken().hash])).toMatch(/forbidden/);
    expect(await db.as(supervisor, (q) => q(`select id from public.enrollment_codes where institution_id = $1`, [inst]))).toEqual([]);
    const [membership] = await db.sql<{ role: string; consented_at: string | null }>(
      `select role, consented_at from public.institution_memberships where user_id = $1`,
      [supervisor],
    );
    expect(membership).toMatchObject({ role: "supervisor", consented_at: null });
  });
});
