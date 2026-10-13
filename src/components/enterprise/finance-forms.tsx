"use client";

import { useActionState, useRef } from "react";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { FormActions, FormMessage, SubmitButton, useActionToast } from "@/components/ui/form";
import { COST_CATEGORIES, PAYMENT_METHODS, REVENUE_CATEGORIES } from "@/lib/enterprise";
import { INITIAL_ACTION_STATE } from "@/lib/types";
import { cancelInvoice, recordCost, recordInvoice, recordPayment } from "@/server/actions/finance";

/** Forms of SANADY Enterprise phase E6: amounts recorded from the Foundation's accounting. */

const today = () => new Date().toISOString().slice(0, 10);

export function InvoiceForm({ contractId, currency }: { contractId: string; currency: string }) {
  const [state, action] = useActionState(recordInvoice, INITIAL_ACTION_STATE);
  const ref = useRef<HTMLFormElement>(null);
  useActionToast(state, () => ref.current?.reset());
  const e = state.fieldErrors ?? {};
  return (
    <form ref={ref} action={action} className="space-y-3">
      <input type="hidden" name="contract_id" value={contractId} />
      {!state.ok && state.message ? <FormMessage state={state} /> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="N° de facture (comptabilité)" error={e.external_reference}>
          <Input name="external_reference" maxLength={80} placeholder="FA-2026-014" />
        </Field>
        <Field label="Catégorie" error={e.category}>
          <Select name="category" defaultValue="platform_subscription">
            {Object.entries(REVENUE_CATEGORIES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={`Montant (${currency})`} error={e.amount}>
          <Input name="amount" inputMode="decimal" />
        </Field>
        <Field label="Émise le" error={e.issued_on}>
          <Input name="issued_on" type="date" max={today()} />
        </Field>
        <Field label="Échéance" optional error={e.due_on}>
          <Input name="due_on" type="date" />
        </Field>
        <Field label="Objet" optional error={e.description}>
          <Input name="description" maxLength={500} />
        </Field>
      </div>
      <FormActions>
        <SubmitButton variant="secondary">Enregistrer la facture</SubmitButton>
      </FormActions>
    </form>
  );
}

export function PaymentForm({ invoiceId, contractId, currency, remaining }: { invoiceId: string; contractId: string; currency: string; remaining: number }) {
  const [state, action] = useActionState(recordPayment, INITIAL_ACTION_STATE);
  const ref = useRef<HTMLFormElement>(null);
  useActionToast(state, () => ref.current?.reset());
  const e = state.fieldErrors ?? {};
  return (
    <form ref={ref} action={action} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_1fr_auto] sm:items-end">
      <input type="hidden" name="invoice_id" value={invoiceId} />
      <input type="hidden" name="contract_id" value={contractId} />
      <Field label={`Reçu (${currency})`} error={e.amount ?? (!state.ok && state.message ? state.message : undefined)}>
        <Input name="amount" inputMode="decimal" defaultValue={String(remaining)} />
      </Field>
      <Field label="Le" error={e.received_on}>
        <Input name="received_on" type="date" max={today()} />
      </Field>
      <Field label="Moyen" error={e.method}>
        <Select name="method" defaultValue="transfer">
          {Object.entries(PAYMENT_METHODS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Réf. bancaire" optional error={e.bank_reference}>
        <Input name="bank_reference" maxLength={120} />
      </Field>
      <SubmitButton variant="secondary">Enregistrer</SubmitButton>
    </form>
  );
}

export function CancelInvoiceForm({ invoiceId, contractId }: { invoiceId: string; contractId: string }) {
  const [state, action] = useActionState(cancelInvoice, INITIAL_ACTION_STATE);
  useActionToast(state);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={invoiceId} />
      <input type="hidden" name="contract_id" value={contractId} />
      <Field label="Annuler (motif)" error={state.fieldErrors?.reason ?? (!state.ok && state.message ? state.message : undefined)} className="min-w-0 flex-1">
        <Input name="reason" maxLength={500} placeholder="Avoir n° …" />
      </Field>
      <SubmitButton variant="danger-ghost">Annuler la facture</SubmitButton>
    </form>
  );
}

export function CostForm({ contracts }: { contracts: Array<{ id: string; reference: string; title: string }> }) {
  const [state, action] = useActionState(recordCost, INITIAL_ACTION_STATE);
  const ref = useRef<HTMLFormElement>(null);
  useActionToast(state, () => ref.current?.reset());
  const e = state.fieldErrors ?? {};
  return (
    <form ref={ref} action={action} className="space-y-3">
      {!state.ok && state.message ? <FormMessage state={state} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Catégorie" error={e.category}>
          <Select name="category" defaultValue="video_hosting">
            {Object.entries(COST_CATEGORIES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Contrat (coût direct)" optional error={e.contract_id}>
          <Select name="contract_id" defaultValue="">
            <option value="">Coût général</option>
            {contracts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.reference} — {c.title}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Description" error={e.description}>
        <Input name="description" maxLength={500} placeholder="Ex. facture Mux de février" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Montant" error={e.amount}>
          <Input name="amount" inputMode="decimal" />
        </Field>
        <Field label="Devise" error={e.currency}>
          <Select name="currency" defaultValue="MAD">
            {["MAD", "EUR", "USD"].map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Date" error={e.incurred_on}>
          <Input name="incurred_on" type="date" />
        </Field>
      </div>
      <Checkbox name="is_estimate" label="Estimation (pas encore une facture de fournisseur)" />
      <FormActions>
        <SubmitButton variant="secondary">Enregistrer le coût</SubmitButton>
      </FormActions>
    </form>
  );
}
