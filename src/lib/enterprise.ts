/**
 * SANADY Enterprise (brief V3, phases E1-E2) — labels and rules shared by the
 * public page, the forms and the administration. Database: migration
 * 20261018000100_enterprise.sql. PROPOSED activity: everything public is
 * worded as a proposal until the Foundation's approvals (docs/enterprise/plan.md §1).
 */

export const ENTERPRISE_SERVICES = {
  sur_mesure: { label: "Formation sur mesure", short: "Sur mesure", text: "La Fondation conçoit et anime un parcours de formation adapté à vos équipes." },
  plateforme: { label: "Plateforme de formation", short: "Plateforme", text: "Vos équipes suivent vos propres formations dans un espace sécurisé de la plateforme SANADY." },
  complete: { label: "Solution complète", short: "Complète", text: "Conception de la formation et espace dédié pour vos collaborateurs." },
  partenariat: { label: "Partenariat institutionnel", short: "Partenariat", text: "Soutenir la mission éducative de la Fondation (mécénat, expertise, équipement)." },
} as const;
export type EnterpriseService = keyof typeof ENTERPRISE_SERVICES;

export const EMPLOYEE_COUNTS = { "1-49": "Moins de 50", "50-249": "50 à 249", "250-999": "250 à 999", "1000+": "1 000 et plus" } as const;
export const EXISTING_CONTENT = { none: "Aucun contenu existant", partial: "Une partie du contenu existe", complete: "Le contenu existe déjà" } as const;
export const LANGUAGES = { fr: "Français", ar: "Arabe", en: "Anglais", multiple: "Plusieurs langues" } as const;

export const REQUEST_STATUS = {
  received: { label: "Reçue", tone: "accent" },
  qualified: { label: "Qualifiée", tone: "brand" },
  converted: { label: "Client créé", tone: "success" },
  declined: { label: "Non retenue", tone: "neutral" },
  withdrawn: { label: "Retirée", tone: "neutral" },
  spam: { label: "Indésirable", tone: "danger" },
} as const;
export type RequestStatus = keyof typeof REQUEST_STATUS;

/** Enterprise service pipeline (brief V3 §7), then the two closed outcomes. */
export const ENTERPRISE_PIPELINE = {
  lead: "Prospect",
  qualified: "Qualifié",
  discovery: "Réunion de découverte",
  needs_assessment: "Analyse des besoins",
  proposal: "Proposition",
  negotiation: "Négociation",
  institutional_approval: "Validation institutionnelle",
  contract_signed: "Contrat signé",
  onboarding: "Mise en place",
  active_service: "Service actif",
  renewal: "Renouvellement",
  lost: "Perdu",
  withdrawn: "Retiré",
} as const;
export type EnterpriseStage = keyof typeof ENTERPRISE_PIPELINE;
export const ENTERPRISE_ORDER = Object.keys(ENTERPRISE_PIPELINE) as EnterpriseStage[];

const EARLY: EnterpriseStage[] = ["lead", "qualified", "discovery", "needs_assessment", "proposal", "negotiation", "institutional_approval", "lost", "withdrawn"];
const SIGNED: EnterpriseStage[] = ["contract_signed", "onboarding", "active_service", "renewal"];

export function enterpriseStageTone(s: EnterpriseStage): "neutral" | "success" | "warning" | "brand" {
  if (s === "lost" || s === "withdrawn") return "neutral";
  if (SIGNED.includes(s)) return "success";
  if (s === "institutional_approval") return "warning";
  return "brand";
}

/** Next stages for the current person (mirrors public.set_enterprise_status). */
export function enterpriseNextSteps(from: EnterpriseStage, a: { manager: boolean; signatory: boolean }): EnterpriseStage[] {
  return ENTERPRISE_ORDER.filter((to) => {
    if (to === from) return false;
    if (EARLY.includes(to)) return a.manager && !SIGNED.includes(from);
    if (to === "contract_signed") return a.signatory && from === "institutional_approval";
    if (to === "onboarding") return a.manager && from === "contract_signed";
    if (to === "active_service") return a.manager && (from === "onboarding" || from === "renewal");
    if (to === "renewal") return a.manager && from === "active_service";
    return false;
  });
}

export const PROPOSAL_STATUS = {
  draft: { label: "Brouillon", tone: "neutral" },
  internal_review: { label: "Revue interne", tone: "brand" },
  approved: { label: "Approuvée — à envoyer", tone: "warning" },
  sent: { label: "Envoyée au client", tone: "accent" },
  accepted: { label: "Acceptée", tone: "success" },
  declined: { label: "Refusée", tone: "neutral" },
  expired: { label: "Expirée", tone: "neutral" },
} as const;
export type ProposalStatus = keyof typeof PROPOSAL_STATUS;

export function proposalNextSteps(from: ProposalStatus, a: { manager: boolean; signatory: boolean }): ProposalStatus[] {
  const out: ProposalStatus[] = [];
  if (a.manager && from === "draft") out.push("internal_review");
  if (a.signatory && from === "internal_review") out.push("approved");
  if (a.manager && from === "internal_review") out.push("draft");
  if (a.manager && from === "approved") out.push("sent", "draft");
  if (a.manager && from === "sent") out.push("accepted", "declined", "expired");
  return out;
}

/** Configurable line items (brief V3 §3) — never hard-coded prices. */
export const LINE_CATEGORIES = {
  needs_analysis: "Analyse des besoins",
  instructional_design: "Ingénierie pédagogique",
  content_development: "Développement des contenus",
  video_production: "Production vidéo",
  assessment_design: "Conception des évaluations",
  platform_access: "Accès à la plateforme",
  employee_enrollment: "Inscription des collaborateurs",
  technical_support: "Support technique",
  content_maintenance: "Maintenance des contenus",
  setup_fee: "Frais de mise en place",
  other: "Autre",
} as const;
export type LineCategory = keyof typeof LINE_CATEGORIES;

export function lineTotal(l: { quantity: string | number; unit_price: string | number }) {
  return Math.round(Number(l.quantity) * Number(l.unit_price) * 100) / 100;
}

/* ─── Phase E3: company learning spaces (migration 20261019000100) ─────── */

export const TENANT_STATUS = {
  requested: { label: "Demande d’espace", tone: "brand" },
  authorized: { label: "Création autorisée", tone: "accent" },
  provisioning: { label: "Mise en place", tone: "warning" },
  active: { label: "Actif", tone: "success" },
  suspended: { label: "Suspendu", tone: "danger" },
  offboarding: { label: "Fin de contrat en cours", tone: "warning" },
  closed: { label: "Fermé", tone: "neutral" },
  cancelled: { label: "Refusé", tone: "neutral" },
} as const;
export type TenantStatus = keyof typeof TENANT_STATUS;

/** The ten provisioning steps of brief V3 §9, in order (keys of public.tenant_checklist). */
export const TENANT_STEPS = [
  { key: "contract_signed", label: "Contrat signé", who: "Approbateur (fiche client)" },
  { key: "authorized", label: "Création de l’espace autorisée", who: "Approbateur" },
  { key: "workspace", label: "Espace généré", who: "Responsable entreprises" },
  { key: "admin_assigned", label: "Administrateur de l’entreprise désigné", who: "Responsable entreprises" },
  { key: "limits", label: "Limites de service et dates du contrat", who: "Responsable entreprises" },
  { key: "catalog", label: "Catalogue initialisé (au moins une formation publiée)", who: "Équipe pédagogique" },
  { key: "storage", label: "Stockage configuré", who: "Responsable entreprises" },
  { key: "security", label: "Contrôles de sécurité effectués", who: "Administrateur SANADY" },
  { key: "welcome_sent", label: "Invitation de bienvenue envoyée ou acceptée", who: "Responsable entreprises" },
  { key: "active", label: "Espace activé", who: "Responsable entreprises" },
] as const;
export type TenantChecklist = Record<(typeof TENANT_STEPS)[number]["key"], boolean>;

/** Next statuses for the current person (mirrors public.set_tenant_status). */
export function tenantNextSteps(from: TenantStatus, a: { manager: boolean }): TenantStatus[] {
  if (!a.manager) return [];
  if (from === "provisioning" || from === "suspended") return from === "suspended" ? ["active", "offboarding"] : ["active"];
  if (from === "active") return ["suspended", "offboarding"];
  if (from === "offboarding") return ["closed"];
  return [];
}

export const SERVICE_PLANS = {
  plateforme: "Espace de formation entreprise",
  sur_mesure: "Formation sur mesure",
  complete: "Solution complète (sur mesure + espace)",
} as const;

export const COURSE_OWNERSHIP = {
  sanady: "Formation SANADY",
  company: "Formation de l’entreprise",
  joint: "Formation développée conjointement",
  licensed: "Formation sous licence (tiers)",
} as const;
export type CourseOwnership = keyof typeof COURSE_OWNERSHIP;

/** Slug of a workspace address (/entreprise/<slug>): lowercase, digits, dashes. */
export function slugify(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

/** Words of the institution area: teachers in schools, employees in companies. */
export function audience(kind: "school" | "enterprise" | null | undefined) {
  return kind === "enterprise"
    ? { one: "collaborateur", many: "collaborateurs", Many: "Collaborateurs", our: "Nos collaborateurs", place: "entreprise", space: "Espace entreprise" }
    : { one: "enseignant", many: "enseignants", Many: "Enseignants", our: "Nos enseignants", place: "établissement", space: "Espace établissement" };
}

/**
 * Institution-area texts are written for schools; in a company workspace the
 * same sentences speak of employees and of the company.
 */
export function wording(kind: "school" | "enterprise" | null | undefined) {
  if (kind !== "enterprise") return (text: string) => text;
  return (text: string) =>
    text
      .replace(/cet établissement/g, "cette entreprise")
      .replace(/Cet établissement/g, "Cette entreprise")
      .replace(/un établissement/g, "une entreprise")
      .replace(/établissement/g, "entreprise")
      .replace(/Établissement/g, "Entreprise")
      .replace(/enseignant/g, "collaborateur")
      .replace(/Enseignant/g, "Collaborateur");
}

/* ─── Phase E4: custom training production studio (migration 20261020000100) ─ */

export const TRAINING_STATUS = {
  brief: { label: "Besoins reçus", tone: "neutral" },
  design: { label: "Conception", tone: "brand" },
  production: { label: "Production", tone: "brand" },
  internal_review: { label: "Revue pédagogique", tone: "warning" },
  client_review: { label: "Revue du client", tone: "warning" },
  approval: { label: "Validation institutionnelle", tone: "warning" },
  approved: { label: "Approuvée — à publier", tone: "accent" },
  published: { label: "Publiée — à lancer", tone: "accent" },
  launched: { label: "Lancée", tone: "success" },
  cancelled: { label: "Annulée", tone: "neutral" },
} as const;
export type TrainingStatus = keyof typeof TRAINING_STATUS;

/** The 12 production steps of brief V3 §13 (keys of public.training_checklist). */
export const TRAINING_STEPS = [
  { key: "brief", label: "Besoins du client reçus" },
  { key: "objectives", label: "Objectifs de formation définis" },
  { key: "curriculum", label: "Programme préparé" },
  { key: "modules", label: "Modules planifiés dans la formation" },
  { key: "assigned", label: "Contenus attribués à l’équipe de production" },
  { key: "content", label: "Vidéos et PDF développés" },
  { key: "quizzes", label: "Évaluations créées (une par module)" },
  { key: "internal_review", label: "Revue pédagogique interne" },
  { key: "client_review", label: "Revue du client (si prévue au contrat)" },
  { key: "approved", label: "Validation institutionnelle (approbateur)" },
  { key: "published", label: "Formation publiée" },
  { key: "launched", label: "Formation lancée dans l’espace du client" },
] as const;
export type TrainingChecklist = Record<(typeof TRAINING_STEPS)[number]["key"], boolean> & {
  open_tasks: number;
  course_issues: number | null;
  course_status: string | null;
};

export const TASK_KINDS = {
  video: "Vidéo",
  pdf: "Support PDF",
  quiz: "Évaluation",
  activity: "Activité",
  review: "Relecture",
  other: "Autre",
} as const;
export type TaskKind = keyof typeof TASK_KINDS;
export const TASK_STATUS = { todo: "À faire", in_progress: "En cours", done: "Terminée" } as const;
export type TaskStatus = keyof typeof TASK_STATUS;

/** Next statuses a person can choose (mirrors public.set_training_status; reviews move the rest). */
export function trainingNextSteps(from: TrainingStatus, a: { manage: boolean; signatory: boolean }): TrainingStatus[] {
  const out: TrainingStatus[] = [];
  if (a.manage && from === "brief") out.push("design");
  if (a.manage && from === "design") out.push("production");
  if (a.manage && from === "production") out.push("internal_review");
  if (a.signatory && from === "approval") out.push("approved", "production");
  if (a.manage && from === "published") out.push("launched");
  if (a.manage && from === "launched") out.push("production");
  if (a.manage && ["brief", "design", "production", "internal_review", "client_review", "approval"].includes(from)) out.push("cancelled");
  return out;
}

/* ─── Phase E5: contracts and usage (migration 20261024000100) ────────────── */

export const CONTRACT_STATUS = {
  draft: { label: "Brouillon", tone: "neutral" },
  internal_review: { label: "Revue interne", tone: "brand" },
  approved: { label: "Approuvé — à signer", tone: "warning" },
  signed: { label: "Signé", tone: "accent" },
  active: { label: "En cours", tone: "success" },
  renewal: { label: "Renouvellement", tone: "warning" },
  closed: { label: "Clos", tone: "neutral" },
} as const;
export type ContractStatus = keyof typeof CONTRACT_STATUS;

/** Pricing models of brief V3 §3 — the amounts are the contract lines. */
export const PRICING_MODELS = {
  annual_subscription: "Abonnement annuel",
  monthly_subscription: "Abonnement mensuel",
  per_active_learner: "Par collaborateur actif",
  per_enrolled_learner: "Par collaborateur inscrit",
  fixed_fee: "Forfait",
  mixed: "Mixte",
} as const;
export type PricingModel = keyof typeof PRICING_MODELS;

/** Next statuses for the current person (mirrors public.set_contract_status). */
export function contractNextSteps(from: ContractStatus, a: { manager: boolean; signatory: boolean }): ContractStatus[] {
  const out: ContractStatus[] = [];
  if (a.manager && from === "draft") out.push("internal_review");
  if (a.manager && from === "internal_review") out.push("draft");
  if (a.signatory && from === "internal_review") out.push("approved");
  if (a.signatory && from === "approved") out.push("signed");
  if (a.manager && from === "approved") out.push("draft");
  if (a.manager && from === "signed") out.push("active");
  if (a.manager && from === "active") out.push("renewal");
  if (a.manager && from === "renewal") out.push("active");
  if (a.manager && ["signed", "active", "renewal"].includes(from)) out.push("closed");
  return out;
}

/* ─── Phase E6: financial foundation (migration 20261025000100) ─────────── */

export const REVENUE_CATEGORIES = {
  custom_training: "Production de formations sur mesure",
  platform_subscription: "Abonnement à la plateforme",
  setup: "Mise en place",
  support_maintenance: "Support et maintenance",
  content_updates: "Mises à jour des contenus",
  other: "Autre service approuvé",
} as const;
export type RevenueCategory = keyof typeof REVENUE_CATEGORIES;

export const COST_CATEGORIES = {
  cloud_infrastructure: "Infrastructure cloud",
  video_hosting: "Hébergement vidéo",
  file_storage: "Stockage de fichiers",
  technical_maintenance: "Maintenance technique",
  content_production: "Production de contenus",
  trainer_compensation: "Rémunération des formateurs",
  customer_support: "Support client",
  administrative: "Frais administratifs",
} as const;
export type CostCategory = keyof typeof COST_CATEGORIES;

/** Costs that count as infrastructure (cost per active learner, an estimate). */
export const INFRASTRUCTURE_COSTS: CostCategory[] = ["cloud_infrastructure", "video_hosting", "file_storage"];

export const PAYMENT_METHODS = { transfer: "Virement", cheque: "Chèque", cash: "Espèces", card: "Carte", other: "Autre" } as const;
