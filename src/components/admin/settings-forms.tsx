"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { updateSettings } from "@/server/actions/admin";
import { createCategory, deleteCategory, updateCategory } from "@/server/actions/courses";
import { ActionButton } from "@/components/common/action-button";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { FormActions, FormMessage, SubmitButton, useActionToast } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { INITIAL_ACTION_STATE, type CourseCategory, type PlatformSettings } from "@/lib/types";

export function SettingsForm({ settings }: { settings: PlatformSettings }) {
  const [state, action] = useActionState(updateSettings, INITIAL_ACTION_STATE);
  useActionToast(state);
  return (
    <form action={action} className="space-y-6" noValidate>
      {!state.ok ? <FormMessage state={state} /> : null}
      <fieldset className="space-y-4">
        <legend className="mb-1 text-label font-semibold uppercase tracking-wide text-ink-500">Suivi et invitations</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Seuil d’inactivité (jours)"
            hint="Au-delà, un enseignant ayant une formation non terminée est signalé comme inactif."
            error={state.fieldErrors?.inactivity_threshold_days}
          >
            <Input name="inactivity_threshold_days" type="number" min={3} max={180} defaultValue={settings.inactivity_threshold_days} required />
          </Field>
          <Field label="Validité des invitations (jours)" error={state.fieldErrors?.invitation_validity_days}>
            <Input name="invitation_validity_days" type="number" min={1} max={30} defaultValue={settings.invitation_validity_days} required />
          </Field>
        </div>
      </fieldset>
      <fieldset className="space-y-4">
        <legend className="mb-1 text-label font-semibold uppercase tracking-wide text-ink-500">Certificats</legend>
        <Field label="Organisme émetteur" error={state.fieldErrors?.certificate_issuer_name}>
          <Input name="certificate_issuer_name" defaultValue={settings.certificate_issuer_name} required />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Signataire" optional error={state.fieldErrors?.certificate_signatory_name}>
            <Input name="certificate_signatory_name" defaultValue={settings.certificate_signatory_name ?? ""} />
          </Field>
          <Field label="Fonction du signataire" optional error={state.fieldErrors?.certificate_signatory_title}>
            <Input name="certificate_signatory_title" defaultValue={settings.certificate_signatory_title ?? ""} />
          </Field>
        </div>
      </fieldset>
      <fieldset className="space-y-4">
        <legend className="mb-1 text-label font-semibold uppercase tracking-wide text-ink-500">Contact</legend>
        <Field label="E-mail d’assistance" optional hint="Affiché dans la notice de confidentialité." error={state.fieldErrors?.support_email}>
          <Input name="support_email" type="email" defaultValue={settings.support_email ?? ""} />
        </Field>
      </fieldset>
      <FormActions>
        <SubmitButton>Enregistrer les paramètres</SubmitButton>
      </FormActions>
    </form>
  );
}

export function CategoryManager({ categories }: { categories: CourseCategory[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState(createCategory, INITIAL_ACTION_STATE);
  useActionToast(state, () => formRef.current?.reset());

  return (
    <div className="space-y-4">
      <form ref={formRef} action={action} className="flex items-end gap-2" noValidate>
        <Field label="Nouvelle catégorie" error={state.fieldErrors?.name ?? (!state.ok ? state.message : undefined)} className="flex-1">
          <Input name="name" maxLength={80} placeholder="Ex. : Didactique des sciences" />
        </Field>
        <SubmitButton variant="secondary">Ajouter</SubmitButton>
      </form>
      {categories.length ? (
        <ul className="divide-y divide-line rounded-md border border-line">
          {categories.map((c) => (
            <CategoryRow key={c.id} category={c} />
          ))}
        </ul>
      ) : (
        <p className="text-body text-ink-500">Aucune catégorie. Une catégorie est requise pour publier une formation.</p>
      )}
    </div>
  );
}

function CategoryRow({ category }: { category: CourseCategory }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  return (
    <li className="flex items-center gap-2 px-3 py-2">
      {editing ? (
        <>
          <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Nom de la catégorie" className="flex-1" autoFocus />
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Valider"
            loading={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await updateCategory(category.id, name);
                toast({ tone: res.ok ? "success" : "danger", title: res.message ?? "" });
                if (res.ok) setEditing(false);
              })
            }
          >
            <Check />
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label="Annuler" onClick={() => (setEditing(false), setName(category.name))}>
            <X />
          </Button>
        </>
      ) : (
        <>
          <span className="flex-1 text-body text-ink-800">{category.name}</span>
          <Button size="icon-sm" variant="ghost" aria-label={`Renommer ${category.name}`} onClick={() => setEditing(true)}>
            <Pencil />
          </Button>
          <ActionButton
            variant="danger-ghost"
            size="icon-sm"
            action={deleteCategory.bind(null, category.id)}
            confirm={{
              title: `Supprimer la catégorie « ${category.name} » ?`,
              description: "Les formations de cette catégorie n’en auront plus ; une catégorie est requise pour publier.",
              confirmLabel: "Supprimer",
            }}
          >
            <Trash2 aria-label={`Supprimer ${category.name}`} />
          </ActionButton>
        </>
      )}
    </li>
  );
}
