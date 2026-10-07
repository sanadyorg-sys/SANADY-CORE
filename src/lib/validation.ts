import { z } from "zod";

/** Shared input schemas. Every server action validates its input with these. */

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Veuillez saisir une adresse e-mail.")
  .max(254, "Adresse e-mail trop longue.")
  .pipe(z.email("Adresse e-mail invalide."));

export const passwordSchema = z
  .string()
  .min(10, "Le mot de passe doit contenir au moins 10 caractères.")
  .max(128, "Le mot de passe est trop long.")
  .refine((v) => /[A-Za-zÀ-ÿ]/.test(v) && /\d/.test(v), "Le mot de passe doit contenir des lettres et au moins un chiffre.");

export const nameSchema = (label: string) =>
  z.string().trim().min(1, `Veuillez saisir votre ${label}.`).max(100, `${label[0]!.toUpperCase()}${label.slice(1)} trop long.`);

export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères maximum.`)
    .optional()
    .transform((v) => (v ? v : undefined));

export const uuidSchema = z.uuid("Identifiant invalide.");

export const checkboxSchema = z
  .union([z.literal("on"), z.literal("true"), z.literal("1"), z.undefined(), z.null()])
  .transform((v) => v === "on" || v === "true" || v === "1");

export type ParseResult<T> = { ok: true; data: T } | { ok: false; fieldErrors: Record<string, string> };

/** Parses FormData (or a plain object) and returns the first error per field. */
export function parseInput<T extends z.ZodType>(schema: T, input: FormData | Record<string, unknown>): ParseResult<z.output<T>> {
  const raw = input instanceof FormData ? Object.fromEntries(input.entries()) : input;
  const result = schema.safeParse(raw);
  if (result.success) return { ok: true, data: result.data };
  const fieldErrors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "_form");
    fieldErrors[key] ??= issue.message;
  }
  return { ok: false, fieldErrors };
}

/** Accepts only same-site relative paths (prevents open redirects). */
export function safeRedirectPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
