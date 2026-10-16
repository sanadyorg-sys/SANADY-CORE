import "server-only";
import { PDFDocument } from "pdf-lib";

/**
 * Checks a company logo: PNG or JPEG recognised by its first bytes (not by
 * its name or declared type), 1 MB at most, and actually decodable — it is
 * embedded once in a throwaway PDF, the way certificates will use it.
 * SVG is never accepted (it can carry scripts).
 */
export const LOGO_MAX_BYTES = 1024 * 1024;

export type LogoCheck = { ok: true; type: "png" | "jpg"; width: number; height: number } | { ok: false; message: string };

export async function checkLogo(bytes: Uint8Array): Promise<LogoCheck> {
  if (bytes.byteLength === 0) return { ok: false, message: "Choisissez un fichier." };
  if (bytes.byteLength > LOGO_MAX_BYTES) return { ok: false, message: "Le logo dépasse 1 Mo." };
  const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const jpg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (!png && !jpg) return { ok: false, message: "Le logo doit être une image PNG ou JPEG." };
  try {
    const doc = await PDFDocument.create();
    const img = png ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    if (Math.min(img.width, img.height) < 32) return { ok: false, message: "Le logo est trop petit (32 pixels au moins de côté)." };
    if (Math.max(img.width, img.height) > 4000) return { ok: false, message: "Le logo est trop grand (4 000 pixels au plus de côté)." };
    return { ok: true, type: png ? "png" : "jpg", width: img.width, height: img.height };
  } catch {
    return { ok: false, message: "L’image n’a pas pu être lue : enregistrez-la à nouveau en PNG ou JPEG." };
  }
}
