/**
 * Scenarios 7–13: video & PDF progress persistence, quiz grading, the
 * three-attempt rule, course completion, automatic certificates and
 * duplicate prevention.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb, answersFor, buildCourse, completeLessons, uid, type BuiltCourse } from "./harness";

let db: TestDb;
let admin: string;

beforeAll(async () => {
  db = await TestDb.create();
  admin = await db.createAdmin();
});
afterAll(async () => db?.close());

async function learnerFor(course: BuiltCourse, name = "Amina") {
  const teacher = await db.createUser(`${name.toLowerCase()}.${uid()}@e.test`, name, "Benali");
  await db.rpc(admin, "grant_course_to_user", [course.courseId, teacher]);
  return teacher;
}

const ONE_MODULE = {
  modules: [
    {
      lessons: [{ kind: "video" as const, duration: 300 }],
      questions: [
        { kind: "single" as const, options: [true, false, false] },
        { kind: "multiple" as const, options: [true, true, false, false] },
        { kind: "single" as const, options: [false, true] },
      ],
    },
  ],
};

describe("7. Video progress persistence", () => {
  it("persists coverage and resume position across sessions", async () => {
    const course = await buildCourse(db, admin, ONE_MODULE);
    const teacher = await learnerFor(course);
    const lesson = course.modules[0]!.lessonIds[0]!;

    await db.rpc(teacher, "start_lesson", [lesson]);
    await db.ageRows("public.lesson_progress", "started_at", "user_id = $1", 600, [teacher]);
    await db.rpc(teacher, "record_video_progress", [lesson, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 30, 300]);

    // "Another device": start_lesson returns the persisted state.
    const state = await db.rpc<{ resume_position: number; watched_buckets: number[]; status: string }>(teacher, "start_lesson", [lesson]);
    expect(state.resume_position).toBe(30);
    expect(state.watched_buckets).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(state.status).toBe("in_progress");
  });

  it("does not count replaying the same segment as additional progress", async () => {
    const course = await buildCourse(db, admin, ONE_MODULE);
    const teacher = await learnerFor(course);
    const lesson = course.modules[0]!.lessonIds[0]!;
    await db.rpc(teacher, "start_lesson", [lesson]);
    await db.ageRows("public.lesson_progress", "started_at", "user_id = $1", 600, [teacher]);

    const first = await db.rpc<{ progress_ratio: number }>(teacher, "record_video_progress", [lesson, [0, 1, 2, 3, 4], 15, 300]);
    for (let i = 0; i < 5; i++) {
      await db.ageRows("public.video_progress", "updated_at", "user_id = $1", 120, [teacher]);
      await db.rpc(teacher, "record_video_progress", [lesson, [0, 1, 2, 3, 4], 15, 300]);
    }
    const [row] = await db.sql<{ progress_ratio: string }>(
      `select progress_ratio from public.lesson_progress where user_id = $1 and lesson_id = $2`,
      [teacher, lesson],
    );
    expect(Number(first.progress_ratio)).toBeCloseTo(0.05);
    expect(Number(row!.progress_ratio)).toBeCloseTo(0.05);
  });

  it("rejects implausible jumps (cannot claim a full video in one request)", async () => {
    const course = await buildCourse(db, admin, ONE_MODULE);
    const teacher = await learnerFor(course);
    const lesson = course.modules[0]!.lessonIds[0]!;
    await db.rpc(teacher, "start_lesson", [lesson]);

    const all = Array.from({ length: 100 }, (_, i) => i);
    const res = await db.rpc<{ status: string; accepted_buckets: number }>(teacher, "record_video_progress", [lesson, all, 299, 300]);
    expect(res.status).toBe("in_progress");
    // 300 s video → 3 s per bucket; ~0 s elapsed → only the slack is accepted.
    expect(res.accepted_buckets).toBeLessThanOrEqual(8);
  });

  it("completes the lesson at 90 % coverage and records checkpoints once", async () => {
    const course = await buildCourse(db, admin, ONE_MODULE);
    const teacher = await learnerFor(course);
    await completeLessons(db, teacher, course.modules[0]!.lessonIds);
    const lesson = course.modules[0]!.lessonIds[0]!;

    const [progress] = await db.sql<{ status: string }>(
      `select status from public.lesson_progress where user_id = $1 and lesson_id = $2`,
      [teacher, lesson],
    );
    expect(progress!.status).toBe("completed");

    const checkpoints = await db.sql<{ m: number }>(
      `select (metadata->>'milestone')::int as m from public.learning_events
        where user_id = $1 and event_type = 'video_checkpoint' order by 1`,
      [teacher],
    );
    expect(checkpoints.map((c) => c.m)).toEqual([25, 50, 75, 100]);
    const completedEvents = await db.sql(
      `select 1 from public.learning_events where user_id = $1 and event_type = 'lesson_completed'`,
      [teacher],
    );
    expect(completedEvents).toHaveLength(1);
  });
});

describe("8. PDF progress persistence", () => {
  const PDF = { modules: [{ lessons: [{ kind: "pdf" as const, pages: 6 }], questions: [{ kind: "single" as const, options: [true, false] }] }] };

  it("opening a document does not complete it", async () => {
    const course = await buildCourse(db, admin, PDF);
    const teacher = await learnerFor(course);
    const lesson = course.modules[0]!.lessonIds[0]!;
    const state = await db.rpc<{ status: string }>(teacher, "start_lesson", [lesson]);
    expect(state.status).toBe("in_progress");
  });

  it("persists viewed pages and the resume page; completes after every page", async () => {
    const course = await buildCourse(db, admin, PDF);
    const teacher = await learnerFor(course);
    const lesson = course.modules[0]!.lessonIds[0]!;
    await db.rpc(teacher, "start_lesson", [lesson]);
    await db.ageRows("public.lesson_progress", "started_at", "user_id = $1", 600, [teacher]);

    const partial = await db.rpc<{ status: string; pages_viewed: number[] }>(teacher, "record_document_progress", [lesson, [1, 2, 3], 3]);
    expect(partial.status).toBe("in_progress");
    expect(partial.pages_viewed).toEqual([1, 2, 3]);

    const resumed = await db.rpc<{ resume_position: number; pages_viewed: number[] }>(teacher, "start_lesson", [lesson]);
    expect(resumed.resume_position).toBe(3);
    expect(resumed.pages_viewed).toEqual([1, 2, 3]);

    await db.ageRows("public.document_progress", "updated_at", "user_id = $1", 600, [teacher]);
    const done = await db.rpc<{ status: string }>(teacher, "record_document_progress", [lesson, [4, 5, 6, 99], 6]);
    expect(done.status).toBe("completed");
  });
});

describe("9. Quiz grading", () => {
  it("grades on the server; partial multi-select answers are incorrect", async () => {
    const course = await buildCourse(db, admin, ONE_MODULE);
    const teacher = await learnerFor(course);
    const mod = course.modules[0]!;
    await completeLessons(db, teacher, mod.lessonIds);

    const started = await db.rpc<{ attempt_id: string; questions: Array<{ options: Array<Record<string, unknown>> }> }>(
      teacher, "start_quiz_attempt", [mod.quizId],
    );
    // No correctness information is ever sent before submission.
    for (const q of started.questions) for (const o of q.options) expect(Object.keys(o).sort()).toEqual(["id", "label"]);

    const answers = answersFor(mod.questions, [true, true, false]);
    // Partial selection for the multiple-answer question → incorrect.
    answers[mod.questions[1]!.id] = [mod.questions[1]!.options[0]!.id];
    const result = await db.rpc<{ score_percent: string; passed: boolean; earned_points: number; answers_revealed: boolean }>(
      teacher, "submit_quiz_attempt", [started.attempt_id, JSON.stringify(answers)],
    );
    expect(result.earned_points).toBe(1);
    expect(Number(result.score_percent)).toBeCloseTo(33.33);
    expect(result.passed).toBe(false);
    expect(result.answers_revealed).toBe(false);
  });

  it("applies the 70 % threshold exactly (7/10 passes, 6/10 fails)", async () => {
    const tenQuestions = {
      modules: [{
        lessons: [{ kind: "pdf" as const, pages: 1 }],
        questions: Array.from({ length: 10 }, () => ({ kind: "single" as const, options: [true, false] })),
      }],
    };
    for (const [correct, expected] of [[6, false], [7, true]] as const) {
      const course = await buildCourse(db, admin, tenQuestions);
      const teacher = await learnerFor(course);
      const mod = course.modules[0]!;
      await completeLessons(db, teacher, mod.lessonIds);
      const started = await db.rpc<{ attempt_id: string }>(teacher, "start_quiz_attempt", [mod.quizId]);
      const mask = Array.from({ length: 10 }, (_, i) => i < correct);
      const result = await db.rpc<{ passed: boolean; score_percent: string }>(
        teacher, "submit_quiz_attempt", [started.attempt_id, JSON.stringify(answersFor(mod.questions, mask))],
      );
      expect(Number(result.score_percent)).toBe(correct * 10);
      expect(result.passed).toBe(expected);
    }
  });

  it("weights questions by points and ignores foreign option ids", async () => {
    const weighted = {
      modules: [{
        lessons: [{ kind: "pdf" as const, pages: 1 }],
        questions: [
          { kind: "single" as const, points: 7, options: [true, false] },
          { kind: "single" as const, points: 3, options: [true, false] },
        ],
      }],
    };
    const course = await buildCourse(db, admin, weighted);
    const teacher = await learnerFor(course);
    const mod = course.modules[0]!;
    await completeLessons(db, teacher, mod.lessonIds);
    const started = await db.rpc<{ attempt_id: string }>(teacher, "start_quiz_attempt", [mod.quizId]);
    const answers = answersFor(mod.questions, [true, false]);
    // Injecting the other question's correct option must not help.
    answers[mod.questions[1]!.id]!.push(mod.questions[0]!.options[0]!.id);
    const result = await db.rpc<{ score_percent: string; passed: boolean; answers_revealed: boolean }>(
      teacher, "submit_quiz_attempt", [started.attempt_id, JSON.stringify(answers)],
    );
    expect(Number(result.score_percent)).toBe(70);
    expect(result.passed).toBe(true);
    expect(result.answers_revealed).toBe(true);
  });

  it("keeps the quiz locked until the module's mandatory lessons are complete", async () => {
    const course = await buildCourse(db, admin, ONE_MODULE);
    const teacher = await learnerFor(course);
    expect(await db.rpcError(teacher, "start_quiz_attempt", [course.modules[0]!.quizId])).toBe("quiz_locked");
  });
});

describe("10. Three-attempt enforcement", () => {
  it("allows exactly three attempts; refreshes and replays never add attempts", async () => {
    const course = await buildCourse(db, admin, ONE_MODULE);
    const teacher = await learnerFor(course);
    const mod = course.modules[0]!;
    await completeLessons(db, teacher, mod.lessonIds);
    const wrong = JSON.stringify(answersFor(mod.questions, [false, false, false]));

    for (let attempt = 1; attempt <= 3; attempt++) {
      const a = await db.rpc<{ attempt_id: string; attempt_number: number }>(teacher, "start_quiz_attempt", [mod.quizId]);
      // "Refresh": starting again returns the same open attempt.
      const again = await db.rpc<{ attempt_id: string }>(teacher, "start_quiz_attempt", [mod.quizId]);
      expect(again.attempt_id).toBe(a.attempt_id);
      expect(a.attempt_number).toBe(attempt);

      const res = await db.rpc<{ remaining_attempts: number }>(teacher, "submit_quiz_attempt", [a.attempt_id, wrong]);
      expect(res.remaining_attempts).toBe(3 - attempt);
      // Replayed submission is refused.
      expect(await db.rpcError(teacher, "submit_quiz_attempt", [a.attempt_id, wrong])).toBe("attempt_already_submitted");
    }

    expect(await db.rpcError(teacher, "start_quiz_attempt", [mod.quizId])).toBe("attempts_exhausted");
    const status = await db.rpc<{ exhausted: boolean; attempts_used: number }>(teacher, "quiz_status", [mod.quizId]);
    expect(status).toMatchObject({ exhausted: true, attempts_used: 3 });

    const [{ count }] = (await db.sql<{ count: number }>(
      `select count(*)::int as count from public.quiz_attempts where user_id = $1`, [teacher],
    )) as [{ count: number }];
    expect(count).toBe(3);
  });

  it("enforces uniqueness at the database level even if the function were bypassed", async () => {
    const course = await buildCourse(db, admin, ONE_MODULE);
    const teacher = await learnerFor(course);
    const mod = course.modules[0]!;
    await completeLessons(db, teacher, mod.lessonIds);
    await db.rpc(teacher, "start_quiz_attempt", [mod.quizId]);
    await expect(
      db.sql(
        `insert into public.quiz_attempts (quiz_id, user_id, course_id, attempt_number, pass_threshold, max_attempts, question_ids)
         values ($1, $2, $3, 2, 70, 3, '{}')`,
        [mod.quizId, teacher, course.courseId],
      ),
    ).rejects.toThrow(/quiz_attempts_one_open_idx/);
  });

  it("administrator reset is audited, requires a reason, and restores three attempts", async () => {
    const course = await buildCourse(db, admin, ONE_MODULE);
    const teacher = await learnerFor(course);
    const mod = course.modules[0]!;
    await completeLessons(db, teacher, mod.lessonIds);
    const wrong = JSON.stringify(answersFor(mod.questions, [false, false, false]));
    for (let i = 0; i < 3; i++) {
      const a = await db.rpc<{ attempt_id: string }>(teacher, "start_quiz_attempt", [mod.quizId]);
      await db.rpc(teacher, "submit_quiz_attempt", [a.attempt_id, wrong]);
    }
    const exhausted = await db.rpc<Array<{ user_id: string }>>(admin, "exhausted_attempts", []);
    void exhausted;
    const rows = await db.as(admin, (q) => q<{ user_id: string }>(`select user_id from public.exhausted_attempts()`));
    expect(rows.map((r) => r.user_id)).toContain(teacher);

    expect(await db.rpcError(teacher, "reset_quiz_attempts", [mod.quizId, teacher, "Je veux réessayer"])).toBe("forbidden");
    expect(await db.rpcError(admin, "reset_quiz_attempts", [mod.quizId, teacher, ""])).toBe("reason_required");
    expect(await db.rpc(admin, "reset_quiz_attempts", [mod.quizId, teacher, "Accompagnement individuel réalisé"])).toBe(3);

    const a = await db.rpc<{ attempt_number: number }>(teacher, "start_quiz_attempt", [mod.quizId]);
    expect(a.attempt_number).toBe(1);

    const audit = await db.as(admin, (q) =>
      q<{ details: { reason: string } }>(`select details from public.audit_logs where action = 'quiz_attempts_reset' and entity_id = $1`, [mod.quizId]),
    );
    expect(audit[0]!.details.reason).toBe("Accompagnement individuel réalisé");
  });

  it("no further attempts once passed", async () => {
    const course = await buildCourse(db, admin, ONE_MODULE);
    const teacher = await learnerFor(course);
    const mod = course.modules[0]!;
    await completeLessons(db, teacher, mod.lessonIds);
    const a = await db.rpc<{ attempt_id: string }>(teacher, "start_quiz_attempt", [mod.quizId]);
    await db.rpc(teacher, "submit_quiz_attempt", [a.attempt_id, JSON.stringify(answersFor(mod.questions, [true, true, true]))]);
    expect(await db.rpcError(teacher, "start_quiz_attempt", [mod.quizId])).toBe("quiz_already_passed");
  });
});

describe("11–13. Completion, automatic certificate, duplicate prevention", () => {
  const TWO_MODULES = {
    modules: [
      { lessons: [{ kind: "video" as const }, { kind: "pdf" as const, pages: 2, mandatory: false }], questions: [{ kind: "single" as const, options: [true, false] }] },
      { lessons: [{ kind: "pdf" as const, pages: 2 }], questions: [{ kind: "single" as const, options: [false, true] }] },
    ],
  };

  async function passModule(teacher: string, mod: BuiltCourse["modules"][number]) {
    await completeLessons(db, teacher, mod.lessonIds.slice(0, 1));
    const a = await db.rpc<{ attempt_id: string }>(teacher, "start_quiz_attempt", [mod.quizId]);
    return db.rpc<{ passed: boolean; certificate_issued: boolean }>(
      teacher, "submit_quiz_attempt", [a.attempt_id, JSON.stringify(answersFor(mod.questions, mod.questions.map(() => true)))],
    );
  }

  it("11. a course is complete only when all mandatory lessons AND all quizzes are passed", async () => {
    const course = await buildCourse(db, admin, TWO_MODULES);
    const teacher = await learnerFor(course);

    const first = await passModule(teacher, course.modules[0]!);
    expect(first.passed).toBe(true);
    expect(first.certificate_issued).toBe(false);

    // All mandatory lessons done for module 2 but its quiz not yet passed.
    await completeLessons(db, teacher, course.modules[1]!.lessonIds);
    let progress = await db.rpc<{ enrollment_status: string; certificate: unknown; quizzes_passed: number }>(
      teacher, "course_progress", [course.courseId],
    );
    expect(progress.enrollment_status).toBe("active");
    expect(progress.certificate).toBeNull();
    expect(progress.quizzes_passed).toBe(1);

    const second = await db.rpc<{ attempt_id: string }>(teacher, "start_quiz_attempt", [course.modules[1]!.quizId]);
    const res = await db.rpc<{ certificate_issued: boolean }>(teacher, "submit_quiz_attempt", [
      second.attempt_id, JSON.stringify(answersFor(course.modules[1]!.questions, [true])),
    ]);
    expect(res.certificate_issued).toBe(true);

    progress = await db.rpc(teacher, "course_progress", [course.courseId]);
    expect(progress.enrollment_status).toBe("completed");
    // The optional lesson was never opened: completion does not depend on it.
    expect(progress.certificate).not.toBeNull();
  });

  it("12. issues a verifiable certificate automatically, with snapshot data", async () => {
    const course = await buildCourse(db, admin, TWO_MODULES, { title: "Évaluation formative en classe" });
    const teacher = await learnerFor(course, "Youssef");
    await passModule(teacher, course.modules[0]!);
    await passModule(teacher, course.modules[1]!);

    const [cert] = await db.as(teacher, (q) =>
      q<{ certificate_number: string; verification_code: string; recipient_name: string; course_title: string; course_duration_minutes: number }>(
        `select certificate_number, verification_code, recipient_name, course_title, course_duration_minutes from public.certificates`,
      ),
    );
    expect(cert!.certificate_number).toMatch(/^SND-\d{4}-[0-9A-F]{8}$/);
    expect(cert!.recipient_name).toBe("Youssef Benali");
    expect(cert!.course_title).toBe("Évaluation formative en classe");
    expect(cert!.course_duration_minutes).toBe(90);

    // Public verification (anonymous) reveals only what is needed.
    const verified = await db.rpc<Record<string, unknown>>(null, "verify_certificate", [cert!.verification_code], "anon");
    expect(verified).toMatchObject({ status: "valid", recipient_name: "Youssef Benali", course_title: "Évaluation formative en classe" });
    expect(Object.keys(verified).sort()).toEqual(
      ["certificate_number", "completed_at", "course_duration_minutes", "course_title", "issued_at", "issuer", "recipient_name", "status"],
    );
    expect(await db.rpc(null, "verify_certificate", [cert!.certificate_number.toLowerCase()], "anon")).toMatchObject({ status: "valid" });
    expect(await db.rpc(null, "verify_certificate", ["inexistant"], "anon")).toBeNull();

    // Later course edits never alter the issued certificate.
    await db.as(admin, (q) => q(`update public.courses set title = 'Nouveau titre' where id = $1`, [course.courseId]));
    const again = await db.rpc<{ course_title: string }>(null, "verify_certificate", [cert!.verification_code], "anon");
    expect(again.course_title).toBe("Évaluation formative en classe");

    // Revocation is reflected publicly.
    const [{ id }] = (await db.sql<{ id: string }>(`select id from public.certificates where user_id = $1`, [teacher])) as [{ id: string }];
    await db.rpc(admin, "revoke_certificate", [id, "Erreur administrative constatée"]);
    expect(await db.rpc(null, "verify_certificate", [cert!.verification_code], "anon")).toMatchObject({ status: "revoked" });
  });

  it("13. certificate issuance is idempotent", async () => {
    const course = await buildCourse(db, admin, TWO_MODULES);
    const teacher = await learnerFor(course);
    await passModule(teacher, course.modules[0]!);
    await passModule(teacher, course.modules[1]!);

    for (let i = 0; i < 3; i++) {
      expect(await db.rpc(teacher, "refresh_course_completion", [course.courseId])).toBe(false);
    }
    const certs = await db.sql(`select 1 from public.certificates where user_id = $1 and course_id = $2`, [teacher, course.courseId]);
    expect(certs).toHaveLength(1);
    const events = await db.sql(
      `select 1 from public.learning_events where user_id = $1 and event_type = 'certificate_issued'`, [teacher],
    );
    expect(events).toHaveLength(1);

    await expect(
      db.sql(
        `insert into public.certificates (user_id, course_id, certificate_number, verification_code, recipient_name, course_title, completed_at)
         values ($1, $2, 'SND-2026-0000AAAA', '00000000000000000000000000000000', 'X', 'Y', now())`,
        [teacher, course.courseId],
      ),
    ).rejects.toThrow(/unique/);
  });
});
