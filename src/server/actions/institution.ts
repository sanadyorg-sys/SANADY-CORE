"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { errorMessage, messageFor } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";
import { uuidSchema } from "@/lib/validation";

/** Assigns an authorized course to one or more teachers of the institution. */
export async function assignCourse(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .object({
      institution_id: uuidSchema,
      course_id: uuidSchema,
      user_ids: z.array(uuidSchema).min(1, "Sélectionnez au moins un enseignant.").max(500),
      due_on: z.union([z.iso.date("Date invalide."), z.literal("")]).optional(),
    })
    .safeParse({
      institution_id: formData.get("institution_id"),
      course_id: formData.get("course_id"),
      user_ids: formData.getAll("user_ids"),
      due_on: formData.get("due_on") ?? "",
    });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, fieldErrors: { [String(issue?.path[0] ?? "_form")]: issue?.message ?? "Données invalides." } };
  }
  const { institution_id, course_id, user_ids, due_on } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("assign_course", {
    p_institution: institution_id,
    p_course: course_id,
    p_users: user_ids,
    p_due_on: due_on || null,
  });
  if (error) return { ok: false, message: errorMessage(error) };

  revalidatePath(`/etablissement/${institution_id}`, "layout");
  const count = Number(data ?? 0);
  return {
    ok: true,
    message:
      count === 0
        ? "Ces enseignants avaient déjà cette formation."
        : `Formation affectée à ${count} enseignant${count > 1 ? "s" : ""}.`,
  };
}

export async function unassignCourse(assignmentId: string, institutionId: string): Promise<ActionState> {
  const id = uuidSchema.safeParse(assignmentId);
  if (!id.success) return { ok: false, message: messageFor("not_found") };
  const supabase = await createClient();
  const { error } = await supabase.rpc("unassign_course", { p_assignment: id.data });
  if (error) return { ok: false, message: errorMessage(error) };
  revalidatePath(`/etablissement/${institutionId}`, "layout");
  return { ok: true, message: "Affectation retirée. La progression de l’enseignant est conservée." };
}

export async function revokeMembership(membershipId: string, institutionId: string): Promise<ActionState> {
  const id = uuidSchema.safeParse(membershipId);
  if (!id.success) return { ok: false, message: messageFor("not_found") };
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_membership", { p_membership: id.data });
  if (error) return { ok: false, message: errorMessage(error) };
  revalidatePath(`/etablissement/${institutionId}`, "layout");
  revalidatePath(`/admin/etablissements/${institutionId}`);
  return { ok: true, message: "L’enseignant a été retiré de l’établissement." };
}
