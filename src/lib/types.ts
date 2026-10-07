/**
 * Domain types mirroring the database schema (supabase/migrations).
 * Keep in sync with migrations; when the Supabase CLI is available, these can
 * be cross-checked against `supabase gen types typescript`.
 */

export type UUID = string;
export type Timestamp = string;

export type AccountStatus = "active" | "suspended";
export type InstitutionType =
  | "ecole_primaire"
  | "college"
  | "lycee"
  | "groupe_scolaire"
  | "etablissement_superieur"
  | "centre_formation"
  | "direction_provinciale"
  | "association"
  | "autre";
export type MembershipRole = "admin" | "teacher";
export type MembershipStatus = "active" | "revoked";
export type MembershipSource = "invitation" | "code" | "admin";
export type InvitationKind = "platform_admin" | "teacher" | "institution_admin" | "institution_teacher";
export type CourseLevel = "debutant" | "intermediaire" | "avance";
export type CourseStatus = "draft" | "published" | "archived";
export type LessonKind = "video" | "pdf";
export type VideoProvider = "storage" | "mux";
export type QuestionKind = "single" | "multiple";
export type EnrollmentStatus = "active" | "completed";
export type ProgressStatus = "in_progress" | "completed";
export type LearningEventType =
  | "enrolled"
  | "lesson_started"
  | "video_checkpoint"
  | "lesson_completed"
  | "quiz_started"
  | "quiz_submitted"
  | "quiz_passed"
  | "quiz_failed"
  | "quiz_attempts_reset"
  | "course_completed"
  | "certificate_issued";

export interface Profile {
  id: UUID;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  job_title: string | null;
  subject_area: string | null;
  phone: string | null;
  status: AccountStatus;
  privacy_acknowledged_at: Timestamp | null;
  onboarded_at: Timestamp | null;
  created_at: Timestamp;
}

export interface Institution {
  id: UUID;
  name: string;
  identifier: string;
  type: InstitutionType;
  city: string | null;
  contact_email: string;
  contact_phone: string | null;
  status: AccountStatus;
  created_at: Timestamp;
}

export interface Membership {
  id: UUID;
  institution_id: UUID;
  user_id: UUID;
  role: MembershipRole;
  status: MembershipStatus;
  source: MembershipSource;
  consented_at: Timestamp | null;
  created_at: Timestamp;
  revoked_at: Timestamp | null;
}

export interface Invitation {
  id: UUID;
  kind: InvitationKind;
  email: string;
  institution_id: UUID | null;
  enrollment_code_id: UUID | null;
  invited_by: UUID | null;
  expires_at: Timestamp;
  email_sent_at: Timestamp | null;
  accepted_at: Timestamp | null;
  revoked_at: Timestamp | null;
  created_at: Timestamp;
}

export interface EnrollmentCode {
  id: UUID;
  institution_id: UUID;
  code: string;
  label: string | null;
  max_uses: number;
  uses_count: number;
  expires_at: Timestamp;
  revoked_at: Timestamp | null;
  created_at: Timestamp;
}

export interface CourseCategory {
  id: UUID;
  name: string;
  position: number;
}

export interface Course {
  id: UUID;
  title: string;
  summary: string;
  description: string;
  objectives: string[];
  cover_path: string | null;
  estimated_minutes: number | null;
  category_id: UUID | null;
  target_audience: string;
  level: CourseLevel;
  status: CourseStatus;
  published_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface Module {
  id: UUID;
  course_id: UUID;
  title: string;
  description: string;
  position: number;
  archived_at: Timestamp | null;
}

export interface Lesson {
  id: UUID;
  module_id: UUID;
  course_id: UUID;
  title: string;
  description: string;
  kind: LessonKind;
  position: number;
  is_mandatory: boolean;
  estimated_minutes: number | null;
  video_provider: VideoProvider | null;
  video_ref: string | null;
  video_duration_seconds: number | null;
  pdf_path: string | null;
  pdf_page_count: number | null;
  completion_threshold: number | null;
  archived_at: Timestamp | null;
}

export interface LessonResource {
  id: UUID;
  lesson_id: UUID;
  title: string;
  file_path: string;
  size_bytes: number | null;
  position: number;
}

export interface Quiz {
  id: UUID;
  module_id: UUID;
  course_id: UUID;
  title: string;
  instructions: string;
  pass_threshold: number;
  max_attempts: number;
}

export interface QuestionOption {
  id: UUID;
  question_id: UUID;
  label: string;
  is_correct: boolean;
  position: number;
}

export interface Question {
  id: UUID;
  quiz_id: UUID;
  kind: QuestionKind;
  prompt: string;
  explanation: string;
  points: number;
  position: number;
  archived_at: Timestamp | null;
}

export interface Enrollment {
  id: UUID;
  user_id: UUID;
  course_id: UUID;
  status: EnrollmentStatus;
  enrolled_at: Timestamp;
  started_at: Timestamp | null;
  completed_at: Timestamp | null;
  last_activity_at: Timestamp | null;
}

export interface LessonProgress {
  lesson_id: UUID;
  course_id: UUID;
  status: ProgressStatus;
  progress_ratio: number;
  resume_position: number;
  completed_at: Timestamp | null;
  updated_at: Timestamp;
}

export interface QuizAttemptRow {
  id: UUID;
  quiz_id: UUID;
  user_id: UUID;
  course_id: UUID;
  attempt_number: number;
  status: "in_progress" | "submitted";
  started_at: Timestamp;
  submitted_at: Timestamp | null;
  score_percent: number | null;
  passed: boolean | null;
  voided_at: Timestamp | null;
}

export interface Certificate {
  id: UUID;
  user_id: UUID;
  course_id: UUID;
  certificate_number: string;
  verification_code: string;
  recipient_name: string;
  course_title: string;
  course_duration_minutes: number | null;
  completed_at: Timestamp;
  issued_at: Timestamp;
  revoked_at: Timestamp | null;
  revoke_reason: string | null;
}

export interface LearningEvent {
  id: UUID;
  user_id: UUID;
  course_id: UUID;
  lesson_id: UUID | null;
  quiz_id: UUID | null;
  event_type: LearningEventType;
  metadata: Record<string, unknown>;
  occurred_at: Timestamp;
}

// ─── RPC payloads ────────────────────────────────────────────────────────────

export interface CourseProgressSummary {
  course_id: UUID;
  user_id: UUID;
  mandatory_lessons: number;
  completed_mandatory_lessons: number;
  lesson_completion_ratio: number;
  quizzes_total: number;
  quizzes_passed: number;
  enrollment_status: EnrollmentStatus | null;
  last_activity_at: Timestamp | null;
  certificate: { id: UUID; certificate_number: string; issued_at: Timestamp; revoked: boolean } | null;
}

export interface QuizStatus {
  quiz_id: UUID;
  attempts_used: number;
  max_attempts: number;
  remaining_attempts: number;
  pass_threshold: number;
  passed: boolean;
  best_score: number | null;
  open_attempt_id: UUID | null;
  unlocked: boolean;
  question_count: number;
  exhausted: boolean;
}

export interface AttemptQuestion {
  id: UUID;
  kind: QuestionKind;
  prompt: string;
  points: number;
  options: Array<{ id: UUID; label: string }>;
}

export interface StartedAttempt {
  attempt_id: UUID;
  attempt_number: number;
  max_attempts: number;
  pass_threshold: number;
  started_at: Timestamp;
  questions: AttemptQuestion[];
}

export interface AttemptResult {
  attempt_id: UUID;
  quiz_id: UUID;
  course_id: UUID;
  attempt_number: number;
  submitted_at: Timestamp;
  earned_points: number;
  max_points: number;
  score_percent: number;
  passed: boolean;
  pass_threshold: number;
  max_attempts: number;
  attempts_used: number;
  remaining_attempts: number | null;
  voided: boolean;
  answers_revealed: boolean;
  certificate_issued?: boolean;
  questions: Array<{
    id: UUID;
    kind: QuestionKind;
    prompt: string;
    points: number;
    explanation: string | null;
    is_correct: boolean;
    points_awarded: number;
    selected_option_ids: UUID[];
    options: Array<{ id: UUID; label: string; is_correct?: boolean }>;
  }>;
}

export interface LessonState {
  status: ProgressStatus;
  progress_ratio: number;
  resume_position: number;
  watched_buckets: number[];
  pages_viewed: number[];
}

export interface ProgressUpdate {
  status: ProgressStatus;
  progress_ratio: number;
  lesson_completed_now: boolean;
  certificate_issued: boolean;
  pages_viewed?: number[];
}

export interface InstitutionOverview {
  registered_teachers: number;
  active_teachers: number;
  inactivity_threshold_days: number;
  authorized_courses: number;
  assigned_courses: number;
  assignments: number;
  completed_assignments: number;
  in_progress_assignments: number;
  not_started_assignments: number;
  pending_invitations: number;
}

export interface TeacherSummary {
  user_id: UUID;
  membership_id: UUID;
  full_name: string;
  email: string;
  joined_at: Timestamp;
  source: MembershipSource;
  assigned_courses: number;
  completed_courses: number;
  certificates: number;
  last_activity_at: Timestamp | null;
  exhausted_quizzes: number;
  inactive: boolean;
}

export interface PlatformOverview {
  institutions: number;
  teachers: number;
  active_learners: number;
  inactivity_threshold_days: number;
  published_courses: number;
  draft_courses: number;
  enrollments: number;
  completed_enrollments: number;
  certificates: number;
  pending_invitations: number;
  exhausted_attempts: number;
}

export interface PlatformSettings {
  inactivity_threshold_days: number;
  invitation_validity_days: number;
  certificate_issuer_name: string;
  certificate_signatory_name: string | null;
  certificate_signatory_title: string | null;
  support_email: string | null;
  updated_at: Timestamp;
}

export interface VerifiedCertificate {
  certificate_number: string;
  recipient_name: string;
  course_title: string;
  course_duration_minutes: number | null;
  completed_at: Timestamp;
  issued_at: Timestamp;
  status: "valid" | "revoked";
  issuer: string;
}

/** Standard result of a server action used with useActionState. */
export interface ActionState {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Optional payload, e.g. an invitation link when e-mail is not configured. */
  data?: Record<string, unknown>;
}

export const INITIAL_ACTION_STATE: ActionState = { ok: false };
