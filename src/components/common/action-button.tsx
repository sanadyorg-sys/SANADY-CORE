"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { ConfirmDialog, Dialog } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import type { ActionState } from "@/lib/types";

/**
 * Runs a bound server action, optionally behind a confirmation dialog,
 * and reports the outcome with a toast. When the action returns a link
 * (invitation re-issued while e-mail is not configured) it is displayed.
 */
export function ActionButton({
  action,
  children,
  variant = "secondary",
  size = "sm",
  confirm,
}: {
  action: () => Promise<ActionState>;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  confirm?: { title: string; description: ReactNode; confirmLabel?: string; tone?: ButtonVariant };
}) {
  const toast = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [linkResult, setLinkResult] = useState<{ message?: string; link: string } | null>(null);

  const run = async () => {
    const res = await action();
    if (res.ok && typeof res.data?.link === "string") {
      setLinkResult({ message: res.message, link: res.data.link });
      router.refresh();
    } else if (res.ok) {
      toast({ tone: "success", title: res.message ?? "Opération effectuée." });
      router.refresh();
    } else if (!confirm) {
      toast({ tone: "danger", title: res.message ?? "L’opération n’a pas pu aboutir." });
    }
    return res;
  };

  const linkDialog = (
    <Dialog
      open={Boolean(linkResult)}
      onOpenChange={(open) => !open && setLinkResult(null)}
      title="Lien d’invitation"
      description={linkResult?.message}
      size="md"
    >
      <div className="flex flex-wrap items-center gap-2">
        <code className="max-w-full truncate rounded-sm bg-ink-50 px-2 py-1 font-mono text-caption text-ink-800">{linkResult?.link}</code>
        {linkResult ? <CopyButton value={linkResult.link} label="Copier le lien" /> : null}
      </div>
      <p className="mt-3 text-caption text-ink-500">Ce lien est personnel, à usage unique, et ne sera plus affiché.</p>
    </Dialog>
  );

  if (confirm) {
    return (
      <>
        <ConfirmDialog
          trigger={
            <Button variant={variant} size={size}>
              {children}
            </Button>
          }
          title={confirm.title}
          description={confirm.description}
          confirmLabel={confirm.confirmLabel}
          confirmVariant={confirm.tone ?? "danger"}
          onConfirm={run}
        />
        {linkDialog}
      </>
    );
  }

  return (
    <>
      <Button variant={variant} size={size} loading={pending} onClick={() => startTransition(async () => void (await run()))}>
        {children}
      </Button>
      {linkDialog}
    </>
  );
}
