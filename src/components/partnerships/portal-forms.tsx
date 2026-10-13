"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { FileUp, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { FormActions, FormMessage, SubmitButton, useActionToast } from "@/components/ui/form";
import { createClient } from "@/lib/supabase/browser";
import { DOCUMENT_MIME, MAX_DOCUMENTS } from "@/lib/partnerships";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/types";
import { invitePartnerMember, postPortalMessage, postTeamMessage, preparePartnerUpload, reviewDeliverable, submitDeliverable } from "@/server/actions/portal";

/** Forms of the partner portal (partnerships phase 6). */

type Option = { id: string; label: string };

export function DeliverableForm({ agreements }: { agreements: Option[] }) {
  const [state, setState] = useState<ActionState>(INITIAL_ACTION_STATE);
  const [docs, setDocs] = useState<Array<{ path: string; name: string }>>([]);
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const file = useRef<HTMLInputElement>(null);
  useActionToast(state, () => {
    form.current?.reset();
    setDocs([]);
  });
  const e = state.fieldErrors ?? {};

  async function add(f: File) {
    setUploading(true);
    try {
      const ticket = await preparePartnerUpload({ name: f.name, size: f.size, type: f.type });
      if (!ticket.ok) return setState({ ok: false, message: ticket.message });
      const { error } = await createClient().storage.from("partnerships").uploadToSignedUrl(ticket.path, ticket.token, f, { contentType: DOCUMENT_MIME });
      if (error) return setState({ ok: false, message: `« ${f.name} » n’a pas pu être envoyé. Réessayez.` });
      setDocs((d) => [...d, { path: ticket.path, name: f.name }]);
    } finally {
      setUploading(false);
      if (file.current) file.current.value = "";
    }
  }

  return (
    <form
      ref={form}
      className="space-y-4"
      onSubmit={(ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.currentTarget);
        fd.set("documents", JSON.stringify(docs));
        start(async () => {
          const result = await submitDeliverable(INITIAL_ACTION_STATE, fd);
          // A refused file is removed from the list.
          const rejected = (result.data as { rejectedPath?: string } | undefined)?.rejectedPath;
          if (rejected) setDocs((d) => d.filter((x) => x.path !== rejected));
          setState(result);
        });
      }}
    >
      {!state.ok && state.message ? <FormMessage state={state} /> : null}
      <Field label="Titre du livrable" error={e.title}>
        <Input name="title" maxLength={200} placeholder="Ex. Rapport d’activité du premier trimestre" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Convention concernée" optional error={e.agreement_id}>
          <Select name="agreement_id" defaultValue="">
            <option value="">Aucune en particulier</option>
            {agreements.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Description" optional error={e.description}>
        <Textarea name="description" rows={3} maxLength={2000} />
      </Field>
      <div className="space-y-2">
        <p className="text-label font-medium text-ink-800">Documents PDF ({MAX_DOCUMENTS} au maximum, 10 Mo chacun)</p>
        {docs.length ? (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {docs.map((d) => (
              <li key={d.path} className="flex items-center justify-between gap-2 px-3 py-2 text-label">
                <span className="truncate">{d.name}</span>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => setDocs((x) => x.filter((y) => y.path !== d.path))}>
                  <X aria-hidden /> <span className="sr-only">Retirer {d.name}</span>
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
        {docs.length < MAX_DOCUMENTS ? (
          <label className="flex cursor-pointer items-center gap-2 text-label text-accent-700">
            <FileUp className="size-4" aria-hidden /> {uploading ? "Envoi en cours…" : "Ajouter un PDF"}
            <input
              ref={file}
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              disabled={uploading}
              onChange={(ev) => {
                const f = ev.currentTarget.files?.[0];
                if (f) void add(f);
              }}
            />
          </label>
        ) : null}
        {e.documents ? (
          <p className="text-caption font-medium text-danger-600" role="alert">
            {e.documents}
          </p>
        ) : null}
      </div>
      <FormActions>
        <Button type="submit" loading={pending} disabled={uploading}>
          Transmettre le livrable
        </Button>
      </FormActions>
    </form>
  );
}

function MessageBox({ action, organizationId, placeholder }: { action: typeof postPortalMessage; organizationId?: string; placeholder: string }) {
  const [state, run] = useActionState(action, INITIAL_ACTION_STATE);
  const ref = useRef<HTMLFormElement>(null);
  useActionToast(state, () => ref.current?.reset());
  return (
    <form ref={ref} action={run} className="space-y-3">
      {organizationId ? <input type="hidden" name="organization_id" value={organizationId} /> : null}
      {!state.ok && state.message ? <FormMessage state={state} /> : null}
      <Field label="Message" error={state.fieldErrors?.body}>
        <Textarea name="body" rows={3} maxLength={4000} placeholder={placeholder} />
      </Field>
      <FormActions>
        <SubmitButton>
          <Send aria-hidden /> Envoyer
        </SubmitButton>
      </FormActions>
    </form>
  );
}

export function PortalMessageForm() {
  return <MessageBox action={postPortalMessage} placeholder="Votre message à l’équipe SANADY" />;
}

export function TeamMessageForm({ organizationId }: { organizationId: string }) {
  return <MessageBox action={postTeamMessage} organizationId={organizationId} placeholder="Votre message au partenaire (visible dans son espace)" />;
}

export function InvitePartnerForm({ organizationId }: { organizationId: string }) {
  const [state, action] = useActionState(invitePartnerMember, INITIAL_ACTION_STATE);
  useActionToast(state);
  const link = (state.data as { link?: string } | undefined)?.link;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="organization_id" value={organizationId} />
      {!state.ok && state.message ? <FormMessage state={state} /> : null}
      <Field label="E-mail du contact" hint="Une personne de l’organisation partenaire ; elle verra l’espace de cette organisation uniquement." error={state.fieldErrors?.email}>
        <Input name="email" type="email" autoComplete="off" maxLength={254} />
      </Field>
      {link ? (
        <div className="rounded-xl border border-warning-200 bg-warning-50 p-3 text-label text-ink-800">
          <p>E-mail non envoyé : transmettez ce lien personnel de façon sûre.</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-surface px-2 py-1 text-caption">{link}</code>
            <CopyButton value={link} label="Copier le lien" />
          </div>
        </div>
      ) : null}
      <FormActions>
        <SubmitButton variant="secondary">Inviter</SubmitButton>
      </FormActions>
    </form>
  );
}

export function DeliverableReviewForm({ id, organizationId }: { id: string; organizationId: string }) {
  const [state, action] = useActionState(reviewDeliverable, INITIAL_ACTION_STATE);
  useActionToast(state);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="organization_id" value={organizationId} />
      <Field label="Décision" className="w-40">
        <Select name="status" defaultValue="accepted">
          <option value="accepted">Accepter</option>
          <option value="returned">À compléter</option>
        </Select>
      </Field>
      <Field label="Commentaire" optional error={state.fieldErrors?.comment} className="min-w-0 flex-1">
        <Input name="comment" maxLength={1000} />
      </Field>
      <SubmitButton variant="secondary">Valider</SubmitButton>
    </form>
  );
}
