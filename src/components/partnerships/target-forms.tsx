"use client";

import { useActionState, useRef, type ReactNode } from "react";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { FormActions, FormMessage, SubmitButton, useActionToast } from "@/components/ui/form";
import { CONTRIBUTION_TYPES, CURRENCIES, FIELD_SLUGS, INTERVENTION_FIELDS, NEED_PRIORITY } from "@/lib/partnerships";
import { INITIAL_ACTION_STATE } from "@/lib/types";
import { addTargetNote, saveNeed, saveOpportunity, setNeedStatus, setOpportunityStatus } from "@/server/actions/partnerships";
import type { NeedDetail, OpportunityDetail } from "@/server/queries/partnerships";

/** Forms of phase 3: educational needs and projects seeking partners. */

export function StatusChangeForm({
  id,
  options,
  kind,
  help,
}: {
  id: string;
  options: Array<{ value: string; label: string }>;
  kind: "need" | "opportunity";
  help?: ReactNode;
}) {
  const [state, action] = useActionState(kind === "need" ? setNeedStatus : setOpportunityStatus, INITIAL_ACTION_STATE);
  useActionToast(state);
  if (!options.length) return <p className="text-body text-ink-600">Aucune action disponible pour votre rôle à ce stade.</p>;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      {!state.ok && state.message ? <FormMessage state={state} /> : null}
      <Field label="Action" error={state.fieldErrors?.status}>
        <Select name="status" defaultValue={options[0]!.value}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </Field>
      {help ? <div className="text-caption text-ink-500">{help}</div> : null}
      <Field label="Commentaire (historique)" optional error={state.fieldErrors?.note}>
        <Textarea name="note" rows={2} maxLength={1000} />
      </Field>
      <FormActions>
        <SubmitButton>Enregistrer</SubmitButton>
      </FormActions>
    </form>
  );
}

export function TargetNoteForm({ needId, opportunityId }: { needId?: string; opportunityId?: string }) {
  const [state, action] = useActionState(addTargetNote, INITIAL_ACTION_STATE);
  const ref = useRef<HTMLFormElement>(null);
  useActionToast(state, () => ref.current?.reset());
  return (
    <form ref={ref} action={action} className="space-y-3">
      <input type="hidden" name="need_id" value={needId ?? ""} />
      <input type="hidden" name="opportunity_id" value={opportunityId ?? ""} />
      <Field label="Nouvelle note" hint="Visible uniquement par l’équipe partenariats." error={state.fieldErrors?.body}>
        <Textarea name="body" rows={3} maxLength={4000} />
      </Field>
      <FormActions>
        <SubmitButton variant="secondary">Ajouter la note</SubmitButton>
      </FormActions>
    </form>
  );
}

type Person = { id: string; full_name: string | null; email: string };

function FieldSelect({ value, error }: { value?: string; error?: string }) {
  return (
    <Field label="Domaine d’intervention" error={error}>
      <Select name="intervention_field" defaultValue={value ?? ""}>
        <option value="" disabled>
          Choisir…
        </option>
        {FIELD_SLUGS.map((s) => (
          <option key={s} value={s}>
            {INTERVENTION_FIELDS[s].name}
          </option>
        ))}
      </Select>
    </Field>
  );
}

function CurrencySelect({ value, error }: { value?: string; error?: string }) {
  return (
    <Field label="Devise" error={error}>
      <Select name="currency" defaultValue={value ?? "MAD"}>
        {Object.keys(CURRENCIES).map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </Select>
    </Field>
  );
}

export function NeedForm({ need, institutions, team }: { need?: NeedDetail; institutions: Array<{ id: string; name: string }>; team: Person[] }) {
  const [state, action] = useActionState(saveNeed, INITIAL_ACTION_STATE);
  useActionToast(state);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={need?.id ?? ""} />
      {!state.ok && state.message ? <FormMessage state={state} /> : null}
      <Field label="Titre du besoin" error={e.title}>
        <Input name="title" defaultValue={need?.title} maxLength={200} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldSelect value={need?.intervention_field} error={e.intervention_field} />
        <Field label="Priorité" error={e.priority}>
          <Select name="priority" defaultValue={need?.priority ?? "medium"}>
            {Object.entries(NEED_PRIORITY).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Établissement concerné" optional error={e.institution_id}>
          <Select name="institution_id" defaultValue={need?.institution_id ?? ""}>
            <option value="">Aucun ou plusieurs</option>
            {institutions.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Projet ou programme" optional error={e.project_label}>
          <Input name="project_label" defaultValue={need?.project_label ?? ""} maxLength={200} />
        </Field>
      </div>
      <Field label="Description du besoin" error={e.description}>
        <Textarea name="description" rows={4} defaultValue={need?.description} maxLength={4000} />
      </Field>
      <Field label="Justification éducative" hint="Pourquoi ce besoin compte pour les élèves ou les enseignants." error={e.justification}>
        <Textarea name="justification" rows={3} defaultValue={need?.justification} maxLength={4000} />
      </Field>
      <Field label="Ressources nécessaires" optional error={e.required_resources}>
        <Textarea name="required_resources" rows={2} defaultValue={need?.required_resources ?? ""} maxLength={2000} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Coût estimé" optional hint="Interne, jamais publié tel quel." error={e.estimated_cost}>
          <Input name="estimated_cost" inputMode="decimal" defaultValue={need?.estimated_cost ?? ""} />
        </Field>
        <CurrencySelect value={need?.currency} error={e.currency} />
        <Field label="Calendrier" optional error={e.timeline}>
          <Input name="timeline" defaultValue={need?.timeline ?? ""} maxLength={200} />
        </Field>
      </div>
      <Field label="Responsable SANADY" optional error={e.responsible_id}>
        <Select name="responsible_id" defaultValue={need?.responsible_id ?? ""}>
          <option value="">Moi</option>
          {team.map((m) => (
            <option key={m.id} value={m.id}>
              {m.full_name || m.email}
            </option>
          ))}
        </Select>
      </Field>
      <FormActions>
        <SubmitButton>{need ? "Enregistrer" : "Enregistrer le besoin"}</SubmitButton>
      </FormActions>
    </form>
  );
}

export function OpportunityForm({ opportunity: o }: { opportunity?: OpportunityDetail }) {
  const [state, action] = useActionState(saveOpportunity, INITIAL_ACTION_STATE);
  useActionToast(state);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={o?.id ?? ""} />
      {!state.ok && state.message ? <FormMessage state={state} /> : null}
      <Field label="Titre du projet" error={e.title}>
        <Input name="title" defaultValue={o?.title} maxLength={200} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldSelect value={o?.intervention_field} error={e.intervention_field} />
        <Field label="Zone géographique" optional error={e.geographic_scope}>
          <Input name="geographic_scope" defaultValue={o?.geographic_scope ?? ""} maxLength={200} />
        </Field>
      </div>
      <Field label="Résumé (carte publique)" hint="De 20 à 300 caractères." error={e.summary}>
        <Textarea name="summary" rows={2} defaultValue={o?.summary} maxLength={300} />
      </Field>
      <Field label="Description" error={e.description}>
        <Textarea name="description" rows={5} defaultValue={o?.description} maxLength={6000} />
      </Field>
      <Field label="Objectifs éducatifs" error={e.objectives}>
        <Textarea name="objectives" rows={3} defaultValue={o?.objectives} maxLength={3000} />
      </Field>
      <Field label="Bénéficiaires" error={e.beneficiaries}>
        <Input name="beneficiaries" defaultValue={o?.beneficiaries} maxLength={1000} />
      </Field>
      <fieldset>
        <legend className="text-label font-medium text-ink-800">Types de contribution recherchés</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {Object.entries(CONTRIBUTION_TYPES).map(([k, v]) => (
            <Checkbox key={k} name="contribution_types" value={k} defaultChecked={o?.contribution_types.includes(k as never)} label={v} />
          ))}
        </div>
        {e.contribution_types ? (
          <p className="mt-1 text-caption font-medium text-danger-600" role="alert">
            {e.contribution_types}
          </p>
        ) : null}
      </fieldset>
      <Field label="Contribution attendue" error={e.expected_contribution}>
        <Textarea name="expected_contribution" rows={2} defaultValue={o?.expected_contribution} maxLength={2000} />
      </Field>
      <Field label="Expertise ou ressources nécessaires" optional error={e.required_resources}>
        <Textarea name="required_resources" rows={2} defaultValue={o?.required_resources ?? ""} maxLength={2000} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Objectif de financement" optional hint="Publié seulement après approbation." error={e.funding_target}>
          <Input name="funding_target" inputMode="decimal" defaultValue={o?.funding_target ?? ""} />
        </Field>
        <CurrencySelect value={o?.currency} error={e.currency} />
        <Field label="Date limite de candidature" optional error={e.deadline}>
          <Input name="deadline" type="date" defaultValue={o?.deadline ?? ""} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Calendrier de mise en œuvre" optional error={e.timeline}>
          <Input name="timeline" defaultValue={o?.timeline ?? ""} maxLength={200} />
        </Field>
        <Field label="Département responsable" optional error={e.department}>
          <Input name="department" defaultValue={o?.department ?? ""} maxLength={150} />
        </Field>
      </div>
      <FormActions>
        <SubmitButton>{o ? "Enregistrer" : "Créer le brouillon"}</SubmitButton>
      </FormActions>
    </form>
  );
}
