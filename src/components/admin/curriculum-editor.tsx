"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useRef, useState, useTransition } from "react";
import {
  ArrowDown,
  ArrowUp,
  ClipboardCheck,
  Eye,
  FileText,
  Pencil,
  PlayCircle,
  Plus,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import {
  createLesson,
  createModule,
  removeLesson,
  removeModule,
  reorderLessons,
  reorderModules,
  updateModule,
} from "@/server/actions/courses";
import { ActionButton } from "@/components/common/action-button";
import { Button, buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/field";
import { FormMessage, SubmitButton, useActionToast } from "@/components/ui/form";
import { Dialog } from "@/components/ui/overlay";
import { Badge, Card } from "@/components/ui/surface";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { formatClock } from "@/lib/format";
import { INITIAL_ACTION_STATE, type ActionState, type Lesson } from "@/lib/types";
import type { EditorModule } from "@/server/queries/admin";

function move<T>(list: T[], index: number, delta: number) {
  const next = [...list];
  const [item] = next.splice(index, 1);
  next.splice(index + delta, 0, item!);
  return next;
}

function lessonContentBadge(lesson: Lesson) {
  if (lesson.kind === "video") {
    if (!lesson.video_ref) return <Badge tone="warning">Vidéo manquante</Badge>;
    return <Badge tone="neutral">{lesson.video_duration_seconds ? formatClock(lesson.video_duration_seconds) : "Vidéo"}{lesson.video_provider === "mux" ? " · Mux" : ""}</Badge>;
  }
  if (!lesson.pdf_path) return <Badge tone="warning">Document manquant</Badge>;
  return <Badge tone="neutral">{lesson.pdf_page_count} p.</Badge>;
}

export function CurriculumEditor({ courseId, modules }: { courseId: string; modules: EditorModule[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const base = `/admin/formations/${courseId}`;

  const reorder = (run: () => Promise<{ ok: boolean; message?: string }>) =>
    startTransition(async () => {
      const res = await run();
      if (!res.ok) toast({ tone: "danger", title: res.message ?? "Réorganisation impossible." });
      router.refresh();
    });

  return (
    <div className="space-y-4">
      {modules.length === 0 ? (
        <Card>
          <EmptyState
            icon={ClipboardCheck}
            title="Aucun module"
            description="Structurez la formation en modules. Chaque module contient des leçons (vidéo ou PDF) et une évaluation obligatoire."
          />
        </Card>
      ) : null}

      <ol className="space-y-4">
        {modules.map((m, mi) => (
          <li key={m.id}>
            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-3 border-b border-line bg-ink-25 px-4 py-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-brand-700 text-caption font-semibold text-white">
                  {mi + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-card font-semibold text-ink-900">{m.title}</h3>
                  <p className="text-caption text-ink-500">
                    {m.lessons.length} leçon{m.lessons.length > 1 ? "s" : ""} ·{" "}
                    {m.quiz ? `${m.quiz.question_count} question${m.quiz.question_count > 1 ? "s" : ""}` : "sans évaluation"}
                  </p>
                </div>
                <div className="flex items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Monter le module ${mi + 1}`}
                    disabled={mi === 0 || pending}
                    onClick={() => reorder(() => reorderModules(courseId, move(modules, mi, -1).map((x) => x.id)))}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Descendre le module ${mi + 1}`}
                    disabled={mi === modules.length - 1 || pending}
                    onClick={() => reorder(() => reorderModules(courseId, move(modules, mi, 1).map((x) => x.id)))}
                  >
                    <ArrowDown />
                  </Button>
                  <EditModuleDialog courseId={courseId} module={m} />
                  <ActionButton
                    variant="danger-ghost"
                    size="icon-sm"
                    action={removeModule.bind(null, m.id, courseId)}
                    confirm={{
                      title: `Supprimer le module « ${m.title} » ?`,
                      description:
                        "Ses leçons et son évaluation seront supprimées. Si des enseignants ont déjà commencé ce module, il sera archivé (masqué) afin de conserver leur historique.",
                      confirmLabel: "Supprimer",
                    }}
                  >
                    <Trash2 aria-label="Supprimer le module" />
                  </ActionButton>
                </div>
              </div>

              <ul className="divide-y divide-line">
                {m.lessons.map((l, li) => (
                  <li key={l.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                    {l.kind === "video" ? (
                      <PlayCircle className="size-4 shrink-0 text-ink-400" aria-label="Vidéo" />
                    ) : (
                      <FileText className="size-4 shrink-0 text-ink-400" aria-label="Document PDF" />
                    )}
                    <Link href={`${base}/programme/lecons/${l.id}`} className="min-w-0 flex-1 truncate text-body font-medium text-ink-800 hover:underline">
                      {l.title}
                    </Link>
                    <div className="flex items-center gap-1.5">
                      {lessonContentBadge(l)}
                      {!l.is_mandatory ? <Badge>Facultative</Badge> : null}
                    </div>
                    <div className="flex items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Monter la leçon « ${l.title} »`}
                        disabled={li === 0 || pending}
                        onClick={() => reorder(() => reorderLessons(m.id, courseId, move(m.lessons, li, -1).map((x) => x.id)))}
                      >
                        <ArrowUp />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Descendre la leçon « ${l.title} »`}
                        disabled={li === m.lessons.length - 1 || pending}
                        onClick={() => reorder(() => reorderLessons(m.id, courseId, move(m.lessons, li, 1).map((x) => x.id)))}
                      >
                        <ArrowDown />
                      </Button>
                      <Link href={`${base}/programme/lecons/${l.id}`} className={buttonClasses({ variant: "ghost", size: "icon-sm" })} aria-label={`Modifier « ${l.title} »`}>
                        <Pencil />
                      </Link>
                      {l.video_ref || l.pdf_path ? (
                        <Link href={`${base}/apercu/lecons/${l.id}`} className={buttonClasses({ variant: "ghost", size: "icon-sm" })} aria-label={`Aperçu de « ${l.title} »`}>
                          <Eye />
                        </Link>
                      ) : null}
                      <ActionButton
                        variant="danger-ghost"
                        size="icon-sm"
                        action={removeLesson.bind(null, l.id, courseId)}
                        confirm={{
                          title: `Supprimer la leçon « ${l.title} » ?`,
                          description: "Si des enseignants l’ont déjà commencée, elle sera archivée (masquée) et leur historique conservé.",
                          confirmLabel: "Supprimer",
                        }}
                      >
                        <Trash2 aria-label="Supprimer la leçon" />
                      </ActionButton>
                    </div>
                  </li>
                ))}
                <li className="px-4 py-2.5">
                  <AddLessonDialog courseId={courseId} moduleId={m.id} />
                </li>
                {m.quiz ? (
                  <li className={cn("flex flex-wrap items-center gap-3 px-4 py-3", m.quiz.question_count === 0 && "bg-warning-50/60")}>
                    <ClipboardCheck className="size-4 shrink-0 text-accent-600" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body font-medium text-ink-800">{m.quiz.title}</p>
                      <p className="text-caption text-ink-500">Évaluation obligatoire · seuil {m.quiz.pass_threshold} % · {m.quiz.max_attempts} tentatives</p>
                    </div>
                    {m.quiz.question_count === 0 ? (
                      <span className="inline-flex items-center gap-1 text-caption font-medium text-warning-700">
                        <TriangleAlert className="size-3.5" aria-hidden /> Aucune question
                      </span>
                    ) : null}
                    <Link href={`${base}/programme/evaluations/${m.quiz.id}`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
                      Modifier l’évaluation
                    </Link>
                  </li>
                ) : null}
              </ul>
            </Card>
          </li>
        ))}
      </ol>

      <AddModuleForm courseId={courseId} />
    </div>
  );
}

function AddModuleForm({ courseId }: { courseId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState(createModule, INITIAL_ACTION_STATE);
  useActionToast(state, () => formRef.current?.reset());
  return (
    <Card className="p-4">
      <form ref={formRef} action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end" noValidate>
        <input type="hidden" name="course_id" value={courseId} />
        <Field label="Nouveau module" error={state.fieldErrors?.title ?? (!state.ok ? state.message : undefined)} className="flex-1">
          <Input name="title" placeholder="Titre du module" maxLength={200} />
        </Field>
        <SubmitButton variant="secondary">
          <Plus aria-hidden /> Ajouter le module
        </SubmitButton>
      </form>
    </Card>
  );
}

function EditModuleDialog({ courseId, module }: { courseId: string; module: EditorModule }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, action] = useActionState(async (prev: ActionState, formData: FormData) => {
    const res = await updateModule(prev, formData);
    if (res.ok) {
      setOpen(false);
      router.refresh();
    }
    return res;
  }, INITIAL_ACTION_STATE);
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title="Modifier le module"
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`Modifier le module « ${module.title} »`}>
          <Pencil />
        </Button>
      }
    >
      <form action={action} className="space-y-4" noValidate>
        {!state.ok ? <FormMessage state={state} /> : null}
        <input type="hidden" name="id" value={module.id} />
        <input type="hidden" name="course_id" value={courseId} />
        <Field label="Titre" error={state.fieldErrors?.title}>
          <Input name="title" defaultValue={module.title} required maxLength={200} />
        </Field>
        <Field label="Description" optional error={state.fieldErrors?.description}>
          <Textarea name="description" defaultValue={module.description} rows={3} />
        </Field>
        <div className="flex justify-end">
          <SubmitButton>Enregistrer</SubmitButton>
        </div>
      </form>
    </Dialog>
  );
}

function AddLessonDialog({ courseId, moduleId }: { courseId: string; moduleId: string }) {
  const [state, action] = useActionState(createLesson, INITIAL_ACTION_STATE);
  const [kind, setKind] = useState<"video" | "pdf">("video");
  return (
    <Dialog
      title="Nouvelle leçon"
      description="Vous ajouterez le contenu (vidéo ou PDF) à l’étape suivante."
      trigger={
        <Button variant="ghost" size="sm">
          <Plus aria-hidden /> Ajouter une leçon
        </Button>
      }
    >
      <form action={action} className="space-y-4" noValidate>
        {!state.ok ? <FormMessage state={state} /> : null}
        <input type="hidden" name="course_id" value={courseId} />
        <input type="hidden" name="module_id" value={moduleId} />
        <fieldset>
          <legend className="mb-2 text-label font-medium text-ink-800">Type de leçon</legend>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { value: "video", label: "Vidéo", icon: PlayCircle },
                { value: "pdf", label: "Document PDF", icon: FileText },
              ] as const
            ).map((o) => (
              <label
                key={o.value}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2.5 text-body",
                  kind === o.value ? "border-accent-600 bg-accent-50/60 ring-1 ring-accent-600" : "border-line-strong hover:bg-ink-25",
                )}
              >
                <input type="radio" name="kind" value={o.value} checked={kind === o.value} onChange={() => setKind(o.value)} className="sr-only" />
                <o.icon className="size-4 text-ink-500" aria-hidden />
                {o.label}
              </label>
            ))}
          </div>
        </fieldset>
        <Field label="Titre de la leçon" error={state.fieldErrors?.title}>
          <Input name="title" required maxLength={200} />
        </Field>
        <div className="flex justify-end">
          <SubmitButton>Créer la leçon</SubmitButton>
        </div>
      </form>
    </Dialog>
  );
}
