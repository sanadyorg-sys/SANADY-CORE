"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createInvitation } from "@/server/actions/invitations";
import { CopyButton } from "@/components/ui/copy-button";
import { Field, Input, Select } from "@/components/ui/field";
import { FormMessage, SubmitButton } from "@/components/ui/form";
import { Alert } from "@/components/ui/surface";
import { useToast } from "@/components/ui/toast";
import { INVITATION_KINDS } from "@/lib/labels";
import { INITIAL_ACTION_STATE, type InvitationKind } from "@/lib/types";

/**
 * Invitation form. When e-mail delivery is not configured (or fails), the
 * single-use link is shown so the administrator can transmit it — this is
 * stated explicitly; the UI never pretends an e-mail was sent.
 */
export function InviteForm({
  kinds,
  institutions,
  fixedInstitutionId,
  defaultKind,
}: {
  kinds: InvitationKind[];
  institutions?: Array<{ id: string; name: string }>;
  fixedInstitutionId?: string;
  defaultKind?: InvitationKind;
}) {
  const [state, action] = useActionState(createInvitation, INITIAL_ACTION_STATE);
  const [kind, setKind] = useState<InvitationKind>(defaultKind ?? kinds[0]!);
  const formRef = useRef<HTMLFormElement>(null);
  const toast = useToast();
  const needsInstitution = kind === "institution_admin" || kind === "institution_teacher";
  const link = state.ok ? (state.data?.link as string | undefined) : undefined;

  useEffect(() => {
    if (state.ok && !state.data?.link) {
      toast({ tone: "success", title: state.message ?? "Invitation envoyée." });
      formRef.current?.reset();
    }
  }, [state, toast]);

  return (
    <div className="space-y-4">
      {link ? (
        <Alert tone="warning" title="Invitation créée — e-mail non envoyé">
          <p>{state.message}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="max-w-full truncate rounded-sm bg-white/70 px-2 py-1 font-mono text-caption text-ink-800">{link}</code>
            <CopyButton value={link} label="Copier le lien" />
          </div>
          <p className="mt-2 text-caption">Ce lien est personnel, à usage unique, et ne sera plus affiché.</p>
        </Alert>
      ) : null}
      {!state.ok ? <FormMessage state={state} /> : null}

      <form ref={formRef} action={action} className="space-y-4" noValidate>
        {kinds.length > 1 ? (
          <Field label="Type d’invitation">
            <Select name="kind" value={kind} onChange={(e) => setKind(e.target.value as InvitationKind)}>
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {INVITATION_KINDS[k]}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <input type="hidden" name="kind" value={kind} />
        )}

        {fixedInstitutionId ? (
          <input type="hidden" name="institution_id" value={fixedInstitutionId} />
        ) : needsInstitution ? (
          <Field label="Établissement" error={state.fieldErrors?.institution_id}>
            <Select name="institution_id" defaultValue="" required>
              <option value="" disabled>
                Sélectionner un établissement
              </option>
              {(institutions ?? []).map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <input type="hidden" name="institution_id" value="" />
        )}

        <Field
          label="Adresse e-mail"
          hint="La personne recevra un lien personnel, valable pendant la durée définie dans les paramètres."
          error={state.fieldErrors?.email}
        >
          <Input name="email" type="email" autoComplete="off" required />
        </Field>
        <div className="flex justify-end">
          <SubmitButton>Envoyer l’invitation</SubmitButton>
        </div>
      </form>
    </div>
  );
}
