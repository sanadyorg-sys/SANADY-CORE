import type { Metadata } from "next";
import Link from "next/link";
import { BookMarked, Download, Eye, Plus } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { FilterSelect, SearchForm } from "@/components/ui/search-form";
import { Badge, Card, PageHeader } from "@/components/ui/surface";
import { LinkTabs } from "@/components/ui/tabs";
import { Pagination, TBody, TD, TH, THead, TR, Table, withParams } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { LIBRARY_KINDS, LIBRARY_STATUSES, SCHOOL_LEVELS } from "@/lib/labels";
import type { LibraryStatus } from "@/lib/types";
import { requireSanadyAdmin } from "@/server/auth";
import { LIBRARY_PAGE_SIZE, listLibrary, parseLibraryFilters } from "@/server/queries/library";

export const metadata: Metadata = { title: "Bibliothèque pédagogique" };

const STATUS_TONE: Record<LibraryStatus, "neutral" | "success" | "warning"> = { draft: "neutral", published: "success", archived: "warning" };

export default async function AdminLibraryPage(props: PageProps<"/admin/bibliotheque">) {
  await requireSanadyAdmin();
  const sp = await props.searchParams;
  const filters = parseLibraryFilters(sp);
  const statut = typeof sp.statut === "string" && ["draft", "published", "archived"].includes(sp.statut) ? (sp.statut as LibraryStatus) : undefined;
  const { items, total, page } = await listLibrary({ ...filters, status: statut ?? "all" });
  const tab = (s?: string) => withParams("/admin/bibliotheque", { statut: s });

  return (
    <>
      <PageHeader
        title="Bibliothèque pédagogique"
        description="Ressources mises à disposition de tous les enseignants : fichiers hébergés (téléchargement au choix) ou liens vers des sources officielles."
        actions={
          <Link href="/admin/bibliotheque/nouvelle" className={buttonClasses()}>
            <Plus aria-hidden /> Nouvelle ressource
          </Link>
        }
      />
      <LinkTabs
        className="mb-6"
        activeHref={tab(statut)}
        items={[
          { href: tab(), label: "Toutes" },
          { href: tab("published"), label: "Publiées" },
          { href: tab("draft"), label: "Brouillons" },
          { href: tab("archived"), label: "Archivées" },
        ]}
      />
      <Card>
        <div className="border-b border-line px-5 py-4">
          <SearchForm action="/admin/bibliotheque" defaultValue={filters.q} placeholder="Rechercher une ressource">
            {statut ? <input type="hidden" name="statut" value={statut} /> : null}
            <FilterSelect
              name="type"
              label="Type"
              defaultValue={filters.kind}
              options={[{ value: "", label: "Tous les types" }, ...Object.entries(LIBRARY_KINDS).map(([value, label]) => ({ value, label }))]}
            />
          </SearchForm>
        </div>
        {items.length === 0 ? (
          <EmptyState
            icon={BookMarked}
            title="Aucune ressource"
            description="Ajoutez un guide, une fiche, un support de formation ou un lien vers une ressource officielle."
          />
        ) : (
          <Table caption="Ressources de la bibliothèque">
            <THead>
              <TR>
                <TH>Ressource</TH>
                <TH>Niveaux</TH>
                <TH>Accès</TH>
                <TH>Statut</TH>
                <TH>Mise à jour</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((r) => (
                <TR key={r.id}>
                  <TD>
                    <Link href={`/admin/bibliotheque/${r.id}`} className="font-medium text-ink-900 hover:underline">
                      {r.title}
                    </Link>
                    <p className="text-caption text-ink-500">
                      {LIBRARY_KINDS[r.kind]}
                      {r.subject ? ` · ${r.subject}` : ""}
                    </p>
                  </TD>
                  <TD className="text-label text-ink-600">{r.levels.length ? r.levels.map((l) => SCHOOL_LEVELS[l]).join(", ") : "Tous"}</TD>
                  <TD className="text-label text-ink-600">
                    {r.external_url ? (
                      "Lien externe"
                    ) : !r.file_path ? (
                      <span className="text-warning-700">Fichier manquant</span>
                    ) : r.allow_download ? (
                      <span className="inline-flex items-center gap-1">
                        <Download className="size-3.5" aria-hidden /> Téléchargeable
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <Eye className="size-3.5" aria-hidden /> Lecture seule
                      </span>
                    )}
                  </TD>
                  <TD>
                    <Badge tone={STATUS_TONE[r.status]} dot>
                      {LIBRARY_STATUSES[r.status]}
                    </Badge>
                  </TD>
                  <TD className="whitespace-nowrap text-label text-ink-600">{formatDateTime(r.updated_at)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
      <div className="mt-6">
        <Pagination
          page={page}
          pageSize={LIBRARY_PAGE_SIZE}
          total={total}
          hrefFor={(p) => withParams("/admin/bibliotheque", { statut, q: filters.q, type: filters.kind, page: p })}
        />
      </div>
    </>
  );
}
