"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { Archive, CheckCircle2, EyeOff, MessageSquareWarning, Rocket, Send, TriangleAlert } from "lucide-react";
import {
  approveCourse,
  requestCourseChanges,
  setCourseStatus,
  submitCourseForReview,
  type PublishResult,
} from "@/server/actions/courses";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { FormMessage, SubmitButton } from "@/components/ui/form";
import { ConfirmDialog, Dialog } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { INITIAL_ACTION_STATE, type ActionState, type CourseStatus } from "@/lib/types";

/**
 * Course status actions by role.
 * Trainers: submit a draft for review. Staff (administrators, training
 * managers): approve or send back a course under review, publish,
 * unpublish, archive. The database enforces the same rules.
 */
export function CourseStatusActions({
  courseId,
  status,
  activeLearners,
  canPublish,
}: {
  courseId: string;
  status: CourseStatus;
  activeLearners: number;
  /** Administrators and training managers. */
  canPublish: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [issues, setIssues] = useState<{ title: string; list: NonNullable<PublishResult["issues"]> } | null>(null);
  const [changesOpen, setChangesOpen] = useState(false);

  const report = (res: PublishResult | ActionState, issuesTitle: string) => {
    if (res.ok) {
      toast({ tone: "success", title: res.message ?? "Statut mis à jour." });
      router.refresh();
    } else if ("issues" in res && res.issues?.length) {
      setIssues({ title: issuesTitle, list: res.issues });
    } else {
      toast({ tone: "danger", title: res.message ?? "L’opération n’a pas pu aboutir." });
    }
    return { ok: true };
  };
  const apply = async (next: CourseStatus) => report(await setCourseStatus(courseId, next), "Publication impossible pour le moment");

  return (
    <>
      {status === "draft" ? (
        <Button
          variant={canPublish ? "secondary" : "primary"}
          loading={pending}
          onClick={() => startTransition(async () => void report(await submitCourseForReview(courseId), "Soumission impossible pour le moment"))}
        >
          <Send aria-hidden /> Soumettre à la revue
        </Button>
      ) : null}

      {canPublish && status === "review" ? (
        <>
          <ConfirmDialog
            trigger={
              <Button>
                <CheckCircle2 aria-hidden /> Approuver et publier
              </Button>
            }
            title="Approuver et publier la formation ?"
            description="Elle devient accessible aux enseignants et établissements autorisés. Les formateurs ne pourront plus la modifier."
            confirmLabel="Approuver et publier"
            confirmVariant="primary"
            onConfirm={async () => report(await approveCourse(courseId), "Publication impossible pour le moment")}
          />
          <Button variant="secondary" onClick={() => setChangesOpen(true)}>
            <MessageSquareWarning aria-hidden /> Demander des modifications
          </Button>
        </>
      ) : null}

      {canPublish && (status === "draft" || status === "archived") ? (
        <Button loading={pending} onClick={() => startTransition(async () => void (await apply("published")))}>
          <Rocket aria-hidden /> {status === "archived" ? "Republier" : "Publier"}
        </Button>
      ) : null}

      {canPublish && status === "published" ? (
        <ConfirmDialog
          trigger={
            <Button variant="secondary">
              <EyeOff aria-hidden /> Dépublier
            </Button>
          }
          title="Repasser la formation en brouillon ?"
          description={
            activeLearners > 0
              ? `${activeLearners} enseignant(s) suivent actuellement cette formation : ils n’y auront plus accès jusqu’à sa republication. Leur progression est conservée.`
              : "La formation ne sera plus accessible aux enseignants jusqu’à sa republication."
          }
          confirmLabel="Dépublier"
          confirmVariant="primary"
          onConfirm={() => apply("draft")}
        />
      ) : null}

      {canPublish && status !== "archived" ? (
        <ConfirmDialog
          trigger={
            <Button variant="ghost">
              <Archive aria-hidden /> Archiver
            </Button>
          }
          title="Archiver la formation ?"
          description="Une formation archivée n’est plus accessible ni attribuable. Les certificats déjà délivrés restent valides et vérifiables."
          confirmLabel="Archiver"
          onConfirm={() => apply("archived")}
        />
      ) : null}

      <RequestChangesDialog courseId={courseId} open={changesOpen} onOpenChange={setChangesOpen} />

      <Dialog
        open={Boolean(issues)}
        onOpenChange={(open) => !open && setIssues(null)}
        title={issues?.title ?? ""}
        description="Corrigez les points suivants, puis réessayez."
      >
        <ul className="space-y-2">
          {issues?.list.map((issue, i) => (
            <li key={i} className="flex gap-2.5 text-body text-ink-800">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning-700" aria-hidden />
              <span>
                {issue.message}
                {issue.label ? <span className="text-ink-500"> — « {issue.label} »</span> : null}
              </span>
            </li>
          ))}
        </ul>
      </Dialog>
    </>
  );
}

function RequestChangesDialog({ courseId, open, onOpenChange }: { courseId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [state, action] = useActionState(requestCourseChanges, INITIAL_ACTION_STATE);
  const router = useRouter();
  const toast = useToast();
  useEffect(() => {
    if (state.ok) {
      toast({ tone: "success", title: state.message ?? "Remarques envoyées." });
      onOpenChange(false);
      router.refresh();
    }
  }, [state, toast, onOpenChange, router]);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Demander des modifications"
      description="La formation repasse en brouillon : ses formateurs verront vos remarques en haut de la page."
    >
      <form action={action} className="space-y-4" noValidate>
        {!state.ok && state.message ? <FormMessage state={state} /> : null}
        <input type="hidden" name="course_id" value={courseId} />
        <Field label="Remarques pour les formateurs" error={state.fieldErrors?.comment}>
          <Textarea name="comment" rows={5} maxLength={2000} required placeholder="Ex. : ajoutez une explication à chaque question du module 2." />
        </Field>
        <div className="flex justify-end">
          <SubmitButton>Renvoyer en brouillon</SubmitButton>
        </div>
      </form>
    </Dialog>
  );
}
