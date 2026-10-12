"use client";

import { useActionState, useRef, useState } from "react";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { FormActions, FormMessage, SubmitButton, useActionToast } from "@/components/ui/form";
import { COURSE_OWNERSHIP, LANGUAGES, TASK_KINDS, TRAINING_STATUS, type TrainingStatus } from "@/lib/enterprise";
import { INITIAL_ACTION_STATE } from "@/lib/types";
import { assignProjectTrainer, recordTrainingReview, saveOutlineItem, saveTrainingProject, saveTrainingTask, setTrainingStatus } from "@/server/actions/studio";
import type { ProjectDetail } from "@/server/queries/studio";

/** Forms of the custom training production studio (phase E4). */

type Option = { id: string; label: string };

export function ProjectForm({
  organizationId,
  project: p,
  tenants,
  proposals,
  team,
}: {
  organizationId: string;
  project?: ProjectDetail;
  tenants: Option[];
  proposals: Option[];
  team: Option[];
}) {
  const [state, action] = useActionState(saveTrainingProject, INITIAL_ACTION_STATE);
  useActionToast(state);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={p?.id ?? ""} />
      <input type="hidden" name="organization_id" value={organizationId} />
      {!state.ok && state.message ? <FormMessage state={state} /> : null}
      <Field label="Intitulé de la formation" error={e.title}>
        <Input name="title" defaultValue={p?.title} maxLength={200} />
      </Field>
      <Field label="Public visé" error={e.target_audience}>
        <Input name="target_audience" defaultValue={p?.target_audience} maxLength={1000} placeholder="Ex. 300 opérateurs de production" />
      </Field>
      <Field label="Objectifs de formation" optional hint="Ce que les collaborateurs sauront faire à la fin. Obligatoire pour passer à la conception." error={e.objectives}>
        <Textarea name="objectives" rows={4} defaultValue={p?.objectives ?? ""} maxLength={4000} />
      </Field>
      <Field label="Contraintes et exigences du client" optional error={e.constraints}>
        <Textarea name="constraints" rows={2} defaultValue={p?.constraints ?? ""} maxLength={2000} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Langue" error={e.language}>
          <Select name="language" defaultValue={p?.language ?? "fr"}>
            {Object.entries(LANGUAGES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Durée visée (minutes)" optional error={e.target_minutes}>
          <Input name="target_minutes" inputMode="numeric" defaultValue={p?.target_minutes ?? ""} />
        </Field>
        <Field label="Échéance" optional error={e.due_on}>
          <Input name="due_on" type="date" defaultValue={p?.due_on ?? ""} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Propriété du contenu" error={e.ownership}>
          <Select name="ownership" defaultValue={p?.ownership ?? "company"}>
            {(["company", "joint", "licensed"] as const).map((k) => (
              <option key={k} value={k}>
                {COURSE_OWNERSHIP[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Espace de formation du client" optional hint="Nécessaire pour une formation appartenant à l’entreprise." error={e.tenant_id}>
          <Select name="tenant_id" defaultValue={p?.tenant_id ?? ""}>
            <option value="">Aucun pour l’instant</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Proposition commerciale" optional error={e.proposal_id}>
          <Select name="proposal_id" defaultValue={p?.proposal_id ?? ""}>
            <option value="">Non rattachée</option>
            {proposals.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Responsable du projet" optional error={e.lead_id}>
          <Select name="lead_id" defaultValue={p?.lead_id ?? ""}>
            <option value="">Moi</option>
            {team.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Checkbox
        name="client_review_required"
        defaultChecked={p?.client_review_required ?? true}
        label="Revue du client prévue au contrat"
        description="Le client valide le programme avant la validation institutionnelle."
      />
      <FormActions>
        <SubmitButton>{p ? "Enregistrer" : "Créer le projet"}</SubmitButton>
      </FormActions>
    </form>
  );
}

export function OutlineForm({ projectId, item }: { projectId: string; item?: { id: string; title: string; description: string | null } }) {
  const [state, action] = useActionState(saveOutlineItem, INITIAL_ACTION_STATE);
  const ref = useRef<HTMLFormElement>(null);
  useActionToast(state, () => (item ? undefined : ref.current?.reset()));
  return (
    <form ref={ref} action={action} className="space-y-3">
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="id" value={item?.id ?? ""} />
      {!state.ok && state.message ? <FormMessage state={state} /> : null}
      <Field label="Module" error={state.fieldErrors?.title}>
        <Input name="title" defaultValue={item?.title} maxLength={200} placeholder="Ex. Les règles de sécurité au poste" />
      </Field>
      <Field label="Contenu prévu" optional error={state.fieldErrors?.description}>
        <Textarea name="description" rows={2} defaultValue={item?.description ?? ""} maxLength={2000} />
      </Field>
      <FormActions>
        <SubmitButton variant="secondary">{item ? "Modifier" : "Ajouter au programme"}</SubmitButton>
      </FormActions>
    </form>
  );
}

export function TrainerForm({ projectId, trainers }: { projectId: string; trainers: Option[] }) {
  const [state, action] = useActionState(assignProjectTrainer, INITIAL_ACTION_STATE);
  useActionToast(state);
  if (!trainers.length) return <p className="text-caption text-ink-500">Aucun formateur disponible. Attribuez le rôle dans « Équipe SANADY ».</p>;
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="project_id" value={projectId} />
      <Field label="Ajouter un formateur" error={state.fieldErrors?.user_id} className="min-w-0 flex-1">
        <Select name="user_id" defaultValue="">
          <option value="" disabled>
            Choisir…
          </option>
          {trainers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </Select>
      </Field>
      <SubmitButton variant="secondary">Ajouter</SubmitButton>
    </form>
  );
}

export function TaskForm({ projectId, team }: { projectId: string; team: Option[] }) {
  const [state, action] = useActionState(saveTrainingTask, INITIAL_ACTION_STATE);
  const ref = useRef<HTMLFormElement>(null);
  useActionToast(state, () => ref.current?.reset());
  const e = state.fieldErrors ?? {};
  return (
    <form ref={ref} action={action} className="space-y-3">
      <input type="hidden" name="project_id" value={projectId} />
      {!state.ok && state.message ? <FormMessage state={state} /> : null}
      <div className="grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)]">
        <Field label="Type" error={e.kind}>
          <Select name="kind" defaultValue="video">
            {Object.entries(TASK_KINDS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tâche" error={e.title}>
          <Input name="title" maxLength={200} placeholder="Ex. Tourner la vidéo du module 1" />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Attribuée à" optional error={e.assigned_to}>
          <Select name="assigned_to" defaultValue="">
            <option value="">Personne pour l’instant</option>
            {team.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Échéance" optional error={e.due_on}>
          <Input name="due_on" type="date" />
        </Field>
      </div>
      <FormActions>
        <SubmitButton variant="secondary">Ajouter la tâche</SubmitButton>
      </FormActions>
    </form>
  );
}

export function ReviewForm({ projectId, kind, institutionId }: { projectId: string; kind: "internal" | "client"; institutionId?: string }) {
  const [state, action] = useActionState(recordTrainingReview, INITIAL_ACTION_STATE);
  useActionToast(state);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="institution_id" value={institutionId ?? ""} />
      {!state.ok && state.message ? <FormMessage state={state} /> : null}
      <Field label="Décision" error={state.fieldErrors?.decision}>
        <Select name="decision" defaultValue="">
          <option value="" disabled>
            Choisir…
          </option>
          <option value="approved">{kind === "internal" ? "Valider sur le plan pédagogique" : "Valider le programme"}</option>
          <option value="changes_requested">Demander des modifications</option>
        </Select>
      </Field>
      <Field label="Commentaires" optional hint="Obligatoires pour une demande de modifications." error={state.fieldErrors?.comment}>
        <Textarea name="comment" rows={3} maxLength={4000} />
      </Field>
      <FormActions>
        <SubmitButton>Enregistrer</SubmitButton>
      </FormActions>
    </form>
  );
}

const ACTION_LABELS: Partial<Record<TrainingStatus, string>> = {
  design: "Passer à la conception",
  production: "Passer en production",
  internal_review: "Soumettre à la revue pédagogique",
  approved: "Approuver (validation institutionnelle)",
  launched: "Lancer dans l’espace du client",
  cancelled: "Annuler le projet",
};

export function TrainingStatusForm({ id, from, options }: { id: string; from: TrainingStatus; options: TrainingStatus[] }) {
  const [state, action] = useActionState(setTrainingStatus, INITIAL_ACTION_STATE);
  useActionToast(state);
  const [choice, setChoice] = useState("");
  if (!options.length) return <p className="text-body text-ink-600">Aucune action disponible pour votre rôle à ce stade.</p>;
  const label = (s: TrainingStatus) =>
    s === "production" && from === "approval" ? "Renvoyer en production (refus)" : s === "production" && from === "launched" ? "Préparer une nouvelle version" : (ACTION_LABELS[s] ?? TRAINING_STATUS[s].label);
  const needsNote = choice === "cancelled" || (choice === "production" && from === "approval");
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
              {label(o)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={needsNote ? "Motif" : "Commentaire (historique)"} optional={!needsNote} error={state.fieldErrors?.note}>
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
