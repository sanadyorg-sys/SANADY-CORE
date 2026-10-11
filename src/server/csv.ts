import "server-only";

/**
 * CSV for spreadsheet software used in Morocco and France: UTF-8 with BOM
 * (accents), semicolon separator, CRLF line endings, decimal comma.
 * Cells that look like formulas are neutralised (CSV injection).
 */
export function toCsv(headers: string[], rows: Array<Array<string | number | null | undefined>>) {
  const cell = (v: string | number | null | undefined) => {
    if (v === null || v === undefined) return "";
    if (typeof v === "number") return String(v).replace(".", ",");
    let s = v;
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "\uFEFF" + [headers, ...rows].map((r) => r.map(cell).join(";")).join("\r\n") + "\r\n";
}

export function csvResponse(fileName: string, csv: string) {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/** 0.6667 → 66,7 (percent, one decimal); null stays empty. */
export const pct = (ratio: number | string | null | undefined) =>
  ratio === null || ratio === undefined ? null : Math.round(Number(ratio) * 1000) / 10;
