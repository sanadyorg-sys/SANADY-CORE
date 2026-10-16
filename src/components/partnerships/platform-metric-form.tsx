"use client";

import { useActionState, useState } from "react";
import { Calculator, ShieldAlert } from "lucide-react";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { FormActions, FormMessage, SubmitButton, useActionToast } from "@/components/ui/form";
import { ATTRIBUTIONS, FIELD_SLUGS, INTERVENTION_FIELDS, PLATFORM_MEASURES, type PlatformMeasure } from "@/lib/partnerships";
import { INITIAL_ACTION_STATE } from "@/lib/types";
import { savePlatformMetric } from "@/server/actions/impact";
import type { MetricRow, PlatformScope } from "@/server/queries/impact";

/**
 * Indicator computed from SANADY data. The team chooses what is measured,
 * the schools, the courses and the link to the partnership; the database
 * computes the figure (aggregates only).
 */

type Option = { id: string; label: string };

function ChoiceList({
  legend,
  name,
  hint,
  items,
  selected,
  onChange,
  error,
}: {
  legend: string;
  name: string;
  hint: string;
  items: Array<{ id: string; label: string }>;
  selected: string[];
  onChange: (ids: string[]) => void;
  error?: string;
}) {
  const [filter, setFilter] = useState("");
  const shown = filter ? items.filter((i) => i.label.toLowerCase().includes(filter.toLowerCase())) : items;
  return (
    <fieldset className="space-y-2">
      <legend className="text-label font-medium text-ink-800">{legend}</legend>
      <p className="text-caption text-ink-500">{hint}</p>
      {items.length > 8 ? <Input aria-label={`Filtrer : ${legend}`} placeholder="Filtrer…" value={filter} onChange={(e) => setFilter(e.currentTarget.value)} /> : null}
      <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-line p-3">
        {items.length === 0 ? <p className="text-label text-ink-500">Aucun élément.</p> : null}
        {shown.map((i) => (
          <Checkbox
            key={i.id}
            name={name}
            value={i.id}
            label={i.label}
            checked={selected.includes(i.id)}
            onChange={(e) => onChange(e.currentTarget.checked ? [...selected, i.id] : selected.filter((x) => x !== i.id))}
          />
        ))}
        {/* Keep checked items that the filter hides. */}
        {selected
          .filter((id) => !shown.some((i) => i.id === id))
          .map((id) => (
            <input key={id} type="hidden" name={name} value={id} />
          ))}
      </div>
      {error ? (
        <p className="text-caption font-medium text-danger-600" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

export function PlatformMetricForm({
  organizationId,
  metric: m,
  agreements,
  opportunities,
  scope,
}: {
  organizationId: string;
  metric?: MetricRow;
  agreements: Option[];
  opportunities: Option[];
  scope: PlatformScope;
}) {
  const [state, action] = useActionState(savePlatformMetric, INITIAL_ACTION_STATE);
  useActionToast(state);
  const e = state.fieldErrors ?? {};
  const s = m?.source_scope;
  const [measure, setMeasure] = useState<PlatformMeasure>(s?.measure ?? "teachers_trained");
  const [schools, setSchools] = useState<string[]>(s?.institution_ids ?? []);
  const [courses, setCourses] = useState<string[]>(s?.course_ids ?? []);
  const preview = state.ok && typeof state.data?.preview === "number" ? (state.data.preview as number) : null;

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
        <Field label="Projet soutenu" optional hint="L’établissement du projet est proposé, jamais imposé." error={e.opportunity_id}>
          <Select
            name="opportunity_id"
            defaultValue={m?.opportunity_id ?? ""}
            onChange={(ev) => {
              const school = scope.project_schools[ev.currentTarget.value];
              if (school && !schools.includes(school)) setSchools([...schools, school]);
            }}
          >
            <option value="">Aucun</option>
            {opportunities.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Ce qui est mesuré" hint={PLATFORM_MEASURES[measure].hint} error={e.measure}>
          <Select name="measure" value={measure} onChange={(ev) => setMeasure(ev.currentTarget.value as PlatformMeasure)}>
            {Object.entries(PLATFORM_MEASURES).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Domaine d’intervention" error={e.intervention_field}>
          <Select name="intervention_field" defaultValue={m?.intervention_field ?? "formation-continue"}>
            {FIELD_SLUGS.map((f) => (
              <option key={f} value={f}>
                {INTERVENTION_FIELDS[f].name}
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
      </div>
      <ChoiceList
        legend="Établissements"
        name="institution_ids"
        hint="Seuls les enseignants ayant accepté de partager leur progression avec leur établissement sont comptés."
        items={scope.institutions.map((i) => ({ id: i.id, label: i.name }))}
        selected={schools}
        onChange={setSchools}
        error={e.institution_ids}
      />
      <ChoiceList
        legend="Formations (facultatif)"
        name="course_ids"
        hint="Aucune case cochée : toutes les formations publiées."
        items={scope.courses.map((c) => ({ id: c.id, label: c.title }))}
        selected={courses}
        onChange={setCourses}
      />
      <div className="grid gap-4 sm:grid-cols-2">
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
        <Field label="Précision sur la méthode" optional error={e.note}>
          <Textarea name="note" rows={2} maxLength={500} placeholder="Ex. : formations suivies dans le cadre du programme." />
        </Field>
      </div>
      {preview !== null ? (
        <div className="rounded-xl bg-ink-50 px-4 py-3" role="status">
          <p className="text-body text-ink-800">
            Résultat : <span className="text-section font-semibold text-ink-900">{preview.toLocaleString("fr-FR")}</span> — {PLATFORM_MEASURES[measure].label.toLowerCase()}
          </p>
          {state.data?.small ? (
            <p className="mt-1 flex items-start gap-1.5 text-label text-warning-700">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> Moins de 5 personnes : vérifiez que personne ne peut être reconnu avant de l’utiliser dans un rapport.
            </p>
          ) : null}
        </div>
      ) : null}
      <p className="text-caption text-ink-500">Le chiffre est calculé par la plateforme au moment de l’enregistrement ; il ne peut pas être saisi à la main. Un approbateur le vérifie ensuite.</p>
      <FormActions>
        <SubmitButton variant="secondary" name="intent" value="preview" keepValues>
          <Calculator aria-hidden /> Calculer
        </SubmitButton>
        <SubmitButton name="intent" value="save">
          {m ? "Recalculer et soumettre" : "Enregistrer l’indicateur"}
        </SubmitButton>
      </FormActions>
    </form>
  );
}
