/**
 * Database test harness.
 *
 * Boots an in-process PostgreSQL (PGlite), applies a minimal Supabase shim
 * and then the REAL migrations from supabase/migrations, in order. Tests then
 * act as specific users through the same roles and JWT claim that Supabase
 * uses, so Row Level Security, grants and SQL functions are all exercised
 * exactly as in production.
 */
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export type Role = "authenticated" | "anon" | "service_role";
export type Query = <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>;

export class TestDb {
  private constructor(readonly pg: PGlite) {}

  static async create(): Promise<TestDb> {
    const pg = await PGlite.create();
    await pg.exec(readFileSync(join(ROOT, "tests", "db", "supabase-shim.sql"), "utf8"));
    const dir = join(ROOT, "supabase", "migrations");
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
      try {
        await pg.exec(readFileSync(join(dir, file), "utf8"));
      } catch (err) {
        throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
      }
    }
    return new TestDb(pg);
  }

  /** Runs SQL as the database owner (setup only — bypasses RLS). */
  async sql<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    const res = await this.pg.query<T>(sql, params);
    return res.rows;
  }

  /** Creates an auth user; the profile is created by the migration trigger. */
  async createUser(email: string, firstName = "Prénom", lastName = "Nom"): Promise<string> {
    const [row] = await this.sql<{ id: string }>(
      `insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
      [email, JSON.stringify({ first_name: firstName, last_name: lastName })],
    );
    return row!.id;
  }

  async createAdmin(email = `admin.${uid()}@sanady.test`): Promise<string> {
    const id = await this.createUser(email, "Admin", "SANADY");
    await this.sql(`insert into public.platform_roles (user_id) values ($1)`, [id]);
    return id;
  }

  /**
   * Runs `fn` inside a transaction as the given user and role. Sessions are
   * two-factor verified (aal2) by default; pass "aal1" to simulate a
   * password-only session.
   */
  async as<T>(userId: string | null, fn: (q: Query) => Promise<T>, role: Role = "authenticated", aal: "aal1" | "aal2" = "aal2"): Promise<T> {
    return this.pg.transaction(async (tx: Transaction) => {
      await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId ?? ""]);
      await tx.query(`select set_config('request.jwt.claims', $1, true)`, [
        userId ? JSON.stringify({ sub: userId, role, aal }) : "",
      ]);
      await tx.exec(`set local role ${role}`);
      const q: Query = async (sql, params = []) => (await tx.query(sql, params)).rows as never;
      return fn(q);
    });
  }

  /** Calls a public function as a user and returns its single scalar value. */
  async rpc<T = unknown>(userId: string | null, fn: string, args: unknown[] = [], role: Role = "authenticated"): Promise<T> {
    const placeholders = args.map((_, i) => `$${i + 1}`).join(", ");
    return this.as(
      userId,
      async (q) => {
        const rows = await q<{ result: T }>(`select public.${fn}(${placeholders}) as result`, args);
        return rows[0]!.result;
      },
      role,
    );
  }

  /** Expects the call to fail with the given application error code. */
  async rpcError(userId: string | null, fn: string, args: unknown[] = [], role: Role = "authenticated"): Promise<string> {
    try {
      await this.rpc(userId, fn, args, role);
    } catch (err) {
      return (err as Error).message;
    }
    throw new Error(`Expected ${fn} to fail, but it succeeded`);
  }

  /** Moves a timestamp column into the past (simulates elapsed time). */
  async ageRows(table: string, column: string, where: string, seconds: number, params: unknown[] = []) {
    await this.sql(
      `update ${table} set ${column} = ${column} - make_interval(secs => ${Number(seconds)}) where ${where}`,
      params,
    );
  }

  async close() {
    await this.pg.close();
  }
}

export function uid() {
  return randomBytes(4).toString("hex");
}

export function newToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: createHash("sha256").update(token).digest("hex") };
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

export interface CourseSpec {
  modules: Array<{
    lessons: Array<{ kind: "video" | "pdf"; mandatory?: boolean; duration?: number; pages?: number }>;
    questions: Array<{ kind: "single" | "multiple"; points?: number; options: boolean[] }>;
  }>;
}

export interface BuiltCourse {
  courseId: string;
  modules: Array<{
    moduleId: string;
    quizId: string;
    lessonIds: string[];
    questions: Array<{ id: string; options: Array<{ id: string; correct: boolean }> }>;
  }>;
}

/** Builds (and optionally publishes) a course AS the admin, through RLS. */
export async function buildCourse(
  db: TestDb,
  adminId: string,
  spec: CourseSpec,
  { publish = true, title = `Cours ${uid()}` } = {},
): Promise<BuiltCourse> {
  const built = await db.as(adminId, async (q) => {
    const [cat] = await q<{ id: string }>(
      `insert into public.course_categories (name) values ($1) returning id`,
      [`Catégorie ${uid()}`],
    );
    const [course] = await q<{ id: string }>(
      `insert into public.courses (title, description, objectives, category_id, estimated_minutes)
       values ($1, $2, $3, $4, 90) returning id`,
      [title, "Une description suffisamment détaillée de la formation.", ["Objectif 1"], cat!.id],
    );
    const out: BuiltCourse = { courseId: course!.id, modules: [] };

    for (const [mi, m] of spec.modules.entries()) {
      const [mod] = await q<{ id: string }>(
        `insert into public.modules (course_id, title, position) values ($1, $2, $3) returning id`,
        [course!.id, `Module ${mi + 1}`, mi],
      );
      const lessonIds: string[] = [];
      for (const [li, l] of m.lessons.entries()) {
        const [lesson] = await q<{ id: string }>(
          l.kind === "video"
            ? `insert into public.lessons (module_id, course_id, title, kind, position, is_mandatory,
                 video_provider, video_ref, video_duration_seconds)
               values ($1, $1, $2, 'video', $3, $4, 'storage', 'x/y.mp4', $5) returning id`
            : `insert into public.lessons (module_id, course_id, title, kind, position, is_mandatory,
                 pdf_path, pdf_page_count)
               values ($1, $1, $2, 'pdf', $3, $4, 'x/y.pdf', $5) returning id`,
          [mod!.id, `Leçon ${li + 1}`, li, l.mandatory ?? true, l.kind === "video" ? (l.duration ?? 300) : (l.pages ?? 4)],
        );
        lessonIds.push(lesson!.id);
      }
      const [quiz] = await q<{ id: string }>(
        `insert into public.quizzes (module_id, course_id, title) values ($1, $1, $2) returning id`,
        [mod!.id, `Évaluation ${mi + 1}`],
      );
      const questions: BuiltCourse["modules"][number]["questions"] = [];
      for (const [qi, question] of m.questions.entries()) {
        const options = question.options.map((correct, oi) => ({ label: `Option ${oi + 1}`, is_correct: correct }));
        const [saved] = await q<{ id: string }>(
          `select public.save_question($1, null, $2, $3, $4, $5::smallint, $6::jsonb) as id`,
          [quiz!.id, question.kind, `Question ${qi + 1} ?`, "Explication.", question.points ?? 1, JSON.stringify(options)],
        );
        const opts = await q<{ id: string; is_correct: boolean }>(
          `select id, is_correct from public.question_options where question_id = $1 order by position`,
          [saved!.id],
        );
        questions.push({ id: saved!.id, options: opts.map((o) => ({ id: o.id, correct: o.is_correct })) });
      }
      out.modules.push({ moduleId: mod!.id, quizId: quiz!.id, lessonIds, questions });
    }

    if (publish) {
      await q(`update public.courses set status = 'published' where id = $1`, [course!.id]);
    }
    return out;
  });
  return built;
}

/** Builds the answer payload; `correct` chooses right or wrong answers. */
export function answersFor(
  questions: BuiltCourse["modules"][number]["questions"],
  correctMask: boolean[],
): Record<string, string[]> {
  const answers: Record<string, string[]> = {};
  questions.forEach((question, i) => {
    const right = question.options.filter((o) => o.correct).map((o) => o.id);
    const wrong = question.options.filter((o) => !o.correct).map((o) => o.id).slice(0, 1);
    answers[question.id] = correctMask[i] ? right : wrong;
  });
  return answers;
}

/** Completes every lesson of a module by simulating realistic elapsed time. */
export async function completeLessons(db: TestDb, userId: string, lessonIds: string[]) {
  for (const lessonId of lessonIds) {
    const [lesson] = await db.sql<{ kind: string; pdf_page_count: number | null }>(
      `select kind, pdf_page_count from public.lessons where id = $1`,
      [lessonId],
    );
    await db.rpc(userId, "start_lesson", [lessonId]);
    if (lesson!.kind === "video") {
      await db.ageRows("public.video_progress", "updated_at", "user_id = $1 and lesson_id = $2", 3600, [userId, lessonId]);
      await db.sql(
        `insert into public.video_progress (user_id, lesson_id, updated_at) values ($1, $2, now() - interval '1 hour')
         on conflict do nothing`,
        [userId, lessonId],
      );
      // Elapsed is capped at 120 s per call; send coverage in plausible chunks.
      for (let start = 0; start < 100; start += 25) {
        await db.ageRows("public.video_progress", "updated_at", "user_id = $1 and lesson_id = $2", 3600, [userId, lessonId]);
        const buckets = Array.from({ length: 25 }, (_, i) => start + i);
        await db.rpc(userId, "record_video_progress", [lessonId, buckets, start * 3, 300]);
      }
    } else {
      const pages = Array.from({ length: lesson!.pdf_page_count! }, (_, i) => i + 1);
      await db.sql(
        `insert into public.document_progress (user_id, lesson_id, page_count, updated_at)
         values ($1, $2, $3, now() - interval '1 hour') on conflict do nothing`,
        [userId, lessonId, lesson!.pdf_page_count],
      );
      await db.ageRows("public.document_progress", "updated_at", "user_id = $1 and lesson_id = $2", 3600, [userId, lessonId]);
      await db.rpc(userId, "record_document_progress", [lessonId, pages, pages.length]);
    }
  }
}
