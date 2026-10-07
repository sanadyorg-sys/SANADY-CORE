"use client";

import { useActionState, useRef } from "react";
import { createEnrollmentCodeAction } from "@/server/actions/enrollment-codes";
import { Field, Input } from "@/components/ui/field";
import { FormMessage, SubmitButton, useActionToast } from "@/components/ui/form";
import { INITIAL_ACTION_STATE } from "@/lib/types";

function isoDateInDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function EnrollmentCodeForm({ institutionId }: { institutionId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState(createEnrollmentCodeAction, INITIAL_ACTION_STATE);
  useActionToast(state, () => formRef.current?.reset());

  return (
    <form ref={formRef} action={action} className="space-y-4" noValidate>
      {!state.ok ? <FormMessage state={state} /> : null}
      <input type="hidden" name="institution_id" value={institutionId} />
      <Field label="Libellé" optional hint="Par exemple : Rentrée 2026 — équipe de sciences" error={state.fieldErrors?.label}>
        <Input name="label" maxLength={120} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nombre maximal d’inscriptions" error={state.fieldErrors?.max_uses}>
          <Input name="max_uses" type="number" min={1} max={5000} defaultValue={30} required />
        </Field>
        <Field label="Valable jusqu’au" error={state.fieldErrors?.expires_on}>
          <Input name="expires_on" type="date" min={isoDateInDays(1)} max={isoDateInDays(365)} defaultValue={isoDateInDays(30)} required />
        </Field>
      </div>
      <div className="flex justify-end">
        <SubmitButton>Générer le code</SubmitButton>
      </div>
    </form>
  );
}
