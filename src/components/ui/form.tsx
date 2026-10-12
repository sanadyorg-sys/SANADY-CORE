"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/types";
import { Alert } from "./surface";
import { Button, type ButtonProps } from "./button";
import { useToast } from "./toast";

type Snapshot = Array<{ el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement; value: string; checked: boolean }>;

function snapshotForm(form: HTMLFormElement): Snapshot {
  const out: Snapshot = [];
  for (const el of Array.from(form.elements)) {
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) continue;
    if (el instanceof HTMLInputElement && (el.type === "file" || el.type === "hidden" || el.type === "password")) continue;
    out.push({ el, value: el.value, checked: el instanceof HTMLInputElement ? el.checked : false });
  }
  return out;
}

function restoreForm(snapshot: Snapshot) {
  for (const { el, value, checked } of snapshot) {
    if (!el.isConnected) continue;
    if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) el.checked = checked;
    else el.value = value;
  }
}

/**
 * Submit button bound to the enclosing <form>'s pending state, for every form:
 * - React 19 clears a form after each submission, even a refused one. When
 *   the result comes back with errors, the values the person typed are put
 *   back (passwords excepted), so nothing has to be typed again.
 * - Focus then moves to the first invalid field (WCAG 3.3.1).
 */
export function SubmitButton({ children, ...props }: ButtonProps) {
  const { pending } = useFormStatus();
  const ref = useRef<HTMLButtonElement>(null);
  const snapshot = useRef<Snapshot | null>(null);
  useEffect(() => {
    const form = ref.current?.form;
    if (pending) {
      if (form) snapshot.current = snapshotForm(form);
      return;
    }
    const saved = snapshot.current;
    if (!saved || !form) return;
    snapshot.current = null;
    const frame = requestAnimationFrame(() => {
      const invalid = form.querySelector<HTMLElement>('[aria-invalid="true"]');
      const refused = invalid ?? form.querySelector('[role="alert"]:not(:empty)');
      if (refused) restoreForm(saved);
      invalid?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [pending]);
  return (
    <Button ref={ref} type="submit" loading={pending} {...props}>
      {children}
    </Button>
  );
}

/** Inline result message for a server action (errors stay visible). */
export function FormMessage({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <Alert tone={state.ok ? "success" : "danger"} className="mb-4">
      {state.message}
    </Alert>
  );
}

/** Shows a toast when an action succeeds; optional callback (e.g. close a dialog, reset the form). */
export function useActionToast(state: ActionState, onSuccess?: () => void) {
  const toast = useToast();
  const last = useRef<ActionState | null>(null);
  useEffect(() => {
    if (state === last.current) return;
    last.current = state;
    if (state.ok && state.message) {
      toast({ tone: "success", title: state.message });
      onSuccess?.();
    }
  }, [state, toast, onSuccess]);
}

export function FormActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center justify-end gap-2 pt-2">{children}</div>;
}
