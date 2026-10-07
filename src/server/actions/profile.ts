"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { errorMessage, messageFor } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";
import { nameSchema, optionalText, parseInput, passwordSchema, uuidSchema } from "@/lib/validation";
import { getViewer } from "@/server/auth";
import { rateLimit } from "@/server/rate-limit";

export async function updateProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseInput(
    z.object({
      first_name: nameSchema("prénom"),
      last_name: nameSchema("nom"),
      job_title: optionalText(150),
      subject_area: optionalText(150),
      phone: optionalText(30),
    }),
    formData,
  );
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const viewer = await getViewer();
  if (!viewer) return { ok: false, message: messageFor("not_authenticated") };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: parsed.data.first_name,
      last_name: parsed.data.last_name,
      job_title: parsed.data.job_title ?? null,
      subject_area: parsed.data.subject_area ?? null,
      phone: parsed.data.phone ?? null,
    })
    .eq("id", viewer.id);
  if (error) return { ok: false, message: errorMessage(error) };
  revalidatePath("/", "layout");
  return { ok: true, message: "Vos informations ont été enregistrées." };
}

export async function changePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseInput(
    z
      .object({ current: z.string().min(1, "Saisissez votre mot de passe actuel."), password: passwordSchema, confirm: z.string() })
      .refine((v) => v.password === v.confirm, { message: "Les mots de passe ne correspondent pas.", path: ["confirm"] }),
    formData,
  );
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const viewer = await getViewer();
  if (!viewer) return { ok: false, message: messageFor("not_authenticated") };
  if (!(await rateLimit(`pwd-change:${viewer.id}`, 5, 15 * 60))) return { ok: false, message: messageFor("rate_limited") };

  const supabase = await createClient();
  // Re-authenticate before a sensitive change.
  const { error: authError } = await supabase.auth.signInWithPassword({ email: viewer.email, password: parsed.data.current });
  if (authError) return { ok: false, fieldErrors: { current: "Mot de passe actuel incorrect." } };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return {
      ok: false,
      message:
        error.code === "same_password"
          ? "Le nouveau mot de passe doit être différent de l’ancien."
          : error.code === "weak_password"
            ? "Ce mot de passe est trop faible. Choisissez-en un autre."
            : "Le mot de passe n’a pas pu être modifié.",
    };
  }
  return { ok: true, message: "Votre mot de passe a été modifié." };
}

export async function leaveInstitution(institutionId: string): Promise<ActionState> {
  const id = uuidSchema.safeParse(institutionId);
  if (!id.success) return { ok: false, message: messageFor("not_found") };
  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_institution", { p_institution: id.data });
  if (error) return { ok: false, message: errorMessage(error) };
  revalidatePath("/", "layout");
  return { ok: true, message: "Vous avez quitté l’établissement." };
}
