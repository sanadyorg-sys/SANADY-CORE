"use client";

import { useActionState } from "react";
import { Package } from "lucide-react";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { FormActions, FormMessage, SubmitButton, useActionToast } from "@/components/ui/form";
import { ENTERPRISE_SERVICES, PRICING_MODELS } from "@/lib/enterprise";
import { INITIAL_ACTION_STATE } from "@/lib/types";
import { applyPlan, savePlan } from "@/server/actions/plans";
import type { PlanRow } from "@/server/queries/plans";

/** Reusable service plans: editor, and « apply to a proposal ». */

export function PlanForm({ plan: p }: { plan?: PlanRow }) {
  const [state, action] = useActionState(savePlan, INITIAL_ACTION_STATE);
  useActionToast(state);
  const e = state.fieldErrors ?? {};
  const locked = Boolean(p?.lines.length);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={p?.id ?? ""} />
      {!state.ok && state.message ? <FormMessage state={state} /> : null}
      {p?.status === "active" ? (
        <p className="rounded-lg bg-warning-50 px-3 py-2 text-label text-warning-700">Enregistrer une modification repasse la formule en brouillon : un approbateur devra l’approuver à nouveau.</p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom de la formule" error={e.name}>
          <Input name="name" defaultValue={p?.name} maxLength={120} placeholder="Ex. : Plateforme PME" />
        </Field>
        <Field label="Service" error={e.service}>
          <Select name="service" defaultValue={p?.service ?? "plateforme"}>
            {(["sur_mesure", "plateforme", "complete"] as const).map((k) => (
              <option key={k} value={k}>
                {ENTERPRISE_SERVICES[k].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Modèle de tarification" error={e.pricing_model}>
          <Select name="pricing_model" defaultValue={p?.pricing_model ?? "annual_subscription"}>
            {Object.entries(PRICING_MODELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Devise" hint={locked ? "Fixée par les lignes existantes." : undefined} error={e.currency}>
          <Select name="currency" defaultValue={p?.currency ?? "MAD"} disabled={locked}>
            {["MAD", "EUR", "USD"].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {locked ? <input type="hidden" name="currency" value={p!.currency} /> : null}
      <Field label="Description" optional error={e.description}>
        <Textarea name="description" rows={3} maxLength={2000} defaultValue={p?.description ?? ""} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Collaborateurs" optional error={e.learner_limit}>
          <Input name="learner_limit" inputMode="numeric" defaultValue={p?.learner_limit ?? ""} />
        </Field>
        <Field label="Stockage (Go)" optional error={e.storage_limit_gb}>
          <Input name="storage_limit_gb" inputMode="decimal" defaultValue={p?.storage_limit_gb ?? ""} />
        </Field>
        <Field label="Minutes de vidéo" optional error={e.video_minutes_limit}>
          <Input name="video_minutes_limit" inputMode="numeric" defaultValue={p?.video_minutes_limit ?? ""} />
        </Field>
      </div>
      <Field label="Niveau de support" optional error={e.support_level}>
        <Input name="support_level" maxLength={200} defaultValue={p?.support_level ?? ""} placeholder="Ex. : réponse sous 2 jours ouvrés" />
      </Field>
      <Field label="Engagements de support" optional error={e.support_commitments}>
        <Textarea name="support_commitments" rows={3} maxLength={2000} defaultValue={p?.support_commitments ?? ""} />
      </Field>
      <FormActions>
        <SubmitButton>{p ? "Enregistrer" : "Créer la formule"}</SubmitButton>
      </FormActions>
    </form>
  );
}

export function ApplyPlanForm({ proposalId, plans }: { proposalId: string; plans: Array<{ id: string; label: string }> }) {
  const [state, action] = useActionState(applyPlan, INITIAL_ACTION_STATE);
  useActionToast(state);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="proposal_id" value={proposalId} />
      {!state.ok && state.message ? <FormMessage state={state} /> : null}
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Formule de service" hint="Ses lignes sont ajoutées à la proposition ; ajustez-les ensuite si besoin." error={state.fieldErrors?.plan_id} className="min-w-0 flex-1">
          <Select name="plan_id" defaultValue="">
            <option value="" disabled>
              Choisir une formule…
            </option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>
        <SubmitButton variant="secondary">
          <Package aria-hidden /> Appliquer
        </SubmitButton>
      </div>
    </form>
  );
}
