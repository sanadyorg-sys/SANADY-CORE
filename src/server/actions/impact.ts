"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { errorMessage, messageFor } from "@/lib/errors";
import { metricSchema, platformMetricSchema, reportSchema } from "@/lib/partnerships-schema";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";
import { optionalText, parseInput, uuidSchema } from "@/lib/validation";
import { requireViewer } from "@/server/auth";

/** Partnership phase 5: impact indicators and partner reports. Every rule is in the database. */

const BASE = "/admin/partenariats";

async function call(fn: string, args: Record<string, unknown>, paths: string[], success: string): Promise<ActionState> {
  await requireViewer();
  const { error } = await (await createClient()).rpc(fn, args);
  if (error) return { ok: false, message: errorMessage(error) };
  for (const p of paths) revalidatePath(p);
  return { ok: true, message: success };
}

export async function saveMetric(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireViewer();
  const id = String(formData.get("id") ?? "");
  const org = uuidSchema.safeParse(formData.get("organization_id"));
  if (!org.success) return { ok: false, message: messageFor("not_found") };
  const parsed = parseInput(metricSchema, formData);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors, message: "Certaines informations sont à compléter." };
  const { error } = await (await createClient()).rpc("save_impact_metric", { p_id: id || null, p_org: org.data, p: parsed.data });
  if (error) return { ok: false, message: errorMessage(error) };
  for (const p of [`${BASE}/impact`, `${BASE}/organisations/${org.data}`]) revalidatePath(p);
  return { ok: true, message: id ? "Indicateur corrigé et soumis à nouveau." : "Indicateur enregistré, à vérifier par un approbateur." };
}

/**
 * Indicator computed from platform data. « preview » only shows the figure;
 * « save » records it (the database recomputes it, the form never sends it).
 */
export async function savePlatformMetric(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireViewer();
  const id = String(formData.get("id") ?? "");
  const org = uuidSchema.safeParse(formData.get("organization_id"));
  if (!org.success) return { ok: false, message: messageFor("not_found") };
  const parsed = parseInput(platformMetricSchema, {
    ...Object.fromEntries(formData.entries()),
    institution_ids: formData.getAll("institution_ids").map(String),
    course_ids: formData.getAll("course_ids").map(String),
  });
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors, message: "Certaines informations sont à compléter." };
  const d = parsed.data;
  const supabase = await createClient();
  if (formData.get("intent") === "preview") {
    const { data, error } = await supabase.rpc("platform_impact_measure", {
      p_measure: d.measure,
      p_institutions: d.institution_ids,
      p_courses: d.course_ids,
      p_from: d.period_start,
      p_to: d.period_end,
    });
    if (error) return { ok: false, message: errorMessage(error) };
    const r = data as { value: number; small: boolean };
    return { ok: true, data: { preview: r.value, small: r.small } };
  }
  const { error } = await supabase.rpc("record_platform_metric", { p_id: id || null, p_org: org.data, p: d });
  if (error) return { ok: false, message: errorMessage(error) };
  for (const p of [`${BASE}/impact`, `${BASE}/organisations/${org.data}`]) revalidatePath(p);
  return { ok: true, message: id ? "Indicateur recalculé et soumis à nouveau." : "Indicateur calculé et enregistré, à vérifier par un approbateur." };
}

export async function setMetricStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseInput(z.object({ id: uuidSchema, status: z.enum(["verified", "rejected"], "Choisissez une décision."), comment: optionalText(1000) }), formData);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const { id, status, comment } = parsed.data;
  if (status === "rejected" && !comment) return { ok: false, fieldErrors: { comment: "Indiquez ce qui doit être corrigé." } };
  return call("set_metric_status", { p_metric: id, p_status: status, p_comment: comment ?? null }, [`${BASE}/impact`], status === "verified" ? "Indicateur vérifié." : "Indicateur renvoyé pour correction.");
}

export async function saveReport(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireViewer();
  const id = String(formData.get("id") ?? "");
  const org = uuidSchema.safeParse(formData.get("organization_id"));
  if (!org.success) return { ok: false, message: messageFor("not_found") };
  const parsed = parseInput(reportSchema, formData);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors, message: "Certaines informations sont à compléter." };
  const { data, error } = await (await createClient()).rpc("save_partner_report", { p_id: id || null, p_org: org.data, p: parsed.data });
  if (error) return { ok: false, message: errorMessage(error) };
  revalidatePath(`${BASE}/rapports`);
  revalidatePath(`${BASE}/organisations/${org.data}`);
  if (!id) redirect(`${BASE}/rapports/${data as string}`);
  revalidatePath(`${BASE}/rapports/${id}`);
  return { ok: true, message: "Rapport enregistré." };
}

export async function setReportStatus(reportId: string, status: "approved" | "draft" | "shared"): Promise<ActionState> {
  if (!uuidSchema.safeParse(reportId).success) return { ok: false, message: messageFor("not_found") };
  return call(
    "set_report_status",
    { p_report: reportId, p_status: status },
    [`${BASE}/rapports`, `${BASE}/rapports/${reportId}`],
    status === "approved" ? "Rapport approuvé." : status === "shared" ? "Transmission au partenaire enregistrée." : "Rapport renvoyé en brouillon.",
  );
}
