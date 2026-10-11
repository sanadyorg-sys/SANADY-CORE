import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { LibraryKind, LibraryResource, LibraryStatus, SchoolLevel } from "@/lib/types";

export const LIBRARY_BUCKET = "library";
export const LIBRARY_PAGE_SIZE = 24;

export interface LibraryItem extends LibraryResource {
  category: { name: string } | null;
  course: { id: string; title: string } | null;
}

export interface LibraryFilters {
  q?: string;
  kind?: LibraryKind;
  level?: SchoolLevel;
  subject?: string;
  category?: string;
  course?: string;
  status?: LibraryStatus | "all";
  page?: number;
}

/** Same folding as private.fold_accents (search index): lower case, no accents. */
export function foldAccents(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").replace(/œ/g, "oe").replace(/æ/g, "ae").toLowerCase();
}

const SELECT = "*, category:course_categories(name), course:courses(id, title)";

/**
 * Library listing under the viewer's RLS: teachers only ever receive
 * published resources; administrators may pass a status filter.
 */
export async function listLibrary(filters: LibraryFilters) {
  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);
  let query = supabase.from("library_resources").select(SELECT, { count: "exact" });

  const status = filters.status ?? "published";
  if (status !== "all") query = query.eq("status", status);
  if (filters.kind) query = query.eq("kind", filters.kind);
  if (filters.level) query = query.contains("levels", [filters.level]);
  if (filters.subject) query = query.eq("subject", filters.subject);
  if (filters.category) query = query.eq("category_id", filters.category);
  if (filters.course) query = query.eq("course_id", filters.course);
  if (filters.q) query = query.textSearch("search", foldAccents(filters.q), { config: "french", type: "websearch" });

  const { data, count, error } = await query
    .order("updated_at", { ascending: false })
    .range((page - 1) * LIBRARY_PAGE_SIZE, page * LIBRARY_PAGE_SIZE - 1);
  if (error) console.error("[library]", error.message);
  return { items: (data ?? []) as unknown as LibraryItem[], total: count ?? 0, page };
}

/** Facet values present in the published library (subjects, categories, courses). */
export async function libraryFacets() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("library_resources")
    .select("subject, category_id, category:course_categories(name), course:courses(id, title)")
    .eq("status", "published")
    .limit(2000);
  const rows = (data ?? []) as unknown as Array<{
    subject: string | null;
    category_id: string | null;
    category: { name: string } | null;
    course: { id: string; title: string } | null;
  }>;
  const subjects = [...new Set(rows.map((r) => r.subject).filter((s): s is string => Boolean(s)))].sort((a, b) => a.localeCompare(b, "fr"));
  const categories = [...new Map(rows.filter((r) => r.category_id && r.category).map((r) => [r.category_id!, r.category!.name])).entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  const courses = [...new Map(rows.filter((r) => r.course).map((r) => [r.course!.id, r.course!.title])).entries()]
    .map(([id, title]) => ({ id, title }))
    .sort((a, b) => a.title.localeCompare(b.title, "fr"));
  return { subjects, categories, courses };
}

export async function getLibraryResource(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("library_resources").select(SELECT).eq("id", id).maybeSingle();
  return (data ?? null) as unknown as LibraryItem | null;
}

/**
 * Short-lived URLs created under the viewer's RLS (the storage policy only
 * allows files of published resources). The download URL exists only when
 * the administrator allowed downloading.
 */
export async function libraryFileUrls(resource: LibraryResource) {
  if (!resource.file_path) return { viewUrl: null, downloadUrl: null };
  const supabase = await createClient();
  const bucket = supabase.storage.from(LIBRARY_BUCKET);
  const [view, download] = await Promise.all([
    bucket.createSignedUrl(resource.file_path, 3600),
    resource.allow_download
      ? bucket.createSignedUrl(resource.file_path, 3600, { download: resource.file_name ?? true })
      : Promise.resolve({ data: null }),
  ]);
  return { viewUrl: view.data?.signedUrl ?? null, downloadUrl: download.data?.signedUrl ?? null };
}

const KINDS = ["guide", "support", "fiche", "reference", "externe"] as const;
const LEVELS = ["prescolaire", "primaire", "college", "lycee"] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validates library filters taken from the URL (unknown values are ignored). */
export function parseLibraryFilters(sp: Record<string, string | string[] | undefined>): LibraryFilters {
  const one = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
  };
  const kind = one("type");
  const level = one("niveau");
  const category = one("theme");
  const course = one("formation");
  return {
    q: one("q")?.slice(0, 100),
    kind: KINDS.includes(kind as LibraryKind) ? (kind as LibraryKind) : undefined,
    level: LEVELS.includes(level as SchoolLevel) ? (level as SchoolLevel) : undefined,
    subject: one("matiere")?.slice(0, 100),
    category: category && UUID_RE.test(category) ? category : undefined,
    course: course && UUID_RE.test(course) ? course : undefined,
    page: Math.max(1, Number(one("page")) || 1),
  };
}

/** Choices for the administrator form (categories, courses, known subjects). */
export async function libraryEditorOptions() {
  const supabase = await createClient();
  const [{ data: categories }, { data: courses }, { data: subjects }] = await Promise.all([
    supabase.from("course_categories").select("id, name").order("position").order("name"),
    supabase.from("courses").select("id, title").neq("status", "archived").order("title"),
    supabase.from("library_resources").select("subject").not("subject", "is", null).limit(2000),
  ]);
  return {
    categories: (categories ?? []) as Array<{ id: string; name: string }>,
    courses: (courses ?? []) as Array<{ id: string; title: string }>,
    subjects: [...new Set(((subjects ?? []) as Array<{ subject: string }>).map((s) => s.subject))].sort((a, b) => a.localeCompare(b, "fr")),
  };
}

/** Recent published resources, those linked to the learner's courses first. */
export async function libraryHighlights(courseIds: string[], limit = 3) {
  const supabase = await createClient();
  const base = () => supabase.from("library_resources").select(SELECT).eq("status", "published").order("updated_at", { ascending: false });
  const linked = courseIds.length ? ((await base().in("course_id", courseIds).limit(limit)).data ?? []) : [];
  const ids = new Set((linked as Array<{ id: string }>).map((r) => r.id));
  const recent = linked.length < limit ? ((await base().limit(limit * 2)).data ?? []).filter((r) => !ids.has((r as { id: string }).id)) : [];
  return [...linked, ...recent].slice(0, limit) as unknown as LibraryItem[];
}
