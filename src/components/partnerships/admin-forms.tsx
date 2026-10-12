"use client";

import { useActionState, useRef } from "react";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { FormActions, FormMessage, SubmitButton, useActionToast } from "@/components/ui/form";
import { CONTRIBUTION_TYPES, FIELD_SLUGS, INTERVENTION_FIELDS, ORG_TYPES, PIPELINE, type PipelineStatus } from "@/lib/partnerships";
import { INITIAL_ACTION_STATE } from "@/lib/types";
import { addNote, saveContact, saveOrganization, saveTask, setApplicationStatus, setPartnerStatus } from "@/server/actions/partnerships";
import type { OrganizationDetail } from "@/server/queries/partnerships";

const APP_ACTIONS: Record<string, Array<{ value: string; label: string }>> = {
  received: [
    { value: "under_review", label: "Passer en examen" },
    { value: "declined", label: "Ne pas retenir" },
    { value: "withdrawn", label: "Retirée par l’organisation" },
    { value: "spam", label: "Indésirable (spam)" },
  ],
  under_review: [
    { value: "declined", label: "Ne pas retenir" },
    { value: "withdrawn", label: "Retirée par l’organisation" },
  ],
  declined: [{ value: "under_review", label: "Rouvrir l’examen" }],
  withdrawn: [{ value: "under_review", label: "Rouvrir l’examen" }],
};

export function ApplicationStatusForm({ id, status }: { id: string; status: string }) {
  const [state, action] = useActionState(setApplicationStatus, INITIAL_ACTION_STATE);
  useActionToast(state);
  const options = APP_ACTIONS[status] ?? [];
  if (!options.length) return <p className="text-body text-ink-600">Aucun changement de statut possible.</p>;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      {!state.ok && state.message ? <FormMessage state={state} /> : null}
      <Field label="Décision" error={state.fieldErrors?.status}>
        <Select name="status" defaultValue={options[0]!.value}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Commentaire (historique interne)" optional error={state.fieldErrors?.note}>
        <Textarea name="note" rows={2} maxLength={1000} />
      </Field>
      <FormActions>
        <SubmitButton variant="secondary">Enregistrer</SubmitButton>
      </FormActions>
    </form>
  );
}

export function NoteForm({ applicationId, organizationId }: { applicationId?: string; organizationId?: string }) {
  const [state, action] = useActionState(addNote, INITIAL_ACTION_STATE);
  const ref = useRef<HTMLFormElement>(null);
  useActionToast(state, () => ref.current?.reset());
  return (
    <form ref={ref} action={action} className="space-y-3">
      <input type="hidden" name="application_id" value={applicationId ?? ""} />
      <input type="hidden" name="organization_id" value={organizationId ?? ""} />
      <Field label="Nouvelle note" hint="Échange, réunion, appel… Visible uniquement par l’équipe partenariats." error={state.fieldErrors?.body}>
        <Textarea name="body" rows={3} maxLength={4000} />
      </Field>
      <FormActions>
        <SubmitButton variant="secondary">Ajouter la note</SubmitButton>
      </FormActions>
    </form>
  );
}

export function OrganizationForm({ organization }: { organization?: OrganizationDetail }) {
  const [state, action] = useActionState(saveOrganization, INITIAL_ACTION_STATE);
  useActionToast(state);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={organization?.id ?? ""} />
      {!state.ok && state.message ? <FormMessage state={state} /> : null}
      <Field label="Nom de l’organisation" error={e.name}>
        <Input name="name" defaultValue={organization?.name} maxLength={200} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type" error={e.org_type}>
          <Select name="org_type" defaultValue={organization?.org_type ?? ""}>
            <option value="" disabled>
              Choisir…
            </option>
            {Object.entries(ORG_TYPES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Secteur" optional error={e.sector}>
          <Input name="sector" defaultValue={organization?.sector ?? ""} maxLength={150} />
        </Field>
        <Field label="Pays" optional error={e.country}>
          <Input name="country" defaultValue={organization?.country ?? ""} maxLength={80} />
        </Field>
        <Field label="Ville" optional error={e.city}>
          <Input name="city" defaultValue={organization?.city ?? ""} maxLength={100} />
        </Field>
      </div>
      <Field label="Site web" optional error={e.website}>
        <Input name="website" defaultValue={organization?.website ?? ""} maxLength={300} />
      </Field>
      <Field label="Description" optional error={e.description}>
        <Textarea name="description" rows={3} defaultValue={organization?.description ?? ""} maxLength={2000} />
      </Field>
      <fieldset>
        <legend className="text-label font-medium text-ink-800">Domaines d’intervention concernés</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {FIELD_SLUGS.map((s) => (
            <Checkbox key={s} name="fields" value={s} defaultChecked={organization?.fields.includes(s)} label={INTERVENTION_FIELDS[s].name} />
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-label font-medium text-ink-800">Types de contribution</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {Object.entries(CONTRIBUTION_TYPES).map(([k, v]) => (
            <Checkbox key={k} name="contributions" value={k} defaultChecked={organization?.contributions.includes(k as never)} label={v} />
          ))}
        </div>
      </fieldset>
      <FormActions>
        <SubmitButton>{organization ? "Enregistrer" : "Créer la fiche"}</SubmitButton>
      </FormActions>
    </form>
  );
}

const STEP_HELP: Partial<Record<PipelineStatus, string>> = {
  institutional_validation: "Recommandation du responsable des partenariats : la décision revient à un approbateur habilité.",
  agreement_signed: "Décision d’un approbateur habilité (double authentification). Joignez la convention signée dans les notes ou documents.",
  rejected: "Clôt le partenariat.",
};

export function PartnerStatusForm({ id, allowed }: { id: string; allowed: PipelineStatus[] }) {
  const [state, action] = useActionState(setPartnerStatus, INITIAL_ACTION_STATE);
  useActionToast(state);
  if (!allowed.length) {
    return <p className="text-body text-ink-600">Aucune étape suivante n’est disponible pour votre rôle à ce stade.</p>;
  }
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      {!state.ok && state.message ? <FormMessage state={state} /> : null}
      <Field label="Nouvelle étape" error={state.fieldErrors?.status}>
        <Select name="status" defaultValue={allowed[0]}>
          {allowed.map((s) => (
            <option key={s} value={s}>
              {PIPELINE[s]}
            </option>
          ))}
        </Select>
      </Field>
      <ul className="space-y-1 text-caption text-ink-500">
        {allowed
          .filter((s) => STEP_HELP[s])
          .map((s) => (
            <li key={s}>
              <strong className="font-semibold text-ink-700">{PIPELINE[s]} :</strong> {STEP_HELP[s]}
            </li>
          ))}
      </ul>
      <Field label="Commentaire (historique)" optional error={state.fieldErrors?.note}>
        <Textarea name="note" rows={2} maxLength={1000} />
      </Field>
      <FormActions>
        <SubmitButton>Changer d’étape</SubmitButton>
      </FormActions>
    </form>
  );
}

export function ContactForm({ organizationId }: { organizationId: string }) {
  const [state, action] = useActionState(saveContact, INITIAL_ACTION_STATE);
  const ref = useRef<HTMLFormElement>(null);
  useActionToast(state, () => ref.current?.reset());
  const e = state.fieldErrors ?? {};
  return (
    <form ref={ref} action={action} className="space-y-3">
      <input type="hidden" name="organization_id" value={organizationId} />
      {!state.ok && state.message ? <FormMessage state={state} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nom complet" error={e.full_name}>
          <Input name="full_name" maxLength={150} />
        </Field>
        <Field label="Fonction" optional error={e.job_title}>
          <Input name="job_title" maxLength={150} />
        </Field>
        <Field label="E-mail" optional error={e.email}>
          <Input name="email" type="email" maxLength={254} />
        </Field>
        <Field label="Téléphone" optional error={e.phone}>
          <Input name="phone" type="tel" maxLength={40} />
        </Field>
      </div>
      <Checkbox name="is_primary" label="Contact principal" />
      <FormActions>
        <SubmitButton variant="secondary">Ajouter le contact</SubmitButton>
      </FormActions>
    </form>
  );
}

export function TaskForm({ organizationId, team }: { organizationId: string; team: Array<{ id: string; full_name: string | null; email: string }> }) {
  const [state, action] = useActionState(saveTask, INITIAL_ACTION_STATE);
  const ref = useRef<HTMLFormElement>(null);
  useActionToast(state, () => ref.current?.reset());
  const e = state.fieldErrors ?? {};
  return (
    <form ref={ref} action={action} className="space-y-3">
      <input type="hidden" name="organization_id" value={organizationId} />
      {!state.ok && state.message ? <FormMessage state={state} /> : null}
      <Field label="Tâche de suivi" error={e.title}>
        <Input name="title" placeholder="Ex. : relancer pour la proposition écrite" maxLength={200} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Échéance" optional error={e.due_on}>
          <Input name="due_on" type="date" />
        </Field>
        <Field label="Responsable" optional error={e.assigned_to}>
          <Select name="assigned_to" defaultValue="">
            <option value="">Moi</option>
            {team.map((m) => (
              <option key={m.id} value={m.id}>
                {m.full_name || m.email}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <FormActions>
        <SubmitButton variant="secondary">Ajouter la tâche</SubmitButton>
      </FormActions>
    </form>
  );
}
