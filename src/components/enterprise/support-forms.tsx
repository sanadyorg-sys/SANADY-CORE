"use client";

import { useActionState } from "react";
import { Lock, Send } from "lucide-react";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { FormActions, FormMessage, SubmitButton, useActionToast } from "@/components/ui/form";
import { SUPPORT_CATEGORIES, SUPPORT_PRIORITY } from "@/lib/enterprise";
import { INITIAL_ACTION_STATE } from "@/lib/types";
import { assignSupportRequest, openSupportRequest, postSupportMessage } from "@/server/actions/support";

/** Support requests: opening (company administrator), replies (both sides), assignment (team). */

export function SupportRequestForm({ institutionId }: { institutionId: string }) {
  const [state, action] = useActionState(openSupportRequest, INITIAL_ACTION_STATE);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="institution_id" value={institutionId} />
      {!state.ok && state.message ? <FormMessage state={state} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type de demande" error={e.category}>
          <Select name="category" defaultValue="">
            <option value="" disabled>
              Choisir…
            </option>
            {Object.entries(SUPPORT_CATEGORIES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Priorité" hint="« Urgente » : la formation est bloquée pour vos collaborateurs." error={e.priority}>
          <Select name="priority" defaultValue="normal">
            {Object.entries(SUPPORT_PRIORITY).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Objet" error={e.subject}>
        <Input name="subject" maxLength={200} placeholder="Ex. : un collaborateur ne reçoit pas son invitation" />
      </Field>
      <Field label="Description" hint="Ce qui se passe, depuis quand, pour qui. N’indiquez aucun mot de passe." error={e.body}>
        <Textarea name="body" rows={7} maxLength={6000} />
      </Field>
      <FormActions>
        <SubmitButton>
          <Send aria-hidden /> Envoyer la demande
        </SubmitButton>
      </FormActions>
    </form>
  );
}

export function SupportReplyForm({ requestId, institutionId, team }: { requestId: string; institutionId: string; team: boolean }) {
  const [state, action] = useActionState(postSupportMessage, INITIAL_ACTION_STATE);
  useActionToast(state);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="request_id" value={requestId} />
      <input type="hidden" name="institution_id" value={institutionId} />
      {!state.ok && state.message ? <FormMessage state={state} /> : null}
      <Field label={team ? "Réponse ou note" : "Votre message"} error={state.fieldErrors?.body}>
        <Textarea name="body" rows={4} maxLength={6000} />
      </Field>
      {team ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <p className="mr-auto text-caption text-ink-500">Une note interne n’est jamais montrée à l’entreprise.</p>
          <SubmitButton variant="secondary" name="internal" value="on">
            <Lock aria-hidden /> Ajouter une note interne
          </SubmitButton>
          <SubmitButton>
            <Send aria-hidden /> Répondre à l’entreprise
          </SubmitButton>
        </div>
      ) : (
        <FormActions>
          <SubmitButton>
            <Send aria-hidden /> Envoyer
          </SubmitButton>
        </FormActions>
      )}
    </form>
  );
}

export function SupportAssignForm({ requestId, assignedTo, team }: { requestId: string; assignedTo: string | null; team: Array<{ id: string; label: string }> }) {
  const [state, action] = useActionState(assignSupportRequest, INITIAL_ACTION_STATE);
  useActionToast(state);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="request_id" value={requestId} />
      <Field label="Suivie par" className="min-w-0 flex-1">
        <Select name="assigned_to" defaultValue={assignedTo ?? ""}>
          <option value="">Personne</option>
          {team.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </Select>
      </Field>
      <SubmitButton variant="secondary">Attribuer</SubmitButton>
    </form>
  );
}
