import { publicEnv } from "./env";

/** Public URL of a course cover (course-covers is a public bucket). */
export function coverUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `${publicEnv.supabaseUrl}/storage/v1/object/public/course-covers/${path.split("/").map(encodeURIComponent).join("/")}`;
}

export function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return "";
  const units = ["o", "Ko", "Mo", "Go"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: unit === 0 ? 0 : 1 }).format(value)} ${units[unit]}`;
}
