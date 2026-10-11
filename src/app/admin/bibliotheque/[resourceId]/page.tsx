import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye } from "lucide-react";
import { LibraryFilePanel, LibraryResourceForm } from "@/components/admin/library-forms";
import { ActionButton } from "@/components/common/action-button";
import { buttonClasses } from "@/components/ui/button";
import { Alert, Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/surface";
import { LIBRARY_STATUSES } from "@/lib/labels";
import { uuidSchema } from "@/lib/validation";
import { deleteLibraryResource, setLibraryStatus } from "@/server/actions/library";
import { requireStaff } from "@/server/auth";
import { getLibraryResource, libraryEditorOptions } from "@/server/queries/library";

export const metadata: Metadata = { title: "Ressource de la bibliothèque" };

export default async function EditLibraryResourcePage({ params }: PageProps<"/admin/bibliotheque/[resourceId]">) {
  await requireStaff(["admin", "manager"]);
  const { resourceId } = await params;
  if (!uuidSchema.safeParse(resourceId).success) notFound();
  const [resource, options] = await Promise.all([getLibraryResource(resourceId), libraryEditorOptions()]);
  if (!resource) notFound();
  const ready = Boolean(resource.file_path || resource.external_url);

  return (
    <>
      <Link href="/admin/bibliotheque" className="mb-4 inline-flex min-h-6 items-center gap-1.5 py-1 text-label font-medium text-ink-600 hover:text-ink-900">
        <ArrowLeft className="size-4" aria-hidden /> Bibliothèque
      </Link>
      <PageHeader
        title={resource.title}
        eyebrow={
          <Badge tone={resource.status === "published" ? "success" : resource.status === "archived" ? "warning" : "neutral"} dot>
            {LIBRARY_STATUSES[resource.status]}
          </Badge>
        }
        actions={
          <>
            {resource.status === "published" ? (
              <Link href={`/espace/bibliotheque/${resource.id}`} className={buttonClasses({ variant: "secondary" })}>
                <Eye aria-hidden /> Voir comme un enseignant
              </Link>
            ) : null}
            {resource.status !== "published" ? (
              <ActionButton action={setLibraryStatus.bind(null, resource.id, "published")} variant="accent" size="md">
                Publier
              </ActionButton>
            ) : (
              <ActionButton action={setLibraryStatus.bind(null, resource.id, "draft")} size="md">
                Repasser en brouillon
              </ActionButton>
            )}
            {resource.status !== "archived" ? (
              <ActionButton action={setLibraryStatus.bind(null, resource.id, "archived")} variant="ghost" size="md">
                Archiver
              </ActionButton>
            ) : null}
          </>
        }
      />

      {!ready ? (
        <Alert tone="warning" title="Ressource incomplète" className="mb-6">
          Ajoutez un fichier ou un lien externe avant de la publier.
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <Card>
          <CardHeader title="Description" />
          <CardBody>
            <LibraryResourceForm resource={resource} {...options} />
          </CardBody>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Fichier" />
            <CardBody>
              <LibraryFilePanel resource={resource} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Suppression" />
            <CardBody className="space-y-3">
              <p className="text-body text-ink-600">Préférez l’archivage : la ressource disparaît pour les enseignants mais reste récupérable.</p>
              <ActionButton
                action={deleteLibraryResource.bind(null, resource.id)}
                variant="danger-ghost"
                confirm={{
                  title: "Supprimer définitivement cette ressource ?",
                  description: "La fiche et son fichier seront supprimés. Cette action est irréversible.",
                  confirmLabel: "Supprimer",
                  tone: "danger",
                }}
              >
                Supprimer définitivement
              </ActionButton>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
