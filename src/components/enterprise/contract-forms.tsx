"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { FormActions, FormMessage, SubmitButton, useActionToast } from "@/components/ui/form";
import { CONTRACT_STATUS, LINE_CATEGORIES, PRICING_MODELS, type ContractStatus } from "@/lib/enterprise";
import { DOCUMENT_MIME } from "@/lib/partnerships";
import { createClient } from "@/lib/supabase/browser";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/types";
import { attachContractDocument, prepareContractUpload, reviewOverage, saveContract, saveContractLine, setContractStatus } from "@/server/actions/contracts";
import type { ContractDetail } from "@/server/queries/enterprise";

/** Forms of SANADY Enterprise phase E5: contracts, documents, usage review. */

export function ContractForm({ contract: c, tenants }: { contract: ContractDetail; tenants: Array<{ id: string; display_name: string }> }) {
  const [state, action] = useActionState(saveContract, INITIAL_ACTION_STATE);
  useActionToast(state);
  const e = state.fieldErrors ?? {};
  const renewal = c.status === "renewal";
  const signed = c.status === "signed" || c.status === "active";
  const locked = renewal || signed;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={c.id} />
      {!state.ok && state.message ? <FormMessage state={state} /> : null}
      {locked ? (
        <p className="rounded-lg bg-ink-50 px-3 py-2 text-label text-ink-700">
          {renewal ? "Renouvellement : seules la nouvelle échéance, les conditions de renouvellement et l’espace rattaché changent." : "Contrat signé : seul l’espace de formation rattaché peut changer."}
        </p>
      ) : null}
      {locked ? (
        <>
          {/* Signed terms are sent unchanged; the database ignores them. */}
          {(["title", "pricing_model", "currency", "start_on"] as const).map((k) => (
            <input key={k} type="hidden" name={k} value={(c[k] as string | null) ?? ""} />
          ))}
        </>
      ) : (
        <>
          <Field label="Intitulé du contrat" error={e.title}>
            <Input name="title" defaultValue={c.title} maxLength={200} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Modèle de tarification" error={e.pricing_model}>
              <Select name="pricing_model" defaultValue={c.pricing_model}>
                {Object.entries(PRICING_MODELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Devise" error={e.currency}>
              <Select name="currency" defaultValue={c.currency}>
                {["MAD", "EUR", "USD"].map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Début" optional error={e.start_on}>
              <Input name="start_on" type="date" defaultValue={c.start_on ?? ""} />
            </Field>
          </div>
        </>
      )}
      {!signed ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={renewal ? "Nouvelle fin du contrat" : "Fin"} optional={!renewal} error={e.end_on}>
            <Input name="end_on" type="date" defaultValue={c.end_on ?? ""} />
          </Field>
          {!locked ? (
            <Field label="Rappel avant l’échéance (jours)" error={e.renewal_notice_days}>
              <Input name="renewal_notice_days" inputMode="numeric" defaultValue={c.renewal_notice_days} />
            </Field>
          ) : null}
        </div>
      ) : (
        <input type="hidden" name="end_on" value={c.end_on ?? ""} />
      )}
      {!signed ? (
        <Field label="Conditions de renouvellement" optional error={e.renewal_terms}>
          <Textarea name="renewal_terms" rows={2} defaultValue={c.renewal_terms ?? ""} maxLength={2000} />
        </Field>
      ) : null}
      {!locked ? (
        <>
          <fieldset className="space-y-4 rounded-xl border border-line p-4">
            <legend className="px-1 text-label font-semibold text-ink-800">Limites de service</legend>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Collaborateurs" optional error={e.learner_limit}>
                <Input name="learner_limit" inputMode="numeric" defaultValue={c.learner_limit ?? ""} />
              </Field>
              <Field label="Stockage (Go)" optional error={e.storage_limit_gb}>
                <Input name="storage_limit_gb" inputMode="decimal" defaultValue={c.storage_limit_gb ?? ""} />
              </Field>
              <Field label="Minutes de vidéo / an" optional error={e.video_minutes_limit}>
                <Input name="video_minutes_limit" inputMode="numeric" defaultValue={c.video_minutes_limit ?? ""} />
              </Field>
            </div>
          </fieldset>
          {(
            [
              ["support_commitments", "Engagements de support"],
              ["data_ownership", "Propriété et traitement des données"],
              ["content_ownership", "Propriété des contenus"],
              ["termination_provisions", "Conditions de résiliation"],
            ] as const
          ).map(([k, label]) => (
            <Field key={k} label={label} optional error={e[k]}>
              <Textarea name={k} rows={2} defaultValue={c[k] ?? ""} maxLength={2000} />
            </Field>
          ))}
        </>
      ) : null}
      <Field label="Espace de formation rattaché" optional error={e.tenant_id}>
        <Select name="tenant_id" defaultValue={c.tenant_id ?? ""}>
          <option value="">Aucun</option>
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>
              {t.display_name}
            </option>
          ))}
        </Select>
      </Field>
      <FormActions>
        <SubmitButton>Enregistrer</SubmitButton>
      </FormActions>
    </form>
  );
}

export function ContractLineForm({ contractId, currency }: { contractId: string; currency: string }) {
  const [state, action] = useActionState(saveContractLine, INITIAL_ACTION_STATE);
  const ref = useRef<HTMLFormElement>(null);
  useActionToast(state, () => ref.current?.reset());
  const e = state.fieldErrors ?? {};
  return (
    <form ref={ref} action={action} className="grid gap-3 sm:grid-cols-[1.3fr_2fr_0.7fr_0.8fr_1fr_auto] sm:items-end">
      <input type="hidden" name="contract_id" value={contractId} />
      <Field label="Catégorie" error={e.category}>
        <Select name="category" defaultValue="platform_access">
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
        <Input name="unit" placeholder="mois" maxLength={40} />
      </Field>
      <Field label={`Prix unitaire (${currency})`} error={e.unit_price}>
        <Input name="unit_price" inputMode="decimal" />
      </Field>
      <SubmitButton variant="secondary">Ajouter</SubmitButton>
    </form>
  );
}

const ACTIONS: Partial<Record<ContractStatus, string>> = {
  internal_review: "Soumettre à la revue interne",
  draft: "Renvoyer en brouillon",
  approved: "Approuver (approbateur)",
  signed: "Enregistrer la signature (approbateur)",
  active: "Démarrer / reprendre le contrat",
  renewal: "Ouvrir le renouvellement",
  closed: "Clore le contrat",
};

export function ContractStatusForm({ id, options }: { id: string; options: ContractStatus[] }) {
  const [state, action] = useActionState(setContractStatus, INITIAL_ACTION_STATE);
  useActionToast(state);
  const [choice, setChoice] = useState("");
  if (!options.length) return <p className="text-body text-ink-600">Aucune action disponible pour votre rôle à ce stade.</p>;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      {!state.ok && state.message ? <FormMessage state={state} /> : null}
      <Field label="Action" error={state.fieldErrors?.status}>
        <Select name="status" value={choice} onChange={(ev) => setChoice(ev.currentTarget.value)}>
          <option value="" disabled>
            Choisir une action…
          </option>
          {options.map((o) => (
            <option key={o} value={o}>
              {ACTIONS[o] ?? CONTRACT_STATUS[o].label}
            </option>
          ))}
        </Select>
      </Field>
      {choice === "signed" ? (
        <Field label="Date de signature" hint="La signature a lieu hors de la plateforme ; l’exemplaire signé doit être joint." error={state.fieldErrors?.signed_on}>
          <Input name="signed_on" type="date" max={new Date().toISOString().slice(0, 10)} />
        </Field>
      ) : null}
      <Field label={choice === "closed" ? "Motif de la clôture" : "Commentaire (historique)"} optional={choice !== "closed"} error={state.fieldErrors?.note}>
        <Textarea name="note" rows={2} maxLength={1000} />
      </Field>
      <FormActions>
        <SubmitButton variant={choice === "closed" ? "danger" : "primary"} disabled={!choice}>
          Enregistrer
        </SubmitButton>
      </FormActions>
    </form>
  );
}

export function ContractDocumentUpload({ contractId, canSign }: { contractId: string; canSign: boolean }) {
  const [state, setState] = useState<ActionState>(INITIAL_ACTION_STATE);
  const [pending, start] = useTransition();
  const kinds = canSign ? (["signed", "draft", "supporting"] as const) : (["draft", "supporting"] as const);
  const [kind, setKind] = useState<string>(kinds[0]);
  const input = useRef<HTMLInputElement>(null);
  useActionToast(state, () => {
    if (input.current) input.current.value = "";
  });
  const LABELS: Record<string, string> = { signed: "Exemplaire signé", draft: "Projet de contrat", supporting: "Pièce justificative" };

  function upload() {
    const file = input.current?.files?.[0];
    if (!file) return setState({ ok: false, message: "Choisissez un document PDF." });
    start(async () => {
      const ticket = await prepareContractUpload({ name: file.name, size: file.size, type: file.type });
      if (!ticket.ok) return setState({ ok: false, message: ticket.message });
      const { error } = await createClient().storage.from("enterprise").uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: DOCUMENT_MIME });
      if (error) return setState({ ok: false, message: `« ${file.name} » n’a pas pu être envoyé. Réessayez.` });
      const fd = new FormData();
      fd.set("contract_id", contractId);
      fd.set("kind", kind);
      fd.set("documents", JSON.stringify([{ path: ticket.path, name: file.name }]));
      setState(await attachContractDocument(INITIAL_ACTION_STATE, fd));
    });
  }

  return (
    <div className="space-y-3">
      {!state.ok && state.message ? <FormMessage state={state} /> : null}
      <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
        <Field label="Type">
          <Select value={kind} onChange={(ev) => setKind(ev.currentTarget.value)}>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {LABELS[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Document PDF (10 Mo maximum)">
          <input
            ref={input}
            type="file"
            accept="application/pdf,.pdf"
            className="block w-full text-label text-ink-700 file:mr-3 file:rounded-md file:border file:border-line-strong file:bg-surface file:px-3 file:py-1.5"
          />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button type="button" variant="secondary" loading={pending} onClick={upload}>
          <FileUp aria-hidden /> Joindre
        </Button>
      </div>
    </div>
  );
}

export function OverageReviewForm({ id, tenantId }: { id: string; tenantId: string }) {
  const [state, action] = useActionState(reviewOverage, INITIAL_ACTION_STATE);
  useActionToast(state);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="tenant_id" value={tenantId} />
      <Field label="Suite donnée au dépassement" error={state.fieldErrors?.note} className="min-w-0 flex-1">
        <Input name="note" maxLength={1000} placeholder="Ex. avenant proposé au client, régularisation au renouvellement…" />
      </Field>
      <SubmitButton variant="secondary">Enregistrer</SubmitButton>
    </form>
  );
}
