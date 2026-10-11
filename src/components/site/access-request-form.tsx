"use client";

import Link from "next/link";
import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { FormMessage, SubmitButton } from "@/components/ui/form";
import { requestAccess } from "@/server/actions/access-requests";
import { INITIAL_ACTION_STATE } from "@/lib/types";

export function AccessRequestForm({
  courses,
  courseId,
  institution,
}: {
  courses: Array<{ id: string; title: string }>;
  courseId?: string;
  /** Pre-fills the message for an institution partnership request. */
  institution?: boolean;
}) {
  const [state, action] = useActionState(requestAccess, INITIAL_ACTION_STATE);
  const e = state.fieldErrors ?? {};

  if (state.ok) {
    return (
      <div className="flex flex-col items-center py-6 text-center" role="status">
        <span className="flex size-14 items-center justify-center rounded-full bg-success-50 text-success-700">
          <CheckCircle2 className="size-7" aria-hidden />
        </span>
        <h2 className="mt-5 text-[1.375rem] font-bold text-ink-900">Demande envoyée</h2>
        <p className="mt-2 max-w-sm text-body leading-relaxed text-ink-600">{state.message}</p>
        <Link href="/formations" className="mt-6 text-body font-medium text-accent-700 hover:underline">
          Continuer à découvrir les formations
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5" noValidate>
      {state.message ? <FormMessage state={state} /> : null}
      <input type="hidden" name="kind" value={institution ? "institution" : "teacher"} />
      {/* Invisible to people; bots that fill it are ignored. */}
      <div aria-hidden className="absolute -left-[9999px] size-px overflow-hidden">
        <label>
          Site web
          <input type="text" name="site_web" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Prénom" error={e.first_name}>
          <Input name="first_name" autoComplete="given-name" required maxLength={100} />
        </Field>
        <Field label="Nom" error={e.last_name}>
          <Input name="last_name" autoComplete="family-name" required maxLength={100} />
        </Field>
      </div>
      <Field label="Adresse e-mail" hint="L’invitation sera envoyée à cette adresse." error={e.email}>
        <Input name="email" type="email" autoComplete="email" placeholder="nom@exemple.ma" required maxLength={254} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Fonction" optional error={e.job_title}>
          <Input name="job_title" placeholder={institution ? "Directeur, directrice…" : "Professeur des écoles…"} maxLength={150} />
        </Field>
        <Field label="Discipline" optional error={e.subject_area}>
          <Input name="subject_area" placeholder="Français, mathématiques…" maxLength={150} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Établissement" optional={!institution} error={e.institution_name}>
          <Input name="institution_name" autoComplete="organization" maxLength={200} required={institution} />
        </Field>
        <Field label="Ville" optional error={e.city}>
          <Input name="city" autoComplete="address-level2" maxLength={100} />
        </Field>
      </div>
      {courses.length ? (
        <Field label="Formation qui vous intéresse" optional error={e.course_id}>
          <Select name="course_id" defaultValue={courseId ?? ""}>
            <option value="">Aucune en particulier</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      <Field label="Message" optional error={e.message}>
        <Textarea
          name="message"
          rows={4}
          maxLength={1000}
          defaultValue={institution ? "Notre établissement souhaite devenir partenaire de la Fondation Sanady pour former ses enseignants." : undefined}
          placeholder="Présentez-vous en quelques mots et dites-nous ce que vous attendez de la formation."
        />
      </Field>
      <div>
        <Checkbox
          name="consent"
          label="J’accepte que la Fondation Sanady utilise ces informations pour étudier ma demande."
          description={
            <>
              Elles sont conservées 12 mois au plus.{" "}
              <Link href="/confidentialite" className="font-medium text-accent-700 hover:underline">
                Confidentialité et données
              </Link>
            </>
          }
        />
        {e.consent ? <p className="mt-1.5 text-label text-danger-600">{e.consent}</p> : null}
      </div>
      <SubmitButton variant="brand" size="xl" className="w-full">
        Envoyer ma demande
      </SubmitButton>
    </form>
  );
}
