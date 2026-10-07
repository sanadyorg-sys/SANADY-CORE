"use client";

import { useActionState, useRef } from "react";
import { LogOut } from "lucide-react";
import { changePassword, leaveInstitution, updateProfile } from "@/server/actions/profile";
import { PasswordInput } from "@/components/auth/auth-forms";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { FormActions, FormMessage, SubmitButton, useActionToast } from "@/components/ui/form";
import { ConfirmDialog } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { INITIAL_ACTION_STATE, type Profile } from "@/lib/types";

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, action] = useActionState(updateProfile, INITIAL_ACTION_STATE);
  useActionToast(state);
  return (
    <form action={action} className="space-y-4" noValidate>
      {!state.ok ? <FormMessage state={state} /> : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Prénom" error={state.fieldErrors?.first_name}>
          <Input name="first_name" defaultValue={profile.first_name} autoComplete="given-name" required />
        </Field>
        <Field label="Nom" error={state.fieldErrors?.last_name}>
          <Input name="last_name" defaultValue={profile.last_name} autoComplete="family-name" required />
        </Field>
      </div>
      <Field label="Adresse e-mail" hint="Pour modifier votre adresse, contactez l’administration SANADY.">
        <Input value={profile.email} readOnly disabled />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Fonction" optional error={state.fieldErrors?.job_title}>
          <Input name="job_title" defaultValue={profile.job_title ?? ""} autoComplete="organization-title" />
        </Field>
        <Field label="Discipline ou niveau" optional error={state.fieldErrors?.subject_area}>
          <Input name="subject_area" defaultValue={profile.subject_area ?? ""} />
        </Field>
      </div>
      <Field label="Téléphone" optional error={state.fieldErrors?.phone}>
        <Input name="phone" type="tel" defaultValue={profile.phone ?? ""} autoComplete="tel" className="sm:max-w-xs" />
      </Field>
      <p className="text-caption text-ink-500">
        Le nom indiqué ici figure sur les certificats délivrés après sa modification. Les certificats déjà délivrés ne sont pas modifiés.
      </p>
      <FormActions>
        <SubmitButton>Enregistrer</SubmitButton>
      </FormActions>
    </form>
  );
}

export function PasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState(changePassword, INITIAL_ACTION_STATE);
  useActionToast(state, () => formRef.current?.reset());
  return (
    <form ref={formRef} action={action} className="space-y-4" noValidate>
      {!state.ok ? <FormMessage state={state} /> : null}
      <Field label="Mot de passe actuel" error={state.fieldErrors?.current}>
        <PasswordInput name="current" autoComplete="current-password" required />
      </Field>
      <Field label="Nouveau mot de passe" hint="10 caractères minimum, avec des lettres et au moins un chiffre." error={state.fieldErrors?.password}>
        <PasswordInput name="password" autoComplete="new-password" required />
      </Field>
      <Field label="Confirmation" error={state.fieldErrors?.confirm}>
        <PasswordInput name="confirm" autoComplete="new-password" required />
      </Field>
      <FormActions>
        <SubmitButton variant="secondary">Modifier le mot de passe</SubmitButton>
      </FormActions>
    </form>
  );
}

export function LeaveInstitutionButton({ institutionId, institutionName }: { institutionId: string; institutionName: string }) {
  const toast = useToast();
  return (
    <ConfirmDialog
      trigger={
        <Button variant="danger-ghost" size="sm">
          <LogOut aria-hidden /> Quitter
        </Button>
      }
      title={`Quitter ${institutionName} ?`}
      description="L’établissement n’aura plus accès à votre progression, et les formations qu’il vous a affectées ne seront plus accessibles. Votre historique et vos certificats sont conservés."
      confirmLabel="Quitter l’établissement"
      onConfirm={async () => {
        const res = await leaveInstitution(institutionId);
        if (res.ok) toast({ tone: "success", title: res.message ?? "Établissement quitté." });
        return res;
      }}
    />
  );
}
