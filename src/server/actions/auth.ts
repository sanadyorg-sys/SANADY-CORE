"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { publicEnv } from "@/lib/env";
import { errorMessage } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";
import { emailSchema, nameSchema, optionalText, parseInput, passwordSchema, safeRedirectPath, checkboxSchema } from "@/lib/validation";
import { getViewer, homeFor } from "@/server/auth";
import { clientIp, rateLimit } from "@/server/rate-limit";

const RATE_MESSAGE = "Trop de tentatives. Veuillez patienter quelques minutes avant de réessayer.";

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseInput(
    z.object({ email: emailSchema, password: z.string().min(1, "Veuillez saisir votre mot de passe."), suite: z.string().optional() }),
    formData,
  );
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const { email, password, suite } = parsed.data;

  const ip = await clientIp();
  const allowed =
    (await rateLimit(`login:ip:${ip}`, 30, 15 * 60)) && (await rateLimit(`login:email:${email}`, 8, 15 * 60));
  if (!allowed) return { ok: false, message: RATE_MESSAGE };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // Same message whatever the cause: no account enumeration.
    return { ok: false, message: "Adresse e-mail ou mot de passe incorrect." };
  }

  const viewer = await getViewer();
  if (viewer && viewer.profile.status !== "active") {
    await supabase.auth.signOut();
    return { ok: false, message: "Ce compte est suspendu. Contactez l’administration SANADY." };
  }
  redirect(safeRedirectPath(suite, viewer ? homeFor(viewer) : "/"));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/connexion");
}

export async function requestPasswordReset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseInput(z.object({ email: emailSchema }), formData);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };

  const ip = await clientIp();
  const allowed =
    (await rateLimit(`reset:ip:${ip}`, 10, 60 * 60)) && (await rateLimit(`reset:email:${parsed.data.email}`, 3, 60 * 60));
  if (!allowed) return { ok: false, message: RATE_MESSAGE };

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${publicEnv.appUrl}/auth/confirm?next=/nouveau-mot-de-passe`,
  });
  // Neutral response, whether or not the account exists.
  return {
    ok: true,
    message:
      "Si un compte correspond à cette adresse, vous recevrez un e-mail contenant un lien de réinitialisation valable une heure.",
  };
}

export async function updatePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseInput(
    z
      .object({ password: passwordSchema, confirm: z.string() })
      .refine((v) => v.password === v.confirm, { message: "Les mots de passe ne correspondent pas.", path: ["confirm"] }),
    formData,
  );
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) {
    return { ok: false, message: "Le lien de réinitialisation a expiré. Veuillez refaire une demande." };
  }
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return {
      ok: false,
      message:
        error.code === "same_password"
          ? "Le nouveau mot de passe doit être différent de l’ancien."
          : "Le mot de passe n’a pas pu être modifié. Veuillez réessayer.",
    };
  }
  const viewer = await getViewer();
  redirect(viewer ? homeFor(viewer) : "/");
}

export async function completeOnboarding(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseInput(
    z.object({
      first_name: nameSchema("prénom"),
      last_name: nameSchema("nom"),
      job_title: optionalText(150),
      subject_area: optionalText(150),
      privacy: checkboxSchema.refine((v) => v, "Veuillez confirmer avoir pris connaissance de la notice."),
    }),
    formData,
  );
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_onboarding", {
    p_first_name: parsed.data.first_name,
    p_last_name: parsed.data.last_name,
    p_job_title: parsed.data.job_title ?? null,
    p_subject_area: parsed.data.subject_area ?? null,
  });
  if (error) return { ok: false, message: errorMessage(error) };

  const viewer = await getViewer();
  redirect(viewer ? homeFor(viewer) : "/");
}
