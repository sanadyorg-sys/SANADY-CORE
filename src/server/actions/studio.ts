"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { TASK_KINDS, TRAINING_STATUS, type TrainingStatus } from "@/lib/enterprise";
import { trainingProjectSchema } from "@/lib/enterprise-schema";
import { errorMessage, messageFor } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";
import { optionalText, parseInput, uuidSchema } from "@/lib/validation";
import { requireViewer } from "@/server/auth";

/** Custom training production studio (SANADY Enterprise, phase E4). Every rule is in the database. */

const STUDIO = "/admin/studio";

async function call(fn: string, args: Record<string, unknown>, paths: string[], success: string): Promise<ActionState> {
  await requireViewer();
  const { error } = await (await createClient()).rpc(fn, args);
  if (error) return { ok: false, message: errorMessage(error) };
  for (const p of paths) revalidatePath(p);
  return { ok: true, message: success };
}
const projectPaths = (id: string) => [STUDIO, `${STUDIO}/${id}`];

export async function saveTrainingProject(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireViewer();
  const id = String(formData.get("id") ?? "");
  const org = uuidSchema.safeParse(formData.get("organization_id"));
  if (!org.success) return { ok: false, message: messageFor("not_found") };
  const parsed = parseInput(trainingProjectSchema, formData);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors, message: "Certaines informations sont à compléter." };
  const { data, error } = await (await createClient()).rpc("save_training_project", { p_id: id || null, p_org: org.data, p: parsed.data });
  if (error) return { ok: false, message: errorMessage(error) };
  revalidatePath(STUDIO);
  revalidatePath(`/admin/partenariats/entreprises/clients/${org.data}`);
  if (!id) redirect(`${STUDIO}/${data as string}`);
  revalidatePath(`${STUDIO}/${id}`);
  return { ok: true, message: "Projet enregistré." };
}

export async function saveOutlineItem(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseInput(
    z.object({
      project_id: uuidSchema,
      id: z.union([uuidSchema, z.literal("")]).optional(),
      title: z.string().trim().min(2, "Titre du module requis.").max(200),
      description: optionalText(2000),
    }),
    formData,
  );
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const d = parsed.data;
  return call("save_outline_item", { p_id: d.id || null, p_project: d.project_id, p_title: d.title, p_description: d.description ?? null }, projectPaths(d.project_id), d.id ? "Module modifié." : "Module ajouté au programme.");
}

export async function moveOutlineItem(itemId: string, delta: number, projectId: string): Promise<ActionState> {
  if (!uuidSchema.safeParse(itemId).success) return { ok: false, message: messageFor("not_found") };
  return call("move_outline_item", { p_id: itemId, p_delta: delta < 0 ? -1 : 1 }, projectPaths(projectId), "Ordre mis à jour.");
}

export async function deleteOutlineItem(itemId: string, projectId: string): Promise<ActionState> {
  if (!uuidSchema.safeParse(itemId).success) return { ok: false, message: messageFor("not_found") };
  return call("delete_outline_item", { p_id: itemId }, projectPaths(projectId), "Module retiré du programme.");
}

export async function createProjectCourse(projectId: string): Promise<ActionState> {
  if (!uuidSchema.safeParse(projectId).success) return { ok: false, message: messageFor("not_found") };
  return call("create_project_course", { p_project: projectId }, [...projectPaths(projectId), "/admin/formations"], "Formation créée en brouillon à partir du programme.");
}

export async function assignProjectTrainer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseInput(z.object({ project_id: uuidSchema, user_id: uuidSchema }), formData);
  if (!parsed.ok) return { ok: false, fieldErrors: { user_id: "Choisissez un formateur." } };
  return call("assign_project_trainer", { p_project: parsed.data.project_id, p_user: parsed.data.user_id, p_assign: true }, projectPaths(parsed.data.project_id), "Formateur ajouté à la formation.");
}

export async function removeProjectTrainer(projectId: string, userId: string): Promise<ActionState> {
  if (!uuidSchema.safeParse(userId).success) return { ok: false, message: messageFor("not_found") };
  return call("assign_project_trainer", { p_project: projectId, p_user: userId, p_assign: false }, projectPaths(projectId), "Formateur retiré.");
}

export async function saveTrainingTask(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseInput(
    z.object({
      project_id: uuidSchema,
      kind: z.enum(Object.keys(TASK_KINDS) as [keyof typeof TASK_KINDS], "Choisissez un type."),
      title: z.string().trim().min(2, "Décrivez la tâche.").max(200),
      assigned_to: z.union([uuidSchema, z.literal("")]).optional(),
      due_on: z.union([z.iso.date("Date invalide."), z.literal("")]).optional(),
    }),
    formData,
  );
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const { project_id, ...task } = parsed.data;
  return call("save_training_task", { p_id: null, p_project: project_id, p: task }, projectPaths(project_id), "Tâche ajoutée.");
}

export async function setTrainingTaskStatus(taskId: string, status: "todo" | "in_progress" | "done", projectId: string): Promise<ActionState> {
  if (!uuidSchema.safeParse(taskId).success) return { ok: false, message: messageFor("not_found") };
  return call("set_training_task_status", { p_id: taskId, p_status: status }, projectPaths(projectId), status === "done" ? "Tâche terminée." : "Tâche mise à jour.");
}

export async function recordTrainingReview(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseInput(
    z.object({
      project_id: uuidSchema,
      kind: z.enum(["internal", "client"]),
      decision: z.enum(["approved", "changes_requested"], "Choisissez une décision."),
      comment: optionalText(4000),
      institution_id: z.union([uuidSchema, z.literal("")]).optional(),
    }),
    formData,
  );
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const d = parsed.data;
  if (d.decision === "changes_requested" && !d.comment) return { ok: false, fieldErrors: { comment: "Indiquez les modifications attendues." } };
  const paths = [...projectPaths(d.project_id), ...(d.institution_id ? [`/etablissement/${d.institution_id}/projets`] : [])];
  return call(
    "record_training_review",
    { p_project: d.project_id, p_kind: d.kind, p_decision: d.decision, p_comment: d.comment ?? null },
    paths,
    d.decision === "approved" ? "Validation enregistrée." : "Demande de modifications envoyée à l’équipe de production.",
  );
}

export async function setTrainingStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseInput(
    z.object({ id: uuidSchema, status: z.enum(Object.keys(TRAINING_STATUS) as [TrainingStatus], "Choisissez une action."), note: optionalText(1000) }),
    formData,
  );
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const { id, status, note } = parsed.data;
  return call("set_training_status", { p_project: id, p_status: status, p_note: note ?? null }, projectPaths(id), `Étape « ${TRAINING_STATUS[status].label} » enregistrée.`);
}
