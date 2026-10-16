"use client";

import { useActionState } from "react";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { FormActions, FormMessage, SubmitButton, useActionToast } from "@/components/ui/form";
import { ASSESSMENT_FEEDBACK, SANADY_ASSESSMENT } from "@/lib/enterprise";
import { INITIAL_ACTION_STATE } from "@/lib/types";
import { saveAssessmentPolicy } from "@/server/actions/assessment";
import type { AssessmentPolicy } from "@/server/queries/enterprise";

/** Company assessment policy editor (enterprise manager). */
export function AssessmentPolicyForm({ tenantId, policy: p, contracts }: { tenantId: string; policy: AssessmentPolicy | null; contracts: Array<{ id: string; label: string }> }) {
  const [state, action] = useActionState(saveAssessmentPolicy, INITIAL_ACTION_STATE);
  useActionToast(state);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="tenant_id" value={tenantId} />
      {!state.ok && state.message ? <FormMessage state={state} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Seuil de réussite (%)" hint="Entre 50 et 100." error={e.pass_threshold}>
          <Input name="pass_threshold" inputMode="numeric" defaultValue={p?.pass_threshold ?? SANADY_ASSESSMENT.pass_threshold} />
        </Field>
        <Field label="Tentatives par évaluation" hint="Entre 1 et 10." error={e.max_attempts}>
          <Input name="max_attempts" inputMode="numeric" defaultValue={p?.max_attempts ?? SANADY_ASSESSMENT.max_attempts} />
        </Field>
      </div>
      <Field label="Bonnes réponses affichées" error={e.feedback}>
        <Select name="feedback" defaultValue={p?.feedback ?? "after_pass"}>
          {Object.entries(ASSESSMENT_FEEDBACK).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
      </Field>
      <div className="space-y-3">
        <Checkbox name="certificates" defaultChecked={p?.certificates ?? true} label="Délivrer l’attestation ou le certificat à la fin du parcours" description="Décoché : la formation est marquée terminée, sans document." />
        <Checkbox
          name="enforce_due_dates"
          defaultChecked={p?.enforce_due_dates ?? false}
          label="Clore les évaluations après la date limite"
          description="La date limite est celle que l’entreprise fixe en affectant la formation. Les tentatives déjà ouvertes peuvent être terminées."
        />
      </div>
      {contracts.length ? (
        <Field label="Contrat de référence" optional error={e.contract_id}>
          <Select name="contract_id" defaultValue={p?.contract_id ?? ""}>
            <option value="">Aucun</option>
            {contracts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      <Field label="Précision" optional error={e.note}>
        <Textarea name="note" rows={2} maxLength={1000} defaultValue={p?.note ?? ""} placeholder="Ex. : exigence du contrat, article 4." />
      </Field>
      <FormActions>
        <SubmitButton>Enregistrer les règles</SubmitButton>
      </FormActions>
    </form>
  );
}
