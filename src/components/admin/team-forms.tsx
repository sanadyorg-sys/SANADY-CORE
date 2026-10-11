"use client";

import { useActionState } from "react";
import { setPlatformRole } from "@/server/actions/admin";
import { Field, Input, Select } from "@/components/ui/field";
import { FormMessage, SubmitButton, useActionToast } from "@/components/ui/form";
import { INITIAL_ACTION_STATE } from "@/lib/types";

export function PlatformRoleForm() {
  const [state, action] = useActionState(setPlatformRole, INITIAL_ACTION_STATE);
  useActionToast(state);
  return (
    <form action={action} className="space-y-4" noValidate>
      {!state.ok && state.message ? <FormMessage state={state} /> : null}
      <Field label="Adresse e-mail du compte" hint="La personne doit déjà avoir un compte SANADY." error={state.fieldErrors?.email}>
        <Input name="email" type="email" autoComplete="off" required maxLength={254} />
      </Field>
      <Field label="Rôle" error={state.fieldErrors?.role}>
        <Select name="role" defaultValue="trainer">
          <option value="trainer">Formateur — conçoit les formations qui lui sont confiées</option>
          <option value="training_manager">Responsable pédagogique — relit, publie, suit les résultats</option>
        </Select>
      </Field>
      <SubmitButton>Attribuer le rôle</SubmitButton>
    </form>
  );
}
