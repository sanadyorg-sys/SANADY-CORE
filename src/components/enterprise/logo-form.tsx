"use client";

import { useActionState, useRef } from "react";
import { Upload } from "lucide-react";
import { Field } from "@/components/ui/field";
import { FormMessage, SubmitButton, useActionToast } from "@/components/ui/form";
import { INITIAL_ACTION_STATE } from "@/lib/types";
import { uploadTenantLogo } from "@/server/actions/logo";

/** Company logo upload (enterprise manager): PNG or JPEG, 1 MB at most, checked on the server. */
export function LogoForm({ tenantId, hasLogo }: { tenantId: string; hasLogo: boolean }) {
  const [state, action] = useActionState(uploadTenantLogo, INITIAL_ACTION_STATE);
  const ref = useRef<HTMLFormElement>(null);
  useActionToast(state, () => ref.current?.reset());
  return (
    <form ref={ref} action={action} className="space-y-3">
      <input type="hidden" name="tenant_id" value={tenantId} />
      {!state.ok && state.message ? <FormMessage state={state} /> : null}
      <Field label={hasLogo ? "Remplacer le logo" : "Logo de l’entreprise"} hint="PNG ou JPEG, 1 Mo au plus, fourni par l’entreprise. Fond transparent ou blanc de préférence." error={state.fieldErrors?.logo}>
        <input
          name="logo"
          type="file"
          accept="image/png,image/jpeg"
          className="block w-full text-label text-ink-700 file:mr-3 file:rounded-md file:border file:border-line-strong file:bg-surface file:px-3 file:py-1.5"
        />
      </Field>
      <SubmitButton variant="secondary">
        <Upload aria-hidden /> Enregistrer le logo
      </SubmitButton>
    </form>
  );
}
