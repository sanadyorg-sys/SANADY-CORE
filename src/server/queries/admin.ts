import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  Certificate,
  Course,
  CourseCategory,
  EnrollmentCode,
  Institution,
  Invitation,
  Lesson,
  LessonResource,
  Module,
  PlatformOverview,
  PlatformSettings,
  Profile,
  Question,
  QuestionOption,
  Quiz,
} from "@/lib/types";

/** Escapes user input for PostgREST `or=(…ilike…)` filters. */
function ilikeTerm(q: string) {
  return `%${q.replace(/[%_,()\\*]/g, " ").trim()}%`;
}

export async function getPlatformOverview() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("platform_overview");
  if (error) throw error;
  return data as PlatformOverview;
}

export async function getSettings() {
  const supabase = await createClient();
  const { data } = await supabase.from("platform_settings").select("*").maybeSingle();
  return data as PlatformSettings;
}

export async function getCategories() {
  const supabase = await createClient();
  const { data } = await supabase.from("course_categories").select("*").order("name");
  return (data ?? []) as CourseCategory[];
}

/* ─── Institutions ─────────────────────────────────────────────────────── */

export interface InstitutionListItem extends Institution {
  teachers: number;
  admins: number;
  authorized_courses: number;
}

export async function listInstitutions({ q, status }: { q?: string; status?: string }) {
  const supabase = await createClient();
  let query = supabase.from("institutions").select("*").order("name");
  if (q) query = query.or(`name.ilike.${ilikeTerm(q)},identifier.ilike.${ilikeTerm(q)},city.ilike.${ilikeTerm(q)}`);
  if (status === "active" || status === "suspended") query = query.eq("status", status);
  const [{ data: institutions }, { data: memberships }, { data: permissions }] = await Promise.all([
    query,
    supabase.from("institution_memberships").select("institution_id, role").eq("status", "active"),
    supabase.from("course_permissions").select("institution_id").not("institution_id", "is", null).is("revoked_at", null),
  ]);
  const members = (memberships ?? []) as Array<{ institution_id: string; role: string }>;
  const perms = (permissions ?? []) as Array<{ institution_id: string }>;
  return ((institutions ?? []) as Institution[]).map((i) => ({
    ...i,
    teachers: members.filter((m) => m.institution_id === i.id && m.role === "teacher").length,
    admins: members.filter((m) => m.institution_id === i.id && m.role === "admin").length,
    authorized_courses: perms.filter((p) => p.institution_id === i.id).length,
  })) as InstitutionListItem[];
}

export interface MemberRow {
  id: string;
  role: "admin" | "teacher";
  source: string;
  created_at: string;
  user: Pick<Profile, "id" | "full_name" | "email" | "status">;
}

export async function getInstitutionDetail(institutionId: string) {
  const supabase = await createClient();
  const [inst, members, perms, invitations, codes, courses] = await Promise.all([
    supabase.from("institutions").select("*").eq("id", institutionId).maybeSingle(),
    supabase
      .from("institution_memberships")
      .select("id, role, source, created_at, user:profiles!institution_memberships_user_id_fkey(id, full_name, email, status)")
      .eq("institution_id", institutionId)
      .eq("status", "active")
      .order("created_at"),
    supabase
      .from("course_permissions")
      .select("id, granted_at, course:courses(id, title, status)")
      .eq("institution_id", institutionId)
      .is("revoked_at", null),
    supabase
      .from("invitations")
      .select("id, kind, email, institution_id, enrollment_code_id, invited_by, expires_at, email_sent_at, accepted_at, revoked_at, created_at")
      .eq("institution_id", institutionId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("enrollment_codes").select("*").eq("institution_id", institutionId).order("created_at", { ascending: false }),
    supabase.from("courses").select("id, title, status").neq("status", "archived").order("title"),
  ]);
  if (!inst.data) return null;
  return {
    institution: inst.data as Institution,
    members: (members.data ?? []) as unknown as MemberRow[],
    permissions: (perms.data ?? []) as unknown as Array<{ id: string; granted_at: string; course: { id: string; title: string; status: string } }>,
    invitations: (invitations.data ?? []) as Invitation[],
    codes: (codes.data ?? []) as EnrollmentCode[],
    allCourses: (courses.data ?? []) as Array<{ id: string; title: string; status: string }>,
  };
}

/* ─── People ───────────────────────────────────────────────────────────── */

export interface PersonRow extends Pick<Profile, "id" | "email" | "full_name" | "status" | "created_at" | "job_title"> {
  is_admin: boolean;
  institutions: string[];
}

export async function listPeople({ q, status, page, pageSize }: { q?: string; status?: string; page: number; pageSize: number }) {
  const supabase = await createClient();
  let query = supabase
    .from("profiles")
    .select("id, email, full_name, status, created_at, job_title", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (q) query = query.or(`full_name.ilike.${ilikeTerm(q)},email.ilike.${ilikeTerm(q)}`);
  if (status === "active" || status === "suspended") query = query.eq("status", status);
  const { data, count } = await query;
  const rows = (data ?? []) as PersonRow[];
  const ids = rows.map((r) => r.id);
  const [{ data: roles }, { data: memberships }] = ids.length
    ? await Promise.all([
        supabase.from("platform_roles").select("user_id").in("user_id", ids),
        supabase.from("institution_memberships").select("user_id, institution:institutions(name)").in("user_id", ids).eq("status", "active"),
      ])
    : [{ data: [] }, { data: [] }];
  const adminIds = new Set(((roles ?? []) as Array<{ user_id: string }>).map((r) => r.user_id));
  const memberRows = (memberships ?? []) as unknown as Array<{ user_id: string; institution: { name: string } | null }>;
  return {
    total: count ?? 0,
    rows: rows.map((r) => ({
      ...r,
      is_admin: adminIds.has(r.id),
      institutions: memberRows.filter((m) => m.user_id === r.id && m.institution).map((m) => m.institution!.name),
    })),
  };
}

export async function getPersonDetail(userId: string) {
  const supabase = await createClient();
  const [profile, role, memberships, permissions, courses] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("platform_roles").select("role, granted_at").eq("user_id", userId).maybeSingle(),
    supabase
      .from("institution_memberships")
      .select("id, role, source, created_at, institution:institutions(id, name)")
      .eq("user_id", userId)
      .eq("status", "active"),
    supabase
      .from("course_permissions")
      .select("id, granted_at, course:courses(id, title, status)")
      .eq("user_id", userId)
      .is("revoked_at", null),
    supabase.from("courses").select("id, title, status").eq("status", "published").order("title"),
  ]);
  if (!profile.data) return null;
  return {
    profile: profile.data as Profile,
    isAdmin: Boolean(role.data),
    memberships: (memberships.data ?? []) as unknown as Array<{
      id: string;
      role: "admin" | "teacher";
      source: string;
      created_at: string;
      institution: { id: string; name: string } | null;
    }>,
    permissions: (permissions.data ?? []) as unknown as Array<{ id: string; granted_at: string; course: { id: string; title: string; status: string } }>,
    publishedCourses: (courses.data ?? []) as Array<{ id: string; title: string }>,
  };
}

export async function listAdmins() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("platform_roles")
    .select("granted_at, user:profiles!platform_roles_user_id_fkey(id, full_name, email, status)")
    .order("granted_at");
  return (data ?? []) as unknown as Array<{ granted_at: string; user: Pick<Profile, "id" | "full_name" | "email" | "status"> }>;
}

/* ─── Courses ──────────────────────────────────────────────────────────── */

export interface CourseListItem extends Pick<Course, "id" | "title" | "status" | "updated_at" | "published_at" | "cover_path" | "level"> {
  category: string | null;
  modules: number;
  enrollments: number;
}

export async function listCourses({ q, status }: { q?: string; status?: string }) {
  const supabase = await createClient();
  let query = supabase
    .from("courses")
    .select("id, title, status, updated_at, published_at, cover_path, level, category:course_categories(name)")
    .order("updated_at", { ascending: false });
  if (q) query = query.ilike("title", ilikeTerm(q));
  if (status === "draft" || status === "published" || status === "archived") query = query.eq("status", status);
  const [{ data: courses }, { data: modules }, { data: enrollments }] = await Promise.all([
    query,
    supabase.from("modules").select("course_id").is("archived_at", null),
    supabase.from("enrollments").select("course_id"),
  ]);
  const mods = (modules ?? []) as Array<{ course_id: string }>;
  const enr = (enrollments ?? []) as Array<{ course_id: string }>;
  type Row = Omit<CourseListItem, "category" | "modules" | "enrollments"> & { category: { name: string } | null };
  return ((courses ?? []) as unknown as Row[]).map((c) => ({
    ...c,
    category: c.category?.name ?? null,
    modules: mods.filter((m) => m.course_id === c.id).length,
    enrollments: enr.filter((e) => e.course_id === c.id).length,
  })) as CourseListItem[];
}

export interface EditorModule extends Module {
  lessons: Lesson[];
  quiz: (Quiz & { question_count: number }) | null;
}

export async function getCourseEditorData(courseId: string) {
  const supabase = await createClient();
  const [course, modules, lessons, quizzes, issues, enrollments] = await Promise.all([
    supabase.from("courses").select("*").eq("id", courseId).maybeSingle(),
    supabase.from("modules").select("*").eq("course_id", courseId).is("archived_at", null).order("position"),
    supabase.from("lessons").select("*").eq("course_id", courseId).is("archived_at", null).order("position"),
    supabase.from("quizzes").select("*").eq("course_id", courseId),
    supabase.rpc("validate_course", { p_course: courseId }),
    supabase.from("enrollments").select("status").eq("course_id", courseId),
  ]);
  if (!course.data) return null;
  const quizList = (quizzes.data ?? []) as Quiz[];
  const questions = quizList.length
    ? await supabase
        .from("questions")
        .select("id, quiz_id")
        .in("quiz_id", quizList.map((q) => q.id))
        .is("archived_at", null)
    : { data: [] };
  const questionRows = (questions.data ?? []) as Array<{ quiz_id: string }>;
  const editorModules: EditorModule[] = ((modules.data ?? []) as Module[]).map((m) => {
    const quiz = quizList.find((q) => q.module_id === m.id);
    return {
      ...m,
      lessons: ((lessons.data ?? []) as Lesson[]).filter((l) => l.module_id === m.id),
      quiz: quiz ? { ...quiz, question_count: questionRows.filter((q) => q.quiz_id === quiz.id).length } : null,
    };
  });
  const enr = (enrollments.data ?? []) as Array<{ status: string }>;
  return {
    course: course.data as Course,
    modules: editorModules,
    issues: (issues.data ?? []) as Array<{ code: string; label?: string; module_id?: string; lesson_id?: string; question_id?: string }>,
    stats: { enrollments: enr.length, completed: enr.filter((e) => e.status === "completed").length },
  };
}

export async function getLessonEditorData(lessonId: string) {
  const supabase = await createClient();
  const [lesson, resources] = await Promise.all([
    supabase.from("lessons").select("*, module:modules(id, title)").eq("id", lessonId).maybeSingle(),
    supabase.from("lesson_resources").select("*").eq("lesson_id", lessonId).order("position"),
  ]);
  if (!lesson.data) return null;
  return {
    lesson: lesson.data as Lesson & { module: { id: string; title: string } | null },
    resources: (resources.data ?? []) as LessonResource[],
  };
}

export interface EditorQuestion extends Question {
  options: QuestionOption[];
}

export async function getQuizEditorData(quizId: string) {
  const supabase = await createClient();
  const [quiz, questions] = await Promise.all([
    supabase.from("quizzes").select("*, module:modules(id, title)").eq("id", quizId).maybeSingle(),
    supabase
      .from("questions")
      .select("*, options:question_options(*)")
      .eq("quiz_id", quizId)
      .is("archived_at", null)
      .order("position"),
  ]);
  if (!quiz.data) return null;
  return {
    quiz: quiz.data as Quiz & { module: { id: string; title: string } | null },
    questions: ((questions.data ?? []) as EditorQuestion[]).map((q) => ({
      ...q,
      options: [...q.options].sort((a, b) => a.position - b.position),
    })),
  };
}

/* ─── Supervision ──────────────────────────────────────────────────────── */

export interface ExhaustedAttemptRow {
  quiz_id: string;
  quiz_title: string;
  course_id: string;
  course_title: string;
  user_id: string;
  full_name: string;
  email: string;
  attempts: number;
  best_score: number | null;
  last_attempt: string;
}

export async function getExhaustedAttempts() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("exhausted_attempts");
  if (error) throw error;
  return (data ?? []) as ExhaustedAttemptRow[];
}

export async function listCertificates({ q, page, pageSize }: { q?: string; page: number; pageSize: number }) {
  const supabase = await createClient();
  let query = supabase
    .from("certificates")
    .select("*", { count: "exact" })
    .order("issued_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (q) query = query.or(`certificate_number.ilike.${ilikeTerm(q)},recipient_name.ilike.${ilikeTerm(q)},course_title.ilike.${ilikeTerm(q)}`);
  const { data, count } = await query;
  return { rows: (data ?? []) as Certificate[], total: count ?? 0 };
}

export interface AuditRow {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  institution_id: string | null;
  details: { label?: string; changed?: string[]; reason?: string; learner_id?: string; voided_attempts?: number };
  created_at: string;
  actor: Pick<Profile, "id" | "full_name" | "email"> | null;
}

export async function listAuditLogs({ entity, page, pageSize }: { entity?: string; page: number; pageSize: number }) {
  const supabase = await createClient();
  let query = supabase
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, institution_id, details, created_at, actor:profiles(id, full_name, email)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (entity) query = query.eq("entity_type", entity);
  const { data, count } = await query;
  return { rows: (data ?? []) as unknown as AuditRow[], total: count ?? 0 };
}
