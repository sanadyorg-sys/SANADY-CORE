import { z } from "zod";
import { emailSchema, optionalText } from "./validation";
import { EMPLOYEE_COUNTS, ENTERPRISE_SERVICES, EXISTING_CONTENT, LANGUAGES, LINE_CATEGORIES } from "./enterprise";
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
