import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  Course,
  EnrollmentCode,
  Institution,
  InstitutionOverview,
  Invitation,
  Profile,
  TeacherSummary,
} from "@/lib/types";
import type { ReportCourse, TeacherReportData } from "@/lib/pdf/report";
import { getCourseOutline } from "./learning";

/*
 * Every query below runs with the institution administrator's session.
 * Row Level Security restricts results to this institution's members and
 * to courses the institution itself assigned.
 */

export async function getInstitution(institutionId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("institutions").select("*").eq("id", institutionId).maybeSingle();
  return data as Institution | null;
}

export async function getInstitutionOverview(institutionId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("institution_overview", { p_institution: institutionId });
  if (error) throw error;
  return data as InstitutionOverview;
}

export async function getTeacherSummaries(institutionId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("institution_teacher_summaries", { p_institution: institutionId });
  if (error) throw error;
  return (data ?? []) as TeacherSummary[];
}

export interface InvitationRow extends Invitation {
  enrollment_code: { code: string } | null;
}

export async function getInstitutionInvitations(institutionId: string, { openOnly = false } = {}) {
  const supabase = await createClient();
  let query = supabase
    .from("invitations")
    .select("id, kind, email, institution_id, enrollment_code_id, invited_by, expires_at, email_sent_at, accepted_at, revoked_at, created_at")
    .eq("institution_id", institutionId)
    .eq("kind", "institution_teacher")
    .order("created_at", { ascending: false })
    .limit(300);
  if (openOnly) query = query.is("accepted_at", null).is("revoked_at", null);
  const { data } = await query;
  return (data ?? []) as Invitation[];
}

export async function getEnrollmentCodes(institutionId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("enrollment_codes")
    .select("*")
    .eq("institution_id", institutionId)
    .order("created_at", { ascending: false });
  return (data ?? []) as EnrollmentCode[];
}

export interface AuthorizedCourse extends Pick<Course, "id" | "title" | "summary" | "cover_path" | "estimated_minutes" | "level" | "status"> {
  category: string | null;
  granted_at: string;
  assigned_count: number;
  completed_count: number;
}

export async function getAuthorizedCourses(institutionId: string): Promise<AuthorizedCourse[]> {
  const supabase = await createClient();
  const [{ data: perms }, { data: assignments }] = await Promise.all([
    supabase
      .from("course_permissions")
      .select("granted_at, course:courses(id, title, summary, cover_path, estimated_minutes, level, status, category:course_categories(name))")
      .eq("institution_id", institutionId)
      .is("revoked_at", null),
    supabase
      .from("course_assignments")
      .select("course_id, user_id")
      .eq("institution_id", institutionId)
      .is("revoked_at", null),
  ]);

  const assigned = (assignments ?? []) as Array<{ course_id: string; user_id: string }>;
  const courseIds = [...new Set(assigned.map((a) => a.course_id))];
  const { data: enrollments } = courseIds.length
    ? await supabase.from("enrollments").select("course_id, user_id, status").in("course_id", courseIds)
    : { data: [] };
  const completedKeys = new Set(
    ((enrollments ?? []) as Array<{ course_id: string; user_id: string; status: string }>)
      .filter((e) => e.status === "completed")
      .map((e) => `${e.course_id}:${e.user_id}`),
  );

  type PermRow = {
    granted_at: string;
    course: (Omit<AuthorizedCourse, "category" | "granted_at" | "assigned_count" | "completed_count"> & { category: { name: string } | null }) | null;
  };
  return ((perms ?? []) as unknown as PermRow[])
    .filter((p) => p.course && p.course.status === "published")
    .map((p) => {
      const forCourse = assigned.filter((a) => a.course_id === p.course!.id);
      return {
        ...p.course!,
        category: p.course!.category?.name ?? null,
        granted_at: p.granted_at,
        assigned_count: forCourse.length,
        completed_count: forCourse.filter((a) => completedKeys.has(`${a.course_id}:${a.user_id}`)).length,
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title, "fr"));
}

export interface AssignmentRow {
  id: string;
  user_id: string;
  course_id: string;
  assigned_at: string;
  due_on: string | null;
}

export async function getAssignments(institutionId: string, filter: { courseId?: string; userId?: string } = {}) {
  const supabase = await createClient();
  let query = supabase
    .from("course_assignments")
    .select("id, user_id, course_id, assigned_at, due_on")
    .eq("institution_id", institutionId)
    .is("revoked_at", null);
  if (filter.courseId) query = query.eq("course_id", filter.courseId);
  if (filter.userId) query = query.eq("user_id", filter.userId);
  const { data } = await query.order("assigned_at", { ascending: false });
  return (data ?? []) as AssignmentRow[];
}

/** Builds the assignment-scoped report for one teacher. */
export async function buildTeacherReport(
  institution: { id: string; name: string },
  teacherId: string,
  generatedBy: string,
): Promise<TeacherReportData | null> {
  const supabase = await createClient();
  const [{ data: profile }, { data: membership }, assignments] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", teacherId).maybeSingle(),
    supabase
      .from("institution_memberships")
      .select("created_at")
      .eq("institution_id", institution.id)
      .eq("user_id", teacherId)
      .eq("status", "active")
      .eq("role", "teacher")
      .maybeSingle(),
    getAssignments(institution.id, { userId: teacherId }),
  ]);
  const teacher = profile as Profile | null;
  if (!teacher || !membership) return null;

  const courseIds = assignments.map((a) => a.course_id);
  const [{ data: enrollments }, { data: certificates }] = await Promise.all([
    courseIds.length
      ? supabase.from("enrollments").select("course_id, status, started_at, last_activity_at").eq("user_id", teacherId).in("course_id", courseIds)
      : Promise.resolve({ data: [] }),
    courseIds.length
      ? supabase.from("certificates").select("course_id, certificate_number, issued_at, revoked_at").eq("user_id", teacherId).in("course_id", courseIds)
      : Promise.resolve({ data: [] }),
  ]);

  type Enr = { course_id: string; status: string; started_at: string | null; last_activity_at: string | null };
  type Cert = { course_id: string; certificate_number: string; issued_at: string; revoked_at: string | null };

  const courses: ReportCourse[] = [];
  for (const a of assignments) {
    const outline = await getCourseOutline(a.course_id, teacherId);
    if (!outline) continue;
    const enr = ((enrollments ?? []) as Enr[]).find((e) => e.course_id === a.course_id);
    const cert = ((certificates ?? []) as Cert[]).find((c) => c.course_id === a.course_id && !c.revoked_at);
    courses.push({
      title: outline.course.title,
      assignedAt: a.assigned_at,
      dueOn: a.due_on,
      status: enr?.status === "completed" ? "completed" : enr?.started_at ? "in_progress" : "not_started",
      mandatoryLessons: outline.totals.mandatory,
      completedLessons: outline.totals.completed,
      quizzesTotal: outline.totals.quizzes,
      quizzesPassed: outline.totals.quizzesPassed,
      lastActivityAt: enr?.last_activity_at ?? null,
      certificate: cert ? { number: cert.certificate_number, issuedAt: cert.issued_at } : null,
      modules: outline.modules.map((m) => ({
        title: m.title,
        lessonsCompleted: m.lessons.filter((l) => l.is_mandatory && l.status === "completed").length,
        lessonsTotal: m.lessons.filter((l) => l.is_mandatory).length,
        quiz: m.quiz
          ? { attempts: m.quiz.attempts_used, maxAttempts: m.quiz.max_attempts, bestScore: m.quiz.best_score, passed: m.quiz.passed }
          : null,
      })),
    });
  }

  return {
    institutionName: institution.name,
    generatedAt: new Date().toISOString(),
    generatedBy,
    teacher: {
      name: teacher.full_name || teacher.email,
      email: teacher.email,
      jobTitle: teacher.job_title,
      joinedAt: (membership as { created_at: string }).created_at,
    },
    courses,
  };
}
