"use client";

import { useActionState } from "react";
import { createCourse, updateCourse } from "@/server/actions/courses";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { FormActions, FormMessage, SubmitButton, useActionToast } from "@/components/ui/form";
import { COURSE_LEVELS } from "@/lib/labels";
import { INITIAL_ACTION_STATE, type Course, type CourseCategory } from "@/lib/types";

export function CreateCourseForm({ categories }: { categories: CourseCategory[] }) {
  const [state, action] = useActionState(createCourse, INITIAL_ACTION_STATE);
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <Field label="Titre de la formation" error={state.fieldErrors?.title}>
        <Input name="title" required maxLength={200} autoFocus />
      </Field>
      <Field label="Catégorie" optional error={state.fieldErrors?.category_id}>
        <Select name="category_id" defaultValue="">
          <option value="">Aucune pour l’instant</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <p className="text-caption text-ink-500">La formation est créée en brouillon : elle reste invisible des enseignants jusqu’à sa publication.</p>
      <FormActions>
        <SubmitButton>Créer et continuer</SubmitButton>
      </FormActions>
    </form>
  );
}

export function CourseInfoForm({ course, categories }: { course: Course; categories: CourseCategory[] }) {
  const [state, action] = useActionState(updateCourse, INITIAL_ACTION_STATE);
  useActionToast(state);
  return (
    <form action={action} className="space-y-5" noValidate>
      {!state.ok ? <FormMessage state={state} /> : null}
      <input type="hidden" name="id" value={course.id} />
      <Field label="Titre" error={state.fieldErrors?.title}>
        <Input name="title" defaultValue={course.title} required maxLength={200} />
      </Field>
      <Field label="Résumé" hint="Une ou deux phrases affichées sur les cartes de formation (400 caractères maximum)." error={state.fieldErrors?.summary}>
        <Textarea name="summary" defaultValue={course.summary} rows={2} maxLength={400} />
      </Field>
      <Field label="Présentation détaillée" error={state.fieldErrors?.description}>
        <Textarea name="description" defaultValue={course.description} rows={7} />
      </Field>
      <Field label="Objectifs d’apprentissage" hint="Un objectif par ligne (20 maximum)." error={state.fieldErrors?.objectives}>
        <Textarea name="objectives" defaultValue={course.objectives.join("\n")} rows={5} />
      </Field>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Field label="Catégorie" error={state.fieldErrors?.category_id}>
          <Select name="category_id" defaultValue={course.category_id ?? ""}>
            <option value="">Aucune</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Niveau" error={state.fieldErrors?.level}>
          <Select name="level" defaultValue={course.level}>
            {Object.entries(COURSE_LEVELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Durée estimée (minutes)" error={state.fieldErrors?.estimated_minutes}>
          <Input name="estimated_minutes" type="number" min={1} defaultValue={course.estimated_minutes ?? ""} />
        </Field>
      </div>
      <Field label="Public visé" optional hint="Ex. : Enseignants du primaire, cycle 2." error={state.fieldErrors?.target_audience}>
        <Input name="target_audience" defaultValue={course.target_audience} maxLength={300} />
      </Field>
      <FormActions>
        <SubmitButton>Enregistrer</SubmitButton>
      </FormActions>
    </form>
  );
}
