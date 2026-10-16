"use client";

import { useActionState, useState, type ReactNode } from "react";
import { Copy } from "lucide-react";
import { Button, type ButtonVariant } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { FormMessage, SubmitButton, useActionToast } from "@/components/ui/form";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/types";

/** Small forms of the deletion workflow (each bound to its server action). */

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export function ReasonForm({ action, label, hint, submit, variant = "secondary", children }: { action: Action; label: string; hint?: string; submit: ReactNode; variant?: ButtonVariant; children?: ReactNode }) {
  const [state, run] = useActionState(action, INITIAL_ACTION_STATE);
  useActionToast(state);
  return (
    <form action={run} className="space-y-3">
      {!state.ok && state.message ? <FormMessage state={state} /> : null}
      {children}
      <Field label={label} hint={hint} error={state.fieldErrors?.reason}>
        <Textarea name="reason" rows={2} maxLength={1000} />
      </Field>
      <div className="flex justify-end">
        <SubmitButton variant={variant}>{submit}</SubmitButton>
      </div>
    </form>
  );
}

export function StepForm({ action, kind }: { action: Action; kind: "notice" | "delivery" }) {
  const [state, run] = useActionState(action, INITIAL_ACTION_STATE);
  useActionToast(state);
  const e = state.fieldErrors ?? {};
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={run} className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)_auto] sm:items-end">
      {!state.ok && state.message ? (
        <div className="sm:col-span-3">
          <FormMessage state={state} />
        </div>
      ) : null}
      <Field label={kind === "notice" ? "Envoyé le" : "Remises le"} error={e.date}>
        <Input name="date" type="date" defaultValue={today} max={today} />
      </Field>
      {kind === "notice" ? (
        <Field label="À qui" error={e.recipient}>
          <Input name="recipient" maxLength={300} placeholder="Nom, fonction et adresse e-mail" />
        </Field>
      ) : (
        <Field label="Comment" error={e.method}>
          <Input name="method" maxLength={500} placeholder="Ex. : export CSV remis par e-mail sécurisé — ou : l’organisation n’en veut pas (écrit du …)" />
        </Field>
      )}
      <SubmitButton variant="secondary">Enregistrer</SubmitButton>
    </form>
  );
}

export function NoticeText({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-2">
      <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl border border-line bg-ink-50 p-3 font-sans text-label text-ink-800">{text}</pre>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => {
          void navigator.clipboard?.writeText(text).then(() => setCopied(true));
        }}
      >
        <Copy aria-hidden /> {copied ? "Copié" : "Copier le texte de l’avis"}
      </Button>
    </div>
  );
}
