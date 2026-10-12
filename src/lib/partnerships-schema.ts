import { z } from "zod";
import { emailSchema, optionalText } from "./validation";
import { CONTRIBUTION_TYPES, INTERVENTION_FIELDS, ORG_TYPES } from "./partnerships";

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
