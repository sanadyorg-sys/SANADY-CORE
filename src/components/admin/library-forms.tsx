"use client";

import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { FileText } from "lucide-react";
import { FileUploader } from "@/components/admin/file-uploader";
import { ActionButton } from "@/components/common/action-button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { FormActions, FormMessage, SubmitButton, useActionToast } from "@/components/ui/form";
import { LIBRARY_KINDS, SCHOOL_LEVELS } from "@/lib/labels";
import { formatBytes } from "@/lib/media";
import { INITIAL_ACTION_STATE, type LibraryResource } from "@/lib/types";
import { safeFileName } from "@/lib/upload";
import { removeLibraryFile, saveLibraryResource, setLibraryFile } from "@/server/actions/library";

const ACCEPT = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
  "application/zip",
].join(", ");

export function LibraryResourceForm({
  resource,
  categories,
  courses,
  subjects,
}: {
  resource?: LibraryResource;
  categories: Array<{ id: string; name: string }>;
  courses: Array<{ id: string; title: string }>;
  subjects: string[];
}) {
  const [state, action] = useActionState(saveLibraryResource, INITIAL_ACTION_STATE);
  useActionToast(state);
  const e = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-5" noValidate>
      {!state.ok && state.message ? <FormMessage state={state} /> : null}
      <input type="hidden" name="id" value={resource?.id ?? ""} />
      <Field label="Titre" error={e.title}>
        <Input name="title" defaultValue={resource?.title} required maxLength={200} />
      </Field>
      <Field label="Description" optional hint="Ce que contient la ressource et comment l’utiliser en classe." error={e.description}>
        <Textarea name="description" defaultValue={resource?.description} rows={4} maxLength={4000} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type de ressource" error={e.kind}>
          <Select name="kind" defaultValue={resource?.kind ?? "guide"}>
            {Object.entries(LIBRARY_KINDS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Matière" optional hint="Ex. : Français, Mathématiques, Toutes matières." error={e.subject}>
          <Input name="subject" defaultValue={resource?.subject ?? ""} maxLength={100} list="library-subjects" />
        </Field>
        <datalist id="library-subjects">
          {subjects.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>
      <fieldset>
        <legend className="mb-2 text-label font-medium text-ink-800">
          Niveaux scolaires <span className="font-normal text-ink-500">(aucun coché = tous niveaux)</span>
        </legend>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {Object.entries(SCHOOL_LEVELS).map(([value, label]) => (
            <Checkbox key={value} name="levels" value={value} label={label} defaultChecked={resource?.levels.includes(value as never)} />
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Thème" optional error={e.category_id}>
          <Select name="category_id" defaultValue={resource?.category_id ?? ""}>
            <option value="">Aucun</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Formation associée" optional error={e.course_id}>
          <Select name="course_id" defaultValue={resource?.course_id ?? ""}>
            <option value="">Aucune</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
        <Field label="Source" hint="Auteur ou organisme : « Fondation Sanady », « Ministère de l’Éducation nationale »…" error={e.source_label}>
          <Input name="source_label" defaultValue={resource?.source_label ?? "Fondation Sanady"} maxLength={200} />
        </Field>
        <Field label="Année" optional hint="2024 ou 2023-2024" error={e.published_year}>
          <Input name="published_year" defaultValue={resource?.published_year ?? ""} maxLength={9} />
        </Field>
      </div>
      <Field
        label="Lien externe"
        optional
        hint="Pour une ressource publiée sur un site officiel (elle n’est pas copiée). Laissez vide si vous téléversez un fichier."
        error={e.external_url}
      >
        <Input name="external_url" type="url" defaultValue={resource?.external_url ?? ""} placeholder="https://" maxLength={1000} />
      </Field>
      <Checkbox
        name="allow_download"
        defaultChecked={resource?.allow_download ?? true}
        label="Autoriser le téléchargement du fichier"
        description="Décoché : la ressource se consulte uniquement dans le lecteur intégré, sans bouton de téléchargement."
      />
      <FormActions>
        <SubmitButton>{resource ? "Enregistrer" : "Créer la ressource"}</SubmitButton>
      </FormActions>
    </form>
  );
}

export function LibraryFilePanel({ resource }: { resource: LibraryResource }) {
  const router = useRouter();
  if (resource.external_url) {
    return <p className="text-body text-ink-600">Cette ressource est un lien externe : aucun fichier n’est hébergé sur la plateforme.</p>;
  }
  return (
    <div className="space-y-4">
      {resource.file_path ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-ink-25 p-3">
          <FileText className="size-5 shrink-0 text-ink-500" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-body font-medium text-ink-900">{resource.file_name}</p>
            <p className="text-caption text-ink-500">
              {formatBytes(resource.file_size)}
              {resource.page_count ? ` · ${resource.page_count} page${resource.page_count > 1 ? "s" : ""}` : ""}
            </p>
          </div>
          {resource.status !== "published" ? (
            <ActionButton
              action={removeLibraryFile.bind(null, resource.id)}
              variant="danger-ghost"
              confirm={{ title: "Retirer le fichier ?", description: "Le fichier sera supprimé du stockage.", confirmLabel: "Retirer", tone: "danger" }}
            >
              Retirer
            </ActionButton>
          ) : null}
        </div>
      ) : null}
      <FileUploader
        bucket="library"
        accept={ACCEPT}
        maxBytes={100 * 1024 * 1024}
        buildPath={(file) => `${resource.id}/${safeFileName(file.name)}`}
        label={resource.file_path ? "Remplacer le fichier" : "Déposez le fichier de la ressource"}
        hint="PDF (aperçu intégré), Word, PowerPoint, Excel, image ou ZIP — 100 Mo maximum."
        onUploaded={async (path, file) => {
          const res = await setLibraryFile({ id: resource.id, path, fileName: file.name, size: file.size, mimeType: file.type });
          if (res.ok) router.refresh();
          return res;
        }}
      />
    </div>
  );
}
