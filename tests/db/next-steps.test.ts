/**
 * Teacher dashboard "next step": follows the course rules (modules in order,
 * quiz after the module's mandatory lessons, three attempts) and shows the
 * institution's due date.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb, answersFor, buildCourse, completeLessons, newToken, uid } from "./harness";

let db: TestDb;
let admin: string;

beforeAll(async () => {
  db = await TestDb.create();
  admin = await db.createAdmin();
});
afterAll(async () => db?.close());

type Step = { course_id: string; step_kind: string; lesson_id: string | null; quiz_id: string | null; module_position: number; attempts_used: number; due_on: string | null };

const TWO_MODULES = {
  modules: [
    { lessons: [{ kind: "pdf" as const, pages: 2 }, { kind: "pdf" as const, mandatory: false, pages: 1 }, { kind: "pdf" as const, pages: 2 }], questions: [{ kind: "single" as const, options: [true, false] }] },
    { lessons: [{ kind: "pdf" as const, pages: 2 }], questions: [{ kind: "single" as const, options: [true, false] }] },
  ],
};

describe("next step", () => {
  it("walks lesson → quiz → blocked → next module, skipping optional lessons", async () => {
    const course = await buildCourse(db, admin, TWO_MODULES);
    const [m1, m2] = course.modules as [typeof course.modules[0], typeof course.modules[0]];
    const teacher = await db.createUser(`next.${uid()}@e.test`);
    await db.rpc(admin, "grant_course_to_user", [course.courseId, teacher]);
    const step = async () => (await db.as(teacher, (q) => q<Step>(`select * from public.learner_next_steps()`)))[0]!;

    expect(await step()).toMatchObject({ step_kind: "lesson", lesson_id: m1.lessonIds[0], module_position: 1 });
    await completeLessons(db, teacher, [m1.lessonIds[0]!]);
    expect(await step()).toMatchObject({ step_kind: "lesson", lesson_id: m1.lessonIds[2] });

    await completeLessons(db, teacher, [m1.lessonIds[2]!]);
    expect(await step()).toMatchObject({ step_kind: "quiz", quiz_id: m1.quizId, attempts_used: 0 });

    for (let i = 0; i < 3; i++) {
      const started = await db.rpc<{ attempt_id: string }>(teacher, "start_quiz_attempt", [m1.quizId]);
      await db.rpc(teacher, "submit_quiz_attempt", [started.attempt_id, JSON.stringify(answersFor(m1.questions, [false]))]);
    }
    expect(await step()).toMatchObject({ step_kind: "blocked", quiz_id: m1.quizId, attempts_used: 3 });

    await db.rpc(admin, "reset_quiz_attempts", [m1.quizId, teacher, "Accompagnement individuel réalisé."]);
    const started = await db.rpc<{ attempt_id: string }>(teacher, "start_quiz_attempt", [m1.quizId]);
    await db.rpc(teacher, "submit_quiz_attempt", [started.attempt_id, JSON.stringify(answersFor(m1.questions, [true]))]);
    expect(await step()).toMatchObject({ step_kind: "lesson", lesson_id: m2.lessonIds[0], module_position: 2 });
  });

  it("only lists the teacher's own accessible, unfinished courses", async () => {
    const course = await buildCourse(db, admin, TWO_MODULES);
    const teacher = await db.createUser(`own.${uid()}@e.test`);
    const other = await db.createUser(`other.${uid()}@e.test`);
    await db.rpc(admin, "grant_course_to_user", [course.courseId, teacher]);
    await db.as(teacher, (q) => q(`select public.learner_next_steps()`));
    expect(await db.as(other, (q) => q(`select * from public.learner_next_steps()`))).toEqual([]);

    await db.rpc(admin, "revoke_course_from_user", [course.courseId, teacher]);
    expect(await db.as(teacher, (q) => q(`select * from public.learner_next_steps()`))).toEqual([]);
  });

  it("shows the earliest due date set by the institution", async () => {
    const inst = await db.as(admin, async (q) => {
      const [row] = await q<{ id: string }>(
        `insert into public.institutions (name, identifier, type, contact_email) values ($1, $2, 'college', 'c@c.test') returning id`,
        [`Collège ${uid()}`, `COL-${uid().toUpperCase()}`],
      );
      return row!.id;
    });
    const dirEmail = `dir.${uid()}@c.test`;
    const d = newToken();
    await db.rpc(admin, "create_invitation", ["institution_admin", dirEmail, inst, d.hash]);
    const director = await db.createUser(dirEmail);
    await db.rpc(null, "accept_invitation", [d.hash, director, false], "service_role");
    const tEmail = `ens.${uid()}@c.test`;
    const t = newToken();
    await db.rpc(director, "create_invitation", ["institution_teacher", tEmail, inst, t.hash]);
    const teacher = await db.createUser(tEmail);
    await db.rpc(null, "accept_invitation", [t.hash, teacher, true], "service_role");

    const course = await buildCourse(db, admin, TWO_MODULES);
    await db.rpc(admin, "grant_course_to_institution", [course.courseId, inst]);
    await db.rpc(director, "assign_course", [inst, course.courseId, [teacher], "2026-12-15"]);
    const [step] = await db.as(teacher, (q) => q<Step>(`select course_id, step_kind, due_on::text as due_on from public.learner_next_steps()`));
    expect(step).toMatchObject({ course_id: course.courseId, step_kind: "lesson" });
    expect(step!.due_on).toBe("2026-12-15");
  });
});
