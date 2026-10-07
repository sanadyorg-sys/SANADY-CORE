import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  Certificate,
  Course,
  CourseLevel,
  CourseStatus,
  EnrollmentStatus,
  LearningEventType,
  Lesson,
  LessonProgress,
  Module,
  Quiz,
} from "@/lib/types";

export interface LearnerCourse {
  course_id: string;
  title: string;
  summary: string;
  cover_path: string | null;
  estimated_minutes: number | null;
  level: CourseLevel;
  category: string | null;
  course_status: CourseStatus;
  has_access: boolean;
  enrollment_status: EnrollmentStatus;
  enrolled_at: string;
  started_at: string | null;
  completed_at: string | null;
  last_activity_at: string | null;
  mandatory_lessons: number;
  completed_lessons: number;
  quizzes_total: number;
  quizzes_passed: number;
  certificate_id: string | null;
  certificate_number: string | null;
  resume_lesson_id: string | null;
}

/** All enrollments of a learner (self by default) with progress measures. */
export async function getLearnerCourses(userId?: string): Promise<LearnerCourse[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("learner_courses", { p_user: userId ?? null });
  if (error) throw error;
  return (data ?? []) as LearnerCourse[];
}

export interface OutlineQuiz {
  id: string;
  title: string;
  pass_threshold: number;
  max_attempts: number;
  attempts_used: number;
  passed: boolean;
  best_score: number | null;
  open_attempt_id: string | null;
  last_attempt_id: string | null;
  unlocked: boolean;
  exhausted: boolean;
}

export interface OutlineLesson extends Pick<Lesson, "id" | "title" | "kind" | "position" | "is_mandatory" | "estimated_minutes" | "video_duration_seconds" | "pdf_page_count"> {
  status: "not_started" | "in_progress" | "completed";
  progress_ratio: number;
}

export interface OutlineModule extends Pick<Module, "id" | "title" | "description" | "position"> {
  lessons: OutlineLesson[];
  quiz: OutlineQuiz | null;
  completed: boolean;
}

export interface CourseOutline {
  course: Course & { category: string | null };
  modules: OutlineModule[];
  totals: { mandatory: number; completed: number; quizzes: number; quizzesPassed: number };
}

/**
 * Curriculum with per-lesson progress and per-quiz status for a learner.
 * Every query runs under RLS as the viewer, so the same function serves the
 * learner, an authorized institution and SANADY admins.
 */
export async function getCourseOutline(courseId: string, userId: string): Promise<CourseOutline | null> {
  const supabase = await createClient();
  const [courseRes, modulesRes, lessonsRes, quizzesRes, progressRes, attemptsRes] = await Promise.all([
    supabase.from("courses").select("*, category:course_categories(name)").eq("id", courseId).maybeSingle(),
    supabase.from("modules").select("id, title, description, position").eq("course_id", courseId).is("archived_at", null).order("position"),
    supabase
      .from("lessons")
      .select("id, module_id, title, kind, position, is_mandatory, estimated_minutes, video_duration_seconds, pdf_page_count")
      .eq("course_id", courseId)
      .is("archived_at", null)
      .order("position"),
    supabase.from("quizzes").select("id, module_id, title, pass_threshold, max_attempts").eq("course_id", courseId),
    supabase.from("lesson_progress").select("lesson_id, status, progress_ratio").eq("course_id", courseId).eq("user_id", userId),
    supabase
      .from("quiz_attempts")
      .select("id, quiz_id, status, passed, score_percent, submitted_at, voided_at")
      .eq("course_id", courseId)
      .eq("user_id", userId)
      .is("voided_at", null)
      .order("started_at", { ascending: true }),
  ]);

  const courseRow = courseRes.data as (Course & { category: { name: string } | null }) | null;
  if (!courseRow) return null;

  const progress = new Map(
    ((progressRes.data ?? []) as Pick<LessonProgress, "lesson_id" | "status" | "progress_ratio">[]).map((p) => [p.lesson_id, p]),
  );
  type AttemptRow = { id: string; quiz_id: string; status: string; passed: boolean | null; score_percent: number | null };
  const attempts = (attemptsRes.data ?? []) as AttemptRow[];
  type LessonRow = OutlineLesson & { module_id: string };
  const lessons = (lessonsRes.data ?? []) as unknown as LessonRow[];
  const quizzes = (quizzesRes.data ?? []) as Pick<Quiz, "id" | "module_id" | "title" | "pass_threshold" | "max_attempts">[];

  let mandatory = 0;
  let completed = 0;
  let quizzesPassed = 0;

  const modules: OutlineModule[] = ((modulesRes.data ?? []) as Pick<Module, "id" | "title" | "description" | "position">[]).map((m) => {
    const moduleLessons: OutlineLesson[] = lessons
      .filter((l) => l.module_id === m.id)
      .map((l) => {
        const p = progress.get(l.id);
        const status = p ? (p.status === "completed" ? "completed" : "in_progress") : "not_started";
        if (l.is_mandatory) {
          mandatory++;
          if (status === "completed") completed++;
        }
        return {
          id: l.id,
          title: l.title,
          kind: l.kind,
          position: l.position,
          is_mandatory: l.is_mandatory,
          estimated_minutes: l.estimated_minutes,
          video_duration_seconds: l.video_duration_seconds,
          pdf_page_count: l.pdf_page_count,
          status,
          progress_ratio: Number(p?.progress_ratio ?? 0),
        } satisfies OutlineLesson;
      });

    const lessonsDone = moduleLessons.filter((l) => l.is_mandatory).every((l) => l.status === "completed");
    const q = quizzes.find((qz) => qz.module_id === m.id);
    let quiz: OutlineQuiz | null = null;
    if (q) {
      const qa = attempts.filter((a) => a.quiz_id === q.id);
      const passed = qa.some((a) => a.passed);
      const submitted = qa.filter((a) => a.status === "submitted");
      const open = qa.find((a) => a.status === "in_progress");
      const scores = submitted.map((a) => Number(a.score_percent ?? 0));
      if (passed) quizzesPassed++;
      quiz = {
        id: q.id,
        title: q.title,
        pass_threshold: q.pass_threshold,
        max_attempts: q.max_attempts,
        attempts_used: qa.length,
        passed,
        best_score: scores.length ? Math.max(...scores) : null,
        open_attempt_id: open?.id ?? null,
        last_attempt_id: submitted.at(-1)?.id ?? null,
        unlocked: lessonsDone,
        exhausted: !passed && !open && qa.length >= q.max_attempts,
      };
    }
    return { ...m, lessons: moduleLessons, quiz, completed: lessonsDone && Boolean(quiz?.passed) };
  });

  return {
    course: { ...courseRow, category: courseRow.category?.name ?? null },
    modules,
    totals: { mandatory, completed, quizzes: quizzes.length, quizzesPassed },
  };
}

export interface ActivityItem {
  id: string;
  event_type: LearningEventType;
  occurred_at: string;
  metadata: Record<string, unknown>;
  course: { id: string; title: string } | null;
  lesson: { title: string } | null;
  quiz: { title: string } | null;
}

export async function getRecentActivity(userId: string, options: { courseId?: string; limit?: number } = {}): Promise<ActivityItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from("learning_events")
    .select("id, event_type, occurred_at, metadata, course:courses(id, title), lesson:lessons(title), quiz:quizzes(title)")
    .eq("user_id", userId)
    .neq("event_type", "video_checkpoint")
    .order("occurred_at", { ascending: false })
    .limit(options.limit ?? 8);
  if (options.courseId) query = query.eq("course_id", options.courseId);
  const { data } = await query;
  return (data ?? []) as unknown as ActivityItem[];
}

export async function getCertificates(userId: string): Promise<Certificate[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("certificates")
    .select("*")
    .eq("user_id", userId)
    .order("issued_at", { ascending: false });
  return (data ?? []) as Certificate[];
}

export interface AttemptListItem {
  id: string;
  attempt_number: number;
  status: "in_progress" | "submitted";
  started_at: string;
  submitted_at: string | null;
  score_percent: number | null;
  passed: boolean | null;
  voided_at: string | null;
  course_id: string;
  quiz_id: string;
  quiz: { title: string; module: { title: string } | null } | null;
  course: { title: string } | null;
}

export async function getAttempts(userId: string, courseId?: string): Promise<AttemptListItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from("quiz_attempts")
    .select(
      "id, attempt_number, status, started_at, submitted_at, score_percent, passed, voided_at, course_id, quiz_id, quiz:quizzes(title, module:modules(title)), course:courses(title)",
    )
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(200);
  if (courseId) query = query.eq("course_id", courseId);
  const { data } = await query;
  return (data ?? []) as unknown as AttemptListItem[];
}
