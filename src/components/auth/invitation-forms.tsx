"use client";

import Link from "next/link";
import { useActionState } from "react";
import { acceptInvitationAsCurrentUser, acceptInvitationWithNewAccount } from "@/server/actions/invitations";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { FormMessage, SubmitButton } from "@/components/ui/form";
import { INITIAL_ACTION_STATE } from "@/lib/types";
import { PasswordInput } from "./auth-forms";

export function InstitutionConsent({ institutionName, error }: { institutionName: string; error?: string }) {
  return (
    <div className="rounded-md border border-line bg-ink-25 p-4">
      <p className="mb-2 text-label font-semibold text-ink-900">Ce que {institutionName} pourra consulter</p>
      <ul className="mb-3 list-disc space-y-1 pl-5 text-label text-ink-600">
        <li>votre nom, votre adresse e-mail et votre date d’affiliation ;</li>
        <li>
          pour les seules formations que l’établissement vous affecte : votre progression, vos résultats aux évaluations et
          l’état de votre certificat.
        </li>
      </ul>
      <p className="mb-3 text-label text-ink-600">
        Vos autres formations personnelles restent privées. Vous pourrez quitter l’établissement à tout moment depuis votre profil.
      </p>
      <Checkbox name="consent" label={`J’accepte de rejoindre ${institutionName} dans ces conditions.`} />
      {error ? (
        <p role="alert" className="mt-2 text-caption font-medium text-danger-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function NewAccountInvitationForm({
  token,
  email,
  institutionName,
  needsConsent,
}: {
  token: string;
  email: string;
  institutionName?: string | null;
  needsConsent: boolean;
}) {
  const [state, action] = useActionState(acceptInvitationWithNewAccount, INITIAL_ACTION_STATE);
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="token" value={token} />
      <Field label="Adresse e-mail" hint="L’adresse à laquelle l’invitation a été envoyée.">
        <Input value={email} readOnly disabled autoComplete="email" />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Prénom" error={state.fieldErrors?.first_name}>
          <Input name="first_name" autoComplete="given-name" required />
        </Field>
        <Field label="Nom" error={state.fieldErrors?.last_name}>
          <Input name="last_name" autoComplete="family-name" required />
        </Field>
      </div>
      <Field
        label="Mot de passe"
        hint="10 caractères minimum, avec des lettres et au moins un chiffre."
        error={state.fieldErrors?.password}
      >
        <PasswordInput name="password" autoComplete="new-password" required />
      </Field>
      <Field label="Confirmation du mot de passe" error={state.fieldErrors?.confirm}>
        <PasswordInput name="confirm" autoComplete="new-password" required />
      </Field>
      {needsConsent && institutionName ? (
        <InstitutionConsent institutionName={institutionName} error={state.fieldErrors?.consent} />
      ) : null}
      <div>
        <Checkbox
          name="privacy"
          label="J’ai pris connaissance de la notice d’information sur les données personnelles."
          description={
            <Link href="/confidentialite" target="_blank" className="font-medium text-accent-700 underline">
              Lire la notice
            </Link>
          }
        />
        {state.fieldErrors?.privacy ? (
          <p role="alert" className="mt-2 text-caption font-medium text-danger-600">
            {state.fieldErrors.privacy}
          </p>
        ) : null}
      </div>
      <SubmitButton size="lg" className="w-full">
        Activer mon compte
      </SubmitButton>
    </form>
  );
}

export function ExistingAccountInvitationForm({
  token,
  institutionName,
  needsConsent,
  label,
}: {
  token: string;
  institutionName?: string | null;
  needsConsent: boolean;
  label: string;
}) {
  const [state, action] = useActionState(acceptInvitationAsCurrentUser, INITIAL_ACTION_STATE);
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="token" value={token} />
      {needsConsent && institutionName ? (
        <InstitutionConsent institutionName={institutionName} error={state.fieldErrors?.consent} />
      ) : null}
      <SubmitButton size="lg" className="w-full">
        {label}
      </SubmitButton>
    </form>
  );
}
