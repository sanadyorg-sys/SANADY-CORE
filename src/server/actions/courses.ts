"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PDFDocument } from "pdf-lib";
import { z } from "zod";
import { PUBLICATION_ISSUES, errorMessage, messageFor } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ActionState, CourseStatus } from "@/lib/types";
import { optionalText, parseInput, uuidSchema } from "@/lib/validation";
import { requireSanadyAdmin } from "@/server/auth";
import { MEDIA_BUCKET } from "@/server/media";

/*
 * All writes run with the administrator's session: RLS (is_sanady_admin)
 * is the final authority; requireSanadyAdmin() gives a clean early exit.
 */

const coursePath = (id: string) => `/admin/formations/${id}`;
const revalidateCourse = (id: string) => {
  revalidatePath(coursePath(id), "layout");
  revalidatePath("/admin/formations");
};

/* ─── Courses ──────────────────────────────────────────────────────────── */

export async function createCourse(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSanadyAdmin();
  const parsed = parseInput(
    z.object({
      title: z.string().trim().min(3, "Le titre doit comporter au moins 3 caractères.").max(200),
      category_id: z.union([uuidSchema, z.literal("")]).optional(),
    }),
    formData,
  );
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courses")
    .insert({ title: parsed.data.title, category_id: parsed.data.category_id || null })
    .select("id")
    .single();
  if (error) return { ok: false, message: errorMessage(error) };
  redirect(coursePath((data as { id: string }).id));
}

export async function updateCourse(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSanadyAdmin();
  const parsed = parseInput(
    z.object({
      id: uuidSchema,
      title: z.string().trim().min(3, "Le titre doit comporter au moins 3 caractères.").max(200),
      summary: z.string().trim().max(400, "400 caractères maximum."),
      description: z.string().trim().max(20000),
      objectives: z.string().max(5000),
      category_id: z.union([uuidSchema, z.literal("")]),
      level: z.enum(["debutant", "intermediaire", "avance"]),
      target_audience: z.string().trim().max(300),
      estimated_minutes: z.union([z.coerce.number().int().min(1, "Durée invalide.").max(100000), z.literal("")]),
    }),
    formData,
  );
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const d = parsed.data;
  const objectives = d.objectives
    .split("\n")
    .map((o) => o.trim())
    .filter(Boolean)
    .slice(0, 20);

  const supabase = await createClient();
  const { error } = await supabase
    .from("courses")
    .update({
      title: d.title,
      summary: d.summary,
      description: d.description,
      objectives,
      category_id: d.category_id || null,
      level: d.level,
      target_audience: d.target_audience,
      estimated_minutes: d.estimated_minutes === "" ? null : d.estimated_minutes,
    })
    .eq("id", d.id);
  if (error) return { ok: false, message: errorMessage(error) };
  revalidateCourse(d.id);
  return { ok: true, message: "Informations enregistrées." };
}

export async function setCourseCover(courseId: string, path: string | null): Promise<ActionState> {
  await requireSanadyAdmin();
  const supabase = await createClient();
  const { data: before } = await supabase.from("courses").select("cover_path").eq("id", courseId).maybeSingle();
  const { error } = await supabase.from("courses").update({ cover_path: path }).eq("id", courseId);
  if (error) return { ok: false, message: errorMessage(error) };
  const previous = (before as { cover_path: string | null } | null)?.cover_path;
  if (previous && previous !== path) await supabase.storage.from("course-covers").remove([previous]);
  revalidateCourse(courseId);
  return { ok: true, message: path ? "Image de couverture mise à jour." : "Image de couverture retirée." };
}

export type PublishResult = ActionState & { issues?: Array<{ message: string; label?: string }> };

export async function setCourseStatus(courseId: string, status: CourseStatus): Promise<PublishResult> {
  await requireSanadyAdmin();
  const supabase = await createClient();

  if (status === "published") {
    const { data: issues } = await supabase.rpc("validate_course", { p_course: courseId });
    const list = (issues ?? []) as Array<{ code: string; label?: string }>;
    if (list.length) {
      return {
        ok: false,
        message: messageFor("course_not_publishable"),
        issues: list.map((i) => ({ message: PUBLICATION_ISSUES[i.code] ?? i.code, label: i.label })),
      };
    }
  }

  const { error } = await supabase.from("courses").update({ status }).eq("id", courseId);
  if (error) return { ok: false, message: errorMessage(error) };
  revalidateCourse(courseId);
  const messages: Record<CourseStatus, string> = {
    published: "Formation publiée.",
    draft: "Formation repassée en brouillon : les enseignants n’y ont plus accès.",
    archived: "Formation archivée.",
  };
  return { ok: true, message: messages[status] };
}

export async function deleteCourse(courseId: string): Promise<ActionState> {
  await requireSanadyAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.from("courses").delete().eq("id", courseId).eq("status", "draft").select("id");
  if (error) {
    return {
      ok: false,
      message:
        error.code === "23503"
          ? "Des enseignants sont inscrits à cette formation : archivez-la plutôt que de la supprimer."
          : errorMessage(error),
    };
  }
  if (!data?.length) return { ok: false, message: "Seule une formation en brouillon peut être supprimée." };
  revalidatePath("/admin/formations");
  redirect("/admin/formations");
}

/* ─── Modules ──────────────────────────────────────────────────────────── */

export async function createModule(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSanadyAdmin();
  const parsed = parseInput(
    z.object({ course_id: uuidSchema, title: z.string().trim().min(2, "Titre trop court.").max(200) }),
    formData,
  );
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const { course_id, title } = parsed.data;

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("modules")
    .select("position")
    .eq("course_id", course_id)
    .is("archived_at", null)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = ((last as { position: number } | null)?.position ?? -1) + 1;

  const { data: mod, error } = await supabase
    .from("modules")
    .insert({ course_id, title, position })
    .select("id")
    .single();
  if (error) return { ok: false, message: errorMessage(error) };

  // Every module carries its mandatory assessment.
  const moduleId = (mod as { id: string }).id;
  const { error: quizError } = await supabase
    .from("quizzes")
    .insert({ module_id: moduleId, course_id, title: `Évaluation — ${title}` });
  if (quizError) return { ok: false, message: errorMessage(quizError) };

  revalidateCourse(course_id);
  return { ok: true, message: "Module ajouté avec son évaluation." };
}

export async function updateModule(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSanadyAdmin();
  const parsed = parseInput(
    z.object({
      id: uuidSchema,
      course_id: uuidSchema,
      title: z.string().trim().min(2, "Titre trop court.").max(200),
      description: z.string().trim().max(4000),
    }),
    formData,
  );
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const supabase = await createClient();
  const { error } = await supabase
    .from("modules")
    .update({ title: parsed.data.title, description: parsed.data.description })
    .eq("id", parsed.data.id);
  if (error) return { ok: false, message: errorMessage(error) };
  revalidateCourse(parsed.data.course_id);
  return { ok: true, message: "Module enregistré." };
}

export async function reorderModules(courseId: string, ids: string[]): Promise<ActionState> {
  await requireSanadyAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("reorder_modules", { p_course: courseId, p_ids: ids });
  if (error) return { ok: false, message: errorMessage(error) };
  revalidateCourse(courseId);
  return { ok: true };
}

export async function removeModule(moduleId: string, courseId: string): Promise<ActionState> {
  await requireSanadyAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("remove_module", { p_module: moduleId });
  if (error) return { ok: false, message: errorMessage(error) };
  revalidateCourse(courseId);
  return {
    ok: true,
    message:
      data === "archived"
        ? "Le module contenait des données d’apprenants : il a été archivé (masqué) plutôt que supprimé."
        : "Module supprimé.",
  };
}

/* ─── Lessons ──────────────────────────────────────────────────────────── */

export async function createLesson(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSanadyAdmin();
  const parsed = parseInput(
    z.object({
      course_id: uuidSchema,
      module_id: uuidSchema,
      kind: z.enum(["video", "pdf"]),
      title: z.string().trim().min(2, "Titre trop court.").max(200),
    }),
    formData,
  );
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const { course_id, module_id, kind, title } = parsed.data;

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("lessons")
    .select("position")
    .eq("module_id", module_id)
    .is("archived_at", null)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await supabase
    .from("lessons")
    .insert({
      module_id,
      course_id,
      kind,
      title,
      position: ((last as { position: number } | null)?.position ?? -1) + 1,
    })
    .select("id")
    .single();
  if (error) return { ok: false, message: errorMessage(error) };
  revalidateCourse(course_id);
  redirect(`${coursePath(course_id)}/programme/lecons/${(data as { id: string }).id}`);
}

export async function updateLesson(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSanadyAdmin();
  const parsed = parseInput(
    z.object({
      id: uuidSchema,
      course_id: uuidSchema,
      title: z.string().trim().min(2, "Titre trop court.").max(200),
      description: z.string().trim().max(10000),
      estimated_minutes: z.union([z.coerce.number().int().min(1).max(1440), z.literal("")]),
      is_mandatory: z.union([z.literal("on"), z.undefined(), z.null()]),
      completion_threshold: z.union([z.coerce.number().int().min(50, "Minimum 50 %.").max(100, "Maximum 100 %."), z.literal("")]),
    }),
    formData,
  );
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("lessons")
    .update({
      title: d.title,
      description: d.description,
      estimated_minutes: d.estimated_minutes === "" ? null : d.estimated_minutes,
      is_mandatory: d.is_mandatory === "on",
      completion_threshold: d.completion_threshold === "" ? null : d.completion_threshold / 100,
    })
    .eq("id", d.id);
  if (error) return { ok: false, message: errorMessage(error) };
  revalidateCourse(d.course_id);
  return { ok: true, message: "Leçon enregistrée." };
}

export async function reorderLessons(moduleId: string, courseId: string, ids: string[]): Promise<ActionState> {
  await requireSanadyAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("reorder_lessons", { p_module: moduleId, p_ids: ids });
  if (error) return { ok: false, message: errorMessage(error) };
  revalidateCourse(courseId);
  return { ok: true };
}

export async function removeLesson(lessonId: string, courseId: string): Promise<ActionState> {
  await requireSanadyAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("remove_lesson", { p_lesson: lessonId });
  if (error) return { ok: false, message: errorMessage(error) };
  revalidateCourse(courseId);
  return {
    ok: true,
    message:
      data === "archived"
        ? "Des enseignants avaient commencé cette leçon : elle a été archivée (masquée) et leur historique est conservé."
        : "Leçon supprimée.",
  };
}

const storagePath = z.string().min(3).max(500).regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[^/]+(\/[^/]+)?$/, "Chemin invalide.");

/** Attaches an uploaded (or Mux) video to a lesson. */
export async function setLessonVideo(input: {
  lessonId: string;
  courseId: string;
  provider: "storage" | "mux";
  ref: string;
  durationSeconds: number | null;
}): Promise<ActionState> {
  await requireSanadyAdmin();
  const parsed = z
    .object({
      lessonId: uuidSchema,
      courseId: uuidSchema,
      provider: z.enum(["storage", "mux"]),
      ref: z.string().trim().min(3).max(500),
      durationSeconds: z.number().int().positive().max(24 * 3600).nullable(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: "Données de la vidéo invalides." };
  const v = parsed.data;
  if (v.provider === "storage" && !storagePath.safeParse(v.ref).success) return { ok: false, message: "Chemin de fichier invalide." };
  if (v.provider === "mux" && !/^[A-Za-z0-9]{10,100}$/.test(v.ref)) return { ok: false, message: "Identifiant de lecture Mux invalide." };

  const supabase = await createClient();
  const { data: before } = await supabase.from("lessons").select("video_provider, video_ref").eq("id", v.lessonId).maybeSingle();
  const { error } = await supabase
    .from("lessons")
    .update({ video_provider: v.provider, video_ref: v.ref, video_duration_seconds: v.durationSeconds })
    .eq("id", v.lessonId)
    .eq("kind", "video");
  if (error) return { ok: false, message: errorMessage(error) };

  const prev = before as { video_provider: string | null; video_ref: string | null } | null;
  if (prev?.video_provider === "storage" && prev.video_ref && prev.video_ref !== v.ref) {
    await supabase.storage.from(MEDIA_BUCKET).remove([prev.video_ref]);
  }
  revalidateCourse(v.courseId);
  return { ok: true, message: "Vidéo associée à la leçon." };
}

/** Attaches an uploaded PDF; the page count is measured on the server. */
export async function setLessonPdf(lessonId: string, courseId: string, path: string): Promise<ActionState> {
  await requireSanadyAdmin();
  if (!uuidSchema.safeParse(lessonId).success || !storagePath.safeParse(path).success) {
    return { ok: false, message: "Données du document invalides." };
  }
  const admin = createAdminClient();
  const { data: file, error: downloadError } = await admin.storage.from(MEDIA_BUCKET).download(path);
  if (downloadError || !file) return { ok: false, message: "Le document téléversé est introuvable." };

  let pageCount: number;
  try {
    const pdf = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true, updateMetadata: false });
    pageCount = pdf.getPageCount();
  } catch {
    await admin.storage.from(MEDIA_BUCKET).remove([path]);
    return { ok: false, message: "Ce fichier n’est pas un PDF lisible. Vérifiez qu’il n’est pas protégé par mot de passe." };
  }

  const supabase = await createClient();
  const { data: before } = await supabase.from("lessons").select("pdf_path").eq("id", lessonId).maybeSingle();
  const { error } = await supabase
    .from("lessons")
    .update({ pdf_path: path, pdf_page_count: pageCount })
    .eq("id", lessonId)
    .eq("kind", "pdf");
  if (error) return { ok: false, message: errorMessage(error) };
  const prev = (before as { pdf_path: string | null } | null)?.pdf_path;
  if (prev && prev !== path) await supabase.storage.from(MEDIA_BUCKET).remove([prev]);

  revalidateCourse(courseId);
  return { ok: true, message: `Document associé (${pageCount} page${pageCount > 1 ? "s" : ""}).` };
}

export async function addLessonResource(input: {
  lessonId: string;
  courseId: string;
  title: string;
  path: string;
  sizeBytes: number;
}): Promise<ActionState> {
  await requireSanadyAdmin();
  const parsed = z
    .object({
      lessonId: uuidSchema,
      courseId: uuidSchema,
      title: z.string().trim().min(2).max(200),
      path: storagePath,
      sizeBytes: z.number().int().nonnegative(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: "Données de la ressource invalides." };
  const supabase = await createClient();
  const { error } = await supabase.from("lesson_resources").insert({
    lesson_id: parsed.data.lessonId,
    title: parsed.data.title,
    file_path: parsed.data.path,
    size_bytes: parsed.data.sizeBytes,
  });
  if (error) return { ok: false, message: errorMessage(error) };
  revalidateCourse(parsed.data.courseId);
  return { ok: true, message: "Ressource ajoutée." };
}

export async function removeLessonResource(resourceId: string, courseId: string): Promise<ActionState> {
  await requireSanadyAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.from("lesson_resources").delete().eq("id", resourceId).select("file_path");
  if (error) return { ok: false, message: errorMessage(error) };
  const path = (data as Array<{ file_path: string }> | null)?.[0]?.file_path;
  if (path) await supabase.storage.from(MEDIA_BUCKET).remove([path]);
  revalidateCourse(courseId);
  return { ok: true, message: "Ressource supprimée." };
}

/* ─── Quizzes ──────────────────────────────────────────────────────────── */

export async function updateQuiz(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSanadyAdmin();
  const parsed = parseInput(
    z.object({
      id: uuidSchema,
      course_id: uuidSchema,
      title: z.string().trim().min(2, "Titre trop court.").max(200),
      instructions: z.string().trim().max(4000),
    }),
    formData,
  );
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const supabase = await createClient();
  const { error } = await supabase
    .from("quizzes")
    .update({ title: parsed.data.title, instructions: parsed.data.instructions })
    .eq("id", parsed.data.id);
  if (error) return { ok: false, message: errorMessage(error) };
  revalidateCourse(parsed.data.course_id);
  return { ok: true, message: "Évaluation enregistrée." };
}

export interface QuestionInput {
  quizId: string;
  courseId: string;
  questionId: string | null;
  kind: "single" | "multiple";
  prompt: string;
  explanation: string;
  points: number;
  options: Array<{ id: string | null; label: string; is_correct: boolean }>;
}

export async function saveQuestion(input: QuestionInput): Promise<ActionState> {
  await requireSanadyAdmin();
  const parsed = z
    .object({
      quizId: uuidSchema,
      courseId: uuidSchema,
      questionId: uuidSchema.nullable(),
      kind: z.enum(["single", "multiple"]),
      prompt: z.string().trim().min(3, "L’énoncé doit comporter au moins 3 caractères.").max(2000),
      explanation: z.string().trim().max(4000),
      points: z.number().int().min(1, "1 point minimum.").max(100),
      options: z
        .array(z.object({ id: uuidSchema.nullable(), label: z.string().trim().min(1, "Chaque réponse doit avoir un libellé.").max(500), is_correct: z.boolean() }))
        .min(2, "Ajoutez au moins deux réponses.")
        .max(10, "10 réponses maximum."),
    })
    .safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, message: issue?.message ?? "Question invalide." };
  }
  const q = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_question", {
    p_quiz: q.quizId,
    p_question: q.questionId,
    p_kind: q.kind,
    p_prompt: q.prompt,
    p_explanation: q.explanation,
    p_points: q.points,
    p_options: q.options,
  });
  if (error) return { ok: false, message: errorMessage(error) };
  revalidateCourse(q.courseId);
  return { ok: true, message: q.questionId ? "Question mise à jour." : "Question ajoutée." };
}

export async function removeQuestion(questionId: string, courseId: string): Promise<ActionState> {
  await requireSanadyAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("remove_question", { p_question: questionId });
  if (error) return { ok: false, message: errorMessage(error) };
  revalidateCourse(courseId);
  return {
    ok: true,
    message:
      data === "archived"
        ? "La question figurait dans des tentatives : elle a été archivée afin de préserver les résultats."
        : "Question supprimée.",
  };
}

export async function reorderQuestions(quizId: string, courseId: string, ids: string[]): Promise<ActionState> {
  await requireSanadyAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("reorder_questions", { p_quiz: quizId, p_ids: ids });
  if (error) return { ok: false, message: errorMessage(error) };
  revalidateCourse(courseId);
  return { ok: true };
}

/* ─── Authorization ────────────────────────────────────────────────────── */

export async function grantCourseToInstitution(courseId: string, institutionId: string): Promise<ActionState> {
  await requireSanadyAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("grant_course_to_institution", { p_course: courseId, p_institution: institutionId });
  if (error) return { ok: false, message: errorMessage(error) };
  revalidateCourse(courseId);
  revalidatePath(`/admin/etablissements/${institutionId}`);
  return { ok: true, message: "Formation autorisée pour l’établissement." };
}

export async function revokeCourseFromInstitution(courseId: string, institutionId: string): Promise<ActionState> {
  await requireSanadyAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_course_from_institution", { p_course: courseId, p_institution: institutionId });
  if (error) return { ok: false, message: errorMessage(error) };
  revalidateCourse(courseId);
  revalidatePath(`/admin/etablissements/${institutionId}`);
  return { ok: true, message: "Autorisation retirée. Les affectations correspondantes ont été retirées." };
}

export async function grantCourseToUser(courseId: string, userId: string): Promise<ActionState> {
  await requireSanadyAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("grant_course_to_user", { p_course: courseId, p_user: userId });
  if (error) return { ok: false, message: errorMessage(error) };
  revalidateCourse(courseId);
  revalidatePath(`/admin/enseignants/${userId}`);
  return { ok: true, message: "Formation attribuée à l’enseignant." };
}

export async function revokeCourseFromUser(courseId: string, userId: string): Promise<ActionState> {
  await requireSanadyAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_course_from_user", { p_course: courseId, p_user: userId });
  if (error) return { ok: false, message: errorMessage(error) };
  revalidateCourse(courseId);
  revalidatePath(`/admin/enseignants/${userId}`);
  return { ok: true, message: "Accès individuel retiré. La progression de l’enseignant est conservée." };
}

/* ─── Categories ───────────────────────────────────────────────────────── */

export async function createCategory(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSanadyAdmin();
  const parsed = parseInput(z.object({ name: z.string().trim().min(2, "Nom trop court.").max(80) }), formData);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const supabase = await createClient();
  const { error } = await supabase.from("course_categories").insert({ name: parsed.data.name });
  if (error) return { ok: false, message: error.code === "23505" ? "Cette catégorie existe déjà." : errorMessage(error) };
  revalidatePath("/admin/parametres");
  return { ok: true, message: "Catégorie ajoutée." };
}

export async function deleteCategory(categoryId: string): Promise<ActionState> {
  await requireSanadyAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("course_categories").delete().eq("id", categoryId);
  if (error) return { ok: false, message: errorMessage(error) };
  revalidatePath("/admin/parametres");
  return { ok: true, message: "Catégorie supprimée. Les formations concernées n’ont plus de catégorie." };
}

export async function updateCategory(categoryId: string, name: string): Promise<ActionState> {
  await requireSanadyAdmin();
  const parsed = optionalText(80).safeParse(name);
  if (!parsed.success || !parsed.data || parsed.data.length < 2) return { ok: false, message: "Nom invalide." };
  const supabase = await createClient();
  const { error } = await supabase.from("course_categories").update({ name: parsed.data }).eq("id", categoryId);
  if (error) return { ok: false, message: error.code === "23505" ? "Cette catégorie existe déjà." : errorMessage(error) };
  revalidatePath("/admin/parametres");
  return { ok: true, message: "Catégorie renommée." };
}
