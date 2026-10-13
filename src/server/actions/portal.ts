"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { errorMessage, messageFor } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createInvitationToken } from "@/lib/tokens";
import type { ActionState } from "@/lib/types";
import { emailSchema, optionalText, parseInput, uuidSchema } from "@/lib/validation";
import { requirePartnerMember, requirePartnershipStaff, requireSanadyAdmin } from "@/server/auth";
import { deliverInvitation } from "@/server/invitation-delivery";
import { signedPdfUpload, verifyPdfUploads } from "@/server/pdf-upload";

/** Partner portal (partnerships phase 6). Every rule is in the database. */

const PORTAL = "/espace-partenaire";

/* ─── Partner side ──────────────────────────────────────────────────────── */

export async function preparePartnerUpload(input: { name: string; size: number; type: string }) {
  await requirePartnerMember();
  return signedPdfUpload("partnerships", input);
}

export async function submitDeliverable(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePartnerMember();
  const parsed = parseInput(
    z.object({
      title: z.string().trim().min(3, "Donnez un titre au livrable.").max(200),
      description: optionalText(2000),
      agreement_id: z.union([uuidSchema, z.literal("")]).optional(),
    }),
    formData,
  );
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const id = randomUUID();
  const uploads = await verifyPdfUploads("partnerships", formData, "deliverables", id);
  if (!uploads.ok) return uploads.state;
  if (!uploads.documents.length) return { ok: false, fieldErrors: { documents: "Joignez au moins un document PDF." } };
  const { error } = await (await createClient()).rpc("submit_partner_deliverable", {
    p_id: id,
    p: parsed.data,
    p_documents: uploads.documents.map((d) => ({ path: d.path, name: d.name, size: d.size })),
  });
  if (error) {
    await createAdminClient().storage.from("partnerships").remove(uploads.documents.map((d) => d.path));
    return { ok: false, message: errorMessage(error) };
  }
  revalidatePath(`${PORTAL}/livrables`);
  revalidatePath(`${PORTAL}/messages`);
  return { ok: true, message: "Livrable transmis à l’équipe SANADY." };
}

export async function postPortalMessage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requirePartnerMember();
  const body = z.string().trim().min(1, "Écrivez votre message.").max(4000).safeParse(formData.get("body"));
  if (!body.success) return { ok: false, fieldErrors: { body: body.error.issues[0]?.message ?? "Message invalide." } };
  const { error } = await (await createClient()).rpc("post_partner_message", { p_org: viewer.partnerOrganization.id, p_body: body.data });
  if (error) return { ok: false, message: errorMessage(error) };
  revalidatePath(`${PORTAL}/messages`);
  return { ok: true, message: "Message envoyé." };
}

/* ─── SANADY side ───────────────────────────────────────────────────────── */

const orgPath = (id: string) => `/admin/partenariats/organisations/${id}`;

export async function setPartnerPortal(enabled: boolean): Promise<ActionState> {
  await requireSanadyAdmin();
  const { error } = await (await createClient()).rpc("set_partner_portal", { p_enabled: enabled });
  if (error) return { ok: false, message: errorMessage(error) };
  revalidatePath("/admin/parametres");
  return { ok: true, message: enabled ? "Espace partenaire activé." : "Espace partenaire désactivé : plus aucun partenaire n’y a accès." };
}

export async function invitePartnerMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePartnershipStaff();
  const parsed = parseInput(z.object({ organization_id: uuidSchema, email: emailSchema }), formData);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const supabase = await createClient();
  const { token, hash } = createInvitationToken();
  const { data: invitationId, error } = await supabase.rpc("invite_partner_member", { p_org: parsed.data.organization_id, p_email: parsed.data.email, p_token_hash: hash });
  if (error) return { ok: false, message: errorMessage(error) };
  const [{ data: org }, { data: inv }] = await Promise.all([
    supabase.from("partner_organizations").select("name").eq("id", parsed.data.organization_id).maybeSingle(),
    supabase.from("invitations").select("expires_at").eq("id", invitationId as string).maybeSingle(),
  ]);
  const result = await deliverInvitation({
    invitationId: invitationId as string,
    kind: "partner_member",
    email: parsed.data.email,
    token,
    institutionId: null,
    known: {
      institutionName: (org as { name: string } | null)?.name ?? "votre organisation",
      expiresAt: (inv as { expires_at: string } | null)?.expires_at ?? new Date(Date.now() + 7 * 86400000).toISOString(),
    },
  });
  revalidatePath(orgPath(parsed.data.organization_id));
  return result;
}

export async function revokePartnerMember(memberId: string, organizationId: string): Promise<ActionState> {
  await requirePartnershipStaff();
  if (!uuidSchema.safeParse(memberId).success) return { ok: false, message: messageFor("not_found") };
  const { error } = await (await createClient()).rpc("revoke_partner_member", { p_member: memberId });
  if (error) return { ok: false, message: errorMessage(error) };
  revalidatePath(orgPath(organizationId));
  return { ok: true, message: "Accès retiré." };
}

export async function reviewDeliverable(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePartnershipStaff();
  const parsed = parseInput(
    z.object({ id: uuidSchema, organization_id: uuidSchema, status: z.enum(["accepted", "returned"]), comment: optionalText(1000) }),
    formData,
  );
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const d = parsed.data;
  if (d.status === "returned" && !d.comment) return { ok: false, fieldErrors: { comment: "Indiquez ce qui doit être complété." } };
  const { error } = await (await createClient()).rpc("review_partner_deliverable", { p_id: d.id, p_status: d.status, p_comment: d.comment ?? null });
  if (error) return { ok: false, message: errorMessage(error) };
  revalidatePath(orgPath(d.organization_id));
  return { ok: true, message: d.status === "accepted" ? "Livrable accepté." : "Livrable renvoyé au partenaire." };
}

export async function postTeamMessage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePartnershipStaff();
  const parsed = parseInput(z.object({ organization_id: uuidSchema, body: z.string().trim().min(1, "Écrivez votre message.").max(4000) }), formData);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const { error } = await (await createClient()).rpc("post_partner_message", { p_org: parsed.data.organization_id, p_body: parsed.data.body });
  if (error) return { ok: false, message: errorMessage(error) };
  revalidatePath(orgPath(parsed.data.organization_id));
  return { ok: true, message: "Message envoyé au partenaire." };
}
