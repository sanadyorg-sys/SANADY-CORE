"use client";

import { useActionState, useState } from "react";
import { Copy } from "lucide-react";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { FormActions, FormMessage, SubmitButton, useActionToast } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { SERVICE_PLANS, slugify } from "@/lib/enterprise";
import { INITIAL_ACTION_STATE } from "@/lib/types";
import { authorizeTenant, inviteTenantAdmin, saveTenant, scheduleTenantDeletion, setTenantStatus } from "@/server/actions/enterprise";
import type { TenantDetail } from "@/server/queries/enterprise";

/** Forms of phase E3: company learning spaces. */

type Option = { id: string; label: string };

export function TenantForm({
  organizationId,
  organizationName,
  tenant: t,
  contacts,
  proposals,
}: {
  organizationId: string;
  organizationName: string;
  tenant?: TenantDetail;
  contacts: Option[];
  proposals: Option[];
}) {
  const [state, action] = useActionState(saveTenant, INITIAL_ACTION_STATE);
  useActionToast(state);
  const e = state.fieldErrors ?? {};
  const [slug, setSlug] = useState(t?.slug ?? slugify(organizationName));
  const slugLocked = Boolean(t?.institution_id);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={t?.id ?? ""} />
      <input type="hidden" name="organization_id" value={organizationId} />
      {!state.ok && state.message ? <FormMessage state={state} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom de l’espace" error={e.display_name}>
          <Input
            name="display_name"
            defaultValue={t?.display_name ?? organizationName}
            maxLength={200}
            onChange={(ev) => (!t && !slugLocked ? setSlug(slugify(ev.currentTarget.value)) : undefined)}
          />
        </Field>
        <Field
          label="Adresse de l’espace"
          hint={slugLocked ? "Fixée depuis la création de l’espace." : "sanady-core.vercel.app/entreprise/…"}
          error={e.slug}
        >
          <Input name="slug" value={slug} onChange={(ev) => setSlug(ev.currentTarget.value.toLowerCase())} readOnly={slugLocked} maxLength={60} />
        </Field>
        <Field label="Formule" error={e.service_plan}>
          <Select name="service_plan" defaultValue={t?.service_plan ?? "plateforme"}>
            {Object.entries(SERVICE_PLANS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Contrat (proposition acceptée)" optional error={e.proposal_id}>
          <Select name="proposal_id" defaultValue={t?.proposal_id ?? ""}>
            <option value="">Non rattaché</option>
            {proposals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <fieldset className="space-y-4 rounded-xl border border-line p-4">
        <legend className="px-1 text-label font-semibold text-ink-800">Limites de service (contrat)</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Collaborateurs autorisés" error={e.max_learners}>
            <Input name="max_learners" inputMode="numeric" defaultValue={t?.max_learners ?? ""} />
          </Field>
          <Field label="Stockage (Go)" optional error={e.storage_allowance_gb}>
            <Input name="storage_allowance_gb" inputMode="decimal" defaultValue={t?.storage_allowance_gb ?? ""} />
          </Field>
          <Field label="Minutes de vidéo / an" optional error={e.video_minutes_allowance}>
            <Input name="video_minutes_allowance" inputMode="numeric" defaultValue={t?.video_minutes_allowance ?? ""} />
          </Field>
          <Field label="Début du contrat" optional error={e.contract_start_on}>
            <Input name="contract_start_on" type="date" defaultValue={t?.contract_start_on ?? ""} />
          </Field>
          <Field label="Fin du contrat" optional error={e.contract_end_on}>
            <Input name="contract_end_on" type="date" defaultValue={t?.contract_end_on ?? ""} />
          </Field>
          <Field label="Document de fin" error={e.certificate_kind}>
            <Select name="certificate_kind" defaultValue={t?.certificate_kind ?? "attestation"}>
              <option value="attestation">Attestation de formation</option>
              <option value="certificat">Certificat de fin de formation</option>
            </Select>
          </Field>
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Contact principal" optional error={e.primary_contact_id}>
          <Select name="primary_contact_id" defaultValue={t?.primary_contact_id ?? ""}>
            <option value="">Aucun</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="E-mail du support" optional error={e.support_email}>
          <Input name="support_email" type="email" defaultValue={t?.support_email ?? ""} maxLength={254} />
        </Field>
      </div>
      <Field label="Niveau de support prévu" optional error={e.support_level}>
        <Input name="support_level" defaultValue={t?.support_level ?? ""} maxLength={200} placeholder="Ex. réponse sous 2 jours ouvrés" />
      </Field>
      <FormActions>
        <SubmitButton>{t ? "Enregistrer" : "Demander la création de l’espace"}</SubmitButton>
      </FormActions>
    </form>
  );
}

export function AuthorizeTenantForm({ id }: { id: string }) {
  const [state, action] = useActionState(authorizeTenant, INITIAL_ACTION_STATE);
  useActionToast(state);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      {!state.ok && state.message ? <FormMessage state={state} /> : null}
      <Field label="Décision" error={state.fieldErrors?.decision}>
        <Select name="decision" defaultValue="authorize">
          <option value="authorize">Autoriser la création de l’espace</option>
          <option value="refuse">Refuser</option>
        </Select>
      </Field>
      <Field label="Commentaire (historique)" optional error={state.fieldErrors?.note}>
        <Textarea name="note" rows={2} maxLength={1000} />
      </Field>
      <FormActions>
        <SubmitButton>Enregistrer la décision</SubmitButton>
      </FormActions>
    </form>
  );
}

const STATUS_LABELS: Record<string, string> = {
  active: "Activer l’espace",
  suspended: "Suspendre l’espace (accès coupé)",
  offboarding: "Enregistrer la fin du contrat",
  closed: "Fermer l’espace (accès révoqués)",
};

export function TenantStatusForm({ id, options }: { id: string; options: string[] }) {
  const [state, action] = useActionState(setTenantStatus, INITIAL_ACTION_STATE);
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
              {STATUS_LABELS[o] ?? o}
            </option>
          ))}
        </Select>
      </Field>
      <Field
        label={choice === "offboarding" ? "Fin du contrat (date et motif)" : "Commentaire (historique)"}
        optional={choice !== "offboarding"}
        error={state.fieldErrors?.note}
      >
        <Textarea name="note" rows={2} maxLength={2000} />
      </Field>
      <FormActions>
        <SubmitButton variant={choice === "closed" || choice === "suspended" ? "danger" : "primary"} disabled={!choice}>
          Enregistrer
        </SubmitButton>
      </FormActions>
    </form>
  );
}

export function InviteTenantAdminForm({ id }: { id: string }) {
  const [state, action] = useActionState(inviteTenantAdmin, INITIAL_ACTION_STATE);
  useActionToast(state);
  const link = (state.data as { link?: string } | undefined)?.link;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      {!state.ok && state.message ? <FormMessage state={state} /> : null}
      <Field label="E-mail de l’administrateur de l’entreprise" error={state.fieldErrors?.email}>
        <Input name="email" type="email" autoComplete="off" maxLength={254} />
      </Field>
      {link ? <CopyLink link={link} /> : null}
      <FormActions>
        <SubmitButton variant="secondary">Envoyer l’invitation</SubmitButton>
      </FormActions>
    </form>
  );
}

function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-xl border border-warning-200 bg-warning-50 p-3 text-label text-ink-800">
      <p>Lien d’invitation à transmettre de façon sûre :</p>
      <div className="mt-2 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded bg-surface px-2 py-1 text-caption">{link}</code>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => navigator.clipboard.writeText(link).then(() => setCopied(true))}
        >
          <Copy aria-hidden /> {copied ? "Copié" : "Copier"}
        </Button>
      </div>
    </div>
  );
}

export function DeletionDateForm({ id, value }: { id: string; value: string | null }) {
  const [state, action] = useActionState(scheduleTenantDeletion, INITIAL_ACTION_STATE);
  useActionToast(state);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      {!state.ok && state.message ? <FormMessage state={state} /> : null}
      <Field
        label="Suppression prévue des données"
        hint="Selon le contrat et les obligations légales (loi 09-08). Les données restent conservées jusqu’à cette date."
        error={state.fieldErrors?.deletion_due_on}
      >
        <Input name="deletion_due_on" type="date" defaultValue={value ?? ""} />
      </Field>
      <FormActions>
        <SubmitButton variant="secondary">Enregistrer la date</SubmitButton>
      </FormActions>
    </form>
  );
}
