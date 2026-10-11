/**
 * Quiz options: true/false questions, shuffled questions and answers.
 * Order is fixed per attempt (stable across reloads); grading is unchanged.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb, buildCourse, completeLessons, uid } from "./harness";

let db: TestDb;
let admin: string;

beforeAll(async () => {
  db = await TestDb.create();
  admin = await db.createAdmin();
});
afterAll(async () => db?.close());

type Started = { attempt_id: string; questions: Array<{ id: string; kind: string; options: Array<{ id: string; label: string }> }> };

const tf = (correctIsTrue: boolean) =>
  JSON.stringify([
    { label: "Vrai", is_correct: correctIsTrue },
    { label: "Faux", is_correct: !correctIsTrue },
  ]);

describe("true/false questions", () => {
  it("require exactly two options with one correct answer", async () => {
    const course = await buildCourse(db, admin, { modules: [{ lessons: [{ kind: "pdf" }], questions: [{ kind: "single", options: [true, false] }] }] }, { publish: false });
    const quiz = course.modules[0]!.quizId;
    const save = (options: string) => db.rpcError(admin, "save_question", [quiz, null, "true_false", "L’évaluation formative est notée ?", "", 1, options]);

    expect(await save(JSON.stringify([{ label: "Vrai", is_correct: true }, { label: "Faux", is_correct: false }, { label: "Peut-être", is_correct: false }]))).toMatch(/question_options_count/);
    expect(await save(JSON.stringify([{ label: "Vrai", is_correct: true }, { label: "Faux", is_correct: true }]))).toMatch(/question_correct_count/);
    const id = await db.rpc<string>(admin, "save_question", [quiz, null, "true_false", "L’évaluation formative est notée ?", "", 1, tf(false)]);
    expect(id).toBeTruthy();
  });

  it("are graded like single-answer questions", async () => {
    const course = await buildCourse(db, admin, { modules: [{ lessons: [{ kind: "pdf" }], questions: [{ kind: "single", options: [true, false] }] }] }, { publish: false });
    const mod = course.modules[0]!;
    const tfId = await db.rpc<string>(admin, "save_question", [mod.quizId, null, "true_false", "Affirmation", "", 1, tf(true)]);
    await db.as(admin, (q) => q(`update public.courses set status = 'published' where id = $1`, [course.courseId]));

    const teacher = await db.createUser(`tf.${uid()}@e.test`);
    await db.rpc(admin, "grant_course_to_user", [course.courseId, teacher]);
    await completeLessons(db, teacher, mod.lessonIds);
    const started = await db.rpc<Started>(teacher, "start_quiz_attempt", [mod.quizId]);
    const tfQuestion = started.questions.find((q) => q.id === tfId)!;
    expect(tfQuestion.kind).toBe("true_false");
    expect(tfQuestion.options.map((o) => o.label)).toEqual(["Vrai", "Faux"]);

    const single = mod.questions[0]!;
    const answers = { [single.id]: [single.options.find((o) => o.correct)!.id], [tfId]: [tfQuestion.options[0]!.id] };
    const result = await db.rpc<{ score_percent: string; passed: boolean }>(teacher, "submit_quiz_attempt", [started.attempt_id, JSON.stringify(answers)]);
    expect(result.passed).toBe(true);
    expect(Number(result.score_percent)).toBe(100);
  });
});

describe("shuffled questions and answers", () => {
  it("keep the same order when the attempt is resumed, and grade normally", async () => {
    const questions = Array.from({ length: 8 }, () => ({ kind: "single" as const, options: [true, false, false, false] }));
    const course = await buildCourse(db, admin, { modules: [{ lessons: [{ kind: "pdf" }], questions }] }, { publish: false });
    const mod = course.modules[0]!;
    await db.as(admin, (q) => q(`update public.quizzes set shuffle_questions = true, shuffle_options = true where id = $1`, [mod.quizId]));
    await db.as(admin, (q) => q(`update public.courses set status = 'published' where id = $1`, [course.courseId]));

    const teacher = await db.createUser(`shuffle.${uid()}@e.test`);
    await db.rpc(admin, "grant_course_to_user", [course.courseId, teacher]);
    await completeLessons(db, teacher, mod.lessonIds);

    const first = await db.rpc<Started>(teacher, "start_quiz_attempt", [mod.quizId]);
    const again = await db.rpc<Started>(teacher, "start_quiz_attempt", [mod.quizId]);
    expect(again.attempt_id).toBe(first.attempt_id);
    expect(again.questions.map((q) => q.id)).toEqual(first.questions.map((q) => q.id));
    expect(again.questions.map((q) => q.options.map((o) => o.id))).toEqual(first.questions.map((q) => q.options.map((o) => o.id)));
    expect([...first.questions.map((q) => q.id)].sort()).toEqual([...mod.questions.map((q) => q.id)].sort());

    const answers = Object.fromEntries(mod.questions.map((q) => [q.id, [q.options.find((o) => o.correct)!.id]]));
    const result = await db.rpc<{ passed: boolean }>(teacher, "submit_quiz_attempt", [first.attempt_id, JSON.stringify(answers)]);
    expect(result.passed).toBe(true);
  });

  it("keeps the authored order when shuffling is off", async () => {
    const questions = Array.from({ length: 5 }, () => ({ kind: "single" as const, options: [true, false, false] }));
    const course = await buildCourse(db, admin, { modules: [{ lessons: [{ kind: "pdf" }], questions }] });
    const mod = course.modules[0]!;
    const teacher = await db.createUser(`ordered.${uid()}@e.test`);
    await db.rpc(admin, "grant_course_to_user", [course.courseId, teacher]);
    await completeLessons(db, teacher, mod.lessonIds);
    const started = await db.rpc<Started>(teacher, "start_quiz_attempt", [mod.quizId]);
    expect(started.questions.map((q) => q.id)).toEqual(mod.questions.map((q) => q.id));
    expect(started.questions[0]!.options.map((o) => o.id)).toEqual(mod.questions[0]!.options.map((o) => o.id));
  });
});
