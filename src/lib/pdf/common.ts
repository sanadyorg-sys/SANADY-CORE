import { rgb, type PDFFont } from "pdf-lib";

/**
 * Shared helpers for server-side PDF generation (pdf-lib, standard fonts).
 * Standard PDF fonts use WinAnsi encoding, which covers French fully
 * (é, è, à, ç, œ, «, », ’…). Characters outside it are transliterated
 * when possible, otherwise replaced, so generation never fails.
 */

// Brand colours — PLACEHOLDER palette, see src/app/globals.css.
export const COLORS = {
  navy: rgb(0x12 / 255, 0x36 / 255, 0x53 / 255),
  navyLight: rgb(0xd9 / 255, 0xe3 / 255, 0xee / 255),
  teal: rgb(0x28 / 255, 0x7f / 255, 0x78 / 255),
  ink: rgb(0x1f / 255, 0x2e / 255, 0x3c / 255),
  muted: rgb(0x67 / 255, 0x78 / 255, 0x89 / 255),
  line: rgb(0xdc / 255, 0xe3 / 255, 0xea / 255),
  canvas: rgb(0xf3 / 255, 0xf6 / 255, 0xf9 / 255),
  success: rgb(0x1e / 255, 0x7a / 255, 0x4c / 255),
  danger: rgb(0xb4 / 255, 0x23 / 255, 0x18 / 255),
  white: rgb(1, 1, 1),
};

const WIN_ANSI_EXTRA = new Set(
  "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ".split(""),
);

function isWinAnsi(ch: string) {
  const code = ch.codePointAt(0)!;
  return (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WIN_ANSI_EXTRA.has(ch);
}

/** Makes any string safe for WinAnsi standard fonts. */
export function pdfSafe(input: string | null | undefined): string {
  if (!input) return "";
  return Array.from(
    input
      .normalize("NFC")
      .replace(/[   ]/g, " ")
      .replace(/[\r\n\t]+/g, " "),
  )
    .map((ch) => {
      if (isWinAnsi(ch)) return ch;
      const stripped = ch.normalize("NFD").replace(/\p{M}/gu, "");
      return stripped && Array.from(stripped).every(isWinAnsi) ? stripped : "?";
    })
    .join("");
}

/** Greedy word wrap to a maximum width. */
export function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = pdfSafe(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      // Hard-break words longer than the line.
      let rest = word;
      while (font.widthOfTextAtSize(rest, size) > maxWidth && rest.length > 1) {
        let cut = rest.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > maxWidth) cut--;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      current = rest;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function truncateToWidth(text: string, font: PDFFont, size: number, maxWidth: number): string {
  const safe = pdfSafe(text);
  if (font.widthOfTextAtSize(safe, size) <= maxWidth) return safe;
  let end = safe.length;
  while (end > 1 && font.widthOfTextAtSize(`${safe.slice(0, end)}…`, size) > maxWidth) end--;
  return `${safe.slice(0, end)}…`;
}

const TZ = "Africa/Casablanca";
export function pdfDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  return pdfSafe(
    new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: TZ })
      .format(new Date(value))
      .replace(/^1 /, "1er "),
  );
}

export function pdfDuration(minutes: number | null | undefined) {
  if (!minutes || minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

export function pdfPercent(score: number | string | null | undefined) {
  if (score == null) return "—";
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(Number(score))} %`.replace(/ /g, " ");
}
