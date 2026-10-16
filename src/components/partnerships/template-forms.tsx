"use client";

import { useActionState, useMemo, useState } from "react";
import { Copy, Mail, MessagesSquare, Send } from "lucide-react";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { FormActions, FormMessage, SubmitButton, useActionToast } from "@/components/ui/form";
import { TEMPLATE_CATEGORIES, TEMPLATE_PLACEHOLDERS, fillTemplate, missingPlaceholders, type TemplateCategory } from "@/lib/partnerships";
import { INITIAL_ACTION_STATE } from "@/lib/types";
import { saveTemplate, sendPartnerMessage } from "@/server/actions/templates";
import type { TemplateRow } from "@/server/queries/templates";

/** Communication templates (brief V2 §14): editor and per-organisation composer. */

export function TemplateForm({ template: t }: { template?: TemplateRow }) {
  const [state, action] = useActionState(saveTemplate, INITIAL_ACTION_STATE);
  useActionToast(state);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={t?.id ?? ""} />
      {!state.ok && state.message ? <FormMessage state={state} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom du modèle" error={e.title}>
          <Input name="title" defaultValue={t?.title} maxLength={120} />
        </Field>
        <Field label="Catégorie" error={e.category}>
          <Select name="category" defaultValue={t?.category ?? "other"}>
            {Object.entries(TEMPLATE_CATEGORIES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Objet" error={e.subject}>
        <Input name="subject" defaultValue={t?.subject} maxLength={200} />
      </Field>
      <Field label="Texte" error={e.body}>
        <Textarea name="body" rows={12} defaultValue={t?.body} maxLength={6000} />
      </Field>
      <div className="rounded-xl bg-ink-50 px-3 py-2 text-caption text-ink-600">
        <p className="font-medium text-ink-700">Champs remplis automatiquement</p>
        <ul className="mt-1 grid gap-x-4 sm:grid-cols-2">
          {Object.entries(TEMPLATE_PLACEHOLDERS).map(([k, v]) => (
            <li key={k}>
              <code>{`{{${k}}}`}</code> — {v}
            </li>
          ))}
        </ul>
        <p className="mt-1">N’écrivez dans un modèle aucun chiffre ni engagement de la Fondation qui ne soit confirmé.</p>
      </div>
      <FormActions>
        <SubmitButton>{t ? "Enregistrer" : "Créer le modèle"}</SubmitButton>
      </FormActions>
    </form>
  );
}

type Contact = { id: string; full_name: string; email: string | null };

export function MessageComposer({
  organizationId,
  organizationName,
  interlocutor,
  templates,
  contacts,
  references,
  portalAvailable,
  emailConfigured,
}: {
  organizationId: string;
  organizationName: string;
  interlocutor: string;
  templates: Array<{ id: string; category: TemplateCategory; title: string; subject: string; body: string }>;
  contacts: Contact[];
  references: Array<{ value: string; label: string }>;
  portalAvailable: boolean;
  emailConfigured: boolean;
}) {
  const [state, action] = useActionState(sendPartnerMessage, INITIAL_ACTION_STATE);
  const [templateId, setTemplateId] = useState("");
  const [contactId, setContactId] = useState(contacts.find((c) => c.email)?.id ?? contacts[0]?.id ?? "");
  const [reference, setReference] = useState(references[0]?.value ?? "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [copied, setCopied] = useState(false);
  const contact = contacts.find((c) => c.id === contactId);
  useActionToast(state, () => {
    setTemplateId("");
    setSubject("");
    setBody("");
  });
  const e = state.fieldErrors ?? {};

  const vars = useMemo(
    () => ({
      organisation: organizationName,
      contact: contact?.full_name ?? "",
      interlocuteur: interlocutor,
      reference,
      date: new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date()),
    }),
    [organizationName, contact, interlocutor, reference],
  );
  const apply = (id: string, nextVars = vars) => {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setSubject(fillTemplate(t.subject, nextVars));
    setBody(fillTemplate(t.body, nextVars));
  };
  const missing = missingPlaceholders(`${subject} ${body}`);
  const ready = subject.trim() && body.trim() && missing.length === 0;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="organization_id" value={organizationId} />
      <input type="hidden" name="template_id" value={templateId} />
      {!state.ok && state.message ? <FormMessage state={state} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Modèle" className="sm:col-span-2">
          <Select
            value={templateId}
            onChange={(ev) => {
              setTemplateId(ev.currentTarget.value);
              apply(ev.currentTarget.value);
            }}
          >
            <option value="">Message libre</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {TEMPLATE_CATEGORIES[t.category]} — {t.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Contact" error={e.contact_id}>
          <Select
            name="contact_id"
            value={contactId}
            onChange={(ev) => {
              setContactId(ev.currentTarget.value);
              const c = contacts.find((x) => x.id === ev.currentTarget.value);
              if (templateId) apply(templateId, { ...vars, contact: c?.full_name ?? "" });
            }}
          >
            <option value="">Sans contact précis</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
                {c.email ? "" : " (sans e-mail)"}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Référence citée" optional>
          <Select
            value={reference}
            onChange={(ev) => {
              setReference(ev.currentTarget.value);
              if (templateId) apply(templateId, { ...vars, reference: ev.currentTarget.value });
            }}
          >
            <option value="">Aucune</option>
            {references.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Objet" error={e.subject}>
        <Input name="subject" value={subject} onChange={(ev) => setSubject(ev.currentTarget.value)} maxLength={200} />
      </Field>
      <Field label="Message" hint="Relisez et adaptez le texte : il part tel quel." error={e.body}>
        <Textarea name="body" rows={10} value={body} onChange={(ev) => setBody(ev.currentTarget.value)} maxLength={6000} />
      </Field>
      {missing.length ? (
        <p className="text-label font-medium text-warning-700" role="status">
          À compléter avant l’envoi : {missing.map((m) => `{{${m}}}`).join(", ")}
        </p>
      ) : null}
      <FormActions>
        <SubmitButton
          variant="secondary"
          name="channel"
          value="copy"
          disabled={!ready}
          onClick={() => {
            void navigator.clipboard?.writeText(`${subject}\n\n${body}`).then(() => setCopied(true));
          }}
        >
          <Copy aria-hidden /> {copied ? "Copié" : "Copier"}
        </SubmitButton>
        {contact?.email ? (
          <SubmitButton
            variant="secondary"
            name="channel"
            value="copy"
            disabled={!ready}
            onClick={() => {
              window.open(`mailto:${encodeURIComponent(contact.email!)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, "_blank");
            }}
          >
            <Mail aria-hidden /> Ouvrir dans ma messagerie
          </SubmitButton>
        ) : null}
        {portalAvailable ? (
          <SubmitButton variant="secondary" name="channel" value="portal" disabled={!ready}>
            <MessagesSquare aria-hidden /> Publier dans l’espace partenaire
          </SubmitButton>
        ) : null}
        {emailConfigured && contact?.email ? (
          <SubmitButton name="channel" value="email" disabled={!ready}>
            <Send aria-hidden /> Envoyer par e-mail
          </SubmitButton>
        ) : null}
      </FormActions>
      <p className="text-caption text-ink-500">
        Chaque message est envoyé par vous, un à la fois, et ajouté à l’historique des échanges de l’organisation. Aucun envoi automatique.
      </p>
    </form>
  );
}
