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
