import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { messageFor } from "@/lib/errors";
import { DOCUMENT_MIME, isPdf, MAX_DOCUMENT_BYTES, MAX_DOCUMENTS, safeFileName } from "@/lib/partnerships";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionState } from "@/lib/types";
import { clientIp, rateLimit } from "@/server/rate-limit";

/**
 * Public PDF uploads (partnership applications, enterprise requests):
 * 1. the browser asks for a single-use signed link (type, size, rate limit);
 * 2. it uploads straight to the private bucket under incoming/<hour>-<uuid>/;
 * 3. on submission, the server checks each file's real type (first bytes)
 *    and size, then moves it under the new record's folder.
 * Uploads never attached are deleted after 24 hours.
 */
export type PdfBucket = "partnerships" | "enterprise";

/** incoming/<yyyymmddhh>-<uuid>/<name>.pdf — the hour lets old uploads be cleaned. */
const INCOMING = /^incoming\/(\d{10})-[0-9a-f-]{36}\/[A-Za-z0-9._-]{1,120}$/;
const hourStamp = (d = new Date()) => d.toISOString().slice(0, 13).replace(/\D/g, "");

export async function signedPdfUpload(bucket: PdfBucket, input: { name: string; size: number; type: string }) {
  const f = z
    .object({ name: z.string().min(1).max(200), size: z.number().int().min(1), type: z.string().max(100) })
    .safeParse(input);
  if (!f.success) return { ok: false as const, message: "Fichier invalide." };
  if (f.data.type !== DOCUMENT_MIME || !/\.pdf$/i.test(f.data.name)) return { ok: false as const, message: "Seuls les documents PDF sont acceptés." };
  if (f.data.size > MAX_DOCUMENT_BYTES) return { ok: false as const, message: "Le document dépasse 10 Mo." };

  const ip = await clientIp();
  if (!(await rateLimit(`${bucket}-upload:${ip}`, 12, 60 * 60))) return { ok: false as const, message: messageFor("rate_limited") };

  const storage = createAdminClient().storage.from(bucket);
  await cleanIncoming(storage).catch((e) => console.error(`[${bucket}] incoming cleanup`, e));

  const name = safeFileName(f.data.name).replace(/(\.pdf)?$/i, ".pdf");
  const path = `incoming/${hourStamp()}-${randomUUID()}/${name}`;
  const { data, error } = await storage.createSignedUploadUrl(path);
  if (error || !data) {
    console.error(`[${bucket}] signed upload`, error?.message);
    return { ok: false as const, message: "Le téléversement est indisponible. Réessayez dans quelques minutes." };
  }
  return { ok: true as const, path, token: data.token };
}

async function cleanIncoming(storage: ReturnType<ReturnType<typeof createAdminClient>["storage"]["from"]>) {
  const limit = hourStamp(new Date(Date.now() - 24 * 3600 * 1000));
  const { data: folders } = await storage.list("incoming", { limit: 50, sortBy: { column: "name", order: "asc" } });
  const old = (folders ?? []).filter((f) => f.name.slice(0, 10) < limit).slice(0, 20);
  for (const folder of old) {
    const { data: files } = await storage.list(`incoming/${folder.name}`);
    if (files?.length) await storage.remove(files.map((x) => `incoming/${folder.name}/${x.name}`));
  }
}

const documentsSchema = z
  .array(z.object({ path: z.string().regex(INCOMING), name: z.string().min(1).max(200) }))
  .max(MAX_DOCUMENTS, `${MAX_DOCUMENTS} documents maximum.`);

/** A refused document: the form removes it and goes back to the Documents step. */
function rejectDocument(path: string, message: string): ActionState {
  return { ok: false, message, fieldErrors: { documents: message }, data: { rejectedPath: path } };
}

export type VerifiedDocument = { path: string; name: string; mime: string; size: number };

/**
 * Reads the « documents » field of a form, verifies each upload and moves it
 * under `<folder>/<recordId>/`. Returns either the verified list or the
 * ActionState to send back.
 */
export async function verifyPdfUploads(
  bucket: PdfBucket,
  formData: FormData,
  folder: string,
  recordId: string,
): Promise<{ ok: true; documents: VerifiedDocument[] } | { ok: false; state: ActionState }> {
  let parsed: z.infer<typeof documentsSchema>;
  try {
    const docs = documentsSchema.safeParse(JSON.parse(String(formData.get("documents") ?? "[]")));
    if (!docs.success) return { ok: false, state: { ok: false, message: "Les documents joints ne sont pas valides. Retirez-les et ajoutez-les à nouveau." } };
    parsed = docs.data;
  } catch {
    return { ok: false, state: { ok: false, message: "Les documents joints ne sont pas valides." } };
  }

  const storage = createAdminClient().storage.from(bucket);
  const verified: VerifiedDocument[] = [];
  for (const doc of parsed) {
    const { data: blob, error } = await storage.download(doc.path);
    if (error || !blob) return { ok: false, state: rejectDocument(doc.path, `Le document « ${doc.name} » est introuvable. Ajoutez-le à nouveau.`) };
    const head = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
    if (blob.size > MAX_DOCUMENT_BYTES || !isPdf(head)) {
      await storage.remove([doc.path]);
      return {
        ok: false,
        state: rejectDocument(doc.path, `« ${doc.name} » n’est pas un document PDF valide : il a été retiré. Vous pouvez envoyer le formulaire sans lui ou joindre un autre PDF.`),
      };
    }
    // The upload's own folder id keeps two files with the same name apart.
    const [, upload, name] = doc.path.split("/");
    const target = `${folder}/${recordId}/${upload!.slice(-12)}-${name}`;
    const moved = await storage.move(doc.path, target);
    if (moved.error) return { ok: false, state: { ok: false, message: "Les documents n’ont pas pu être enregistrés. Réessayez." } };
    verified.push({ path: target, name: doc.name.slice(0, 200), mime: DOCUMENT_MIME, size: blob.size });
  }
  return { ok: true, documents: verified };
}
