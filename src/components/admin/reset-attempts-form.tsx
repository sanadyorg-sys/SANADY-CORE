"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { RotateCcw } from "lucide-react";
import { resetQuizAttempts } from "@/server/actions/admin";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { FormMessage, SubmitButton } from "@/components/ui/form";
import { Dialog } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/types";

/** Audited reset of exhausted attempts (a reason is mandatory). */
export function ResetAttemptsForm({ quizId, userId, learnerName }: { quizId: string; userId: string; learnerName: string }) {
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const [state, action] = useActionState(async (prev: ActionState, formData: FormData) => {
    const res = await resetQuizAttempts(prev, formData);
    if (res.ok) {
      toast({ tone: "success", title: res.message ?? "Tentatives réinitialisées." });
      setOpen(false);
      router.refresh();
    }
    return res;
  }, INITIAL_ACTION_STATE);

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title="Réinitialiser les tentatives"
      description={`${learnerName} disposera de nouveau de trois tentatives. Les tentatives précédentes restent visibles dans l’historique, marquées comme réinitialisées.`}
      trigger={
        <Button variant="secondary" size="sm">
          <RotateCcw aria-hidden /> Réinitialiser
        </Button>
      }
    >
      <form action={action} className="space-y-4">
        {!state.ok ? <FormMessage state={state} /> : null}
        <input type="hidden" name="quiz_id" value={quizId} />
        <input type="hidden" name="user_id" value={userId} />
        <Field label="Motif" hint="Enregistré dans le journal d’activité." error={state.fieldErrors?.reason}>
          <Textarea name="reason" rows={3} required placeholder="Ex. : entretien d’accompagnement réalisé le 6 octobre." />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <SubmitButton>Réinitialiser</SubmitButton>
        </div>
      </form>
    </Dialog>
  );
}
