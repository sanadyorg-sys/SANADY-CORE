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
  invalid_transition: "Ce changement de statut n’est pas possible à cette étape.",
  already_exists: "Cet élément existe déjà.",

  // SANADY Enterprise — company workspaces
  contract_not_signed: "Un espace ne peut être préparé qu’après la signature du contrat par un approbateur.",
  tenant_exists: "Un espace existe déjà pour ce client, ou cette adresse d’espace est déjà utilisée.",
  tenant_inactive: "Cet espace entreprise n’est pas actif : aucun nouveau collaborateur ne peut y être ajouté.",
  tenant_full: "Le nombre maximal de collaborateurs prévu au contrat est atteint (invitations en attente comprises).",
  tenant_managed: "Le statut d’un espace entreprise se change depuis SANADY Enterprise.",
  checklist_incomplete: "Toutes les étapes de mise en place doivent être terminées avant l’activation.",
  contract_expired: "La date de fin du contrat est passée : mettez à jour les dates avant d’activer l’espace.",
  deletion_date_required: "Fixez d’abord la date de suppression prévue des données (contrat et obligations légales).",
  course_private_to_tenant: "Cette formation est réservée à l’espace de son entreprise : elle ne peut pas être partagée ailleurs.",
  department_exists: "Ce service existe déjà.",

  // SANADY Enterprise — training production studio
  project_locked: "Le projet est en revue ou en validation : renvoyez-le en production pour le modifier.",
  objectives_required: "Rédigez les objectifs de formation (20 caractères au moins) avant de passer à la conception.",
  outline_required: "Ajoutez au moins un module au programme avant de créer la formation.",
  course_required: "Créez d’abord la formation du projet.",
  tenant_required: "Une formation appartenant à l’entreprise doit être rattachée à son espace de formation.",
  tasks_open: "Toutes les tâches de production doivent être terminées avant la revue pédagogique.",
  reviews_required: "La revue pédagogique (et celle du client, si prévue) doit être validée avant l’approbation.",
  comment_required: "Ajoutez un commentaire (5 caractères au moins).",
  project_not_approved: "Cette formation sur mesure ne peut être publiée qu’après la validation institutionnelle de son projet.",

  // Partenariats, phase 4: agreements and contributions
  agreement_locked: "La convention n’est plus en brouillon : renvoyez-la en brouillon pour la modifier (nouvelle approbation).",
  dates_required: "Indiquez les dates de début et de fin de la convention.",
  signed_date_required: "Indiquez la date de signature (aujourd’hui ou avant).",
  signed_document_required: "Ajoutez d’abord l’exemplaire signé de la convention (PDF).",
  contribution_locked: "Cette contribution est vérifiée ou annulée : elle ne peut plus être modifiée.",
  delivery_details_required: "Indiquez ce qui a réellement été reçu (montant, heures réalisées ou date de réception).",
  evidence_required: "Ajoutez une preuve de réception (PDF) avant la vérification.",
  document_locked: "Ce document ne peut pas être supprimé (exemplaire signé ou contribution vérifiée).",

  // Partenariats, phase 5: impact and partner reports
  attribution_required: "Rattachez l’indicateur à une convention ou à un projet soutenu.",
  metric_locked: "Cet indicateur est vérifié : il ne peut plus être modifié.",
  report_locked: "Le rapport est approuvé : renvoyez-le en brouillon pour le modifier (nouvelle approbation).",

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
  course_not_draft: "Seule une formation en brouillon peut être soumise à la revue.",
  course_not_in_review: "Cette formation n’est pas (ou plus) en attente de revue.",
  not_a_trainer: "Cette personne n’a pas le rôle de formateur. Attribuez-lui d’abord ce rôle dans « Équipe SANADY ».",
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
