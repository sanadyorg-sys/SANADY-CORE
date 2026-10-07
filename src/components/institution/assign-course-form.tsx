"use client";

import { useActionState, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { assignCourse } from "@/server/actions/institution";
import { Field, Input } from "@/components/ui/field";
import { FormMessage, SubmitButton, useActionToast } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import { INITIAL_ACTION_STATE } from "@/lib/types";

export interface AssignableTeacher {
  user_id: string;
  full_name: string;
  email: string;
  alreadyAssigned: boolean;
}

/** Multi-select of teachers (with search) to assign an authorized course. */
export function AssignCourseForm({
  institutionId,
  courseId,
  teachers,
}: {
  institutionId: string;
  courseId: string;
  teachers: AssignableTeacher[];
}) {
  const [state, action] = useActionState(assignCourse, INITIAL_ACTION_STATE);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  useActionToast(state, () => setSelected(new Set()));

  const candidates = teachers.filter((t) => !t.alreadyAssigned);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? candidates.filter((t) => `${t.full_name} ${t.email}`.toLowerCase().includes(q)) : candidates;
  }, [candidates, query]);

  const allVisibleSelected = visible.length > 0 && visible.every((t) => selected.has(t.user_id));
  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visible.forEach((t) => next.delete(t.user_id));
      else visible.forEach((t) => next.add(t.user_id));
      return next;
    });

  if (candidates.length === 0) {
    return (
      <p className="text-body text-ink-500">
        {teachers.length === 0
          ? "Aucun enseignant n’est encore membre de l’établissement. Invitez des enseignants ou partagez un code d’inscription."
          : "Tous les enseignants de l’établissement ont déjà cette formation."}
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4">
      {!state.ok ? <FormMessage state={state} /> : null}
      <input type="hidden" name="institution_id" value={institutionId} />
      <input type="hidden" name="course_id" value={courseId} />
      {[...selected].map((id) => (
        <input key={id} type="hidden" name="user_ids" value={id} />
      ))}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" aria-hidden />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un enseignant…"
          aria-label="Rechercher un enseignant"
          className="pl-9"
        />
      </div>

      <div className="overflow-hidden rounded-md border border-line">
        <label className="flex cursor-pointer items-center gap-3 border-b border-line bg-ink-25 px-3 py-2 text-label font-medium text-ink-700">
          <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} className="size-4 accent-teal-600" />
          Tout sélectionner ({visible.length})
        </label>
        <ul className="max-h-72 divide-y divide-line overflow-y-auto">
          {visible.map((t) => {
            const checked = selected.has(t.user_id);
            return (
              <li key={t.user_id}>
                <label className={cn("flex cursor-pointer items-center gap-3 px-3 py-2.5", checked ? "bg-teal-50/60" : "hover:bg-ink-25")}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (next.has(t.user_id)) next.delete(t.user_id);
                        else next.add(t.user_id);
                        return next;
                      })
                    }
                    className="size-4 accent-teal-600"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-body font-medium text-ink-800">{t.full_name || t.email}</span>
                    <span className="block truncate text-caption text-ink-500">{t.email}</span>
                  </span>
                </label>
              </li>
            );
          })}
          {visible.length === 0 ? <li className="px-3 py-6 text-center text-body text-ink-500">Aucun résultat.</li> : null}
        </ul>
      </div>
      {state.fieldErrors?.user_ids ? (
        <p role="alert" className="text-caption font-medium text-danger-600">
          {state.fieldErrors.user_ids}
        </p>
      ) : null}

      <Field label="Échéance souhaitée" optional hint="Indicative : elle n’empêche pas l’accès après cette date." error={state.fieldErrors?.due_on}>
        <Input name="due_on" type="date" className="sm:max-w-[220px]" />
      </Field>

      <div className="flex items-center justify-between gap-3">
        <p className="text-label text-ink-600">
          {selected.size} enseignant{selected.size > 1 ? "s" : ""} sélectionné{selected.size > 1 ? "s" : ""}
        </p>
        <SubmitButton disabled={selected.size === 0}>Affecter la formation</SubmitButton>
      </div>
    </form>
  );
}
