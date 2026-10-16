/**
 * Restoring an approved version of a custom course while a new version is
 * prepared: same lessons reused (employees' progress kept), nothing deleted,
 * questions back as they were, production team only.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb, buildCourse, completeLessons, uid, type BuiltCourse } from "./harness";

let db: TestDb;
let production: string;
let enterprise: string;
let trainer: string;
let learner: string;
let project: string;
let course: BuiltCourse;

beforeAll(async () => {
  db = await TestDb.create();
  const admin = await db.createAdmin();
  const staff = async (role: string) => {
    const id = await db.createUser(`${role}.${uid()}@sanady.test`);
    await db.rpc(admin, "set_platform_role", [id, role]);
    return id;
  };
  production = await staff("production_manager");
  enterprise = await staff("partnership_coordinator");
  trainer = await staff("trainer");
  course = await buildCourse(db, admin, {
    modules: [{ lessons: [{ kind: "pdf", pages: 2 }, { kind: "pdf", pages: 3 }], questions: [{ kind: "single", options: [true, false] }, { kind: "single", options: [false, true] }] }],
  });
  const [l1, l2] = course.modules[0]!.lessonIds as [string, string];
  await db.sql(`update public.lessons set pdf_path = $2, description = 'Texte de la leçon 1' where id = $1`, [l1, `${course.courseId}/l1.pdf`]);
  await db.sql(`update public.lessons set pdf_path = $2 where id = $1`, [l2, `${course.courseId}/l2.pdf`]);
  const [{ id: org }] = (await db.sql<{ id: string }>(`insert into public.partner_organizations (name, org_type, enterprise_status) values ('Client versions', 'entreprise', 'active_service') returning id`)) as [{ id: string }];
  [{ id: project }] = (await db.sql<{ id: string }>(
    `insert into public.training_projects (reference, organization_id, title, target_audience, course_id, status, version) values ($1, $2, 'Formation versionnée', 'Équipes', $3, 'launched', 2) returning id`,
    [`FS-V-${uid()}`, org, course.courseId],
  )) as [{ id: string }];
  await db.sql(`insert into public.training_versions (project_id, version, snapshot) values ($1, 1, private.course_snapshot($2))`, [project, course.courseId]);
  learner = await db.createUser(`emp.${uid()}@client.test`);
  await db.rpc(admin, "grant_course_to_user", [course.courseId, learner]);
  await completeLessons(db, learner, [l1]);
});
afterAll(async () => db?.close());

describe("restoring an approved version", () => {
  it("is only possible while a new version is prepared, by the production team", async () => {
    expect(await db.rpcError(production, "restore_training_version", [project, 1])).toMatch(/invalid_transition/);
    await db.sql(`update public.training_projects set status = 'production' where id = $1`, [project]);
    expect(await db.rpcError(enterprise, "restore_training_version", [project, 1])).toMatch(/forbidden/);
    expect(await db.rpcError(trainer, "restore_training_version", [project, 1])).toMatch(/forbidden/);
    expect(await db.rpcError(production, "restore_training_version", [project, 9])).toMatch(/not_found/);
  });

  it("brings the content back, reusing the same lessons, so progress is kept", async () => {
    const [l1, l2] = course.modules[0]!.lessonIds as [string, string];
    // Version 2 in preparation: lesson 1 renamed, lesson 2 removed, a lesson and a question added.
    await db.sql(`update public.lessons set title = 'Titre modifié', description = 'Autre texte' where id = $1`, [l1]);
    await db.sql(`update public.lessons set archived_at = now() where id = $1`, [l2]);
    const [{ id: added }] = (await db.sql<{ id: string }>(
      `insert into public.lessons (module_id, course_id, title, kind, position, pdf_path, pdf_page_count) values ($1, $2, 'Leçon ajoutée', 'pdf', 5, $3, 1) returning id`,
      [course.modules[0]!.moduleId, course.courseId, `${course.courseId}/l3.pdf`],
    )) as [{ id: string }];
    await db.sql(`insert into public.questions (quiz_id, kind, prompt, position) values ($1, 'single', 'Question ajoutée en version 2', 9)`, [course.modules[0]!.quizId]);

    const r = await db.rpc<{ modules: number; lessons_reused: number; lessons_created: number; questions: number }>(production, "restore_training_version", [project, 1]);
    expect(r).toEqual({ modules: 1, lessons_reused: 2, lessons_created: 0, questions: 2 });

    const lessons = await db.sql<{ id: string; title: string; description: string; position: number }>(
      `select id, title, description, position from public.lessons where course_id = $1 and archived_at is null order by position`,
      [course.courseId],
    );
    expect(lessons.map((l) => l.id)).toEqual([l1, l2]);
    expect(lessons[0]!.description).toBe("Texte de la leçon 1");
    const [gone] = await db.sql<{ archived_at: string | null }>(`select archived_at from public.lessons where id = $1`, [added]);
    expect(gone!.archived_at).not.toBeNull();
    // The employee's completed lesson is still the active one.
    const [progress] = await db.sql<{ status: string }>(`select status from public.lesson_progress where user_id = $1 and lesson_id = $2`, [learner, l1]);
    expect(progress!.status).toBe("completed");

    const questions = await db.sql<{ prompt: string }>(`select prompt from public.questions where quiz_id = $1 and archived_at is null order by position`, [course.modules[0]!.quizId]);
    expect(questions).toHaveLength(2);
    expect(questions.map((q) => q.prompt)).not.toContain("Question ajoutée en version 2");
    const [{ n }] = (await db.sql<{ n: number }>(
      `select count(*)::int n from public.question_options o join public.questions q on q.id = o.question_id where q.quiz_id = $1 and q.archived_at is null and o.is_correct`,
      [course.modules[0]!.quizId],
    )) as [{ n: number }];
    expect(n).toBe(2);
    const [h] = await db.sql<{ to_status: string; note: string }>(`select to_status, note from public.enterprise_history where project_id = $1 order by created_at desc limit 1`, [project]);
    expect(h).toEqual({ to_status: "version_restored", note: "Version 1" });
  });
});
