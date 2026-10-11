"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { errorMessage, messageFor } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createInvitationToken } from "@/lib/tokens";
import type { ActionState } from "@/lib/types";
import { checkboxSchema, emailSchema, nameSchema, optionalText, parseInput, uuidSchema } from "@/lib/validation";
import { requireSanadyAdmin } from "@/server/auth";
import { deliverInvitation } from "@/server/invitation-delivery";
import { clientIp, rateLimit } from "@/server/rate-limit";

const SENT: ActionState = {
  ok: true,
  message:
    "Votre demande a bien été envoyée. L’équipe SANADY l’étudie et vous recevrez une invitation par e-mail si elle est acceptée.",
};

/* ─── Public: request access (invitation-only platform) ────────────────── */

export async function requestAccess(_prev: ActionState, formData: FormData): Promise<ActionState> {
  // Bots fill every field, including this invisible one: pretend success.
  if (String(formData.get("site_web") ?? "").trim() !== "") return SENT;

  const parsed = parseInput(
    z.object({
      first_name: nameSchema("prénom"),
      last_name: nameSchema("nom"),
      email: emailSchema,
      job_title: optionalText(150),
      subject_area: optionalText(150),
      institution_name: optionalText(200),
      city: optionalText(100),
      message: optionalText(1000),
      course_id: z.union([uuidSchema, z.literal("")]).optional(),
      kind: z.enum(["teacher", "institution"]).default("teacher"),
      consent: checkboxSchema.refine(Boolean, "Veuillez accepter le traitement de vos données pour envoyer la demande."),
    }),
    formData,
  );
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const d = parsed.data;

  const ip = await clientIp();
  if (!(await rateLimit(`access-request:${ip}`, 5, 60 * 60)) || !(await rateLimit(`access-request:${d.email}`, 3, 24 * 60 * 60))) {
    return { ok: false, message: messageFor("rate_limited") };
  }

  const { error } = await createAdminClient().rpc("request_access", {
    p_first_name: d.first_name,
    p_last_name: d.last_name,
    p_email: d.email,
    p_job_title: d.job_title ?? null,
    p_subject_area: d.subject_area ?? null,
    p_institution: d.institution_name ?? null,
    p_city: d.city ?? null,
    p_message: d.message ?? "",
    p_course: d.course_id || null,
    p_kind: d.kind,
  });
  if (error) {
    console.error("[access-request]", error.message);
    return { ok: false, message: "La demande n’a pas pu être enregistrée. Réessayez dans quelques minutes." };
  }
  revalidatePath("/admin/demandes");
  return SENT;
}

/* ─── SANADY administrators: decide ─────────────────────────────────────── */

export async function approveAccessRequest(requestId: string): Promise<ActionState> {
  await requireSanadyAdmin();
  const id = uuidSchema.safeParse(requestId);
  if (!id.success) return { ok: false, message: messageFor("not_found") };

  const supabase = await createClient();
  const { data } = await supabase.from("access_requests").select("email, status, kind").eq("id", id.data).maybeSingle();
  const request = data as { email: string; status: string; kind: "teacher" | "institution" } | null;
  if (!request || request.status !== "pending") return { ok: false, message: messageFor("not_found") };

  // Partnership: the team creates the institution and invites its administrator.
  if (request.kind === "institution") {
    const { error } = await supabase.rpc("resolve_access_request", { p_request: id.data, p_status: "approved", p_invitation: null });
    if (error) return { ok: false, message: errorMessage(error) };
    revalidatePath("/admin/demandes");
    return { ok: true, message: "Demande acceptée. Créez l’établissement puis invitez son administrateur." };
  }

  const { token, hash } = createInvitationToken();
  const { data: invitationId, error } = await supabase.rpc("create_invitation", {
    p_kind: "teacher",
    p_email: request.email,
    p_institution: null,
    p_token_hash: hash,
  });
  if (error) return { ok: false, message: errorMessage(error) };

  const { error: resolveError } = await supabase.rpc("resolve_access_request", {
    p_request: id.data,
    p_status: "approved",
    p_invitation: invitationId,
  });
  if (resolveError) return { ok: false, message: errorMessage(resolveError) };

  const result = await deliverInvitation({ invitationId: invitationId as string, kind: "teacher", email: request.email, token, institutionId: null });
  revalidatePath("/admin/demandes");
  revalidatePath("/admin/invitations");
  return result;
}

export async function rejectAccessRequest(requestId: string): Promise<ActionState> {
  await requireSanadyAdmin();
  const id = uuidSchema.safeParse(requestId);
  if (!id.success) return { ok: false, message: messageFor("not_found") };
  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_access_request", { p_request: id.data, p_status: "rejected", p_invitation: null });
  if (error) return { ok: false, message: errorMessage(error) };
  revalidatePath("/admin/demandes");
  return { ok: true, message: "Demande refusée." };
}
