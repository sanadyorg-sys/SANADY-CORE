import type { Metadata } from "next";
import Link from "next/link";
import { Library } from "lucide-react";
import { LibraryCard } from "@/components/library/library-card";
import { EmptyState } from "@/components/ui/feedback";
import { FilterSelect, SearchForm } from "@/components/ui/search-form";
import { Card, PageHeader } from "@/components/ui/surface";
import { Pagination, withParams } from "@/components/ui/table";
import { LIBRARY_KINDS, SCHOOL_LEVELS } from "@/lib/labels";
import { requireViewer } from "@/server/auth";
import { LIBRARY_PAGE_SIZE, libraryFacets, listLibrary, parseLibraryFilters } from "@/server/queries/library";

export const metadata: Metadata = { title: "Bibliothèque pédagogique" };

export default async function LibraryPage(props: PageProps<"/espace/bibliotheque">) {
  await requireViewer();
  const sp = await props.searchParams;
  const filters = parseLibraryFilters(sp);
  const [{ items, total, page }, facets] = await Promise.all([listLibrary(filters), libraryFacets()]);
  const params = {
    q: filters.q,
    type: filters.kind,
    niveau: filters.level,
    matiere: filters.subject,
    theme: filters.category,
    formation: filters.course,
  };
  const filtered = Object.values(params).some(Boolean);

  return (
    <>
      <PageHeader
        title="Bibliothèque pédagogique"
        description="Guides, supports de formation, fiches d’activité et documents de référence pour préparer et enrichir vos séances."
      />

      <Card className="mb-6 p-4">
        <SearchForm action="/espace/bibliotheque" defaultValue={filters.q} placeholder="Rechercher une ressource…" label="Rechercher une ressource">
          <FilterSelect
            name="type"
            label="Type de ressource"
            defaultValue={filters.kind}
            options={[{ value: "", label: "Tous les types" }, ...Object.entries(LIBRARY_KINDS).map(([value, label]) => ({ value, label }))]}
          />
          <FilterSelect
            name="niveau"
            label="Niveau scolaire"
            defaultValue={filters.level}
            options={[{ value: "", label: "Tous les niveaux" }, ...Object.entries(SCHOOL_LEVELS).map(([value, label]) => ({ value, label }))]}
          />
          {facets.subjects.length ? (
            <FilterSelect
              name="matiere"
              label="Matière"
              defaultValue={filters.subject}
              options={[{ value: "", label: "Toutes les matières" }, ...facets.subjects.map((s) => ({ value: s, label: s }))]}
            />
          ) : null}
          {facets.categories.length ? (
            <FilterSelect
              name="theme"
              label="Thème"
              defaultValue={filters.category}
              options={[{ value: "", label: "Tous les thèmes" }, ...facets.categories.map((c) => ({ value: c.id, label: c.name }))]}
            />
          ) : null}
          {facets.courses.length ? (
            <FilterSelect
              name="formation"
              label="Formation"
              defaultValue={filters.course}
              options={[{ value: "", label: "Toutes les formations" }, ...facets.courses.map((c) => ({ value: c.id, label: c.title }))]}
            />
          ) : null}
        </SearchForm>
      </Card>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-body text-ink-600" aria-live="polite">
          <span className="font-semibold text-ink-900">{total}</span> {total > 1 ? "ressources" : "ressource"}
        </p>
        {filtered ? (
          <Link href="/espace/bibliotheque" className="text-label font-medium text-accent-700 hover:underline">
            Effacer les filtres
          </Link>
        ) : null}
      </div>

      {items.length ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <LibraryCard key={item.id} item={item} href={`/espace/bibliotheque/${item.id}`} />
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={Library}
            title={filtered ? "Aucune ressource ne correspond à votre recherche" : "La bibliothèque est en cours de constitution"}
            description={filtered ? "Essayez d’autres mots-clés ou retirez un filtre." : "Les premières ressources seront bientôt disponibles."}
          />
        </Card>
      )}

      <div className="mt-6">
        <Pagination page={page} pageSize={LIBRARY_PAGE_SIZE} total={total} hrefFor={(p) => withParams("/espace/bibliotheque", { ...params, page: p })} />
      </div>
    </>
  );
}
