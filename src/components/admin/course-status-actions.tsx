"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Archive, EyeOff, Rocket, TriangleAlert } from "lucide-react";
import { setCourseStatus, type PublishResult } from "@/server/actions/courses";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import type { CourseStatus } from "@/lib/types";

/** Publish / unpublish / archive with validation feedback. */
export function CourseStatusActions({
  courseId,
  status,
  activeLearners,
}: {
  courseId: string;
  status: CourseStatus;
  activeLearners: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [issues, setIssues] = useState<PublishResult["issues"] | null>(null);

  const apply = async (next: CourseStatus) => {
    const res = await setCourseStatus(courseId, next);
    if (res.ok) {
      toast({ tone: "success", title: res.message ?? "Statut mis à jour." });
      router.refresh();
    } else if (res.issues?.length) {
      setIssues(res.issues);
    } else {
      toast({ tone: "danger", title: res.message ?? "L’opération n’a pas pu aboutir." });
    }
    return { ok: true };
  };

  return (
    <>
      {status !== "published" ? (
        <Button loading={pending} onClick={() => startTransition(async () => void (await apply("published")))}>
          <Rocket aria-hidden /> {status === "archived" ? "Republier" : "Publier"}
        </Button>
      ) : (
        <ConfirmDialog
          trigger={
            <Button variant="secondary">
              <EyeOff aria-hidden /> Dépublier
            </Button>
          }
          title="Repasser la formation en brouillon ?"
          description={
            activeLearners > 0
              ? `${activeLearners} enseignant(s) suivent actuellement cette formation : ils n’y auront plus accès jusqu’à sa republication. Leur progression est conservée.`
              : "La formation ne sera plus accessible aux enseignants jusqu’à sa republication."
          }
          confirmLabel="Dépublier"
          confirmVariant="primary"
          onConfirm={() => apply("draft")}
        />
      )}
      {status !== "archived" ? (
        <ConfirmDialog
          trigger={
            <Button variant="ghost">
              <Archive aria-hidden /> Archiver
            </Button>
          }
          title="Archiver la formation ?"
          description="Une formation archivée n’est plus accessible ni attribuable. Les certificats déjà délivrés restent valides et vérifiables."
          confirmLabel="Archiver"
          onConfirm={() => apply("archived")}
        />
      ) : null}

      <Dialog
        open={Boolean(issues)}
        onOpenChange={(open) => !open && setIssues(null)}
        title="Publication impossible pour le moment"
        description="Corrigez les points suivants, puis publiez de nouveau."
      >
        <ul className="space-y-2">
          {issues?.map((issue, i) => (
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
