"use client";

import { useActionState, useState } from "react";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { FormActions, FormMessage, SubmitButton, useActionToast } from "@/components/ui/form";
import { ATTRIBUTIONS, FIELD_SLUGS, IMPACT_DIMENSIONS, INTERVENTION_FIELDS, METRIC_TYPES, type InterventionField } from "@/lib/partnerships";
import { INITIAL_ACTION_STATE } from "@/lib/types";
import { saveMetric, saveReport, setMetricStatus } from "@/server/actions/impact";
import type { MetricRow, ReportDetail } from "@/server/queries/impact";

/** Forms of partnership phase 5: impact indicators and partner reports. */

type Option = { id: string; label: string };

export function MetricForm({ organizationId, metric: m, agreements, opportunities }: { organizationId: string; metric?: MetricRow; agreements: Option[]; opportunities: Option[] }) {
  const [state, action] = useActionState(saveMetric, INITIAL_ACTION_STATE);
  useActionToast(state);
  const e = state.fieldErrors ?? {};
  const [field, setField] = useState<InterventionField | "">(m?.intervention_field ?? "");
  const [dimension, setDimension] = useState(m?.dimension ?? "");
  const dimensions = Object.entries(IMPACT_DIMENSIONS).filter(([, d]) => !field || d.field === field || d.field === null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={m?.id ?? ""} />
      <input type="hidden" name="organization_id" value={organizationId} />
      {!state.ok && state.message ? <FormMessage state={state} /> : null}
      {m?.status === "rejected" && m.review_comment ? <p className="rounded-lg bg-danger-50 px-3 py-2 text-label text-danger-700">À corriger : {m.review_comment}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Convention" optional hint="Rattachez l’indicateur à une convention ou à un projet." error={e.agreement_id}>
          <Select name="agreement_id" defaultValue={m?.agreement_id ?? ""}>
            <option value="">Aucune</option>
            {agreements.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Projet soutenu" optional error={e.opportunity_id}>
          <Select name="opportunity_id" defaultValue={m?.opportunity_id ?? ""}>
            <option value="">Aucun</option>
            {opportunities.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Domaine d’intervention" error={e.intervention_field}>
          <Select
            name="intervention_field"
            value={field}
            onChange={(ev) => {
              setField(ev.currentTarget.value as InterventionField);
              setDimension("");
            }}
          >
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
        <Field label="Indicateur" error={e.dimension}>
          <Select name="dimension" value={dimension} onChange={(ev) => setDimension(ev.currentTarget.value)}>
            <option value="" disabled>
              Choisir…
            </option>
            {dimensions.map(([k, d]) => (
              <option key={k} value={k}>
                {d.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {dimension === "other" ? (
        <Field label="Nom de l’indicateur" error={e.label}>
          <Input name="label" defaultValue={m?.label ?? ""} maxLength={200} />
        </Field>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Valeur" error={e.value}>
          <Input name="value" inputMode="decimal" defaultValue={m?.value ?? ""} />
        </Field>
        <Field label="Unité" optional error={e.unit}>
          <Input name="unit" defaultValue={m?.unit ?? ""} maxLength={60} placeholder="élèves, séances…" />
        </Field>
        <Field label="Type" error={e.metric_type}>
          <Select name="metric_type" defaultValue={m?.metric_type ?? "output"}>
            {Object.entries(METRIC_TYPES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Du" error={e.period_start}>
          <Input name="period_start" type="date" defaultValue={m?.period_start ?? ""} />
        </Field>
        <Field label="Au" error={e.period_end}>
          <Input name="period_end" type="date" defaultValue={m?.period_end ?? ""} />
        </Field>
        <Field label="Part du partenariat" error={e.attribution}>
          <Select name="attribution" defaultValue={m?.attribution ?? ""}>
            <option value="" disabled>
              Choisir…
            </option>
            {Object.entries(ATTRIBUTIONS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Méthode de mesure" hint="D’où vient le chiffre (listes de présence, bons de livraison, attestations…)." error={e.method}>
        <Textarea name="method" rows={2} defaultValue={m?.method ?? ""} maxLength={2000} />
      </Field>
      <FormActions>
        <SubmitButton>{m ? "Corriger et soumettre" : "Enregistrer l’indicateur"}</SubmitButton>
      </FormActions>
    </form>
  );
}

export function MetricReviewForm({ id }: { id: string }) {
  const [state, action] = useActionState(setMetricStatus, INITIAL_ACTION_STATE);
  useActionToast(state);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={id} />
      <Field label="Décision" error={state.fieldErrors?.status} className="w-40">
        <Select name="status" defaultValue="verified">
          <option value="verified">Vérifié</option>
          <option value="rejected">À corriger</option>
        </Select>
      </Field>
      <Field label="Commentaire" optional error={state.fieldErrors?.comment} className="min-w-0 flex-1">
        <Input name="comment" maxLength={1000} />
      </Field>
      <SubmitButton variant="secondary">Valider</SubmitButton>
    </form>
  );
}

export function ReportForm({ organizationId, report: r, agreements }: { organizationId: string; report?: ReportDetail; agreements: Option[] }) {
  const [state, action] = useActionState(saveReport, INITIAL_ACTION_STATE);
  useActionToast(state);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={r?.id ?? ""} />
      <input type="hidden" name="organization_id" value={organizationId} />
      {!state.ok && state.message ? <FormMessage state={state} /> : null}
      <Field label="Titre du rapport" error={e.title}>
        <Input name="title" defaultValue={r?.title} maxLength={200} placeholder="Ex. Rapport annuel 2026-2027" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Du" error={e.period_start}>
          <Input name="period_start" type="date" defaultValue={r?.period_start ?? ""} />
        </Field>
        <Field label="Au" error={e.period_end}>
          <Input name="period_end" type="date" defaultValue={r?.period_end ?? ""} />
        </Field>
        <Field label="Convention" optional hint="Vide : tout le partenariat." error={e.agreement_id}>
          <Select name="agreement_id" defaultValue={r?.agreement_id ?? ""}>
            <option value="">Toutes</option>
            {agreements.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Activités réalisées (texte complémentaire)" optional hint="Sans nommer d’élève ni d’enseignant." error={e.activities}>
        <Textarea name="activities" rows={3} defaultValue={r?.activities ?? ""} maxLength={4000} />
      </Field>
      <Field label="Difficultés et limites" optional error={e.challenges}>
        <Textarea name="challenges" rows={3} defaultValue={r?.challenges ?? ""} maxLength={4000} />
      </Field>
      <Field label="Perspectives de coopération" optional error={e.future_opportunities}>
        <Textarea name="future_opportunities" rows={3} defaultValue={r?.future_opportunities ?? ""} maxLength={4000} />
      </Field>
      <FormActions>
        <SubmitButton>{r ? "Enregistrer" : "Créer le brouillon"}</SubmitButton>
      </FormActions>
    </form>
  );
}
