"use client";

import { useActionState } from "react";
import { grantPartnershipApprover, setPlatformRole } from "@/server/actions/admin";
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
          <option value="partnership_coordinator">Chargé(e) des partenariats — candidatures, contacts, suivi</option>
          <option value="partnership_manager">Responsable des partenariats — évalue et soumet à validation</option>
        </Select>
      </Field>
      <SubmitButton>Attribuer le rôle</SubmitButton>
    </form>
  );
}

/** Appoints an approver (signing authority). Never oneself: the database refuses it. */
export function PartnershipApproverForm() {
  const [state, action] = useActionState(grantPartnershipApprover, INITIAL_ACTION_STATE);
  useActionToast(state);
  return (
    <form action={action} className="space-y-4" noValidate>
      {!state.ok && state.message ? <FormMessage state={state} /> : null}
      <Field label="Adresse e-mail du compte" hint="Un administrateur ou une personne ayant un rôle partenariats, autre que vous." error={state.fieldErrors?.email}>
        <Input name="email" type="email" autoComplete="off" required maxLength={254} />
      </Field>
      <SubmitButton variant="secondary">Désigner l’approbateur</SubmitButton>
    </form>
  );
}
