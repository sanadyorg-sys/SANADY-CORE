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
});

export const applicationSchema = organizationStep.merge(contactStep).merge(proposalStep);
export type ApplicationInput = z.output<typeof applicationSchema>;

export const STEP_SCHEMAS = [organizationStep, contactStep, proposalStep] as const;
