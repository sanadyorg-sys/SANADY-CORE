import { z } from "zod";
import { emailSchema, optionalText } from "./validation";
import { COST_CATEGORIES, EMPLOYEE_COUNTS, ENTERPRISE_SERVICES, EXISTING_CONTENT, LANGUAGES, LINE_CATEGORIES, PAYMENT_METHODS, REVENUE_CATEGORIES, SUPPORT_CATEGORIES, type SupportCategory } from "./enterprise";
import { ORG_TYPES } from "./partnerships";

/**
 * Enterprise request, validated step by step in the browser and again, in
 * full, on the server. Limits mirror the database (migration
 * 20261018000100_enterprise.sql).
 */
const required = (label: string, min: number, max: number) =>
  z.string().trim().min(1, `Veuillez renseigner ${label}.`).min(min, `${min} caractères minimum.`).max(max, `${max} caractères maximum.`);
const keys = <T extends Record<string, unknown>>(o: T) => Object.keys(o) as [keyof T & string, ...Array<keyof T & string>];

const website = z
  .string()
  .trim()
  .max(300, "Adresse trop longue.")
  .optional()
  .transform((v) => (v ? (/^https?:\/\//i.test(v) ? v : `https://${v}`) : undefined))
  .refine((v) => !v || /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(v), "Adresse de site web invalide.");

export const orgStep = z.object({
  org_name: required("le nom de l’organisation", 2, 200),
  org_type: z.enum(keys(ORG_TYPES), "Choisissez un type d’organisation."),
  country: required("le pays", 2, 80),
  city: optionalText(100),
  website,
  sector: optionalText(150),
  employee_count: z.enum(keys(EMPLOYEE_COUNTS), "Indiquez l’effectif."),
});

export const contactStep = z.object({
  contact_name: required("votre nom complet", 2, 150),
  contact_title: required("votre fonction", 2, 150),
  contact_email: emailSchema,
  contact_phone: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v ? v : undefined))
    .refine((v) => !v || /^[+\d][\d\s().-]{5,}$/.test(v), "Numéro de téléphone invalide."),
});

export const serviceStep = z.object({
  service: z.enum(keys(ENTERPRISE_SERVICES), "Choisissez un service."),
});

export const needsStep = z.object({
  topic: required("le thème de la formation", 3, 200),
  target_population: required("le public concerné", 3, 500),
  learner_count: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.replace(/\s/g, "") : undefined))
    .refine((v) => !v || (/^\d{1,7}$/.test(v) && Number(v) >= 1), "Nombre invalide."),
  outcomes: required("les résultats attendus", 20, 3000),
  existing_content: z.enum(keys(EXISTING_CONTENT), "Indiquez si des contenus existent."),
  language: z.enum(keys(LANGUAGES), "Choisissez une langue."),
  timeline: optionalText(150),
  reporting: optionalText(1000),
  accessibility: optionalText(1000),
  extra: optionalText(2000),
});

export const enterpriseRequestSchema = orgStep.merge(contactStep).merge(serviceStep).merge(needsStep);
export const ENTERPRISE_STEPS = [orgStep, contactStep, serviceStep, needsStep] as const;

/* ─── Team forms ─────────────────────────────────────────────────────────── */

const money = z
  .string()
  .trim()
  .transform((v) => v.replace(/\s/g, "").replace(",", "."))
  .refine((v) => /^\d{1,10}(\.\d{1,2})?$/.test(v), "Montant invalide.");

export const proposalSchema = z.object({
  title: required("le titre", 5, 200),
  service: z.enum(keys(ENTERPRISE_SERVICES).filter((k) => k !== "partenariat") as ["sur_mesure", "plateforme", "complete"], "Choisissez un service."),
  summary: optionalText(3000),
  currency: z.enum(["MAD", "EUR", "USD"]).default("MAD"),
  valid_until: z
    .union([z.iso.date("Date invalide."), z.literal("")])
    .optional()
    .refine((v) => !v || v >= new Date().toISOString().slice(0, 10), "La date ne peut pas être passée."),
});

export const lineSchema = z.object({
  category: z.enum(keys(LINE_CATEGORIES), "Choisissez une catégorie."),
  label: required("le libellé", 2, 200),
  quantity: money.refine((v) => Number(v) > 0, "La quantité doit être positive."),
  unit: optionalText(40),
  unit_price: money,
});

/** Company workspace configuration (phase E3) — mirrors public.enterprise_tenants. */
const count = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .transform((v) => v.replace(/\s/g, ""))
    .refine((v) => /^\d{1,6}$/.test(v) && Number(v) >= min && Number(v) <= max, `${label} : nombre entre ${min} et ${max}.`);
const optionalCount = (label: string, max: number) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.replace(/\s/g, "") : undefined))
    .refine((v) => !v || (/^\d{1,7}$/.test(v) && Number(v) >= 1 && Number(v) <= max), `${label} : nombre invalide.`);
const date = z.union([z.iso.date("Date invalide."), z.literal("")]).optional();

export const tenantSchema = z
  .object({
    display_name: z.string().trim().min(2, "Nom de l’espace requis.").max(200),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/, "Adresse : 3 à 60 caractères, lettres minuscules, chiffres et tirets."),
    service_plan: z.enum(["plateforme", "sur_mesure", "complete"], "Choisissez une formule."),
    max_learners: count("Collaborateurs autorisés", 1, 100000),
    storage_allowance_gb: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v.replace(",", ".") : undefined))
      .refine((v) => !v || (/^\d{1,5}(\.\d{1,2})?$/.test(v) && Number(v) > 0), "Stockage : nombre de Go invalide."),
    video_minutes_allowance: optionalCount("Minutes de vidéo", 10_000_000),
    support_level: optionalText(200),
    support_email: z.union([z.email("Adresse e-mail invalide."), z.literal("")]).optional(),
    primary_contact_id: z.union([z.uuid(), z.literal("")]).optional(),
    proposal_id: z.union([z.uuid(), z.literal("")]).optional(),
    contract_start_on: date,
    contract_end_on: date,
    certificate_kind: z.enum(["attestation", "certificat"]).default("attestation"),
  })
  .refine((v) => !v.contract_start_on || !v.contract_end_on || v.contract_end_on >= v.contract_start_on, {
    message: "La fin du contrat doit suivre son début.",
    path: ["contract_end_on"],
  });

/** Training project brief (phase E4) — mirrors public.training_projects. */
export const trainingProjectSchema = z.object({
  title: z.string().trim().min(5, "Titre : 5 caractères minimum.").max(200),
  target_audience: z.string().trim().min(3, "Décrivez le public visé.").max(1000),
  objectives: optionalText(4000),
  constraints: optionalText(2000),
  language: z.enum(["fr", "ar", "en", "multiple"]).default("fr"),
  target_minutes: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.replace(/\s/g, "") : undefined))
    .refine((v) => !v || (/^\d{2,6}$/.test(v) && Number(v) >= 10), "Durée en minutes (10 au minimum)."),
  ownership: z.enum(["company", "joint", "licensed"], "Choisissez la propriété du contenu."),
  client_review_required: z
    .union([z.literal("on"), z.literal("true"), z.literal("")])
    .optional()
    .transform((v) => v === "on" || v === "true"),
  due_on: z.union([z.iso.date("Date invalide."), z.literal("")]).optional(),
  tenant_id: z.union([z.uuid(), z.literal("")]).optional(),
  proposal_id: z.union([z.uuid(), z.literal("")]).optional(),
  lead_id: z.union([z.uuid(), z.literal("")]).optional(),
});

/** Commercial contract terms (phase E5) — mirrors public.enterprise_contracts. */
export const contractSchema = z
  .object({
    title: z.string().trim().min(5, "Intitulé : 5 caractères minimum.").max(200),
    pricing_model: z.enum(["annual_subscription", "monthly_subscription", "per_active_learner", "per_enrolled_learner", "fixed_fee", "mixed"], "Choisissez un modèle."),
    currency: z.enum(["MAD", "EUR", "USD"]).default("MAD"),
    start_on: date,
    end_on: date,
    renewal_terms: optionalText(2000),
    renewal_notice_days: z
      .string()
      .trim()
      .optional()
      .refine((v) => !v || (/^\d{1,3}$/.test(v) && Number(v) <= 365), "Entre 0 et 365 jours."),
    learner_limit: optionalCount("Collaborateurs", 100000),
    storage_limit_gb: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v.replace(",", ".") : undefined))
      .refine((v) => !v || (/^\d{1,5}(\.\d{1,2})?$/.test(v) && Number(v) > 0), "Stockage : nombre de Go invalide."),
    video_minutes_limit: optionalCount("Minutes de vidéo", 10_000_000),
    support_commitments: optionalText(2000),
    data_ownership: optionalText(2000),
    content_ownership: optionalText(2000),
    termination_provisions: optionalText(2000),
    tenant_id: z.union([z.uuid(), z.literal("")]).optional(),
  })
  .refine((v) => !v.start_on || !v.end_on || v.end_on >= v.start_on, { message: "La fin doit suivre le début.", path: ["end_on"] });

/* ─── Phase E6: recorded invoices, payments and costs ─────────────────────── */

const isoDay = z.iso.date("Date requise.");
const amountRequired = money.refine((v) => Boolean(v) && Number(v) > 0, "Montant requis.");

export const invoiceSchema = z
  .object({
    external_reference: z.string().trim().min(1, "Référence de la facture (comptabilité).").max(80),
    category: z.enum(keys(REVENUE_CATEGORIES), "Choisissez une catégorie."),
    description: optionalText(500),
    amount: amountRequired,
    issued_on: isoDay.refine((v) => v <= new Date().toISOString().slice(0, 10), "La date ne peut pas être future."),
    due_on: z.union([z.iso.date("Date invalide."), z.literal("")]).optional(),
  })
  .refine((v) => !v.due_on || v.due_on >= v.issued_on, { message: "L’échéance suit l’émission.", path: ["due_on"] });

export const paymentSchema = z.object({
  amount: amountRequired,
  received_on: isoDay.refine((v) => v <= new Date().toISOString().slice(0, 10), "La date ne peut pas être future."),
  method: z.enum(keys(PAYMENT_METHODS)).default("transfer"),
  bank_reference: optionalText(120),
});

export const costSchema = z.object({
  category: z.enum(keys(COST_CATEGORIES), "Choisissez une catégorie."),
  description: z.string().trim().min(3, "Décrivez le coût.").max(500),
  amount: amountRequired,
  currency: z.enum(["MAD", "EUR", "USD"]).default("MAD"),
  incurred_on: isoDay,
  is_estimate: z
    .union([z.literal("on"), z.literal("")])
    .optional()
    .transform((v) => v === "on"),
  contract_id: z.union([z.uuid(), z.literal("")]).optional(),
});

export const supportRequestSchema = z.object({
  category: z.enum(Object.keys(SUPPORT_CATEGORIES) as [SupportCategory], "Choisissez le type de demande."),
  priority: z.enum(["normal", "urgent"], "Choisissez la priorité."),
  subject: z.string().trim().min(5, "Décrivez la demande en quelques mots (5 caractères au moins).").max(200),
  body: z.string().trim().min(10, "Expliquez la situation (10 caractères au moins).").max(6000),
});

export const supportMessageSchema = z.object({
  body: z.string().trim().min(2, "Écrivez votre message.").max(6000),
});

/** Reusable service plan (mirrors public.enterprise_service_plans). */
export const planSchema = z.object({
  name: z.string().trim().min(3, "Nom : 3 caractères minimum.").max(120),
  service: z.enum(["sur_mesure", "plateforme", "complete"], "Choisissez un service."),
  description: optionalText(2000),
  currency: z.enum(["MAD", "EUR", "USD"]).default("MAD"),
  pricing_model: z.enum(["annual_subscription", "monthly_subscription", "per_active_learner", "per_enrolled_learner", "fixed_fee", "mixed"], "Choisissez un modèle."),
  learner_limit: optionalCount("Collaborateurs", 100000),
  storage_limit_gb: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.replace(",", ".") : undefined))
    .refine((v) => !v || (/^\d{1,5}(\.\d{1,2})?$/.test(v) && Number(v) > 0), "Stockage : nombre de Go invalide."),
  video_minutes_limit: optionalCount("Minutes de vidéo", 10_000_000),
  support_level: optionalText(200),
  support_commitments: optionalText(2000),
});

/** Company assessment policy (mirrors public.enterprise_assessment_policies). */
export const assessmentPolicySchema = z.object({
  pass_threshold: z
    .string()
    .trim()
    .refine((v) => /^\d{2,3}$/.test(v) && Number(v) >= 50 && Number(v) <= 100, "Seuil entre 50 et 100 %."),
  max_attempts: z
    .string()
    .trim()
    .refine((v) => /^\d{1,2}$/.test(v) && Number(v) >= 1 && Number(v) <= 10, "Entre 1 et 10 tentatives."),
  feedback: z.enum(["after_pass", "after_each_attempt", "never"], "Choisissez quand montrer les réponses."),
  certificates: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  enforce_due_dates: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  contract_id: z.union([z.uuid(), z.literal("")]).optional(),
  note: optionalText(1000),
});
