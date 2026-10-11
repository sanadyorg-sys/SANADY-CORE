import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Download, Eye } from "lucide-react";
import { KIND_ICONS } from "@/components/library/library-card";
import { LibraryDocumentViewer } from "@/components/library/viewer-loader";
import { buttonClasses } from "@/components/ui/button";
import { Alert, Card, CardBody, DescriptionList } from "@/components/ui/surface";
import { LIBRARY_KINDS, SCHOOL_LEVELS } from "@/lib/labels";
import { formatBytes } from "@/lib/media";
import { uuidSchema } from "@/lib/validation";
import { requireViewer } from "@/server/auth";
import { getLibraryResource, libraryFileUrls } from "@/server/queries/library";

async function load(id: string) {
  if (!uuidSchema.safeParse(id).success) return null;
  const resource = await getLibraryResource(id);
  return resource && resource.status === "published" ? resource : null;
}

export async function generateMetadata({ params }: PageProps<"/espace/bibliotheque/[resourceId]">): Promise<Metadata> {
  const resource = await load((await params).resourceId);
  return { title: resource?.title ?? "Ressource introuvable" };
}

export default async function LibraryResourcePage({ params }: PageProps<"/espace/bibliotheque/[resourceId]">) {
  await requireViewer();
  const resource = await load((await params).resourceId);
  if (!resource) notFound();
  const { viewUrl, downloadUrl } = await libraryFileUrls(resource);
  const Icon = KIND_ICONS[resource.kind];
  const isPdf = resource.mime_type === "application/pdf";
  const isImage = resource.mime_type?.startsWith("image/") ?? false;

  return (
    <>
      <Link href="/espace/bibliotheque" className="mb-4 inline-flex min-h-6 items-center gap-1.5 py-1 text-label font-medium text-ink-600 hover:text-ink-900">
        <ArrowLeft className="size-4" aria-hidden /> Bibliothèque pédagogique
      </Link>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <header className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-700">
              <Icon className="size-6" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-caption font-semibold uppercase tracking-wider text-accent-700">{LIBRARY_KINDS[resource.kind]}</p>
              <h1 className="mt-0.5 text-title font-semibold text-ink-900">{resource.title}</h1>
            </div>
          </header>

          {resource.description ? <p className="whitespace-pre-line text-reading text-ink-700">{resource.description}</p> : null}

          {resource.external_url ? (
            <Card>
              <CardBody className="flex flex-wrap items-center justify-between gap-4">
                <p className="text-body text-ink-600">
                  Cette ressource est publiée par <span className="font-medium text-ink-900">{resource.source_label}</span> sur son site officiel.
                </p>
                <a href={resource.external_url} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: "accent" })}>
                  Ouvrir la ressource <ArrowUpRight aria-hidden />
                  <span className="sr-only">(nouvel onglet)</span>
                </a>
              </CardBody>
            </Card>
          ) : !viewUrl ? (
            <Alert tone="warning" title="Fichier indisponible">
              Le fichier de cette ressource n’a pas pu être chargé. Réessayez dans quelques instants.
            </Alert>
          ) : isPdf ? (
            <LibraryDocumentViewer url={viewUrl} title={resource.title} pageCount={resource.page_count} />
          ) : isImage ? (
            // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
            <img src={viewUrl} alt={resource.title} className="w-full rounded-lg border border-line" />
          ) : (
            <Alert tone="info" title="Aperçu non disponible pour ce format">
              {downloadUrl ? "Téléchargez le fichier pour le consulter." : "Ce format ne peut pas être affiché dans le navigateur."}
            </Alert>
          )}
        </div>

        <aside className="space-y-4">
          {resource.file_path ? (
            <Card>
              <CardBody className="space-y-3">
                {downloadUrl ? (
                  <a href={downloadUrl} className={buttonClasses({ variant: "accent", size: "lg", className: "w-full" })}>
                    <Download aria-hidden /> Télécharger
                  </a>
                ) : (
                  <p className="flex items-start gap-2 text-body text-ink-600">
                    <Eye className="mt-0.5 size-4 shrink-0 text-ink-500" aria-hidden />
                    Consultation en ligne uniquement : le téléchargement n’est pas autorisé pour ce document.
                  </p>
                )}
                {resource.file_name ? (
                  <p className="break-all text-caption text-ink-500">
                    {resource.file_name}
                    {resource.file_size ? ` · ${formatBytes(resource.file_size)}` : ""}
                    {resource.page_count ? ` · ${resource.page_count} p.` : ""}
                  </p>
                ) : null}
              </CardBody>
            </Card>
          ) : null}
          <Card>
            <CardBody>
              <DescriptionList
                items={[
                  { term: "Type", value: LIBRARY_KINDS[resource.kind] },
                  { term: "Niveaux", value: resource.levels.length ? resource.levels.map((l) => SCHOOL_LEVELS[l]).join(", ") : "Tous niveaux" },
                  ...(resource.subject ? [{ term: "Matière", value: resource.subject }] : []),
                  ...(resource.category ? [{ term: "Thème", value: resource.category.name }] : []),
                  ...(resource.course
                    ? [
                        {
                          term: "Formation associée",
                          value: (
                            <Link href={`/espace/formations/${resource.course.id}`} className="font-medium text-accent-700 hover:underline">
                              {resource.course.title}
                            </Link>
                          ),
                        },
                      ]
                    : []),
                  { term: "Source", value: resource.source_label },
                  ...(resource.published_year ? [{ term: "Année", value: resource.published_year }] : []),
                ]}
              />
            </CardBody>
          </Card>
        </aside>
      </div>
    </>
  );
}
