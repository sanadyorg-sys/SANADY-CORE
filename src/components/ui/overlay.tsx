"use client";

import { Dialog as RadixDialog, DropdownMenu } from "radix-ui";
import { X } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button, type ButtonVariant } from "./button";

/* ─── Dialog ───────────────────────────────────────────────────────────── */

export function Dialog({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger> : null}
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-ink-900/40 data-[state=open]:animate-in" />
        <RadixDialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-line bg-surface shadow-pop focus-visible:outline-none",
            { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl" }[size],
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div>
              <RadixDialog.Title className="text-section font-semibold text-ink-900">{title}</RadixDialog.Title>
              {description ? (
                <RadixDialog.Description className="mt-1 text-body text-ink-600">{description}</RadixDialog.Description>
              ) : (
                <RadixDialog.Description className="sr-only">{title}</RadixDialog.Description>
              )}
            </div>
            <RadixDialog.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Fermer">
                <X />
              </Button>
            </RadixDialog.Close>
          </div>
          {children ? <div className="overflow-y-auto px-5 py-4">{children}</div> : null}
          {footer ? (
            <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-ink-25 px-5 py-3">{footer}</div>
          ) : null}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

export const DialogClose = RadixDialog.Close;

/* ─── Drawer (side panel) ──────────────────────────────────────────────── */

export function Drawer({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  side = "right",
  width = "max-w-md",
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  side?: "left" | "right";
  width?: string;
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger> : null}
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-ink-900/40" />
        <RadixDialog.Content
          className={cn(
            "fixed inset-y-0 z-50 flex w-full flex-col border-line bg-surface shadow-pop focus-visible:outline-none",
            side === "right" ? "right-0 border-l" : "left-0 border-r",
            width,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div>
              <RadixDialog.Title className="text-section font-semibold text-ink-900">{title}</RadixDialog.Title>
              {description ? (
                <RadixDialog.Description className="mt-1 text-body text-ink-600">{description}</RadixDialog.Description>
              ) : (
                <RadixDialog.Description className="sr-only">{title}</RadixDialog.Description>
              )}
            </div>
            <RadixDialog.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Fermer">
                <X />
              </Button>
            </RadixDialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto">{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

/* ─── Confirmation dialog ──────────────────────────────────────────────── */

/**
 * Confirmation for consequential actions. `onConfirm` is typically a bound
 * server action; errors are shown inside the dialog.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Confirmer",
  confirmVariant = "danger",
  onConfirm,
  children,
}: {
  trigger: ReactNode;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  confirmVariant?: ButtonVariant;
  onConfirm: () => Promise<{ ok: boolean; message?: string } | void>;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
      trigger={trigger}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <DialogClose asChild>
            <Button variant="secondary" disabled={pending}>
              Annuler
            </Button>
          </DialogClose>
          <Button
            variant={confirmVariant}
            loading={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await onConfirm();
                if (result && !result.ok) {
                  setError(result.message ?? "L’opération n’a pas pu aboutir.");
                } else {
                  setOpen(false);
                }
              })
            }
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
      {error ? (
        <p role="alert" className="mt-2 text-label font-medium text-danger-600">
          {error}
        </p>
      ) : null}
    </Dialog>
  );
}

/* ─── Dropdown menu ────────────────────────────────────────────────────── */

export function Menu({ trigger, children, align = "end" }: { trigger: ReactNode; children: ReactNode; align?: "start" | "end" }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          sideOffset={6}
          className="z-50 min-w-[200px] rounded-md border border-line bg-surface p-1 shadow-pop"
        >
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function MenuItem({
  children,
  onSelect,
  asChild,
  tone = "default",
}: {
  children: ReactNode;
  onSelect?: (e: Event) => void;
  asChild?: boolean;
  tone?: "default" | "danger";
}) {
  return (
    <DropdownMenu.Item
      asChild={asChild}
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer select-none items-center gap-2 rounded-sm px-2.5 py-2 text-body outline-none [&_svg]:size-4",
        tone === "danger"
          ? "text-danger-600 data-[highlighted]:bg-danger-50"
          : "text-ink-800 data-[highlighted]:bg-ink-100",
      )}
    >
      {children}
    </DropdownMenu.Item>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <DropdownMenu.Label className="px-2.5 py-1.5 text-caption font-medium text-ink-500">{children}</DropdownMenu.Label>;
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className="my-1 h-px bg-line" />;
}
