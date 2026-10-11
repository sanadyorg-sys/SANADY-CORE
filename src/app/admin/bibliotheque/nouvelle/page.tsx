import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LibraryResourceForm } from "@/components/admin/library-forms";
import { Card, CardBody, PageHeader } from "@/components/ui/surface";
import { requireStaff } from "@/server/auth";
import { libraryEditorOptions } from "@/server/queries/library";

export const metadata: Metadata = { title: "Nouvelle ressource" };

export default async function NewLibraryResourcePage() {
  await requireStaff(["admin", "manager"]);
  const options = await libraryEditorOptions();
  return (
    <>
      <Link href="/admin/bibliotheque" className="mb-4 inline-flex min-h-6 items-center gap-1.5 py-1 text-label font-medium text-ink-600 hover:text-ink-900">
        <ArrowLeft className="size-4" aria-hidden /> Bibliothèque
      </Link>
      <PageHeader title="Nouvelle ressource" description="Décrivez la ressource ; vous ajouterez ensuite son fichier, puis vous la publierez." />
      <Card className="max-w-3xl">
        <CardBody>
          <LibraryResourceForm {...options} />
        </CardBody>
      </Card>
    </>
  );
}
