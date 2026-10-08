"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { completeOnboarding, requestPasswordReset, signIn, updatePassword } from "@/server/actions/auth";
import { Field, Input, Checkbox } from "@/components/ui/field";
import { FormMessage, SubmitButton } from "@/components/ui/form";
import { Alert } from "@/components/ui/surface";
import { INITIAL_ACTION_STATE } from "@/lib/types";

export function PasswordInput(props: React.ComponentProps<typeof Input>) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className={["pr-10", props.className].filter(Boolean).join(" ")} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-1.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-sm text-ink-500 hover:text-ink-800"
        aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        aria-pressed={visible}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

export function SignInForm({ suite, notice }: { suite?: string; notice?: string }) {
  const [state, action] = useActionState(signIn, INITIAL_ACTION_STATE);
  return (
    <form action={action} className="space-y-4" noValidate>
      {notice ? <Alert tone="info">{notice}</Alert> : null}
      <FormMessage state={state} />
      <input type="hidden" name="suite" value={suite ?? ""} />
      <Field label="Adresse e-mail" error={state.fieldErrors?.email}>
        <Input
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="nom@exemple.ma"
          required
          autoFocus
          className="h-11"
        />
      </Field>
      <Field label="Mot de passe" error={state.fieldErrors?.password}>
        <PasswordInput name="password" autoComplete="current-password" required className="h-11" />
      </Field>
      <div className="flex justify-end">
        <Link href="/mot-de-passe-oublie" className="text-label font-medium text-accent-700 hover:underline">
          Mot de passe oublié&nbsp;?
        </Link>
      </div>
      <SubmitButton variant="accent" size="lg" className="h-12 w-full text-[1rem] font-semibold">
        Se connecter <ArrowRight aria-hidden />
      </SubmitButton>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordReset, INITIAL_ACTION_STATE);
  if (state.ok) return <Alert tone="success">{state.message}</Alert>;
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <Field label="Adresse e-mail" error={state.fieldErrors?.email}>
        <Input name="email" type="email" autoComplete="email" required autoFocus />
      </Field>
      <SubmitButton size="lg" className="w-full">
        Recevoir le lien de réinitialisation
      </SubmitButton>
    </form>
  );
}

export function NewPasswordForm() {
  const [state, action] = useActionState(updatePassword, INITIAL_ACTION_STATE);
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <Field
        label="Nouveau mot de passe"
        hint="10 caractères minimum, avec des lettres et au moins un chiffre."
        error={state.fieldErrors?.password}
      >
        <PasswordInput name="password" autoComplete="new-password" required autoFocus />
      </Field>
      <Field label="Confirmation du mot de passe" error={state.fieldErrors?.confirm}>
        <PasswordInput name="confirm" autoComplete="new-password" required />
      </Field>
      <SubmitButton size="lg" className="w-full">
        Enregistrer le mot de passe
      </SubmitButton>
    </form>
  );
}

export function OnboardingForm({
  defaults,
}: {
  defaults: { first_name: string; last_name: string; job_title: string; subject_area: string };
}) {
  const [state, action] = useActionState(completeOnboarding, INITIAL_ACTION_STATE);
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Prénom" error={state.fieldErrors?.first_name}>
          <Input name="first_name" autoComplete="given-name" defaultValue={defaults.first_name} required />
        </Field>
        <Field label="Nom" error={state.fieldErrors?.last_name}>
          <Input name="last_name" autoComplete="family-name" defaultValue={defaults.last_name} required />
        </Field>
      </div>
      <Field label="Fonction" optional hint="Par exemple : Professeur de mathématiques, Directrice d’école…" error={state.fieldErrors?.job_title}>
        <Input name="job_title" defaultValue={defaults.job_title} autoComplete="organization-title" />
      </Field>
      <Field label="Discipline ou niveau d’enseignement" optional error={state.fieldErrors?.subject_area}>
        <Input name="subject_area" defaultValue={defaults.subject_area} />
      </Field>
      <div className="rounded-md border border-line bg-ink-25 p-4">
        <Checkbox
          name="privacy"
          label="J’ai pris connaissance de la notice d’information sur les données personnelles."
          description={
            <>
              Elle précise les données collectées sur votre apprentissage et ce que votre établissement peut consulter.{" "}
              <Link href="/confidentialite" target="_blank" className="font-medium text-accent-700 underline">
                Lire la notice
              </Link>
            </>
          }
        />
        {state.fieldErrors?.privacy ? (
          <p role="alert" className="mt-2 text-caption font-medium text-danger-600">
            {state.fieldErrors.privacy}
          </p>
        ) : null}
      </div>
      <SubmitButton size="lg" className="w-full">
        Accéder à mon espace
      </SubmitButton>
    </form>
  );
}
