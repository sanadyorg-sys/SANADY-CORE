"use server";

import { revalidatePath } from "next/cache";
import { errorMessage, messageFor } from "@/lib/errors";
import { messageSchema, templateSchema } from "@/lib/partnerships-schema";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";
import { parseInput, uuidSchema } from "@/lib/validation";
import { requirePartnershipStaff } from "@/server/auth";
import { sendEmail } from "@/server/email";
import { clientIp, rateLimit } from "@/server/rate-limit";

/**
 * Communication templates (brief V2 §14). A person sends each message, one
 * at a time; nothing is sent automatically. Every message sent is written
 * to the organisation's contact history.
 */

const LIST = "/admin/partenariats/modeles";

export async function saveTemplate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePartnershipStaff();
  const id = String(formData.get("id") ?? "");
  const parsed = parseInput(templateSchema, formData);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const { error } = await (await createClient()).rpc("save_partnership_template", { p_id: id || null, p: parsed.data });
  if (error) return { ok: false, message: errorMessage(error) };
  revalidatePath(LIST);
  return { ok: true, message: id ? "Modèle enregistré." : "Modèle créé." };
}

export async function setTemplateArchived(templateId: string, archived: boolean): Promise<ActionState> {
  await requirePartnershipStaff();
  if (!uuidSchema.safeParse(templateId).success) return { ok: false, message: messageFor("not_found") };
  const { error } = await (await createClient()).rpc("set_partnership_template_archived", { p_id: templateId, p_archived: archived });
  if (error) return { ok: false, message: errorMessage(error) };
  revalidatePath(LIST);
  return { ok: true, message: archived ? "Modèle archivé." : "Modèle rétabli." };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function sendPartnerMessage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requirePartnershipStaff();
  const parsed = parseInput(messageSchema, formData);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const d = parsed.data;
  if (/\{\{\s*[a-z]+\s*\}\}/.test(`${d.subject} ${d.body}`)) {
    return { ok: false, message: "Il reste des champs à compléter entre {{ }} : remplacez-les avant l’envoi." };
  }
  const supabase = await createClient();

  if (d.channel === "email") {
    if (!d.contact_id) return { ok: false, fieldErrors: { contact_id: "Choisissez le contact destinataire." } };
    const { data: contact } = await supabase.from("partner_contacts").select("email").eq("id", d.contact_id).eq("organization_id", d.organization_id).maybeSingle();
    const to = (contact as { email: string | null } | null)?.email;
    if (!to) return { ok: false, fieldErrors: { contact_id: "Ce contact n’a pas d’adresse e-mail." } };
    if (!(await rateLimit(`partner-mail:${viewer.id}:${await clientIp()}`, 30, 60 * 60))) return { ok: false, message: messageFor("rate_limited") };
    const html = d.body
      .split(/\n{2,}/)
      .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
      .join("");
    const sent = await sendEmail({ to, subject: d.subject, html, text: d.body });
    if (!sent.sent) {
      return {
        ok: false,
        message: sent.notConfigured
          ? "L’envoi d’e-mails n’est pas encore configuré : copiez le message ou ouvrez-le dans votre messagerie."
          : "L’e-mail n’a pas pu être envoyé. Réessayez ou copiez le message.",
      };
    }
  }

  const { error } = await supabase.rpc("record_partner_communication", {
    p_org: d.organization_id,
    p_contact: d.contact_id || null,
    p_channel: d.channel,
    p_subject: d.subject,
    p_body: d.body,
    p_template: d.template_id || null,
  });
  if (error) return { ok: false, message: errorMessage(error) };
  revalidatePath(`/admin/partenariats/organisations/${d.organization_id}`);
  return {
    ok: true,
    message: d.channel === "email" ? "E-mail envoyé et ajouté à l’historique." : d.channel === "portal" ? "Message publié dans l’espace partenaire." : "Message ajouté à l’historique des échanges.",
  };
}
