"use client";

import { useActionState } from "react";
import { assignCourseTrainer } from "@/server/actions/courses";
import { Field, Select } from "@/components/ui/field";
import { FormMessage, SubmitButton, useActionToast } from "@/components/ui/form";
import { INITIAL_ACTION_STATE } from "@/lib/types";

export function AssignTrainerForm({ courseId, candidates }: { courseId: string; candidates: Array<{ id: string; name: string; email: string }> }) {
  const [state, action] = useActionState(assignCourseTrainer, INITIAL_ACTION_STATE);
  useActionToast(state);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3" noValidate>
      {!state.ok && state.message ? <FormMessage state={state} /> : null}
      <input type="hidden" name="course_id" value={courseId} />
      <Field label="Formateur" error={state.fieldErrors?.user_id} className="min-w-[260px] flex-1">
        <Select name="user_id" defaultValue="" required>
          <option value="" disabled>
            Choisir un formateur…
          </option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} — {c.email}
            </option>
          ))}
        </Select>
      </Field>
      <SubmitButton>Ajouter</SubmitButton>
    </form>
  );
}
