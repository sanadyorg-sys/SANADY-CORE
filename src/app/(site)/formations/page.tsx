import type { Metadata } from "next";
import Link from "next/link";
import { SearchX, SlidersHorizontal } from "lucide-react";
import { CatalogCard } from "@/components/site/catalog-card";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { COURSE_LEVELS } from "@/lib/labels";
import type { CourseLevel } from "@/lib/types";
import { getCatalog } from "@/server/queries/public";

export const metadata: Metadata = {
  title: "Catalogue des formations",
  description: "Toutes les formations SANADY pour les enseignants : pédagogie, gestion de classe, numérique éducatif.",
};

const SORTS = {
  recentes: "Les plus récentes",
  courtes: "Les plus courtes",
  titre: "Titre (A → Z)",
} as const;
type Sort = keyof typeof SORTS;

/** Accent-insensitive, case-insensitive search. */
const normalize = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

function href(params: Record<string, string | undefined>) {
  const search = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => Boolean(e[1])));
  const qs = search.toString();
  return qs ? `/formations?${qs}` : "/formations";
}

export default async function CatalogPage({ searchParams }: PageProps<"/formations">) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
  const q = one(sp.q)?.slice(0, 100);
  const theme = one(sp.theme);
  const level = one(sp.niveau) as CourseLevel | undefined;
  const sort: Sort = (one(sp.tri) as Sort) in SORTS ? (one(sp.tri) as Sort) : "recentes";
  const current = { q, theme, niveau: level, tri: sort === "recentes" ? undefined : sort };

  const catalog = await getCatalog();
  const terms = q ? normalize(q).split(/\s+/).filter(Boolean) : [];
  let courses = catalog.courses.filter((c) => {
    if (theme && c.category_id !== theme) return false;
    if (level && c.level !== level) return false;
    if (terms.length) {
      const text = normalize(`${c.title} ${c.summary} ${c.category ?? ""}`);
      return terms.every((t) => text.includes(t));
    }
    return true;
  });
  if (sort === "courtes") courses = [...courses].sort((a, b) => (a.estimated_minutes ?? 1e9) - (b.estimated_minutes ?? 1e9));
  if (sort === "titre") courses = [...courses].sort((a, b) => a.title.localeCompare(b.title, "fr"));

  const activeTheme = catalog.categories.find((c) => c.id === theme);
  const filtered = Boolean(q || theme || level);
  const levels = Object.entries(COURSE_LEVELS) as Array<[CourseLevel, string]>;

  const chip = (active: boolean) =>
    cn(
      "block rounded-md px-3 py-2 text-body transition-colors",
      active ? "bg-accent-50 font-semibold text-accent-800" : "text-ink-700 hover:bg-ink-100 hover:text-ink-900",
    );

  return (
    <>
      <section className="border-b border-line bg-ink-25">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          <nav aria-label="Fil d’Ariane" className="text-label text-ink-500">
            <Link href="/" className="hover:text-ink-800 hover:underline">
              Accueil
            </Link>{" "}
            / <span className="text-ink-700">Formations</span>
          </nav>
          <h1 className="mt-3 text-[2.25rem] font-extrabold leading-tight tracking-tight text-ink-900">
            {activeTheme ? activeTheme.name : "Catalogue des formations"}
          </h1>
          <p className="mt-2 max-w-2xl text-reading text-ink-600">
            Des formations gratuites pour enrichir vos pratiques, avec évaluation à chaque module et certificat vérifiable.
          </p>
          <form action="/formations" role="search" className="mt-6 flex max-w-2xl flex-col gap-2 sm:flex-row">
            {theme ? <input type="hidden" name="theme" value={theme} /> : null}
            {level ? <input type="hidden" name="niveau" value={level} /> : null}
            <label className="flex-1">
              <span className="sr-only">Rechercher une formation</span>
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Rechercher par titre, thème, mot-clé…"
                className="h-11 w-full rounded-md border border-line-strong bg-surface px-4 text-body text-ink-900 placeholder:text-ink-500 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/25"
              />
            </label>
            <button type="submit" className={buttonClasses({ variant: "accent", size: "lg" })}>
              Rechercher
            </button>
          </form>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:px-8">
        {/* ─── Filters ─────────────────────────────────────────────────────── */}
        <aside aria-label="Filtres" className="lg:sticky lg:top-24 lg:self-start">
          <details className="group rounded-lg border border-line lg:border-0" open>
            <summary className="flex cursor-pointer list-none items-center gap-2 p-3 text-body font-semibold text-ink-900 lg:hidden">
              <SlidersHorizontal className="size-4" aria-hidden /> Filtres
            </summary>
            <div className="space-y-7 p-3 pt-0 lg:p-0">
              <div>
                <h2 className="mb-2 px-3 text-caption font-semibold uppercase tracking-wider text-ink-500">Thème</h2>
                <ul className="space-y-0.5">
                  <li>
                    <Link href={href({ ...current, theme: undefined })} className={chip(!theme)} aria-current={!theme ? "true" : undefined}>
                      Tous les thèmes
                    </Link>
                  </li>
                  {catalog.categories.map((c) => (
                    <li key={c.id}>
                      <Link href={href({ ...current, theme: c.id })} className={cn(chip(theme === c.id), "flex justify-between gap-2")} aria-current={theme === c.id ? "true" : undefined}>
                        <span>{c.name}</span>
                        <span className="tabular text-ink-500">{c.count}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h2 className="mb-2 px-3 text-caption font-semibold uppercase tracking-wider text-ink-500">Niveau</h2>
                <ul className="space-y-0.5">
                  <li>
                    <Link href={href({ ...current, niveau: undefined })} className={chip(!level)} aria-current={!level ? "true" : undefined}>
                      Tous les niveaux
                    </Link>
                  </li>
                  {levels.map(([value, label]) => (
                    <li key={value}>
                      <Link href={href({ ...current, niveau: value })} className={chip(level === value)} aria-current={level === value ? "true" : undefined}>
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </details>
        </aside>

        {/* ─── Results ─────────────────────────────────────────────────────── */}
        <section aria-labelledby="resultats">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h2 id="resultats" className="text-body text-ink-600" aria-live="polite">
              <span className="font-semibold text-ink-900">{courses.length}</span> {courses.length > 1 ? "formations" : "formation"}
              {q ? (
                <>
                  {" "}
                  pour « <span className="font-medium text-ink-900">{q}</span> »
                </>
              ) : null}
            </h2>
            <nav aria-label="Trier" className="flex flex-wrap items-center gap-1 text-label">
              <span className="mr-1 text-ink-500">Trier :</span>
              {(Object.entries(SORTS) as Array<[Sort, string]>).map(([value, label]) => (
                <Link
                  key={value}
                  href={href({ ...current, tri: value === "recentes" ? undefined : value })}
                  aria-current={sort === value ? "true" : undefined}
                  className={cn(
                    "rounded-full px-3 py-1.5 transition-colors",
                    sort === value ? "bg-brand-700 font-medium text-white" : "text-ink-700 hover:bg-ink-100",
                  )}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>

          {courses.length ? (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {courses.map((c) => (
                <CatalogCard key={c.id} course={c} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center rounded-xl border border-dashed border-line-strong bg-ink-25 px-6 py-16 text-center">
              <SearchX className="size-8 text-ink-400" aria-hidden />
              <p className="mt-4 text-card font-semibold text-ink-900">Aucune formation ne correspond à votre recherche</p>
              <p className="mt-1 max-w-md text-body text-ink-600">Essayez d’autres mots-clés ou retirez un filtre.</p>
              {filtered ? (
                <Link href="/formations" className={buttonClasses({ variant: "secondary", className: "mt-5" })}>
                  Voir toutes les formations
                </Link>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
