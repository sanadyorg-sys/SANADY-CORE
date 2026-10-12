"use client";

import { useActionState, useRef } from "react";
import { Field, Input, Select } from "@/components/ui/field";
import { FormActions, FormMessage, SubmitButton, useActionToast } from "@/components/ui/form";
import { INITIAL_ACTION_STATE } from "@/lib/types";
import { saveDepartment, setMemberDepartment } from "@/server/actions/departments";

export function DepartmentForm({ institutionId, department }: { institutionId: string; department?: { id: string; name: string } }) {
  const [state, action] = useActionState(saveDepartment, INITIAL_ACTION_STATE);
  const ref = useRef<HTMLFormElement>(null);
  useActionToast(state, () => (department ? undefined : ref.current?.reset()));
  return (
    <form ref={ref} action={action} className="space-y-3">
      <input type="hidden" name="institution_id" value={institutionId} />
      <input type="hidden" name="id" value={department?.id ?? ""} />
      {!state.ok && state.message ? <FormMessage state={state} /> : null}
      <Field label={department ? "Nouveau nom" : "Nom du service"} error={state.fieldErrors?.name}>
        <Input name="name" defaultValue={department?.name} maxLength={120} placeholder="Ex. Production, Ressources humaines" />
      </Field>
      <FormActions>
        <SubmitButton variant="secondary">{department ? "Renommer" : "Ajouter le service"}</SubmitButton>
      </FormActions>
    </form>
  );
}

/** Changes an employee's service as soon as a new one is chosen. */
export function MemberDepartmentSelect({
  institutionId,
  userId,
  value,
  departments,
  label,
}: {
  institutionId: string;
  userId: string;
  value: string | null;
  departments: Array<{ id: string; name: string }>;
  label: string;
}) {
  const [state, action] = useActionState(setMemberDepartment, INITIAL_ACTION_STATE);
  useActionToast(state);
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form ref={ref} action={action}>
      <input type="hidden" name="institution_id" value={institutionId} />
      <input type="hidden" name="user_id" value={userId} />
      <Select name="department_id" defaultValue={value ?? ""} aria-label={label} onChange={() => ref.current?.requestSubmit()}>
        <option value="">Sans service</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </Select>
    </form>
  );
}
