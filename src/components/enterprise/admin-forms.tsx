"use client";

import { useActionState, useRef, type ReactNode } from "react";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { FormActions, FormMessage, SubmitButton, useActionToast } from "@/components/ui/form";
import { EMPLOYEE_COUNTS, ENTERPRISE_SERVICES, LINE_CATEGORIES, type EnterpriseService } from "@/lib/enterprise";
import { ORG_TYPES } from "@/lib/partnerships";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/types";
import {
  addEnterpriseNote,
  createClientFromRequest,
  saveClient,
  saveEnterpriseContact,
  saveEnterpriseTask,
  saveLine,
  saveProposal,
  setClientStage,
  setProposalStatus,
  setRequestStatus,
} from "@/server/actions/enterprise";

/** Team forms of SANADY Enterprise (E1-E2). */

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;
const STATUS_ACTIONS: Record<"request" | "client" | "proposal", Action> = { request: setRequestStatus, client: setClientStage, proposal: setProposalStatus };

export function EnterpriseStatusForm({
  kind,
  id,
  options,
  help,
  submitLabel = "Enregistrer",
}: {
  kind: "request" | "client" | "proposal";
  id: string;
  options: Array<{ value: string; label: string }>;
  help?: ReactNode;
  submitLabel?: string;
}) {
  const [state, action] = useActionState(STATUS_ACTIONS[kind], INITIAL_ACTION_STATE);
  useActionToast(state);
  if (!options.length) return <p className="text-body text-ink-600">Aucune action disponible pour votre rôle à ce stade.</p>;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      {!state.ok && state.message ? <FormMessage state={state} /> : null}
      <Field label="Action" error={state.fieldErrors?.status}>
        <Select name="status" defaultValue={options[0]!.value}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </Field>
      {help ? <div className="text-caption text-ink-500">{help}</div> : null}
      <Field label="Commentaire (historique)" optional error={state.fieldErrors?.note}>
        <Textarea name="note" rows={2} maxLength={1000} />
      </Field>
      <FormActions>
        <SubmitButton>{submitLabel}</SubmitButton>
      </FormActions>
    </form>
  );
}

/** Creates the client record, or links the request to an existing organisation. */
export function CreateClientForm({ requestId, candidates }: { requestId: string; candidates: Array<{ id: string; name: string; partner: boolean }> }) {
  const [state, action] = useActionState(createClientFromRequest, INITIAL_ACTION_STATE);
  useActionToast(state);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={requestId} />
      {!state.ok && state.message ? <FormMessage state={state} /> : null}
      {candidates.length ? (
        <Field label="Organisation" hint="Une organisation au nom proche existe déjà : liez-la plutôt que d’en créer une seconde." error={state.fieldErrors?.organization_id}>
          <Select name="organization_id" defaultValue="">
            <option value="">Créer une nouvelle fiche</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                Lier à « {c.name} »{c.partner ? " (partenaire)" : ""}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      <FormActions>
        <SubmitButton variant="accent">Créer le suivi client</SubmitButton>
      </FormActions>
    </form>
  );
}

export function ClientForm({
  client,
  team,
}: {
  client?: { id: string; employee_count: string | null; enterprise_services: EnterpriseService[]; enterprise_manager_id: string | null };
  team: Array<{ id: string; full_name: string | null; email: string }>;
}) {
  const [state, action] = useActionState(saveClient, INITIAL_ACTION_STATE);
  useActionToast(state);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={client?.id ?? ""} />
      {!state.ok && state.message ? <FormMessage state={state} /> : null}
      {!client ? (
        <>
          <Field label="Nom de l’organisation" error={e.name}>
            <Input name="name" maxLength={200} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type" error={e.org_type}>
              <Select name="org_type" defaultValue="entreprise">
                {Object.entries(ORG_TYPES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Secteur" optional error={e.sector}>
              <Input name="sector" maxLength={150} />
            </Field>
            <Field label="Pays" optional error={e.country}>
              <Input name="country" defaultValue="Maroc" maxLength={80} />
            </Field>
            <Field label="Ville" optional error={e.city}>
              <Input name="city" maxLength={100} />
            </Field>
          </div>
          <Field label="Site web" optional error={e.website}>
            <Input name="website" maxLength={300} />
          </Field>
        </>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Effectif" optional error={e.employee_count}>
          <Select name="employee_count" defaultValue={client?.employee_count ?? ""}>
            <option value="">Non renseigné</option>
            {Object.entries(EMPLOYEE_COUNTS).map(([k, v]) => (
              <option key={k} value={k}>
                {v} salariés
              </option>
            ))}
          </Select>
        </Field>
        {client ? (
          <Field label="Responsable du compte" optional error={e.manager_id}>
            <Select name="manager_id" defaultValue={client.enterprise_manager_id ?? ""}>
              <option value="">Inchangé</option>
              {team.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name || m.email}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
      </div>
      <fieldset>
        <legend className="text-label font-medium text-ink-800">Services envisagés</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {(Object.keys(ENTERPRISE_SERVICES) as EnterpriseService[])
            .filter((k) => k !== "partenariat")
            .map((k) => (
              <Checkbox key={k} name="services" value={k} defaultChecked={client?.enterprise_services.includes(k)} label={ENTERPRISE_SERVICES[k].label} />
            ))}
        </div>
      </fieldset>
      <FormActions>
        <SubmitButton>{client ? "Enregistrer" : "Créer la fiche client"}</SubmitButton>
      </FormActions>
    </form>
  );
}

export function ProposalForm({
  organizationId,
  requestId,
  proposal,
}: {
  organizationId?: string;
  requestId?: string;
  proposal?: { id: string; title: string; service: EnterpriseService; summary: string | null; currency: string; valid_until: string | null };
}) {
  const [state, action] = useActionState(saveProposal, INITIAL_ACTION_STATE);
  useActionToast(state);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={proposal?.id ?? ""} />
      <input type="hidden" name="organization_id" value={organizationId ?? ""} />
      <input type="hidden" name="request_id" value={requestId ?? ""} />
      {!state.ok && state.message ? <FormMessage state={state} /> : null}
      <Field label="Titre de la proposition" error={e.title}>
        <Input name="title" defaultValue={proposal?.title} maxLength={200} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Service" error={e.service}>
          <Select name="service" defaultValue={proposal?.service ?? "sur_mesure"}>
            {(["sur_mesure", "plateforme", "complete"] as const).map((k) => (
              <option key={k} value={k}>
                {ENTERPRISE_SERVICES[k].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Devise" error={e.currency}>
          <Select name="currency" defaultValue={proposal?.currency ?? "MAD"}>
            {["MAD", "EUR", "USD"].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Valable jusqu’au" optional error={e.valid_until}>
          <Input name="valid_until" type="date" defaultValue={proposal?.valid_until ?? ""} />
        </Field>
      </div>
      <Field label="Présentation" optional error={e.summary}>
        <Textarea name="summary" rows={4} defaultValue={proposal?.summary ?? ""} maxLength={3000} />
      </Field>
      <FormActions>
        <SubmitButton>{proposal ? "Enregistrer" : "Créer le brouillon"}</SubmitButton>
      </FormActions>
    </form>
  );
}

export function LineForm({ proposalId, currency }: { proposalId: string; currency: string }) {
  const [state, action] = useActionState(saveLine, INITIAL_ACTION_STATE);
  const ref = useRef<HTMLFormElement>(null);
  useActionToast(state, () => ref.current?.reset());
  const e = state.fieldErrors ?? {};
  return (
    <form ref={ref} action={action} className="grid gap-3 sm:grid-cols-[1.3fr_2fr_0.7fr_0.8fr_1fr_auto] sm:items-end">
      <input type="hidden" name="proposal_id" value={proposalId} />
      <Field label="Catégorie" error={e.category}>
        <Select name="category" defaultValue="needs_analysis">
          {Object.entries(LINE_CATEGORIES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Libellé" error={e.label}>
        <Input name="label" maxLength={200} />
      </Field>
      <Field label="Quantité" error={e.quantity}>
        <Input name="quantity" inputMode="decimal" defaultValue="1" />
      </Field>
      <Field label="Unité" optional error={e.unit}>
        <Input name="unit" placeholder="jours" maxLength={40} />
      </Field>
      <Field label={`Prix unitaire (${currency})`} error={e.unit_price}>
        <Input name="unit_price" inputMode="decimal" />
      </Field>
      <SubmitButton variant="secondary">Ajouter</SubmitButton>
    </form>
  );
}

export function EnterpriseNoteForm({ organizationId, requestId, proposalId }: { organizationId?: string; requestId?: string; proposalId?: string }) {
  const [state, action] = useActionState(addEnterpriseNote, INITIAL_ACTION_STATE);
  const ref = useRef<HTMLFormElement>(null);
  useActionToast(state, () => ref.current?.reset());
  return (
    <form ref={ref} action={action} className="space-y-3">
      <input type="hidden" name="organization_id" value={organizationId ?? ""} />
      <input type="hidden" name="request_id" value={requestId ?? ""} />
      <input type="hidden" name="proposal_id" value={proposalId ?? ""} />
      <Field label="Nouvelle note" hint="Réunion, appel, décision — visible uniquement par l’équipe Enterprise." error={state.fieldErrors?.body}>
        <Textarea name="body" rows={3} maxLength={4000} />
      </Field>
      <FormActions>
        <SubmitButton variant="secondary">Ajouter la note</SubmitButton>
      </FormActions>
    </form>
  );
}

export function EnterpriseTaskForm({ organizationId, team }: { organizationId: string; team: Array<{ id: string; full_name: string | null; email: string }> }) {
  const [state, action] = useActionState(saveEnterpriseTask, INITIAL_ACTION_STATE);
  const ref = useRef<HTMLFormElement>(null);
  useActionToast(state, () => ref.current?.reset());
  const e = state.fieldErrors ?? {};
  return (
    <form ref={ref} action={action} className="space-y-3">
      <input type="hidden" name="organization_id" value={organizationId} />
      {!state.ok && state.message ? <FormMessage state={state} /> : null}
      <Field label="Tâche de suivi" error={e.title}>
        <Input name="title" placeholder="Ex. : envoyer la proposition" maxLength={200} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Échéance" optional error={e.due_on}>
          <Input name="due_on" type="date" />
        </Field>
        <Field label="Responsable" optional error={e.assigned_to}>
          <Select name="assigned_to" defaultValue="">
            <option value="">Moi</option>
            {team.map((m) => (
              <option key={m.id} value={m.id}>
                {m.full_name || m.email}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <FormActions>
        <SubmitButton variant="secondary">Ajouter la tâche</SubmitButton>
      </FormActions>
    </form>
  );
}

export function EnterpriseContactForm({ organizationId }: { organizationId: string }) {
  const [state, action] = useActionState(saveEnterpriseContact, INITIAL_ACTION_STATE);
  const ref = useRef<HTMLFormElement>(null);
  useActionToast(state, () => ref.current?.reset());
  const e = state.fieldErrors ?? {};
  return (
    <form ref={ref} action={action} className="space-y-3">
      <input type="hidden" name="organization_id" value={organizationId} />
      {!state.ok && state.message ? <FormMessage state={state} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nom complet" error={e.full_name}>
          <Input name="full_name" maxLength={150} />
        </Field>
        <Field label="Fonction" optional error={e.job_title}>
          <Input name="job_title" maxLength={150} />
        </Field>
        <Field label="E-mail" optional error={e.email}>
          <Input name="email" type="email" maxLength={254} />
        </Field>
        <Field label="Téléphone" optional error={e.phone}>
          <Input name="phone" type="tel" maxLength={40} />
        </Field>
      </div>
      <Checkbox name="is_primary" label="Contact principal" />
      <FormActions>
        <SubmitButton variant="secondary">Ajouter le contact</SubmitButton>
      </FormActions>
    </form>
  );
}
