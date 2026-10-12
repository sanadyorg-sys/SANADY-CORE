"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/types";
import { Alert } from "./surface";
import { Button, type ButtonProps } from "./button";
import { useToast } from "./toast";

/**
 * Submit button bound to the enclosing <form>'s pending state.
 * When a submission comes back with field errors, it moves focus to the first
 * invalid field (WCAG 3.3.1), so keyboard and screen-reader users land on
 * what needs fixing — for every form, without per-form code.
 */
export function SubmitButton({ children, ...props }: ButtonProps) {
  const { pending } = useFormStatus();
  const ref = useRef<HTMLButtonElement>(null);
  const submitted = useRef(false);
  useEffect(() => {
    if (pending) {
      submitted.current = true;
      return;
    }
    if (!submitted.current) return;
    submitted.current = false;
    const frame = requestAnimationFrame(() => {
      ref.current?.form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
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
