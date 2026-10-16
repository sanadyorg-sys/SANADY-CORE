import { z } from "zod";
import { emailSchema, optionalText, uuidSchema } from "./validation";
import { CONTRIBUTION_TYPES, INTERVENTION_FIELDS, ORG_TYPES, PLATFORM_MEASURES, type PlatformMeasure } from "./partnerships";

/**
 * Partnership application, validated step by step in the browser and again,
 * in full, on the server. Limits mirror the database constraints
 * (supabase/migrations/20261016000100_partnerships.sql).
 */
const required = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .min(1, `Veuillez renseigner ${label}.`)
    .min(min, `${min} caractères minimum.`)
    .max(max, `${max} caractères maximum.`);

const website = z
  .string()
  .trim()
  .max(300, "Adresse trop longue.")
  .optional()
  .transform((v) => (v ? (/^https?:\/\//i.test(v) ? v : `https://${v}`) : undefined))
  .refine((v) => !v || /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(v), "Adresse de site web invalide.");

const phone = z
  .string()
  .trim()
  .max(40, "Numéro trop long.")
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => !v || /^[+\d][\d\s().-]{5,}$/.test(v), "Numéro de téléphone invalide.");

export const organizationStep = z.object({
  org_name: required("le nom de l’organisation", 2, 200),
  org_type: z.enum(Object.keys(ORG_TYPES) as [keyof typeof ORG_TYPES], "Choisissez un type d’organisation."),
  country: required("le pays", 2, 80),
  city: optionalText(100),
  website,
  sector: optionalText(150),
  org_description: required("une description de l’organisation", 20, 2000),
});

export const contactStep = z.object({
  contact_name: required("votre nom complet", 2, 150),
  contact_title: required("votre fonction", 2, 150),
  contact_email: emailSchema,
  contact_phone: phone,
});

export const proposalStep = z.object({
  intervention_field: z.enum(Object.keys(INTERVENTION_FIELDS) as [keyof typeof INTERVENTION_FIELDS], "Choisissez un domaine d’intervention."),
  contribution_type: z.enum(Object.keys(CONTRIBUTION_TYPES) as [keyof typeof CONTRIBUTION_TYPES], "Choisissez un type de contribution."),
  contribution: required("la contribution proposée", 10, 2000),
  cooperation: required("la coopération envisagée", 30, 4000),
  timeline: optionalText(150),
  extra: optionalText(2000),
  /** Reference of a published project (OPP-2026-0001), optional. */
  opportunity: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined))
    .refine((v) => !v || /^OPP-\d{4}-\d{4,}$/.test(v), "Projet inconnu."),
});

export const applicationSchema = organizationStep.merge(contactStep).merge(proposalStep);
export type ApplicationInput = z.output<typeof applicationSchema>;

export const STEP_SCHEMAS = [organizationStep, contactStep, proposalStep] as const;

/* ─── Phase 3 (team forms) ───────────────────────────────────────────────── */

const amount = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v.replace(/\s/g, "").replace(",", ".") : undefined))
  .refine((v) => !v || (/^\d{1,10}(\.\d{1,2})?$/.test(v) && Number(v) > 0), "Montant invalide (chiffres uniquement).");

export const needSchema = z.object({
  title: required("le titre", 5, 200),
  intervention_field: z.enum(Object.keys(INTERVENTION_FIELDS) as [keyof typeof INTERVENTION_FIELDS], "Choisissez un domaine."),
  institution_id: z.union([z.uuid(), z.literal("")]).optional(),
  project_label: optionalText(200),
  description: required("la description du besoin", 20, 4000),
  justification: required("la justification éducative", 20, 4000),
  priority: z.enum(["low", "medium", "high"], "Choisissez une priorité."),
  required_resources: optionalText(2000),
  estimated_cost: amount,
  currency: z.enum(["MAD", "EUR", "USD"]).default("MAD"),
  timeline: optionalText(200),
  responsible_id: z.union([z.uuid(), z.literal("")]).optional(),
});

export const opportunitySchema = z.object({
  title: required("le titre", 5, 200),
  intervention_field: z.enum(Object.keys(INTERVENTION_FIELDS) as [keyof typeof INTERVENTION_FIELDS], "Choisissez un domaine."),
  summary: required("un résumé", 20, 300),
  description: required("la description", 50, 6000),
  objectives: required("les objectifs éducatifs", 20, 3000),
  beneficiaries: required("les bénéficiaires", 5, 1000),
  geographic_scope: optionalText(200),
  expected_contribution: required("la contribution attendue", 10, 2000),
  required_resources: optionalText(2000),
  funding_target: amount,
  currency: z.enum(["MAD", "EUR", "USD"]).default("MAD"),
  timeline: optionalText(200),
  department: optionalText(150),
  deadline: z
    .union([z.iso.date("Date invalide."), z.literal("")])
    .optional()
    .refine((v) => !v || v >= new Date().toISOString().slice(0, 10), "La date limite ne peut pas être passée."),
});

/* ─── Phase 4: agreements and contributions ─────────────────────────────── */

const optionalDate = z.union([z.iso.date("Date invalide."), z.literal("")]).optional();
const optionalUuid = z.union([z.uuid(), z.literal("")]).optional();

export const agreementSchema = z
  .object({
    title: required("le titre", 5, 200),
    intervention_field: z.enum(Object.keys(INTERVENTION_FIELDS) as [keyof typeof INTERVENTION_FIELDS], "Choisissez un domaine."),
    opportunity_id: optionalUuid,
    objectives: required("les objectifs", 20, 4000),
    responsibilities: optionalText(4000),
    contributions_summary: optionalText(4000),
    start_on: optionalDate,
    end_on: optionalDate,
    renewal_terms: optionalText(2000),
    renewal_notice_days: z
      .string()
      .trim()
      .optional()
      .refine((v) => !v || (/^\d{1,3}$/.test(v) && Number(v) <= 365), "Entre 0 et 365 jours."),
  })
  .refine((v) => !v.start_on || !v.end_on || v.end_on >= v.start_on, { message: "La fin doit suivre le début.", path: ["end_on"] });

const count = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v.replace(/\s/g, "") : undefined))
  .refine((v) => !v || /^\d{1,7}$/.test(v), "Nombre entier attendu.");
const hours = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v.replace(/\s/g, "").replace(",", ".") : undefined))
  .refine((v) => !v || (/^\d{1,6}(\.\d)?$/.test(v) && Number(v) > 0), "Nombre d’heures invalide.");

export const contributionSchema = z
  .object({
    kind: z.enum(["financial", "material", "expertise"], "Choisissez le type de contribution."),
    description: required("la description", 5, 2000),
    agreement_id: optionalUuid,
    opportunity_id: optionalUuid,
    expected_on: optionalDate,
    currency: z.enum(["MAD", "EUR", "USD"]).default("MAD"),
    amount_pledged: amount,
    restricted_purpose: optionalText(1000),
    item: optionalText(200),
    quantity: count,
    estimated_value: amount,
    recipient: optionalText(200),
    expertise_category: optionalText(200),
    hours_pledged: hours,
    supported_activities: optionalText(2000),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "financial" && !v.amount_pledged) ctx.addIssue({ code: "custom", path: ["amount_pledged"], message: "Indiquez le montant promis." });
    if (v.kind === "material" && !v.item) ctx.addIssue({ code: "custom", path: ["item"], message: "Indiquez le matériel." });
    if (v.kind === "expertise" && !v.expertise_category) ctx.addIssue({ code: "custom", path: ["expertise_category"], message: "Indiquez le domaine d’expertise." });
  });

export const deliverySchema = z.object({
  amount_received: amount,
  received_on: optionalDate.refine((v) => !v || v <= new Date().toISOString().slice(0, 10), "La date ne peut pas être future."),
  hours_delivered: hours,
});

/* ─── Phase 5: impact indicators and partner reports ─────────────────────── */

export const metricSchema = z
  .object({
    agreement_id: optionalUuid,
    opportunity_id: optionalUuid,
    intervention_field: z.enum(Object.keys(INTERVENTION_FIELDS) as [keyof typeof INTERVENTION_FIELDS], "Choisissez un domaine."),
    dimension: z.string().trim().min(1, "Choisissez un indicateur."),
    label: optionalText(200),
    metric_type: z.enum(["output", "outcome"], "Réalisation ou résultat ?"),
    value: z
      .string()
      .trim()
      .transform((v) => v.replace(/\s/g, "").replace(",", "."))
      .refine((v) => /^\d{1,10}(\.\d{1,2})?$/.test(v), "Valeur numérique attendue."),
    unit: optionalText(60),
    period_start: z.iso.date("Date de début requise."),
    period_end: z.iso.date("Date de fin requise."),
    method: required("la méthode de mesure", 10, 2000),
    attribution: z.enum(["direct", "shared", "context"], "Précisez la part du partenariat."),
  })
  .refine((v) => v.period_end >= v.period_start, { message: "La fin doit suivre le début.", path: ["period_end"] })
  .refine((v) => Boolean(v.agreement_id || v.opportunity_id), { message: "Rattachez l’indicateur à une convention ou à un projet.", path: ["agreement_id"] })
  .refine((v) => v.dimension !== "other" || Boolean(v.label), { message: "Nommez l’indicateur.", path: ["label"] });

export const reportSchema = z
  .object({
    title: required("le titre", 5, 200),
    agreement_id: optionalUuid,
    period_start: z.iso.date("Date de début requise."),
    period_end: z.iso.date("Date de fin requise."),
    activities: optionalText(4000),
    challenges: optionalText(4000),
    future_opportunities: optionalText(4000),
  })
  .refine((v) => v.period_end >= v.period_start, { message: "La fin doit suivre le début.", path: ["period_end"] });

/* ─── Communication templates ─────────────────────────────────────────────── */

export const templateSchema = z.object({
  category: z.enum(["first_contact", "acknowledgement", "follow_up", "decline", "renewal", "report", "thanks", "other"], "Choisissez une catégorie."),
  title: required("le nom du modèle", 3, 120),
  subject: required("l’objet", 3, 200),
  body: required("le texte", 10, 6000),
});

export const messageSchema = z.object({
  organization_id: z.uuid(),
  contact_id: z.union([z.uuid(), z.literal("")]).optional(),
  template_id: z.union([z.uuid(), z.literal("")]).optional(),
  channel: z.enum(["email", "portal", "copy"]),
  subject: required("l’objet", 1, 200),
  body: required("le message", 1, 6000),
});

export const platformMetricSchema = z
  .object({
    agreement_id: optionalUuid,
    opportunity_id: optionalUuid,
    intervention_field: z.enum(Object.keys(INTERVENTION_FIELDS) as [keyof typeof INTERVENTION_FIELDS], "Choisissez un domaine."),
    measure: z.enum(Object.keys(PLATFORM_MEASURES) as [PlatformMeasure], "Choisissez ce qui est mesuré."),
    institution_ids: z.array(uuidSchema).min(1, "Choisissez au moins un établissement.").max(200),
    course_ids: z.array(uuidSchema).max(200),
    period_start: z.iso.date("Date de début requise."),
    period_end: z.iso.date("Date de fin requise."),
    attribution: z.enum(["direct", "shared", "context"], "Précisez la part du partenariat."),
    note: optionalText(500),
  })
  .refine((v) => v.period_end >= v.period_start, { message: "La fin doit suivre le début.", path: ["period_end"] })
  .refine((v) => Boolean(v.agreement_id || v.opportunity_id), { message: "Rattachez l’indicateur à une convention ou à un projet.", path: ["agreement_id"] });
