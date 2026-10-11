"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PDFDocument } from "pdf-lib";
import { z } from "zod";
import { errorMessage, messageFor } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ActionState, LibraryStatus } from "@/lib/types";
import { checkboxSchema, parseInput, uuidSchema } from "@/lib/validation";
import { requireStaff } from "@/server/auth";
import { LIBRARY_BUCKET } from "@/server/queries/library";

const LEVELS = ["prescolaire", "primaire", "college", "lycee"] as const;

function revalidateLibrary(id?: string) {
  revalidatePath("/admin/bibliotheque");
  revalidatePath("/espace/bibliotheque");
  if (id) {
    revalidatePath(`/admin/bibliotheque/${id}`);
    revalidatePath(`/espace/bibliotheque/${id}`);
  }
}

const optional = (max: number, message?: string) =>
  z
    .string()
    .trim()
    .max(max, message ?? `${max} caractères maximum.`)
    .transform((v) => v || null);

/* ─── Create / update ───────────────────────────────────────────────────── */

export async function saveLibraryResource(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff(["admin", "manager"]);
  const parsed = parseInput(
    z.object({
      id: z.union([uuidSchema, z.literal("")]).optional(),
      title: z.string().trim().min(3, "Le titre doit comporter au moins 3 caractères.").max(200),
      description: z.string().trim().max(4000, "4 000 caractères maximum."),
      kind: z.enum(["guide", "support", "fiche", "reference", "externe"], "Choisissez un type."),
      subject: optional(100),
      category_id: z.union([uuidSchema, z.literal("")]),
      course_id: z.union([uuidSchema, z.literal("")]),
      source_label: z.string().trim().min(2, "Indiquez la source.").max(200),
      published_year: z
        .string()
        .trim()
        .regex(/^(\d{4}(-\d{4})?)?$/, "Format attendu : 2024 ou 2023-2024.")
        .transform((v) => v || null),
      external_url: z
        .string()
        .trim()
        .max(1000)
        .refine((v) => v === "" || /^https:\/\/[^\s]+$/.test(v), "Le lien doit commencer par https://")
        .transform((v) => v || null),
      allow_download: checkboxSchema,
    }),
    formData,
  );
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const d = parsed.data;
  const levels = formData.getAll("levels").filter((l): l is (typeof LEVELS)[number] => LEVELS.includes(l as (typeof LEVELS)[number]));
  if (d.kind === "externe" && !d.external_url) {
    return { ok: false, fieldErrors: { external_url: "Une ressource externe nécessite un lien." } };
  }

  const supabase = await createClient();
  const values = {
    title: d.title,
    description: d.description,
    kind: d.kind,
    levels,
    subject: d.subject,
    category_id: d.category_id || null,
    course_id: d.course_id || null,
    source_label: d.source_label,
    published_year: d.published_year,
    external_url: d.external_url,
    allow_download: d.allow_download,
  };

  if (d.id) {
    const { data: current } = await supabase.from("library_resources").select("file_path").eq("id", d.id).maybeSingle();
    if (!current) return { ok: false, message: messageFor("not_found") };
    if (d.external_url && (current as { file_path: string | null }).file_path) {
      return { ok: false, fieldErrors: { external_url: "Retirez d’abord le fichier : une ressource est soit un fichier, soit un lien." } };
    }
    const { error } = await supabase.from("library_resources").update(values).eq("id", d.id);
    if (error) return { ok: false, message: errorMessage(error) };
    revalidateLibrary(d.id);
    return { ok: true, message: "Ressource enregistrée." };
  }

  const viewer = await requireStaff(["admin", "manager"]);
  const { data, error } = await supabase
    .from("library_resources")
    .insert({ ...values, status: "draft", created_by: viewer.id })
    .select("id")
    .single();
  if (error) return { ok: false, message: errorMessage(error) };
  revalidateLibrary();
  redirect(`/admin/bibliotheque/${(data as { id: string }).id}`);
}

/* ─── File ──────────────────────────────────────────────────────────────── */

const MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
  "application/zip",
] as const;

/** Registers an uploaded file; PDFs are opened on the server to count pages. */
export async function setLibraryFile(input: { id: string; path: string; fileName: string; size: number; mimeType: string }): Promise<ActionState> {
  await requireStaff(["admin", "manager"]);
  const parsed = z
    .object({
      id: uuidSchema,
      path: z.string().min(3).max(500),
      fileName: z.string().trim().min(1).max(255),
      size: z.number().int().min(1).max(104857600),
      mimeType: z.enum(MIME_TYPES),
    })
    .safeParse(input);
  if (!parsed.success || !parsed.data.path.startsWith(`${parsed.data.id}/`)) {
    return { ok: false, message: "Fichier invalide ou format non pris en charge." };
  }
  const f = parsed.data;
  const admin = createAdminClient();

  let pageCount: number | null = null;
  if (f.mimeType === "application/pdf") {
    const { data: file } = await admin.storage.from(LIBRARY_BUCKET).download(f.path);
    try {
      if (!file) throw new Error("missing");
      pageCount = (await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true, updateMetadata: false })).getPageCount();
    } catch {
      await admin.storage.from(LIBRARY_BUCKET).remove([f.path]);
      return { ok: false, message: "Ce fichier n’est pas un PDF lisible. Vérifiez qu’il n’est pas protégé par mot de passe." };
    }
  }

  const supabase = await createClient();
  const { data: before } = await supabase.from("library_resources").select("file_path, external_url, kind").eq("id", f.id).maybeSingle();
  const current = before as { file_path: string | null; external_url: string | null; kind: string } | null;
  if (!current) return { ok: false, message: messageFor("not_found") };
  if (current.external_url || current.kind === "externe") {
    await admin.storage.from(LIBRARY_BUCKET).remove([f.path]);
    return { ok: false, message: "Cette ressource est un lien externe : retirez le lien avant d’ajouter un fichier." };
  }
  const { error } = await supabase
    .from("library_resources")
    .update({ file_path: f.path, file_name: f.fileName, file_size: f.size, mime_type: f.mimeType, page_count: pageCount })
    .eq("id", f.id);
  if (error) return { ok: false, message: errorMessage(error) };
  if (current.file_path && current.file_path !== f.path) await admin.storage.from(LIBRARY_BUCKET).remove([current.file_path]);
  revalidateLibrary(f.id);
  return { ok: true, message: pageCount ? `Fichier enregistré (${pageCount} page${pageCount > 1 ? "s" : ""}).` : "Fichier enregistré." };
}

export async function removeLibraryFile(id: string): Promise<ActionState> {
  await requireStaff(["admin", "manager"]);
  if (!uuidSchema.safeParse(id).success) return { ok: false, message: messageFor("not_found") };
  const supabase = await createClient();
  const { data } = await supabase.from("library_resources").select("file_path, status").eq("id", id).maybeSingle();
  const current = data as { file_path: string | null; status: LibraryStatus } | null;
  if (!current?.file_path) return { ok: false, message: messageFor("not_found") };
  if (current.status === "published") return { ok: false, message: "Repassez la ressource en brouillon avant de retirer son fichier." };
  const { error } = await supabase
    .from("library_resources")
    .update({ file_path: null, file_name: null, file_size: null, mime_type: null, page_count: null })
    .eq("id", id);
  if (error) return { ok: false, message: errorMessage(error) };
  await createAdminClient().storage.from(LIBRARY_BUCKET).remove([current.file_path]);
  revalidateLibrary(id);
  return { ok: true, message: "Fichier retiré." };
}

/* ─── Status and deletion ───────────────────────────────────────────────── */

export async function setLibraryStatus(id: string, status: LibraryStatus): Promise<ActionState> {
  await requireStaff(["admin", "manager"]);
  if (!uuidSchema.safeParse(id).success || !["draft", "published", "archived"].includes(status)) {
    return { ok: false, message: messageFor("not_found") };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("library_resources").update({ status }).eq("id", id);
  if (error) {
    if (/check/i.test(error.message)) return { ok: false, message: "Ajoutez un fichier ou un lien avant de publier la ressource." };
    return { ok: false, message: errorMessage(error) };
  }
  revalidateLibrary(id);
  return {
    ok: true,
    message: status === "published" ? "Ressource publiée dans la bibliothèque." : status === "archived" ? "Ressource archivée." : "Ressource repassée en brouillon.",
  };
}

export async function deleteLibraryResource(id: string): Promise<ActionState> {
  await requireStaff(["admin", "manager"]);
  if (!uuidSchema.safeParse(id).success) return { ok: false, message: messageFor("not_found") };
  const supabase = await createClient();
  const { data } = await supabase.from("library_resources").select("file_path").eq("id", id).maybeSingle();
  if (!data) return { ok: false, message: messageFor("not_found") };
  const { error } = await supabase.from("library_resources").delete().eq("id", id);
  if (error) return { ok: false, message: errorMessage(error) };
  const path = (data as { file_path: string | null }).file_path;
  if (path) await createAdminClient().storage.from(LIBRARY_BUCKET).remove([path]);
  revalidateLibrary();
  redirect("/admin/bibliotheque");
}
