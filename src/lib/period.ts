/** Report periods: calendar days in Morocco (Africa/Casablanca), both bounds included. */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY = 86_400_000;

/** Today's date in Morocco, as YYYY-MM-DD. */
export function todayInMorocco(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Casablanca" }).format(now);
}

function shift(date: string, days: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
}

export interface Period {
  from: string;
  to: string;
  /** Preset key when the period matches one. */
  preset: string | null;
}

/** Start of the Moroccan school year (1 September) that contains `date`. */
function schoolYearStart(date: string) {
  const [y, m] = date.split("-").map(Number) as [number, number];
  return `${m >= 9 ? y : y - 1}-09-01`;
}

export function periodPresets(today = todayInMorocco()) {
  return [
    { key: "30j", label: "30 derniers jours", from: shift(today, -29), to: today },
    { key: "90j", label: "90 derniers jours", from: shift(today, -89), to: today },
    { key: "annee", label: "Année scolaire", from: schoolYearStart(today), to: today },
    { key: "12m", label: "12 derniers mois", from: shift(today, -364), to: today },
  ];
}

/** Reads ?du=&au= (or ?periode=) and falls back to the last 90 days. Invalid input is ignored. */
export function parsePeriod(sp: Record<string, string | string[] | undefined>): Period {
  const one = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const today = todayInMorocco();
  const presets = periodPresets(today);
  const preset = presets.find((p) => p.key === one("periode"));
  if (preset) return { from: preset.from, to: preset.to, preset: preset.key };

  const du = one("du");
  const au = one("au");
  if (du && au && DATE_RE.test(du) && DATE_RE.test(au) && du <= au) {
    const to = au > today ? today : au;
    const from = Date.parse(to) - Date.parse(du) > 730 * DAY ? shift(to, -730) : du;
    return { from, to, preset: presets.find((p) => p.from === from && p.to === to)?.key ?? null };
  }
  const fallback = presets[1]!;
  return { from: fallback.from, to: fallback.to, preset: fallback.key };
}
