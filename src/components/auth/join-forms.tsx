"use client";

import { useActionState } from "react";
import { redeemEnrollmentCode, requestJoinWithCode } from "@/server/actions/enrollment-codes";
import { Field, Input } from "@/components/ui/field";
import { FormMessage, SubmitButton } from "@/components/ui/form";
import { Alert } from "@/components/ui/surface";
import { INITIAL_ACTION_STATE } from "@/lib/types";
import { InstitutionConsent } from "./invitation-forms";

function CodeInput() {
  return (
    <Input
      name="code"
      required
      autoComplete="off"
      autoCapitalize="characters"
      spellCheck={false}
      placeholder="XXXX-XXXX-XXXX"
      className="font-mono uppercase tracking-[0.12em]"
    />
  );
}

export function RequestJoinForm() {
  const [state, action] = useActionState(requestJoinWithCode, INITIAL_ACTION_STATE);
  if (state.ok) return <Alert tone="success" title="Vérifiez votre messagerie">{state.message}</Alert>;
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <Field label="Code d’inscription" hint="Communiqué par votre établissement." error={state.fieldErrors?.code}>
        <CodeInput />
      </Field>
      <Field label="Votre adresse e-mail" hint="Un lien de confirmation vous sera envoyé." error={state.fieldErrors?.email}>
        <Input name="email" type="email" autoComplete="email" required />
      </Field>
      <SubmitButton size="lg" className="w-full">
        Continuer
      </SubmitButton>
    </form>
  );
}

export function RedeemCodeForm() {
  const [state, action] = useActionState(redeemEnrollmentCode, INITIAL_ACTION_STATE);
  if (state.ok) return <Alert tone="success" title="Affiliation confirmée">{state.message}</Alert>;
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <Field label="Code d’inscription" error={state.fieldErrors?.code}>
        <CodeInput />
      </Field>
      <InstitutionConsent institutionName="l’établissement" error={state.fieldErrors?.consent} />
      <SubmitButton size="lg" className="w-full">
        Rejoindre l’établissement
      </SubmitButton>
    </form>
  );
}
