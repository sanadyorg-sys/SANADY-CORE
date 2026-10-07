"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { Ban } from "lucide-react";
import { revokeCertificate } from "@/server/actions/admin";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { FormMessage, SubmitButton } from "@/components/ui/form";
import { Dialog } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/types";

export function RevokeCertificateForm({ certificateId, number }: { certificateId: string; number: string }) {
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const [state, action] = useActionState(async (prev: ActionState, formData: FormData) => {
    const res = await revokeCertificate(prev, formData);
    if (res.ok) {
      toast({ tone: "success", title: res.message ?? "Certificat révoqué." });
      setOpen(false);
      router.refresh();
    }
    return res;
  }, INITIAL_ACTION_STATE);

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title={`Révoquer le certificat ${number} ?`}
      description="La révocation est définitive et visible publiquement sur la page de vérification."
      trigger={
        <Button variant="danger-ghost" size="sm">
          <Ban aria-hidden /> Révoquer
        </Button>
      }
    >
      <form action={action} className="space-y-4">
        {!state.ok ? <FormMessage state={state} /> : null}
        <input type="hidden" name="certificate_id" value={certificateId} />
        <Field label="Motif" hint="Communiqué au titulaire et enregistré dans le journal." error={state.fieldErrors?.reason}>
          <Textarea name="reason" rows={3} required />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <SubmitButton variant="danger">Révoquer</SubmitButton>
        </div>
      </form>
    </Dialog>
  );
}
