"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { createInstitution, updateInstitution } from "@/server/actions/admin";
import { buttonClasses } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Field, Input, Select } from "@/components/ui/field";
import { FormActions, FormMessage, SubmitButton, useActionToast } from "@/components/ui/form";
import { Alert } from "@/components/ui/surface";
import { INSTITUTION_TYPES } from "@/lib/labels";
import { INITIAL_ACTION_STATE, type Institution } from "@/lib/types";

/** Creation (with optional administrator invitation) and edition form. */
export function InstitutionForm({ institution }: { institution?: Institution }) {
  const router = useRouter();
  const [state, action] = useActionState(institution ? updateInstitution : createInstitution, INITIAL_ACTION_STATE);
  useActionToast(institution ? state : INITIAL_ACTION_STATE);

  const href = state.ok ? (state.data?.href as string | undefined) : undefined;
  const link = state.ok ? (state.data?.link as string | undefined) : undefined;
  useEffect(() => {
    if (!institution && href && !link) router.push(href);
  }, [href, link, institution, router]);

  if (!institution && link && href) {
    return (
      <div className="space-y-4">
        <Alert tone="warning" title="Établissement créé — e-mail non envoyé">
          <p>{state.message}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="max-w-full truncate rounded-sm bg-white/70 px-2 py-1 font-mono text-caption text-ink-800">{link}</code>
            <CopyButton value={link} label="Copier le lien" />
          </div>
          <p className="mt-2 text-caption">Ce lien est personnel, à usage unique, et ne sera plus affiché.</p>
        </Alert>
        <Link href={href} className={buttonClasses()}>
          Ouvrir la fiche de l’établissement
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      {!state.ok ? <FormMessage state={state} /> : null}
      {institution ? <input type="hidden" name="id" value={institution.id} /> : null}
      <Field label="Nom de l’établissement" error={state.fieldErrors?.name}>
        <Input name="name" defaultValue={institution?.name} required maxLength={200} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Identifiant" hint="Unique, par ex. LYC-CASA-012" error={state.fieldErrors?.identifier}>
          <Input name="identifier" defaultValue={institution?.identifier} required className="font-mono uppercase" maxLength={40} />
        </Field>
        <Field label="Type" error={state.fieldErrors?.type}>
          <Select name="type" defaultValue={institution?.type ?? ""} required>
            <option value="" disabled>
              Sélectionner
            </option>
            {Object.entries(INSTITUTION_TYPES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Ville" optional error={state.fieldErrors?.city}>
        <Input name="city" defaultValue={institution?.city ?? ""} maxLength={120} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="E-mail de contact" error={state.fieldErrors?.contact_email}>
          <Input name="contact_email" type="email" defaultValue={institution?.contact_email} required />
        </Field>
        <Field label="Téléphone" optional error={state.fieldErrors?.contact_phone}>
          <Input name="contact_phone" type="tel" defaultValue={institution?.contact_phone ?? ""} maxLength={30} />
        </Field>
      </div>
      {!institution ? (
        <div className="rounded-md border border-line bg-ink-25 p-4">
          <Field
            label="Administrateur de l’établissement"
            optional
            hint="Une invitation sécurisée sera adressée à cette personne. Vous pourrez aussi l’inviter plus tard."
            error={state.fieldErrors?.admin_email}
          >
            <Input name="admin_email" type="email" placeholder="direction@etablissement.ma" />
          </Field>
        </div>
      ) : null}
      <FormActions>
        <SubmitButton>{institution ? "Enregistrer" : "Créer l’établissement"}</SubmitButton>
      </FormActions>
    </form>
  );
}
