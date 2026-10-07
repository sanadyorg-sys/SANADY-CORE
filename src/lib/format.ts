/** French formatting helpers (dates displayed in Morocco’s timezone). */
const TZ = "Africa/Casablanca";

const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: TZ });
const shortDateFmt = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: TZ });
const dateTimeFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TZ,
});
const numberFmt = new Intl.NumberFormat("fr-FR");
const relativeFmt = new Intl.RelativeTimeFormat("fr-FR", { numeric: "auto" });

type DateInput = string | Date | null | undefined;
const toDate = (d: DateInput) => (d ? (d instanceof Date ? d : new Date(d)) : null);

/** French ordinal for the first day of the month: « 1er octobre 2026 ». */
export function firstOfMonth(formatted: string) {
  return formatted.replace(/^1 /, "1er ");
}

export function formatDate(d: DateInput, fallback = "—") {
  const date = toDate(d);
  return date ? firstOfMonth(dateFmt.format(date)) : fallback;
}

export function formatShortDate(d: DateInput, fallback = "—") {
  const date = toDate(d);
  return date ? shortDateFmt.format(date) : fallback;
}

export function formatDateTime(d: DateInput, fallback = "—") {
  const date = toDate(d);
  return date ? dateTimeFmt.format(date) : fallback;
}

export function formatNumber(n: number | null | undefined) {
  return n == null ? "—" : numberFmt.format(n);
}

/** 0.4567 → « 46 % » (French typography: narrow no-break space before %). */
export function formatPercent(ratio: number | null | undefined, digits = 0) {
  if (ratio == null || Number.isNaN(ratio)) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: digits }).format(ratio);
}

/** Score stored on a 0–100 scale. */
export function formatScore(score: number | string | null | undefined) {
  if (score == null) return "—";
  return formatPercent(Number(score) / 100, 1);
}

export function formatDuration(minutes: number | null | undefined) {
  if (!minutes || minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

export function formatClock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatRelative(d: DateInput, now = new Date()) {
  const date = toDate(d);
  if (!date) return "Jamais";
  const diffSec = Math.round((date.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 60) return "à l’instant";
  if (abs < 3600) return relativeFmt.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return relativeFmt.format(Math.round(diffSec / 3600), "hour");
  if (abs < 86400 * 30) return relativeFmt.format(Math.round(diffSec / 86400), "day");
  return formatDate(date);
}

export function plural(n: number, singular: string, pluralForm = `${singular}s`) {
  return `${formatNumber(n)} ${n > 1 ? pluralForm : singular}`;
}

export function initials(name: string | null | undefined, email?: string | null) {
  const source = (name ?? "").trim() || (email ?? "").split("@")[0] || "?";
  const parts = source.split(/[\s.\-_]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function displayName(profile: { full_name?: string | null; email?: string | null } | null | undefined) {
  return profile?.full_name?.trim() || profile?.email || "Utilisateur";
}
