"use client";

import { useActionState, useState } from "react";
import { Checkbox, Field, Select } from "@/components/ui/field";
import { FormActions, FormMessage, SubmitButton, useActionToast } from "@/components/ui/form";
import { COURSE_OWNERSHIP, type CourseOwnership } from "@/lib/enterprise";
import { INITIAL_ACTION_STATE } from "@/lib/types";
import { setCourseOwnership } from "@/server/actions/courses";

/** Who owns a course and whether it is reserved to one company workspace. */
export function CourseOwnershipForm({
  courseId,
  ownership,
  ownerId,
  isPrivate,
  workspaces,
}: {
  courseId: string;
  ownership: CourseOwnership;
  ownerId: string | null;
  isPrivate: boolean;
  workspaces: Array<{ institution_id: string; name: string }>;
}) {
  const [state, action] = useActionState(setCourseOwnership, INITIAL_ACTION_STATE);
  useActionToast(state);
  const [kind, setKind] = useState<CourseOwnership>(ownership);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="course_id" value={courseId} />
      {!state.ok && state.message ? <FormMessage state={state} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Propriété du contenu" error={e.ownership}>
          <Select name="ownership" value={kind} onChange={(ev) => setKind(ev.currentTarget.value as CourseOwnership)}>
            {Object.entries(COURSE_OWNERSHIP).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Entreprise propriétaire" optional={kind !== "company"} error={e.owner_institution_id}>
          <Select name="owner_institution_id" defaultValue={ownerId ?? ""} disabled={kind === "sanady"}>
            <option value="">Aucune</option>
            {workspaces.map((w) => (
              <option key={w.institution_id} value={w.institution_id}>
                {w.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Checkbox
        name="tenant_private"
        defaultChecked={isPrivate}
        disabled={kind === "sanady"}
        label="Réservée à l’espace de cette entreprise"
        description="Jamais ouverte à un autre établissement ni au catalogue public. Possible seulement si elle n’est partagée avec personne d’autre."
      />
      {e.tenant_private ? (
        <p className="text-caption font-medium text-danger-600" role="alert">
          {e.tenant_private}
        </p>
      ) : null}
      <FormActions>
        <SubmitButton variant="secondary">Enregistrer</SubmitButton>
      </FormActions>
    </form>
  );
}
