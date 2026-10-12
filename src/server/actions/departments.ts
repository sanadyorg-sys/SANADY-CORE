"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { errorMessage, messageFor } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { createInvitationToken } from "@/lib/tokens";
import type { ActionState } from "@/lib/types";
import { emailSchema, parseInput, uuidSchema } from "@/lib/validation";
import { requireInstitutionAdmin } from "@/server/auth";
import { deliverInvitation } from "@/server/invitation-delivery";
import { rateLimit } from "@/server/rate-limit";

/** Company workspaces (SANADY Enterprise, phase E3): departments and bulk invitations. */

const paths = (institutionId: string) => [`/etablissement/${institutionId}/services`, `/etablissement/${institutionId}/enseignants`];

export async function saveDepartment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseInput(
    z.object({ institution_id: uuidSchema, id: z.union([uuidSchema, z.literal("")]).optional(), name: z.string().trim().min(2, "Nom du service requis.").max(120) }),
    formData,
  );
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const d = parsed.data;
  await requireInstitutionAdmin(d.institution_id);
  const { error } = await (await createClient()).rpc("save_department", { p_id: d.id || null, p_institution: d.institution_id, p_name: d.name });
  if (error) return { ok: false, message: errorMessage(error) };
  for (const p of paths(d.institution_id)) revalidatePath(p);
  return { ok: true, message: d.id ? "Service renommé." : "Service ajouté." };
}

export async function deleteDepartment(departmentId: string, institutionId: string): Promise<ActionState> {
  if (!uuidSchema.safeParse(departmentId).success || !uuidSchema.safeParse(institutionId).success) return { ok: false, message: messageFor("not_found") };
  await requireInstitutionAdmin(institutionId);
  const { error } = await (await createClient()).rpc("delete_department", { p_id: departmentId });
  if (error) return { ok: false, message: errorMessage(error) };
  for (const p of paths(institutionId)) revalidatePath(p);
  return { ok: true, message: "Service supprimé. Les collaborateurs concernés sont conservés, sans service." };
}

export async function setMemberDepartment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseInput(
    z.object({ institution_id: uuidSchema, user_id: uuidSchema, department_id: z.union([uuidSchema, z.literal("")]).optional() }),
    formData,
  );
  if (!parsed.ok) return { ok: false, message: "Choix invalide." };
  const d = parsed.data;
  await requireInstitutionAdmin(d.institution_id);
  const { error } = await (await createClient()).rpc("set_member_department", {
    p_institution: d.institution_id,
    p_user: d.user_id,
    p_department: d.department_id || null,
  });
  if (error) return { ok: false, message: errorMessage(error) };
  for (const p of paths(d.institution_id)) revalidatePath(p);
  return { ok: true, message: "Service mis à jour." };
}

export interface BulkResult {
  email: string;
  ok: boolean;
  message: string;
  link?: string;
}

const MAX_ROWS = 200;

/**
 * Bulk invitations from a CSV list: one line per person, « e-mail » or
 * « e-mail;service ». Each line is checked by the database like a single
 * invitation (active workspace, learner limit, duplicates).
 */
export async function bulkInvite(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const institutionId = uuidSchema.safeParse(formData.get("institution_id"));
  if (!institutionId.success) return { ok: false, message: messageFor("not_found") };
  const { viewer } = await requireInstitutionAdmin(institutionId.data);

  const text = String(formData.get("csv") ?? "");
  const file = formData.get("file");
  const raw = file instanceof File && file.size > 0 ? (file.size > 200_000 ? "" : await file.text()) : text;
  const lines = raw
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l, i) => !(i === 0 && /e-?mail/i.test(l) && !l.includes("@")));
  if (!lines.length) return { ok: false, fieldErrors: { csv: "Collez une adresse e-mail par ligne, ou joignez un fichier CSV." } };
  if (lines.length > MAX_ROWS) return { ok: false, fieldErrors: { csv: `${MAX_ROWS} lignes au maximum par envoi.` } };
  if (!(await rateLimit(`invite-bulk:${viewer.id}`, 10, 60 * 60))) return { ok: false, message: messageFor("rate_limited") };

  const supabase = await createClient();
  const { data: deps } = await supabase.from("enterprise_departments").select("id, name").eq("institution_id", institutionId.data);
  const departments = new Map(((deps ?? []) as Array<{ id: string; name: string }>).map((d) => [d.name.toLocaleLowerCase("fr"), d.id]));

  const seen = new Set<string>();
  const results: BulkResult[] = [];
  for (const line of lines) {
    const [rawEmail, rawDepartment] = line.split(/[;,\t]/).map((c) => c.trim().replace(/^"|"$/g, ""));
    const email = emailSchema.safeParse(rawEmail ?? "");
    if (!email.success) {
      results.push({ email: rawEmail ?? line, ok: false, message: "Adresse e-mail invalide." });
      continue;
    }
    if (seen.has(email.data)) {
      results.push({ email: email.data, ok: false, message: "Doublon dans la liste." });
      continue;
    }
    seen.add(email.data);
    const departmentId = rawDepartment ? departments.get(rawDepartment.toLocaleLowerCase("fr")) : undefined;
    if (rawDepartment && !departmentId) {
      results.push({ email: email.data, ok: false, message: `Service « ${rawDepartment} » inconnu : créez-le d’abord.` });
      continue;
    }
    const { token, hash } = createInvitationToken();
    const { data: invitationId, error } = await supabase.rpc("create_invitation", {
      p_kind: "institution_teacher",
      p_email: email.data,
      p_institution: institutionId.data,
      p_token_hash: hash,
    });
    if (error) {
      results.push({ email: email.data, ok: false, message: errorMessage(error) });
      continue;
    }
    if (departmentId) await supabase.rpc("set_invitation_department", { p_invitation: invitationId, p_department: departmentId });
    const delivered = await deliverInvitation({ invitationId: invitationId as string, kind: "institution_teacher", email: email.data, token, institutionId: institutionId.data });
    const link = (delivered.data as { link?: string } | undefined)?.link;
    results.push({ email: email.data, ok: true, message: link ? "Invitation créée — lien à transmettre" : "Invitation envoyée", link });
  }

  for (const p of paths(institutionId.data)) revalidatePath(p);
  revalidatePath(`/etablissement/${institutionId.data}/enseignants/invitations`);
  const sent = results.filter((r) => r.ok).length;
  return {
    ok: sent > 0,
    message: `${sent} invitation(s) créée(s) sur ${results.length} ligne(s).`,
    data: { results },
  };
}
