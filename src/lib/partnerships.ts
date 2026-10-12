import { PROGRAM_GROUPS } from "./institution";
/**
 * Partenariats & Coopération — labels and rules shared by the public pages,
 * the forms and the administration (database: migration
 * 20261016000100_partnerships.sql; brief: PLAN/partnership.md, V2).
 */

/**
 * The Foundation's six fields of intervention (sanady.org). Names and
 * themes are also stored in public.intervention_fields; the examples of
 * contributions come from the brief and are presented as possibilities,
 * never as existing partnerships.
 */
export const INTERVENTION_FIELDS = {
  "soutien-scolaire": {
    name: "Soutien scolaire",
    theme: "apprentissage",
    contributions: [
      "Parrainage de programmes de soutien scolaire",
      "Financement de supports pédagogiques",
      "Équipement d’apprentissage",
      "Outils éducatifs numériques",
    ],
  },
  "formation-continue": {
    name: "Formation continue des enseignants",
    theme: "apprentissage",
    contributions: [
      "Financement de programmes de formation",
      "Collaboration universitaire et recherche en éducation",
      "Mise à disposition de formateurs experts",
      "Infrastructure de formation numérique",
    ],
  },
  orientation: {
    name: "Orientation scolaire et professionnelle",
    theme: "avenir",
    contributions: [
      "Ateliers d’orientation et découverte des métiers",
      "Mentorat professionnel",
      "Partenariats universitaires",
      "Ressources d’orientation",
    ],
  },
  bourses: {
    name: "Assistance aux bourses d’études supérieures",
    theme: "avenir",
    contributions: [
      "Coopération avec des établissements d’enseignement supérieur",
      "Mentorat des étudiants",
      "Accompagnement à la préparation des candidatures",
      "Programmes d’accès à l’enseignement supérieur",
    ],
  },
  parascolaire: {
    name: "Activités parascolaires",
    theme: "eveil",
    contributions: [
      "Ateliers éducatifs, scientifiques et technologiques",
      "Programmes culturels et artistiques",
      "Équipement sportif et parascolaire",
      "Clubs scolaires et compétitions éducatives",
    ],
  },
  rehabilitation: {
    name: "Réhabilitation des écoles",
    theme: "eveil",
    contributions: [
      "Réhabilitation de salles de classe",
      "Mobilier et équipement scolaire",
      "Matériel informatique et infrastructure numérique",
      "Amélioration de l’accessibilité",
    ],
  },
} as const;
export type InterventionField = keyof typeof INTERVENTION_FIELDS;
export const FIELD_SLUGS = Object.keys(INTERVENTION_FIELDS) as InterventionField[];

export const THEMES = {
  apprentissage: "Autour de l’apprentissage",
  avenir: "Autour de l’avenir",
  eveil: "Autour de l’éveil",
} as const;

/** Ways to contribute (brief V2 §5). */
export const CONTRIBUTION_TYPES = {
  financier: "Soutien financier",
  equipement: "Équipement et matériel",
  expertise: "Expertise professionnelle",
  technologie: "Technologie et infrastructure",
  services_educatifs: "Services éducatifs",
  cooperation_institutionnelle: "Coopération institutionnelle",
} as const;
export type ContributionType = keyof typeof CONTRIBUTION_TYPES;

export const ORG_TYPES = {
  entreprise: "Entreprise",
  fondation: "Fondation",
  universite: "Université ou établissement d’enseignement supérieur",
  association: "Association ou ONG",
  administration: "Administration ou collectivité",
  organisation_internationale: "Organisation internationale",
  autre: "Autre",
} as const;
export type OrgType = keyof typeof ORG_TYPES;

export const APPLICATION_STATUS = {
  received: { label: "Reçue", tone: "accent" },
  under_review: { label: "En cours d’examen", tone: "brand" },
  accepted: { label: "Fiche organisation créée", tone: "success" },
  declined: { label: "Non retenue", tone: "neutral" },
  withdrawn: { label: "Retirée", tone: "neutral" },
  spam: { label: "Indésirable", tone: "danger" },
} as const;
export type ApplicationStatus = keyof typeof APPLICATION_STATUS;

/** The eleven stages of brief V2 §7, then the two closed outcomes. */
export const PIPELINE = {
  prospect: "Prospect identifié",
  first_contact: "Premier contact",
  interest_confirmed: "Intérêt confirmé",
  proposal_received: "Proposition reçue",
  evaluation: "Évaluation",
  negotiation: "Négociation",
  institutional_validation: "Validation institutionnelle",
  agreement_signed: "Convention signée",
  implementation: "Mise en œuvre",
  monitoring: "Suivi et évaluation",
  renewal_or_closure: "Renouvellement ou clôture",
  rejected: "Rejeté",
  withdrawn: "Retiré",
} as const;
export type PipelineStatus = keyof typeof PIPELINE;
export const PIPELINE_ORDER = Object.keys(PIPELINE) as PipelineStatus[];

/** Badge tone of a pipeline stage. */
export function stageTone(s: PipelineStatus): "neutral" | "success" | "warning" | "brand" {
  if (s === "rejected" || s === "withdrawn") return "neutral";
  if (s === "agreement_signed" || s === "implementation" || s === "monitoring" || s === "renewal_or_closure") return "success";
  if (s === "institutional_validation") return "warning";
  return "brand";
}

/** Who may move an organisation (mirrors public.set_partner_status). */
export interface PipelineActor {
  staff: boolean;
  manager: boolean;
  signatory: boolean;
}
const EARLY: PipelineStatus[] = ["prospect", "first_contact", "interest_confirmed", "proposal_received", "evaluation", "negotiation", "withdrawn"];
const LOCKED: PipelineStatus[] = ["institutional_validation", "agreement_signed", "implementation", "monitoring", "renewal_or_closure"];

export function canMove(from: PipelineStatus, to: PipelineStatus, a: PipelineActor): boolean {
  if (from === to) return false;
  if (EARLY.includes(to)) return a.staff && !LOCKED.includes(from);
  switch (to) {
    case "rejected":
      return from === "institutional_validation" ? a.signatory : a.staff && !LOCKED.includes(from);
    case "institutional_validation":
      return a.manager && (from === "evaluation" || from === "negotiation");
    case "agreement_signed":
      return a.signatory && from === "institutional_validation";
    case "implementation":
      return a.staff && from === "agreement_signed";
    case "monitoring":
      return a.staff && from === "implementation";
    case "renewal_or_closure":
      return a.staff && (from === "implementation" || from === "monitoring");
    default:
      return false;
  }
}

export function allowedNextSteps(from: PipelineStatus, actor: PipelineActor): PipelineStatus[] {
  return PIPELINE_ORDER.filter((to) => canMove(from, to, actor));
}

/** Supporting documents: PDF only (brief V2 §6). */
export const DOCUMENT_MIME = "application/pdf";
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const MAX_DOCUMENTS = 3;

/** True when the first bytes are those of a PDF (« %PDF- »), whatever the name. */
export function isPdf(head: Uint8Array): boolean {
  return [0x25, 0x50, 0x44, 0x46, 0x2d].every((b, i) => head[i] === b);
}

/** Storage-safe file name: letters, digits, dot, dash, underscore. */
export function safeFileName(name: string): string {
  const base = name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/-+/g, "-");
  return base.replace(/^[-.]+/, "").slice(-120) || "document";
}

/** Verified description and sanady.org page of a field (src/lib/institution.ts). */
export function fieldProgram(slug: InterventionField) {
  const name = INTERVENTION_FIELDS[slug].name;
  return PROGRAM_GROUPS.flatMap((g) => g.programs).find((p) => p.name === name) ?? null;
}

/* ─── Phase 3: educational needs and projects seeking partners ─────────── */

export const NEED_PRIORITY = {
  low: { label: "Basse", tone: "neutral" },
  medium: { label: "Moyenne", tone: "brand" },
  high: { label: "Haute", tone: "warning" },
} as const;
export type NeedPriority = keyof typeof NEED_PRIORITY;

export const NEED_STATUS = {
  identified: { label: "Besoin identifié", tone: "neutral" },
  internal_review: { label: "Revue interne", tone: "brand" },
  approved: { label: "Validé par la Fondation", tone: "success" },
  rejected: { label: "Non retenu", tone: "neutral" },
  closed: { label: "Clos", tone: "neutral" },
} as const;
export type NeedStatus = keyof typeof NEED_STATUS;

export const OPPORTUNITY_STATUS = {
  draft: { label: "Brouillon", tone: "neutral" },
  internal_review: { label: "Revue interne", tone: "brand" },
  approved: { label: "Approuvé — à publier", tone: "warning" },
  published: { label: "Publié", tone: "success" },
  closed: { label: "Clôturé", tone: "neutral" },
  archived: { label: "Archivé", tone: "neutral" },
} as const;
export type OpportunityStatus = keyof typeof OPPORTUNITY_STATUS;

export const CURRENCIES = { MAD: "MAD", EUR: "EUR", USD: "USD" } as const;

/** Next statuses of a need for the current person (mirrors public.set_need_status). */
export function needNextSteps(from: NeedStatus, a: PipelineActor): NeedStatus[] {
  const out: NeedStatus[] = [];
  if (a.staff && from === "identified") out.push("internal_review");
  if (a.staff && from === "internal_review") out.push("identified");
  if (a.signatory && from === "internal_review") out.push("approved", "rejected");
  if (a.staff && (from === "identified" || from === "internal_review" || from === "approved")) out.push("closed");
  return out;
}

/** Next statuses of a project for the current person (mirrors public.set_opportunity_status). */
export function opportunityNextSteps(from: OpportunityStatus, a: PipelineActor): OpportunityStatus[] {
  const out: OpportunityStatus[] = [];
  if (a.staff && from === "draft") out.push("internal_review");
  if (a.staff && from === "internal_review") out.push("draft");
  if (a.signatory && from === "internal_review") out.push("approved");
  if ((a.staff || a.signatory) && from === "approved") out.push("published");
  if (a.staff && from === "approved") out.push("draft");
  if (a.staff && from === "published") out.push("closed");
  if (a.signatory && from === "closed") out.push("published");
  if (a.staff && from === "closed") out.push("archived");
  return out;
}

/** Public view of a published project (public.public_partnership_opportunities). */
export interface PublicOpportunity {
  reference: string;
  title: string;
  intervention_field: InterventionField;
  summary: string;
  description: string;
  objectives: string;
  beneficiaries: string;
  geographic_scope: string | null;
  contribution_types: ContributionType[];
  expected_contribution: string;
  required_resources: string | null;
  funding_target: number | null;
  currency: string;
  timeline: string | null;
  department: string | null;
  deadline: string | null;
  published_at: string;
  open: boolean;
}

export function formatAmount(amount: number | string | null, currency = "MAD") {
  if (amount == null || amount === "") return null;
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Number(amount))} ${currency}`;
}

/* ─── Phase 4: agreements, contributions, milestones (migration 20261021000100) ─ */

export const AGREEMENT_STATUS = {
  draft: { label: "Brouillon", tone: "neutral" },
  internal_review: { label: "Revue interne", tone: "brand" },
  approved: { label: "Approuvée — à signer", tone: "warning" },
  signed: { label: "Signée", tone: "accent" },
  active: { label: "En cours", tone: "success" },
  completed: { label: "Terminée", tone: "neutral" },
  archived: { label: "Archivée", tone: "neutral" },
} as const;
export type AgreementStatus = keyof typeof AGREEMENT_STATUS;

/** Next statuses for the current person (mirrors public.set_agreement_status). */
export function agreementNextSteps(from: AgreementStatus, a: PipelineActor): AgreementStatus[] {
  const out: AgreementStatus[] = [];
  if (a.staff && from === "draft") out.push("internal_review", "archived");
  if (a.staff && from === "internal_review") out.push("draft");
  if (a.signatory && from === "internal_review") out.push("approved");
  if (a.signatory && from === "approved") out.push("signed");
  if (a.staff && from === "approved") out.push("draft");
  if (a.staff && from === "signed") out.push("active");
  if (a.staff && from === "active") out.push("completed");
  if (a.staff && from === "completed") out.push("archived");
  return out;
}

export const CONTRIBUTION_KINDS = {
  financial: "Financière",
  material: "Matérielle",
  expertise: "Expertise",
} as const;
export type ContributionKind = keyof typeof CONTRIBUTION_KINDS;

/** Stages: a pledge is never money received (brief V2 §9). */
export const CONTRIBUTION_STAGE = {
  pledged: { label: "Promise", tone: "neutral" },
  committed: { label: "Engagée", tone: "brand" },
  delivered: { label: "Reçue / réalisée", tone: "accent" },
  verified: { label: "Vérifiée", tone: "success" },
  cancelled: { label: "Annulée", tone: "neutral" },
} as const;
export type ContributionStage = keyof typeof CONTRIBUTION_STAGE;

export function contributionNextSteps(from: ContributionStage, a: PipelineActor): ContributionStage[] {
  const out: ContributionStage[] = [];
  if (a.staff && from === "pledged") out.push("committed");
  if (a.staff && from === "committed") out.push("delivered");
  if (a.signatory && from === "delivered") out.push("verified");
  if (a.staff && ["pledged", "committed", "delivered"].includes(from)) out.push("cancelled");
  return out;
}

export const DOCUMENT_KINDS = {
  proposal: "Proposition",
  draft: "Projet de convention",
  signed: "Exemplaire signé",
  supporting: "Pièce justificative",
  evidence: "Preuve de réception",
} as const;
export type DocumentKind = keyof typeof DOCUMENT_KINDS;

/** What a contribution amounts to, in its own unit (never mixed). */
export function contributionAmount(c: { kind: ContributionKind; currency: string; amount_pledged: string | null; amount_received: string | null; quantity: number | null; item: string | null; hours_pledged: string | null; hours_delivered: string | null }) {
  if (c.kind === "financial") {
    const pledged = formatAmount(c.amount_pledged, c.currency);
    const received = formatAmount(c.amount_received, c.currency);
    return received ? `${received} reçus sur ${pledged} promis` : `${pledged} promis`;
  }
  if (c.kind === "material") return [c.quantity ? `${c.quantity} ×` : null, c.item].filter(Boolean).join(" ");
  return c.hours_delivered ? `${c.hours_delivered} h réalisées sur ${c.hours_pledged ?? "—"} h` : c.hours_pledged ? `${c.hours_pledged} h prévues` : "—";
}
