import type {
  CourseLevel,
  CourseStatus,
  InstitutionType,
  InvitationKind,
  LearningEventType,
  LessonKind,
  MembershipSource,
  QuestionKind,
} from "./types";

export const INSTITUTION_TYPES: Record<InstitutionType, string> = {
  ecole_primaire: "École primaire",
  college: "Collège",
  lycee: "Lycée",
  groupe_scolaire: "Groupe scolaire",
  etablissement_superieur: "Établissement d’enseignement supérieur",
  centre_formation: "Centre de formation",
  direction_provinciale: "Direction provinciale",
  association: "Association",
  autre: "Autre",
};

export const COURSE_LEVELS: Record<CourseLevel, string> = {
  debutant: "Initiation",
  intermediaire: "Approfondissement",
  avance: "Expertise",
};

export const COURSE_STATUSES: Record<CourseStatus, string> = {
  draft: "Brouillon",
  published: "Publiée",
  archived: "Archivée",
};

export const LESSON_KINDS: Record<LessonKind, string> = {
  video: "Vidéo",
  pdf: "Document PDF",
};

export const QUESTION_KINDS: Record<QuestionKind, string> = {
  single: "Réponse unique",
  multiple: "Réponses multiples",
};

export const INVITATION_KINDS: Record<InvitationKind, string> = {
  platform_admin: "Administrateur SANADY",
  teacher: "Enseignant (compte individuel)",
  institution_admin: "Administrateur d’établissement",
  institution_teacher: "Enseignant de l’établissement",
};

export const MEMBERSHIP_SOURCES: Record<MembershipSource, string> = {
  invitation: "Invitation",
  code: "Code d’inscription",
  admin: "Administration",
};

export const EVENT_LABELS: Record<LearningEventType, string> = {
  enrolled: "Inscription à la formation",
  lesson_started: "Leçon commencée",
  video_checkpoint: "Étape de visionnage atteinte",
  lesson_completed: "Leçon terminée",
  quiz_started: "Évaluation commencée",
  quiz_submitted: "Évaluation soumise",
  quiz_passed: "Évaluation réussie",
  quiz_failed: "Évaluation non validée",
  quiz_attempts_reset: "Tentatives réinitialisées",
  course_completed: "Formation terminée",
  certificate_issued: "Certificat délivré",
};

export const AUDIT_ENTITIES: Record<string, string> = {
  institutions: "Établissement",
  institution_memberships: "Affiliation",
  invitations: "Invitation",
  enrollment_codes: "Code d’inscription",
  courses: "Formation",
  modules: "Module",
  lessons: "Leçon",
  quizzes: "Évaluation",
  questions: "Question",
  course_permissions: "Autorisation de formation",
  course_assignments: "Affectation de formation",
  certificates: "Certificat",
  platform_roles: "Rôle d’administration",
  platform_settings: "Paramètres",
  profiles: "Compte",
};

export const AUDIT_ACTIONS: Record<string, string> = {
  insert: "Création",
  update: "Modification",
  delete: "Suppression",
  quiz_attempts_reset: "Réinitialisation des tentatives",
  user_suspended: "Suspension du compte",
  user_reactivated: "Réactivation du compte",
};
