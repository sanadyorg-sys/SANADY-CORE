import "server-only";
import { messageFor } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import type { Lesson, LessonResource, LessonState } from "@/lib/types";
import type { LessonMedia } from "@/components/learning/lesson-experience";
import { signedMediaUrl, videoSource } from "@/server/media";
import { getCourseOutline, type CourseOutline } from "./learning";

export interface NavTarget {
  href: string;
  label: string;
  kind: "lesson" | "quiz";
}

export interface PlayerData {
  lesson: Lesson;
  moduleTitle: string;
  media: LessonMedia;
  state: LessonState;
  resources: Array<LessonResource & { url: string | null }>;
  outline: CourseOutline;
  previous: NavTarget | null;
  next: NavTarget | null;
  threshold: number;
}

const EMPTY_STATE: LessonState = { status: "in_progress", progress_ratio: 0, resume_position: 0, watched_buckets: [], pages_viewed: [] };

/**
 * Everything the course player needs. In learner mode the lesson is
 * "started" (recorded once) and resume state is loaded. In preview mode
 * (SANADY administrators) nothing is recorded.
 */
export async function getPlayerData(
  courseId: string,
  lessonId: string,
  viewerId: string,
  { preview = false, basePath }: { preview?: boolean; basePath: string },
): Promise<PlayerData | { error: string } | null> {
  const supabase = await createClient();
  const { data: lessonRow } = await supabase
    .from("lessons")
    .select("*, module:modules(title)")
    .eq("id", lessonId)
    .eq("course_id", courseId)
    .maybeSingle();
  const lesson = lessonRow as (Lesson & { module: { title: string } | null }) | null;
  if (!lesson || lesson.archived_at) return null;

  let state = EMPTY_STATE;
  if (!preview) {
    const { data, error } = await supabase.rpc("start_lesson", { p_lesson: lessonId });
    if (error) return { error: messageFor(error.message) };
    state = data as LessonState;
  }

  const [outline, resourcesRes, media] = await Promise.all([
    getCourseOutline(courseId, viewerId),
    supabase.from("lesson_resources").select("*").eq("lesson_id", lessonId).order("position"),
    resolveMedia(lesson),
  ]);
  if (!outline) return null;

  const resources = await Promise.all(
    ((resourcesRes.data ?? []) as LessonResource[]).map(async (r) => ({
      ...r,
      url: await signedMediaUrl(r.file_path, 600, r.file_path.split("/").pop() ?? true),
    })),
  );

  // Linear sequence: each module's lessons, then its quiz.
  const sequence: NavTarget[] = outline.modules.flatMap((m) => [
    ...m.lessons.map((l) => ({ href: `${basePath}/lecons/${l.id}`, label: l.title, kind: "lesson" as const })),
    ...(m.quiz && !preview
      ? [{ href: `${basePath}/evaluations/${m.quiz.id}`, label: `Évaluation — ${m.title}`, kind: "quiz" as const }]
      : []),
  ]);
  const index = sequence.findIndex((s) => s.href.endsWith(`/lecons/${lessonId}`));

  return {
    lesson,
    moduleTitle: lesson.module?.title ?? "",
    media,
    state,
    resources,
    outline,
    previous: index > 0 ? sequence[index - 1]! : null,
    next: index >= 0 && index < sequence.length - 1 ? sequence[index + 1]! : null,
    threshold: Number(lesson.completion_threshold ?? (lesson.kind === "video" ? 0.9 : 1)),
  };
}

async function resolveMedia(lesson: Lesson): Promise<LessonMedia> {
  if (lesson.kind === "video") {
    const source = await videoSource(lesson);
    if (source.type === "unavailable") {
      return {
        kind: "unavailable",
        message:
          source.reason === "not_configured"
            ? "La diffusion vidéo sécurisée n’est pas configurée sur ce serveur. Contactez l’administration SANADY."
            : "La vidéo de cette leçon n’est pas encore disponible.",
      };
    }
    return { kind: "video", source };
  }
  if (!lesson.pdf_path || !lesson.pdf_page_count) {
    return { kind: "unavailable", message: "Le document de cette leçon n’est pas encore disponible." };
  }
  const url = await signedMediaUrl(lesson.pdf_path, 3600);
  return url
    ? { kind: "pdf", url, pageCount: lesson.pdf_page_count }
    : { kind: "unavailable", message: "Le document n’a pas pu être chargé. Veuillez réessayer." };
}
