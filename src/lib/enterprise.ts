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
