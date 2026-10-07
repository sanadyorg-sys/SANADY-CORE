"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { CircleCheck, FileText, Trash2 } from "lucide-react";
import { addLessonResource, removeLessonResource, setLessonPdf, setLessonVideo, updateLesson } from "@/server/actions/courses";
import { ActionButton } from "@/components/common/action-button";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import { FormActions, FormMessage, SubmitButton, useActionToast } from "@/components/ui/form";
import { Alert } from "@/components/ui/surface";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { formatClock } from "@/lib/format";
import { formatBytes } from "@/lib/media";
import { INITIAL_ACTION_STATE, type Lesson, type LessonResource } from "@/lib/types";
import { readVideoDuration, safeFileName } from "@/lib/upload";
import { FileUploader } from "./file-uploader";

export function LessonDetailsForm({ lesson }: { lesson: Lesson }) {
  const [state, action] = useActionState(updateLesson, INITIAL_ACTION_STATE);
  useActionToast(state);
  const defaultThreshold = lesson.kind === "video" ? 90 : 100;
  return (
    <form action={action} className="space-y-4" noValidate>
      {!state.ok ? <FormMessage state={state} /> : null}
      <input type="hidden" name="id" value={lesson.id} />
      <input type="hidden" name="course_id" value={lesson.course_id} />
      <Field label="Titre" error={state.fieldErrors?.title}>
        <Input name="title" defaultValue={lesson.title} required maxLength={200} />
      </Field>
      <Field label="Description" optional hint="Présentée sous le contenu dans le lecteur." error={state.fieldErrors?.description}>
        <Textarea name="description" defaultValue={lesson.description} rows={5} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Durée estimée (minutes)" optional error={state.fieldErrors?.estimated_minutes}>
          <Input name="estimated_minutes" type="number" min={1} max={1440} defaultValue={lesson.estimated_minutes ?? ""} />
        </Field>
        <Field
          label="Seuil de validation (%)"
          hint={
            lesson.kind === "video"
              ? `Part de la vidéo à visionner. Par défaut : ${defaultThreshold} %.`
              : `Part des pages à consulter. Par défaut : ${defaultThreshold} %.`
          }
          error={state.fieldErrors?.completion_threshold}
        >
          <Input
            name="completion_threshold"
            type="number"
            min={50}
            max={100}
            placeholder={String(defaultThreshold)}
            defaultValue={lesson.completion_threshold ? Math.round(Number(lesson.completion_threshold) * 100) : ""}
          />
        </Field>
      </div>
      <Checkbox
        name="is_mandatory"
        defaultChecked={lesson.is_mandatory}
        label="Leçon obligatoire"
        description="Les leçons obligatoires conditionnent l’accès à l’évaluation du module et l’obtention du certificat."
      />
      <FormActions>
        <SubmitButton>Enregistrer</SubmitButton>
      </FormActions>
    </form>
  );
}

export function LessonContentEditor({ lesson, muxConfigured }: { lesson: Lesson; muxConfigured: boolean }) {
  const router = useRouter();
  const contentPath = (file: File) => `${lesson.course_id}/${lesson.id}/${safeFileName(file.name)}`;

  if (lesson.kind === "pdf") {
    return (
      <div className="space-y-4">
        {lesson.pdf_path ? (
          <Alert tone="success" title="Document en place">
            {lesson.pdf_page_count} page{(lesson.pdf_page_count ?? 0) > 1 ? "s" : ""}. Téléversez un nouveau fichier pour le remplacer.
          </Alert>
        ) : (
          <Alert tone="warning">Aucun document. La leçon ne peut pas être publiée sans contenu.</Alert>
        )}
        <FileUploader
          bucket="course-media"
          accept="application/pdf"
          maxBytes={100 * 1024 * 1024}
          buildPath={contentPath}
          onUploaded={async (path) => {
            const res = await setLessonPdf(lesson.id, lesson.course_id, path);
            router.refresh();
            return res;
          }}
          label="Document PDF"
          hint="100 Mo maximum. Le nombre de pages est mesuré automatiquement."
        />
      </div>
    );
  }

  const current = lesson.video_ref ? (
    <Alert tone="success" title="Vidéo en place">
      {lesson.video_provider === "mux" ? `Mux · identifiant ${lesson.video_ref}` : "Stockage sécurisé SANADY"}
      {lesson.video_duration_seconds ? ` · durée ${formatClock(lesson.video_duration_seconds)}` : ""}
    </Alert>
  ) : (
    <Alert tone="warning">Aucune vidéo. La leçon ne peut pas être publiée sans contenu.</Alert>
  );

  return (
    <div className="space-y-4">
      {current}
      <Tabs
        defaultValue={lesson.video_provider === "mux" ? "mux" : "storage"}
        items={[
          {
            value: "storage",
            label: "Téléverser un fichier",
            content: (
              <FileUploader
                bucket="course-media"
                accept="video/mp4, video/webm"
                maxBytes={2 * 1024 * 1024 * 1024}
                buildPath={contentPath}
                onUploaded={async (path, file) => {
                  const duration = await readVideoDuration(file);
                  const res = await setLessonVideo({
                    lessonId: lesson.id,
                    courseId: lesson.course_id,
                    provider: "storage",
                    ref: path,
                    durationSeconds: duration,
                  });
                  router.refresh();
                  return res;
                }}
                label="Fichier vidéo"
                hint="MP4 (H.264) ou WebM, 2 Go maximum. Le téléversement reprend automatiquement en cas de coupure."
              />
            ),
          },
          {
            value: "mux",
            label: "Diffusion adaptative (Mux)",
            content: <MuxForm lesson={lesson} configured={muxConfigured} />,
          },
        ]}
      />
    </div>
  );
}

function MuxForm({ lesson, configured }: { lesson: Lesson; configured: boolean }) {
  const [playbackId, setPlaybackId] = useState(lesson.video_provider === "mux" ? (lesson.video_ref ?? "") : "");
  const [duration, setDuration] = useState(lesson.video_duration_seconds ? formatClock(lesson.video_duration_seconds) : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();

  const parseDuration = (v: string) => {
    const parts = v.trim().split(":").map(Number);
    if (!v.trim() || parts.some((p) => Number.isNaN(p))) return null;
    return parts.reduce((acc, p) => acc * 60 + p, 0) || null;
  };

  return (
    <div className="space-y-4">
      {!configured ? (
        <Alert tone="warning" title="Mux non configuré">
          Renseignez MUX_SIGNING_KEY_ID et MUX_SIGNING_PRIVATE_KEY sur le serveur pour activer la lecture signée. Sans cette
          configuration, les vidéos Mux ne pourront pas être lues.
        </Alert>
      ) : null}
      <p className="text-body text-ink-600">
        Importez la vidéo dans Mux avec une politique de lecture <strong className="font-medium">signée</strong>, puis indiquez son
        identifiant de lecture (playback ID).
      </p>
      {error ? <p role="alert" className="text-label font-medium text-danger-600">{error}</p> : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_160px]">
        <Field label="Identifiant de lecture Mux">
          <Input value={playbackId} onChange={(e) => setPlaybackId(e.target.value.trim())} className="font-mono" />
        </Field>
        <Field label="Durée (h:mm:ss)" hint="Ex. 12:30">
          <Input value={duration} onChange={(e) => setDuration(e.target.value)} />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button
          loading={pending}
          disabled={!playbackId}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const res = await setLessonVideo({
                lessonId: lesson.id,
                courseId: lesson.course_id,
                provider: "mux",
                ref: playbackId,
                durationSeconds: parseDuration(duration),
              });
              if (res.ok) {
                toast({ tone: "success", title: res.message ?? "Vidéo associée." });
                router.refresh();
              } else setError(res.message ?? "Enregistrement impossible.");
            })
          }
        >
          Associer la vidéo Mux
        </Button>
      </div>
    </div>
  );
}

export function ResourcesEditor({ lesson, resources }: { lesson: Lesson; resources: LessonResource[] }) {
  const [title, setTitle] = useState("");
  const router = useRouter();
  return (
    <div className="space-y-4">
      {resources.length ? (
        <ul className="divide-y divide-line rounded-md border border-line">
          {resources.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-3 py-2.5">
              <FileText className="size-4 shrink-0 text-ink-400" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-body text-ink-800">{r.title}</span>
              <span className="text-caption text-ink-500">{formatBytes(r.size_bytes)}</span>
              <ActionButton
                variant="danger-ghost"
                size="icon-sm"
                action={removeLessonResource.bind(null, r.id, lesson.course_id)}
                confirm={{ title: `Supprimer « ${r.title} » ?`, description: "Le fichier sera supprimé définitivement.", confirmLabel: "Supprimer" }}
              >
                <Trash2 aria-label="Supprimer la ressource" />
              </ActionButton>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-body text-ink-500">Aucune ressource complémentaire.</p>
      )}
      <Field label="Titre de la ressource" hint="Renseignez le titre avant de choisir le fichier.">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Ex. : Fiche de synthèse" />
      </Field>
      {title.trim().length >= 2 ? (
        <FileUploader
          bucket="course-media"
          accept="application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/vnd.openxmlformats-officedocument.presentationml.presentation, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, image/png, image/jpeg, application/zip"
          maxBytes={50 * 1024 * 1024}
          buildPath={(file) => `${lesson.course_id}/${lesson.id}/resources/${safeFileName(file.name)}`}
          onUploaded={async (path, file) => {
            const res = await addLessonResource({ lessonId: lesson.id, courseId: lesson.course_id, title: title.trim(), path, sizeBytes: file.size });
            if (res.ok) setTitle("");
            router.refresh();
            return res;
          }}
          label="Fichier de la ressource"
          hint="PDF, Word, PowerPoint, Excel, image ou ZIP — 50 Mo maximum."
        />
      ) : (
        <p className="flex items-center gap-1.5 text-caption text-ink-500">
          <CircleCheck className="size-3.5" aria-hidden /> Le téléversement sera proposé une fois le titre saisi.
        </p>
      )}
    </div>
  );
}
