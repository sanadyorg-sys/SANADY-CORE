"use client";

import { useActionState } from "react";
import { CopyButton } from "@/components/ui/copy-button";
import { Field, Textarea } from "@/components/ui/field";
import { FormActions, FormMessage, SubmitButton, useActionToast } from "@/components/ui/form";
import { INITIAL_ACTION_STATE } from "@/lib/types";
import { bulkInvite, type BulkResult } from "@/server/actions/departments";

/** Bulk invitations: pasted list or CSV file, one person per line. */
export function BulkInviteForm({ institutionId, withDepartments }: { institutionId: string; withDepartments: boolean }) {
  const [state, action] = useActionState(bulkInvite, INITIAL_ACTION_STATE);
  useActionToast(state);
  const results = (state.data as { results?: BulkResult[] } | undefined)?.results ?? [];
  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4">
        <input type="hidden" name="institution_id" value={institutionId} />
        {!state.ok && state.message ? <FormMessage state={state} /> : null}
        <Field
          label="Liste des personnes"
          hint={withDepartments ? "Une ligne par personne : « adresse e-mail » ou « adresse e-mail;service ». 200 lignes au maximum." : "Une adresse e-mail par ligne. 200 lignes au maximum."}
          error={state.fieldErrors?.csv}
        >
          <Textarea name="csv" rows={6} placeholder={withDepartments ? "prenom.nom@entreprise.ma;Production" : "prenom.nom@exemple.ma"} />
        </Field>
        <div>
          <label htmlFor="bulk-file" className="text-label font-medium text-ink-800">
            Ou un fichier CSV
          </label>
          <input id="bulk-file" name="file" type="file" accept=".csv,text/csv,text/plain" className="mt-1 block w-full text-label text-ink-700 file:mr-3 file:rounded-md file:border file:border-line-strong file:bg-surface file:px-3 file:py-1.5" />
        </div>
        <FormActions>
          <SubmitButton variant="secondary">Créer les invitations</SubmitButton>
        </FormActions>
      </form>
      {results.length ? (
        <ul className="divide-y divide-line rounded-xl border border-line" aria-label="Résultat des invitations">
          {results.map((r, i) => (
            <li key={`${r.email}-${i}`} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-label">
              <span className="min-w-0 truncate font-medium text-ink-900">{r.email}</span>
              <span className={r.ok ? "text-success-700" : "text-danger-600"}>{r.message}</span>
              {r.link ? <CopyButton value={r.link} label="Copier le lien" /> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
