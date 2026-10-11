import type { Metadata } from "next";
import Link from "next/link";
import { Search, SearchX, SlidersHorizontal } from "lucide-react";
import { BrandDots } from "@/components/brand/brand-decor";
import { CatalogCard } from "@/components/site/catalog-card";
import { buttonClasses } from "@/components/ui/button";
import { Reveal } from "@/components/ui/motion";
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
      "block rounded-xl px-3 py-2 text-body transition-colors",
      active ? "bg-accent-50 font-semibold text-accent-800 ring-1 ring-accent-500/20" : "text-ink-700 hover:bg-ink-100 hover:text-ink-900",
    );

  return (
    <>
      <section className="relative overflow-hidden border-b border-line bg-ink-25">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-dots opacity-25" />
        <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          <nav aria-label="Fil d’Ariane" className="flex items-center gap-2 text-label font-medium text-ink-500">
            <Link href="/" className="hover:text-ink-800 hover:underline">
              Accueil
            </Link>{" "}
            <span>/</span> <span className="font-semibold text-ink-800">Formations</span>
          </nav>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {activeTheme ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-500/30 bg-accent-50 px-3 py-1 text-label font-bold text-accent-800">
                <BrandDots /> {activeTheme.name}
              </span>
            ) : null}
          </div>
          <h1 className="mt-2 text-[2.25rem] font-extrabold leading-tight tracking-tight text-ink-900 sm:text-[2.5rem]">
            {activeTheme ? activeTheme.name : "Catalogue des formations"}
          </h1>
          <p className="mt-2 max-w-2xl text-reading text-ink-600">
            Des parcours courts et concrets pour enrichir vos pratiques, validés par des évaluations formatives et un certificat vérifiable.
          </p>
          <form action="/formations" role="search" className="mt-6 flex max-w-2xl flex-col gap-2.5 sm:flex-row">
            {theme ? <input type="hidden" name="theme" value={theme} /> : null}
            {level ? <input type="hidden" name="niveau" value={level} /> : null}
            <label className="relative flex-1">
              <span className="sr-only">Rechercher une formation</span>
              <Search className="pointer-events-none absolute left-4 top-1/2 size-4.5 -translate-y-1/2 text-ink-400" aria-hidden />
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Rechercher par titre, thème, mot-clé…"
                className="h-12 w-full rounded-xl border border-line-strong bg-surface pl-11 pr-4 text-body text-ink-900 shadow-xs placeholder:text-ink-500 transition-all focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/25"
              />
            </label>
            <button type="submit" className={buttonClasses({ variant: "accent", size: "lg", className: "h-12 rounded-xl shadow-xs" })}>
              Rechercher
            </button>
          </form>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[250px_minmax(0,1fr)] lg:px-8">
        {/* ─── Filters ─────────────────────────────────────────────────────── */}
        <aside aria-label="Filtres" className="lg:sticky lg:top-24 lg:self-start">
          <details className="group rounded-2xl border border-line bg-surface p-3 shadow-xs lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none" open>
            <summary className="flex cursor-pointer list-none items-center gap-2 p-1 text-body font-semibold text-ink-900 lg:hidden">
              <SlidersHorizontal className="size-4" aria-hidden /> Filtres
            </summary>
            <div className="space-y-7 pt-3 lg:pt-0">
              <div className="rounded-2xl border border-line bg-surface p-4 shadow-xs">
                <h2 className="mb-2.5 flex items-center gap-1.5 text-caption font-bold uppercase tracking-wider text-ink-500">
                  <BrandDots /> Thème
                </h2>
                <ul className="space-y-1">
                  <li>
                    <Link href={href({ ...current, theme: undefined })} className={chip(!theme)} aria-current={!theme ? "true" : undefined}>
                      Tous les thèmes
                    </Link>
                  </li>
                  {catalog.categories.map((c) => (
                    <li key={c.id}>
                      <Link href={href({ ...current, theme: c.id })} className={cn(chip(theme === c.id), "flex justify-between gap-2")} aria-current={theme === c.id ? "true" : undefined}>
                        <span className="truncate">{c.name}</span>
                        <span className="tabular font-medium text-ink-500">{c.count}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-line bg-surface p-4 shadow-xs">
                <h2 className="mb-2.5 flex items-center gap-1.5 text-caption font-bold uppercase tracking-wider text-ink-500">
                  <BrandDots /> Niveau
                </h2>
                <ul className="space-y-1">
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
              <span className="font-bold text-ink-900">{courses.length}</span> {courses.length > 1 ? "formations" : "formation"}
              {q ? (
                <>
                  {" "}
                  pour « <span className="font-medium text-ink-900">{q}</span> »
                </>
              ) : null}
            </h2>
            <nav aria-label="Trier" className="flex flex-wrap items-center gap-1.5 text-label">
              <span className="mr-1 text-ink-500">Trier :</span>
              {(Object.entries(SORTS) as Array<[Sort, string]>).map(([value, label]) => (
                <Link
                  key={value}
                  href={href({ ...current, tri: value === "recentes" ? undefined : value })}
                  aria-current={sort === value ? "true" : undefined}
                  className={cn(
                    "rounded-xl px-3 py-1.5 font-medium transition-all",
                    sort === value ? "bg-brand-700 text-white shadow-xs" : "text-ink-700 hover:bg-ink-100",
                  )}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>

          {courses.length ? (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {courses.map((c, i) => (
                <Reveal key={c.id} delay={i * 60}>
                  <CatalogCard course={c} />
                </Reveal>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center rounded-3xl border border-dashed border-line-strong bg-ink-25 px-6 py-16 text-center">
              <SearchX className="size-10 text-ink-400" aria-hidden />
              <p className="mt-4 text-card font-bold text-ink-900">Aucune formation ne correspond à votre recherche</p>
              <p className="mt-1 max-w-md text-body text-ink-600">Essayez d’autres mots-clés ou retirez un filtre.</p>
              {filtered ? (
                <Link href="/formations" className={buttonClasses({ variant: "secondary", size: "lg", className: "mt-6 rounded-xl" })}>
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
