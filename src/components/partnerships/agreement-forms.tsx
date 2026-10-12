"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { FormActions, FormMessage, SubmitButton, useActionToast } from "@/components/ui/form";
import { createClient } from "@/lib/supabase/browser";
import {
  AGREEMENT_STATUS,
  CONTRIBUTION_KINDS,
  CONTRIBUTION_STAGE,
  CURRENCIES,
  DOCUMENT_KINDS,
  DOCUMENT_MIME,
  FIELD_SLUGS,
  INTERVENTION_FIELDS,
  type AgreementStatus,
  type ContributionKind,
  type ContributionStage,
  type DocumentKind,
} from "@/lib/partnerships";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/types";
import {
  attachDocuments,
  prepareTeamUpload,
  saveAgreement,
  saveContribution,
  saveMilestone,
  setAgreementStatus,
  setContributionStage,
} from "@/server/actions/agreements";
import type { AgreementDetail, ContributionDetail } from "@/server/queries/agreements";

/** Forms of partnership phase 4: agreements, milestones, contributions, documents. */

type Option = { id: string; label: string };

export function AgreementForm({ organizationId, agreement: a, opportunities }: { organizationId: string; agreement?: AgreementDetail; opportunities: Option[] }) {
  const [state, action] = useActionState(saveAgreement, INITIAL_ACTION_STATE);
  useActionToast(state);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={a?.id ?? ""} />
      <input type="hidden" name="organization_id" value={organizationId} />
      {!state.ok && state.message ? <FormMessage state={state} /> : null}
      <Field label="Intitulé de la convention" error={e.title}>
        <Input name="title" defaultValue={a?.title} maxLength={200} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Domaine d’intervention" error={e.intervention_field}>
          <Select name="intervention_field" defaultValue={a?.intervention_field ?? ""}>
            <option value="" disabled>
              Choisir…
            </option>
            {FIELD_SLUGS.map((s) => (
              <option key={s} value={s}>
                {INTERVENTION_FIELDS[s].name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Projet concerné" optional error={e.opportunity_id}>
          <Select name="opportunity_id" defaultValue={a?.opportunity_id ?? ""}>
            <option value="">Aucun</option>
            {opportunities.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Objectifs" error={e.objectives}>
        <Textarea name="objectives" rows={3} defaultValue={a?.objectives} maxLength={4000} />
      </Field>
      <Field label="Responsabilités de chaque partie" optional error={e.responsibilities}>
        <Textarea name="responsibilities" rows={3} defaultValue={a?.responsibilities ?? ""} maxLength={4000} />
      </Field>
      <Field label="Contributions prévues" optional hint="Résumé ; chaque contribution est suivie à part." error={e.contributions_summary}>
        <Textarea name="contributions_summary" rows={2} defaultValue={a?.contributions_summary ?? ""} maxLength={4000} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Début" optional error={e.start_on}>
          <Input name="start_on" type="date" defaultValue={a?.start_on ?? ""} />
        </Field>
        <Field label="Fin" optional error={e.end_on}>
          <Input name="end_on" type="date" defaultValue={a?.end_on ?? ""} />
        </Field>
        <Field label="Rappel avant l’échéance (jours)" error={e.renewal_notice_days}>
          <Input name="renewal_notice_days" inputMode="numeric" defaultValue={a?.renewal_notice_days ?? 60} />
        </Field>
      </div>
      <Field label="Conditions de renouvellement" optional error={e.renewal_terms}>
        <Textarea name="renewal_terms" rows={2} defaultValue={a?.renewal_terms ?? ""} maxLength={2000} />
      </Field>
      <FormActions>
        <SubmitButton>{a ? "Enregistrer" : "Créer le brouillon"}</SubmitButton>
      </FormActions>
    </form>
  );
}

const AGREEMENT_ACTIONS: Partial<Record<AgreementStatus, string>> = {
  internal_review: "Soumettre à la revue interne",
  draft: "Renvoyer en brouillon",
  approved: "Approuver (approbateur)",
  signed: "Enregistrer la signature (approbateur)",
  active: "Démarrer la mise en œuvre",
  completed: "Clôturer (terminée)",
  archived: "Archiver",
};

export function AgreementStatusForm({ id, options }: { id: string; options: AgreementStatus[] }) {
  const [state, action] = useActionState(setAgreementStatus, INITIAL_ACTION_STATE);
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
              {AGREEMENT_ACTIONS[o] ?? AGREEMENT_STATUS[o].label}
            </option>
          ))}
        </Select>
      </Field>
      {choice === "signed" ? (
        <Field label="Date de signature" hint="La signature a lieu hors de la plateforme ; l’exemplaire signé doit être joint." error={state.fieldErrors?.signed_on}>
          <Input name="signed_on" type="date" max={new Date().toISOString().slice(0, 10)} />
        </Field>
      ) : null}
      <Field label="Commentaire (historique)" optional error={state.fieldErrors?.note}>
        <Textarea name="note" rows={2} maxLength={1000} />
      </Field>
      <FormActions>
        <SubmitButton disabled={!choice}>Enregistrer</SubmitButton>
      </FormActions>
    </form>
  );
}

export function MilestoneForm({ agreementId }: { agreementId: string }) {
  const [state, action] = useActionState(saveMilestone, INITIAL_ACTION_STATE);
  const ref = useRef<HTMLFormElement>(null);
  useActionToast(state, () => ref.current?.reset());
  return (
    <form ref={ref} action={action} className="space-y-3">
      <input type="hidden" name="agreement_id" value={agreementId} />
      {!state.ok && state.message ? <FormMessage state={state} /> : null}
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_170px]">
        <Field label="Étape du projet" error={state.fieldErrors?.title}>
          <Input name="title" maxLength={200} placeholder="Ex. Livraison des équipements" />
        </Field>
        <Field label="Échéance" error={state.fieldErrors?.due_on}>
          <Input name="due_on" type="date" />
        </Field>
      </div>
      <FormActions>
        <SubmitButton variant="secondary">Ajouter l’étape</SubmitButton>
      </FormActions>
    </form>
  );
}

export function ContributionForm({
  organizationId,
  contribution: c,
  agreements,
  opportunities,
  defaultAgreement,
}: {
  organizationId: string;
  contribution?: ContributionDetail;
  agreements: Option[];
  opportunities: Option[];
  defaultAgreement?: string;
}) {
  const [state, action] = useActionState(saveContribution, INITIAL_ACTION_STATE);
  useActionToast(state);
  const [kind, setKind] = useState<ContributionKind>(c?.kind ?? "financial");
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={c?.id ?? ""} />
      <input type="hidden" name="organization_id" value={organizationId} />
      {!state.ok && state.message ? <FormMessage state={state} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type" error={e.kind}>
          {c ? (
            <>
              <input type="hidden" name="kind" value={kind} />
              <Input value={CONTRIBUTION_KINDS[kind]} readOnly />
            </>
          ) : (
            <Select name="kind" value={kind} onChange={(ev) => setKind(ev.currentTarget.value as ContributionKind)}>
              {Object.entries(CONTRIBUTION_KINDS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Attendue le" optional error={e.expected_on}>
          <Input name="expected_on" type="date" defaultValue={c?.expected_on ?? ""} />
        </Field>
      </div>
      <Field label="Description" error={e.description}>
        <Textarea name="description" rows={2} defaultValue={c?.description} maxLength={2000} />
      </Field>
      {kind === "financial" ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Montant promis" error={e.amount_pledged}>
            <Input name="amount_pledged" inputMode="decimal" defaultValue={c?.amount_pledged ?? ""} />
          </Field>
          <Field label="Devise" error={e.currency}>
            <Select name="currency" defaultValue={c?.currency ?? "MAD"}>
              {Object.keys(CURRENCIES).map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Affectation" optional hint="Utilisation imposée par le donateur." error={e.restricted_purpose}>
            <Input name="restricted_purpose" defaultValue={c?.restricted_purpose ?? ""} maxLength={1000} />
          </Field>
        </div>
      ) : null}
      {kind === "material" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Matériel" error={e.item}>
            <Input name="item" defaultValue={c?.item ?? ""} maxLength={200} />
          </Field>
          <Field label="Quantité" optional error={e.quantity}>
            <Input name="quantity" inputMode="numeric" defaultValue={c?.quantity ?? ""} />
          </Field>
          <Field label="Valeur estimée (MAD)" optional hint="Estimation, pas un montant reçu." error={e.estimated_value}>
            <Input name="estimated_value" inputMode="decimal" defaultValue={c?.estimated_value ?? ""} />
          </Field>
          <Field label="Bénéficiaire" optional hint="École ou programme qui reçoit." error={e.recipient}>
            <Input name="recipient" defaultValue={c?.recipient ?? ""} maxLength={200} />
          </Field>
        </div>
      ) : null}
      {kind === "expertise" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Domaine d’expertise" error={e.expertise_category}>
            <Input name="expertise_category" defaultValue={c?.expertise_category ?? ""} maxLength={200} />
          </Field>
          <Field label="Heures prévues" optional error={e.hours_pledged}>
            <Input name="hours_pledged" inputMode="decimal" defaultValue={c?.hours_pledged ?? ""} />
          </Field>
          <Field label="Activités soutenues" optional error={e.supported_activities} className="sm:col-span-2">
            <Textarea name="supported_activities" rows={2} defaultValue={c?.supported_activities ?? ""} maxLength={2000} />
          </Field>
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Convention" optional error={e.agreement_id}>
          <Select name="agreement_id" defaultValue={c?.agreement_id ?? defaultAgreement ?? ""}>
            <option value="">Aucune</option>
            {agreements.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Projet soutenu" optional error={e.opportunity_id}>
          <Select name="opportunity_id" defaultValue={c?.opportunity_id ?? ""}>
            <option value="">Aucun</option>
            {opportunities.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <FormActions>
        <SubmitButton>{c ? "Enregistrer" : "Enregistrer la promesse"}</SubmitButton>
      </FormActions>
    </form>
  );
}

const STAGE_ACTIONS: Partial<Record<ContributionStage, string>> = {
  committed: "Marquer comme engagée",
  delivered: "Enregistrer la réception / réalisation",
  verified: "Vérifier (approbateur)",
  cancelled: "Annuler",
};

export function ContributionStageForm({ id, kind, currency, options }: { id: string; kind: ContributionKind; currency: string; options: ContributionStage[] }) {
  const [state, action] = useActionState(setContributionStage, INITIAL_ACTION_STATE);
  useActionToast(state);
  const [choice, setChoice] = useState("");
  const e = state.fieldErrors ?? {};
  if (!options.length) return <p className="text-body text-ink-600">Aucune action disponible pour votre rôle à ce stade.</p>;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      {!state.ok && state.message ? <FormMessage state={state} /> : null}
      <Field label="Action" error={e.stage}>
        <Select name="stage" value={choice} onChange={(ev) => setChoice(ev.currentTarget.value)}>
          <option value="" disabled>
            Choisir une action…
          </option>
          {options.map((o) => (
            <option key={o} value={o}>
              {STAGE_ACTIONS[o] ?? CONTRIBUTION_STAGE[o].label}
            </option>
          ))}
        </Select>
      </Field>
      {choice === "delivered" ? (
        <>
          {kind === "financial" ? (
            <Field label={`Montant réellement reçu (${currency})`} error={e.amount_received}>
              <Input name="amount_received" inputMode="decimal" />
            </Field>
          ) : null}
          {kind === "expertise" ? (
            <Field label="Heures réalisées" error={e.hours_delivered}>
              <Input name="hours_delivered" inputMode="decimal" />
            </Field>
          ) : null}
          <Field label="Date de réception" optional={kind === "expertise"} error={e.received_on}>
            <Input name="received_on" type="date" max={new Date().toISOString().slice(0, 10)} />
          </Field>
        </>
      ) : null}
      <Field label={choice === "cancelled" ? "Motif" : "Commentaire (historique)"} optional={choice !== "cancelled"} error={e.note}>
        <Textarea name="note" rows={2} maxLength={1000} />
      </Field>
      <FormActions>
        <SubmitButton variant={choice === "cancelled" ? "danger" : "primary"} disabled={!choice}>
          Enregistrer
        </SubmitButton>
      </FormActions>
    </form>
  );
}

/** PDF upload for the team: single-use signed link, then verification on the server. */
export function DocumentUpload({ target, targetId, kinds }: { target: "agreement" | "contribution"; targetId: string; kinds: DocumentKind[] }) {
  const [state, setState] = useState<ActionState>(INITIAL_ACTION_STATE);
  const [pending, start] = useTransition();
  const [kind, setKind] = useState<DocumentKind>(kinds[0]!);
  const input = useRef<HTMLInputElement>(null);
  useActionToast(state, () => {
    if (input.current) input.current.value = "";
  });

  function upload() {
    const file = input.current?.files?.[0];
    if (!file) return setState({ ok: false, message: "Choisissez un document PDF." });
    start(async () => {
      const ticket = await prepareTeamUpload({ name: file.name, size: file.size, type: file.type });
      if (!ticket.ok) return setState({ ok: false, message: ticket.message });
      const { error } = await createClient().storage.from("partnerships").uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: DOCUMENT_MIME });
      if (error) return setState({ ok: false, message: `« ${file.name} » n’a pas pu être envoyé. Réessayez.` });
      const fd = new FormData();
      fd.set("target", target);
      fd.set("target_id", targetId);
      fd.set("kind", kind);
      fd.set("documents", JSON.stringify([{ path: ticket.path, name: file.name }]));
      setState(await attachDocuments(INITIAL_ACTION_STATE, fd));
    });
  }

  return (
    <div className="space-y-3">
      {!state.ok && state.message ? <FormMessage state={state} /> : null}
      <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
        <Field label="Type">
          <Select value={kind} onChange={(ev) => setKind(ev.currentTarget.value as DocumentKind)}>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {DOCUMENT_KINDS[k]}
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
