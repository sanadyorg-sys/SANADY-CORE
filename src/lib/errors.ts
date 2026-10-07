/**
 * Maps the stable error codes raised by the database (SQLSTATE P0001) and
 * by server actions to professional French messages. Unknown errors never
 * leak internal details to the user.
 */
const MESSAGES: Record<string, string> = {
  not_authenticated: "Votre session a expiré. Veuillez vous reconnecter.",
  forbidden: "Vous n’êtes pas autorisé à effectuer cette action.",
  not_found: "L’élément demandé est introuvable ou n’est plus disponible.",
  account_unavailable: "Ce compte n’est pas actif. Contactez l’administration SANADY.",
  cannot_change_own_status: "Vous ne pouvez pas modifier le statut de votre propre compte.",
  invalid_first_name: "Veuillez saisir votre prénom.",
  invalid_last_name: "Veuillez saisir votre nom.",
  rate_limited: "Trop de tentatives. Veuillez patienter quelques minutes avant de réessayer.",

  // Invitations
  invitation_not_found: "Ce lien d’invitation n’est pas valide.",
  invitation_revoked: "Cette invitation a été annulée. Demandez une nouvelle invitation.",
  invitation_already_accepted: "Cette invitation a déjà été utilisée. Connectez-vous avec votre compte.",
  invitation_expired: "Cette invitation a expiré. Demandez une nouvelle invitation à votre interlocuteur.",
  invitation_email_mismatch:
    "Cette invitation a été envoyée à une autre adresse e-mail. Connectez-vous avec le compte correspondant.",
  institution_required: "Veuillez sélectionner un établissement.",
  institution_not_allowed: "Ce type d’invitation ne peut pas être rattaché à un établissement.",
  institution_inactive: "Cet établissement n’est pas actif.",
  already_member: "Cette personne est déjà membre de l’établissement.",
  already_admin: "Cette personne est déjà administratrice de la plateforme.",
  consent_required: "Votre accord est nécessaire pour rejoindre l’établissement.",

  // Enrollment codes
  invalid_code: "Ce code d’inscription n’est pas valide.",
  code_revoked: "Ce code d’inscription a été désactivé par l’établissement.",
  code_expired: "Ce code d’inscription a expiré.",
  code_exhausted: "Ce code d’inscription a atteint son nombre maximal d’utilisations.",
  invalid_expiry: "La date d’expiration doit être comprise entre demain et un an.",
  membership_inactive: "Cette affiliation n’est plus active.",

  // Courses
  course_unavailable: "Cette formation n’est pas disponible.",
  course_not_publishable: "La formation ne peut pas être publiée tant que les points signalés ne sont pas corrigés.",
  course_not_authorized: "Cette formation n’est pas autorisée pour votre établissement.",
  course_access_denied: "Vous n’avez pas accès à cette formation.",
  not_a_member: "Un ou plusieurs enseignants sélectionnés ne sont pas membres actifs de l’établissement.",
  invalid_selection: "Veuillez sélectionner entre 1 et 500 enseignants.",
  invalid_order: "L’ordre transmis est incomplet. Rechargez la page et réessayez.",
  invalid_options: "Les réponses proposées ne sont pas valides.",
  question_options_count: "Une question doit comporter entre 2 et 10 réponses.",
  question_correct_count:
    "Une question à réponse unique doit avoir exactement une bonne réponse ; une question à réponses multiples, au moins une.",
  invalid_lesson_kind: "Type de leçon incompatible.",
  lesson_not_ready: "Cette leçon n’est pas encore prête.",
  invalid_payload: "Les données transmises ne sont pas valides.",

  // Assessments
  quiz_locked: "Terminez toutes les leçons obligatoires du module pour accéder à l’évaluation.",
  quiz_empty: "Cette évaluation ne contient pas encore de questions.",
  quiz_already_passed: "Vous avez déjà réussi cette évaluation.",
  attempts_exhausted:
    "Vous avez utilisé vos trois tentatives. Une intervention de l’administration SANADY est nécessaire pour poursuivre.",
  attempt_already_submitted: "Cette tentative a déjà été soumise.",
  attempt_voided: "Cette tentative a été réinitialisée par l’administration.",
  attempt_not_submitted: "Cette tentative n’a pas encore été soumise.",
  reason_required: "Veuillez indiquer un motif (5 caractères minimum).",
};

export const GENERIC_ERROR =
  "Une erreur inattendue est survenue. Veuillez réessayer. Si le problème persiste, contactez le support.";

/** Extracts a stable code from a Supabase/PostgREST error, if any. */
export function errorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const e = error as { message?: string; code?: string };
  if (e.message && /^[a-z_]+$/.test(e.message) && MESSAGES[e.message]) return e.message;
  if (e.code === "23505") return "duplicate";
  if (e.code === "42501") return "forbidden";
  return undefined;
}

export function errorMessage(error: unknown, fallback = GENERIC_ERROR): string {
  const code = errorCode(error);
  if (code === "duplicate") return "Cet élément existe déjà.";
  return (code && MESSAGES[code]) || fallback;
}

export function messageFor(code: string): string {
  return MESSAGES[code] ?? GENERIC_ERROR;
}

/** Labels for publication validation issues returned by validate_course(). */
export const PUBLICATION_ISSUES: Record<string, string> = {
  course_description_missing: "La description de la formation est trop courte (20 caractères minimum).",
  course_objectives_missing: "Ajoutez au moins un objectif d’apprentissage.",
  course_category_missing: "Choisissez une catégorie.",
  course_no_modules: "La formation ne contient aucun module.",
  module_no_lessons: "Ce module ne contient aucune leçon",
  module_no_quiz: "Ce module n’a pas d’évaluation comportant au moins une question",
  lesson_no_content: "Le contenu de cette leçon n’a pas été téléversé",
  question_invalid: "Cette question est mal configurée",
};
