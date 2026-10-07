/**
 * Scenarios 5, 6 and 14: unauthorized course access prevention, course
 * creation & publication, institutional data isolation.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb, buildCourse, completeLessons, newToken, uid } from "./harness";

let db: TestDb;
let admin: string;

const SIMPLE = {
  modules: [
    {
      lessons: [{ kind: "video" as const }, { kind: "pdf" as const, pages: 3 }],
      questions: [{ kind: "single" as const, options: [true, false, false] }],
    },
  ],
};

beforeAll(async () => {
  db = await TestDb.create();
  admin = await db.createAdmin();
});
afterAll(async () => db?.close());

async function institutionWithAdmin() {
  const inst = await db.as(admin, async (q) => {
    const [row] = await q<{ id: string }>(
      `insert into public.institutions (name, identifier, type, contact_email)
       values ($1, $2, 'college', 'contact@college.test') returning id`,
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

const visibleCourses = (user: string, courseId: string) =>
  db.as(user, (q) => q(`select id from public.courses where id = $1`, [courseId]));
const visibleLessons = (user: string, courseId: string) =>
  db.as(user, (q) => q(`select id from public.lessons where course_id = $1`, [courseId]));

describe("5. Unauthorized course access prevention", () => {
  it("a teacher without permission cannot read or start a published course", async () => {
    const course = await buildCourse(db, admin, SIMPLE);
    const teacher = await db.createUser(`solo.${uid()}@e.test`);

    expect(await visibleCourses(teacher, course.courseId)).toHaveLength(0);
    expect(await visibleLessons(teacher, course.courseId)).toHaveLength(0);
    expect(await db.rpcError(teacher, "start_lesson", [course.modules[0]!.lessonIds[0]])).toBe("course_access_denied");
    expect(await db.rpcError(teacher, "start_quiz_attempt", [course.modules[0]!.quizId])).toBe("course_access_denied");
  });

  it("individual authorization grants access; revocation removes it", async () => {
    const course = await buildCourse(db, admin, SIMPLE);
    const teacher = await db.createUser(`ind.${uid()}@e.test`);
    await db.rpc(admin, "grant_course_to_user", [course.courseId, teacher]);

    expect(await visibleLessons(teacher, course.courseId)).toHaveLength(2);
    await db.rpc(teacher, "start_lesson", [course.modules[0]!.lessonIds[0]]);

    await db.rpc(admin, "revoke_course_from_user", [course.courseId, teacher]);
    expect(await visibleLessons(teacher, course.courseId)).toHaveLength(0);
    expect(await db.rpcError(teacher, "start_lesson", [course.modules[0]!.lessonIds[0]])).toBe("course_access_denied");
  });

  it("institution membership alone never grants access to a course", async () => {
    const course = await buildCourse(db, admin, SIMPLE);
    const { inst, director } = await institutionWithAdmin();
    const teacher = await addTeacher(inst, director);
    await db.rpc(admin, "grant_course_to_institution", [course.courseId, inst]);

    // Authorized for the institution, but not assigned to this teacher.
    expect(await visibleLessons(teacher, course.courseId)).toHaveLength(0);

    await db.rpc(director, "assign_course", [inst, course.courseId, [teacher], null]);
    expect(await visibleLessons(teacher, course.courseId)).toHaveLength(2);
  });

  it("institutions cannot assign courses they are not authorized for", async () => {
    const course = await buildCourse(db, admin, SIMPLE);
    const { inst, director } = await institutionWithAdmin();
    const teacher = await addTeacher(inst, director);
    expect(await db.rpcError(director, "assign_course", [inst, course.courseId, [teacher], null])).toBe(
      "course_not_authorized",
    );
  });

  it("revoking the institution's authorization or membership ends access", async () => {
    const course = await buildCourse(db, admin, SIMPLE);
    const { inst, director } = await institutionWithAdmin();
    const t1 = await addTeacher(inst, director);
    const t2 = await addTeacher(inst, director);
    await db.rpc(admin, "grant_course_to_institution", [course.courseId, inst]);
    await db.rpc(director, "assign_course", [inst, course.courseId, [t1, t2], null]);

    const [membership] = await db.sql<{ id: string }>(
      `select id from public.institution_memberships where institution_id = $1 and user_id = $2`,
      [inst, t1],
    );
    await db.rpc(director, "revoke_membership", [membership!.id]);
    expect(await visibleLessons(t1, course.courseId)).toHaveLength(0);
    expect(await visibleLessons(t2, course.courseId)).toHaveLength(2);

    await db.rpc(admin, "revoke_course_from_institution", [course.courseId, inst]);
    expect(await visibleLessons(t2, course.courseId)).toHaveLength(0);
  });

  it("unpublishing a course suspends learner access", async () => {
    const course = await buildCourse(db, admin, SIMPLE);
    const teacher = await db.createUser(`unpub.${uid()}@e.test`);
    await db.rpc(admin, "grant_course_to_user", [course.courseId, teacher]);
    await db.as(admin, (q) => q(`update public.courses set status = 'draft' where id = $1`, [course.courseId]));
    expect(await visibleLessons(teacher, course.courseId)).toHaveLength(0);
  });

  it("learners can never read correct answers directly", async () => {
    const course = await buildCourse(db, admin, SIMPLE);
    const teacher = await db.createUser(`peek.${uid()}@e.test`);
    await db.rpc(admin, "grant_course_to_user", [course.courseId, teacher]);
    expect(await db.as(teacher, (q) => q(`select * from public.question_options`))).toHaveLength(0);
    expect(await db.as(teacher, (q) => q(`select * from public.questions`))).toHaveLength(0);
  });

  it("learners cannot write progress or attempts directly", async () => {
    const course = await buildCourse(db, admin, SIMPLE);
    const teacher = await db.createUser(`forge.${uid()}@e.test`);
    await db.rpc(admin, "grant_course_to_user", [course.courseId, teacher]);
    await expect(
      db.as(teacher, (q) =>
        q(`insert into public.lesson_progress (user_id, lesson_id, course_id, status, completed_at)
           values ($1, $2, $3, 'completed', now())`, [teacher, course.modules[0]!.lessonIds[0], course.courseId]),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.as(teacher, (q) =>
        q(`insert into public.certificates (user_id, course_id, certificate_number, verification_code, recipient_name, course_title, completed_at)
           values ($1, $2, 'SND-2026-AAAAAAAA', '0123456789abcdef0123456789abcdef', 'X', 'Y', now())`, [teacher, course.courseId]),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.as(teacher, (q) => q(`update public.profiles set status = 'active', email = 'x@y.z' where id = $1`, [teacher])),
    ).rejects.toThrow(/permission denied/);
  });

  it("storage policies only allow media reads for authorized learners", async () => {
    const course = await buildCourse(db, admin, SIMPLE);
    const allowed = await db.createUser(`media.${uid()}@e.test`);
    const denied = await db.createUser(`nomedia.${uid()}@e.test`);
    await db.rpc(admin, "grant_course_to_user", [course.courseId, allowed]);
    await db.sql(
      `insert into storage.objects (bucket_id, name) values ('course-media', $1)`,
      [`${course.courseId}/${course.modules[0]!.lessonIds[0]}/video.mp4`],
    );
    const read = (u: string) =>
      db.as(u, (q) => q(`select name from storage.objects where bucket_id = 'course-media' and name like $1`, [`${course.courseId}/%`]));
    expect(await read(allowed)).toHaveLength(1);
    expect(await read(denied)).toHaveLength(0);
    await expect(
      db.as(allowed, (q) => q(`insert into storage.objects (bucket_id, name) values ('course-media', 'x/y/z.mp4')`)),
    ).rejects.toThrow(/row-level security/);
  });
});

describe("6. Course creation and publication", () => {
  it("only SANADY administrators can create or edit courses", async () => {
    const { inst, director } = await institutionWithAdmin();
    void inst;
    await expect(
      db.as(director, (q) => q(`insert into public.courses (title) values ('Cours pirate')`)),
    ).rejects.toThrow(/row-level security/);
    const course = await buildCourse(db, admin, SIMPLE);
    const updated = await db.as(director, (q) =>
      q(`update public.courses set title = 'Modifié' where id = $1 returning id`, [course.courseId]),
    );
    expect(updated).toHaveLength(0);
  });

  it("refuses to publish an incomplete course and lists the issues", async () => {
    const course = await buildCourse(
      db,
      admin,
      { modules: [{ lessons: [{ kind: "video" }], questions: [] }] },
      { publish: false },
    );
    const issues = await db.rpc<Array<{ code: string }>>(admin, "validate_course", [course.courseId]);
    expect(issues.map((i) => i.code)).toContain("module_no_quiz");

    await expect(
      db.as(admin, (q) => q(`update public.courses set status = 'published' where id = $1`, [course.courseId])),
    ).rejects.toThrow(/course_not_publishable/);
  });

  it("publishes a complete course and records the publication date", async () => {
    const course = await buildCourse(db, admin, SIMPLE);
    const [row] = await db.sql<{ status: string; published_at: string | null }>(
      `select status, published_at from public.courses where id = $1`,
      [course.courseId],
    );
    expect(row!.status).toBe("published");
    expect(row!.published_at).not.toBeNull();
  });

  it("validates question configuration (single answer needs exactly one correct option)", async () => {
    const course = await buildCourse(db, admin, SIMPLE, { publish: false });
    const quiz = course.modules[0]!.quizId;
    const options = JSON.stringify([{ label: "A", is_correct: true }, { label: "B", is_correct: true }]);
    expect(await db.rpcError(admin, "save_question", [quiz, null, "single", "Question ?", "", 1, options])).toBe(
      "question_correct_count",
    );
    expect(
      await db.rpcError(admin, "save_question", [quiz, null, "multiple", "Question ?", "", 1, JSON.stringify([{ label: "A", is_correct: true }])]),
    ).toBe("question_options_count");
  });

  it("archives (never deletes) lessons that already hold learner progress", async () => {
    const course = await buildCourse(db, admin, SIMPLE);
    const teacher = await db.createUser(`arch.${uid()}@e.test`);
    await db.rpc(admin, "grant_course_to_user", [course.courseId, teacher]);
    const [lessonWithData, lessonWithout] = course.modules[0]!.lessonIds;
    await db.rpc(teacher, "start_lesson", [lessonWithData]);

    expect(await db.rpc(admin, "remove_lesson", [lessonWithData])).toBe("archived");
    expect(await db.rpc(admin, "remove_lesson", [lessonWithout])).toBe("deleted");
    const [progress] = await db.sql(`select 1 from public.lesson_progress where lesson_id = $1`, [lessonWithData]);
    expect(progress).toBeDefined();
  });

  it("reorders modules atomically", async () => {
    const course = await buildCourse(
      db,
      admin,
      { modules: [SIMPLE.modules[0]!, SIMPLE.modules[0]!, SIMPLE.modules[0]!] },
      { publish: false },
    );
    const ids = course.modules.map((m) => m.moduleId).reverse();
    await db.rpc(admin, "reorder_modules", [course.courseId, ids]);
    const rows = await db.sql<{ id: string }>(`select id from public.modules where course_id = $1 order by position`, [course.courseId]);
    expect(rows.map((r) => r.id)).toEqual(ids);
  });
});

describe("14. Institutional data isolation", () => {
  it("institution admins see only their own teachers, invitations and codes", async () => {
    const a = await institutionWithAdmin();
    const b = await institutionWithAdmin();
    const teacherA = await addTeacher(a.inst, a.director);
    const teacherB = await addTeacher(b.inst, b.director);

    const profilesSeenByA = await db.as(a.director, (q) => q<{ id: string }>(`select id from public.profiles`));
    const ids = profilesSeenByA.map((p) => p.id);
    expect(ids).toContain(teacherA);
    expect(ids).not.toContain(teacherB);

    expect(await db.as(a.director, (q) => q(`select id from public.institutions where id = $1`, [b.inst]))).toHaveLength(0);
    expect(
      await db.as(a.director, (q) => q(`select id from public.institution_memberships where institution_id = $1`, [b.inst])),
    ).toHaveLength(0);
    expect(await db.rpcError(a.director, "institution_overview", [b.inst])).toBe("forbidden");
    expect(await db.rpcError(a.director, "institution_teacher_summaries", [b.inst])).toBe("forbidden");
  });

  it("an institution sees progress only for the courses it assigned — never personal learning", async () => {
    const assigned = await buildCourse(db, admin, SIMPLE);
    const personal = await buildCourse(db, admin, SIMPLE);
    const { inst, director } = await institutionWithAdmin();
    const teacher = await addTeacher(inst, director);

    await db.rpc(admin, "grant_course_to_institution", [assigned.courseId, inst]);
    await db.rpc(director, "assign_course", [inst, assigned.courseId, [teacher], null]);
    await db.rpc(admin, "grant_course_to_user", [personal.courseId, teacher]);

    await completeLessons(db, teacher, assigned.modules[0]!.lessonIds);
    await completeLessons(db, teacher, personal.modules[0]!.lessonIds);

    const seen = await db.as(director, (q) =>
      q<{ course_id: string }>(`select distinct course_id from public.lesson_progress where user_id = $1`, [teacher]),
    );
    expect(seen.map((r) => r.course_id)).toEqual([assigned.courseId]);

    const enrollments = await db.as(director, (q) =>
      q<{ course_id: string }>(`select course_id from public.enrollments where user_id = $1`, [teacher]),
    );
    expect(enrollments.map((r) => r.course_id)).toEqual([assigned.courseId]);

    const events = await db.as(director, (q) =>
      q<{ course_id: string }>(`select distinct course_id from public.learning_events where user_id = $1`, [teacher]),
    );
    expect(events.map((r) => r.course_id)).toEqual([assigned.courseId]);

    expect(await db.rpcError(director, "course_progress", [personal.courseId, teacher])).toBe("forbidden");
    const progress = await db.rpc<{ completed_mandatory_lessons: number }>(director, "course_progress", [assigned.courseId, teacher]);
    expect(progress.completed_mandatory_lessons).toBe(2);
  });

  it("visibility ends when the teacher leaves the institution", async () => {
    const course = await buildCourse(db, admin, SIMPLE);
    const { inst, director } = await institutionWithAdmin();
    const teacher = await addTeacher(inst, director);
    await db.rpc(admin, "grant_course_to_institution", [course.courseId, inst]);
    await db.rpc(director, "assign_course", [inst, course.courseId, [teacher], null]);
    await db.rpc(teacher, "start_lesson", [course.modules[0]!.lessonIds[0]]);

    await db.rpc(teacher, "leave_institution", [inst]);
    expect(await db.as(director, (q) => q(`select 1 from public.lesson_progress where user_id = $1`, [teacher]))).toHaveLength(0);
    expect(await db.as(director, (q) => q(`select 1 from public.profiles where id = $1`, [teacher]))).toHaveLength(0);
  });

  it("teachers cannot see other teachers", async () => {
    const { inst, director } = await institutionWithAdmin();
    const t1 = await addTeacher(inst, director);
    const t2 = await addTeacher(inst, director);
    const seen = await db.as(t1, (q) => q<{ id: string }>(`select id from public.profiles`));
    expect(seen.map((p) => p.id)).toEqual([t1]);
    expect(await db.as(t1, (q) => q(`select 1 from public.institution_memberships where user_id = $1`, [t2]))).toHaveLength(0);
  });
});

describe("learner_courses() batch summary", () => {
  it("returns separate measures and the lesson to resume, scoped like RLS", async () => {
    const assigned = await buildCourse(db, admin, SIMPLE);
    const personal = await buildCourse(db, admin, SIMPLE);
    const { inst, director } = await institutionWithAdmin();
    const teacher = await addTeacher(inst, director);
    await db.rpc(admin, "grant_course_to_institution", [assigned.courseId, inst]);
    await db.rpc(director, "assign_course", [inst, assigned.courseId, [teacher], null]);
    await db.rpc(admin, "grant_course_to_user", [personal.courseId, teacher]);

    const [videoLesson, pdfLesson] = assigned.modules[0]!.lessonIds;
    await completeLessons(db, teacher, [videoLesson!]);

    type Row = { course_id: string; mandatory_lessons: number; completed_lessons: number; quizzes_total: number; quizzes_passed: number; resume_lesson_id: string; has_access: boolean };
    const own = await db.as(teacher, (q) => q<Row>(`select * from public.learner_courses()`));
    expect(own.map((r) => r.course_id).sort()).toEqual([assigned.courseId, personal.courseId].sort());
    const row = own.find((r) => r.course_id === assigned.courseId)!;
    expect(row).toMatchObject({ mandatory_lessons: 2, completed_lessons: 1, quizzes_total: 1, quizzes_passed: 0, has_access: true });
    expect(row.resume_lesson_id).toBe(pdfLesson);

    const seenByInstitution = await db.as(director, (q) => q<Row>(`select * from public.learner_courses($1)`, [teacher]));
    expect(seenByInstitution.map((r) => r.course_id)).toEqual([assigned.courseId]);

    const stranger = await db.createUser(`stranger.${uid()}@e.test`);
    expect(await db.as(stranger, (q) => q<Row>(`select * from public.learner_courses($1)`, [teacher]))).toEqual([]);
  });
});
