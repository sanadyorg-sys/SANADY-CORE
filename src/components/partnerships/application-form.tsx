"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, FileText, LoaderCircle, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import {
  CONTRIBUTION_TYPES,
  DOCUMENT_MIME,
  FIELD_SLUGS,
  INTERVENTION_FIELDS,
  MAX_DOCUMENT_BYTES,
  MAX_DOCUMENTS,
  ORG_TYPES,
  type InterventionField,
} from "@/lib/partnerships";
import { STEP_SCHEMAS } from "@/lib/partnerships-schema";
import { createClient } from "@/lib/supabase/browser";
import { INITIAL_ACTION_STATE } from "@/lib/types";
import { preparePartnershipUpload, submitPartnershipApplication } from "@/server/actions/partnerships";

const STEPS = ["Organisation", "Contact", "Partenariat", "Documents", "Récapitulatif"] as const;
const DRAFT_KEY = "sanady-partenariat-brouillon";
/** Fields of each step (used to jump to the step of a server-side error). */
const STEP_FIELDS: string[][] = STEP_SCHEMAS.map((s) => Object.keys(s.shape));

type Doc = { path: string; name: string; size: number };
type Values = Record<string, string>;

const formatSize = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} Ko` : `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} Mo`);

/**
 * Partnership application in five steps (brief V2 §6). Every field stays in
 * one <form> (hidden steps are not unmounted) so the final submission sends
 * everything; each step is validated in the browser before moving on, and
 * the whole application again on the server. The draft (never the
 * documents) is kept in this browser only, until it is sent.
 */
export function PartnershipApplicationForm({
  defaultField,
  projects = [],
  defaultProject,
}: {
  defaultField?: InterventionField;
  /** Open projects published by the Foundation (optional link). */
  projects?: Array<{ reference: string; title: string }>;
  defaultProject?: string;
}) {
  const [state, action, pending] = useActionState(submitPartnershipApplication, INITIAL_ACTION_STATE);
  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [values, setValues] = useState<Values>({});
  const [docs, setDocs] = useState<Doc[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Restore the draft once.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Values;
      const form = formRef.current;
      if (!form) return;
      for (const [k, v] of Object.entries(saved)) {
        const el = form.elements.namedItem(k);
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) el.value = v;
      }
    } catch {
      /* storage unavailable: start empty */
    }
  }, []);

  // Server-side errors: show them on the first step concerned (adjusted during
  // render when a new result arrives, as React recommends).
  const [handled, setHandled] = useState(state);
  if (state !== handled) {
    setHandled(state);
    setErrors(state.fieldErrors ?? {});
    const rejected = state.data?.rejectedPath;
    if (typeof rejected === "string") {
      setDocs((all) => all.filter((d) => d.path !== rejected));
      setUploadError(state.fieldErrors?.documents ?? null);
      setStep(3);
    } else if (state.fieldErrors) {
      const first = STEP_FIELDS.findIndex((fields) => fields.some((f) => state.fieldErrors?.[f]));
      if (first >= 0) setStep(first);
    }
  }

  // A sent application leaves no draft behind.
  useEffect(() => {
    if (state.ok) {
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
      }
    }
  }, [state]);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: false });
  }, [step]);

  function read(): Values {
    const fd = new FormData(formRef.current!);
    const v: Values = {};
    for (const [k, val] of fd.entries()) if (typeof val === "string" && k !== "documents" && k !== "consent" && k !== "site_web") v[k] = val;
    return v;
  }

  function saveDraft() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(read()));
    } catch {
      /* ignore */
    }
  }

  function next() {
    if (step < STEP_SCHEMAS.length) {
      const result = STEP_SCHEMAS[step]!.safeParse(read());
      if (!result.success) {
        const e: Record<string, string> = {};
        for (const issue of result.error.issues) e[String(issue.path[0])] ??= issue.message;
        setErrors(e);
        requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
        return;
      }
    }
    setErrors({});
    if (step === STEPS.length - 2) setValues(read());
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function addFiles(files: FileList | null) {
    setUploadError(null);
    if (!files?.length) return;
    const room = MAX_DOCUMENTS - docs.length;
    if (files.length > room) {
      setUploadError(`${MAX_DOCUMENTS} documents maximum.`);
      return;
    }
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.type !== DOCUMENT_MIME || !/\.pdf$/i.test(file.name)) throw new Error(`« ${file.name} » n’est pas un PDF.`);
        if (file.size > MAX_DOCUMENT_BYTES) throw new Error(`« ${file.name} » dépasse 10 Mo.`);
        const ticket = await preparePartnershipUpload({ name: file.name, size: file.size, type: file.type });
        if (!ticket.ok) throw new Error(ticket.message);
        const { error } = await createClient().storage.from("partnerships").uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: DOCUMENT_MIME });
        if (error) throw new Error(`« ${file.name} » n’a pas pu être envoyé. Réessayez.`);
        setDocs((d) => [...d, { path: ticket.path, name: file.name, size: file.size }]);
      }
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Le document n’a pas pu être envoyé.");
    } finally {
      setUploading(false);
    }
  }

  if (state.ok) {
    const reference = state.data?.reference as string | null | undefined;
    return (
      <div className="flex flex-col items-center py-8 text-center" role="status">
        <span className="flex size-14 items-center justify-center rounded-full bg-success-50 text-success-700">
          <CheckCircle2 className="size-7" aria-hidden />
        </span>
        <h3 className="mt-5 text-[1.375rem] font-bold text-ink-900">Candidature envoyée</h3>
        {reference ? (
          <p className="mt-2 text-body text-ink-700">
            Votre référence : <strong className="font-mono">{reference}</strong>
          </p>
        ) : null}
        <p className="mt-2 max-w-md text-body leading-relaxed text-ink-600">
          Merci pour votre intérêt. L’équipe partenariats de la Fondation Sanady étudiera votre proposition et reviendra vers vous à l’adresse
          indiquée. Conservez votre référence pour tout échange.
        </p>
        <Link href="/partenariats" className="mt-6 text-body font-medium text-accent-700 hover:underline">
          Retour à la page Partenariats
        </Link>
      </div>
    );
  }

  const field = (name: string) => ({ name, invalid: Boolean(errors[name]) });

  return (
    // Submitted by hand (not through the action prop): React would otherwise clear
    // every field after a refused submission, losing five steps of input.
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        if (step < STEPS.length - 1) return next();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
      onChange={saveDraft}
      noValidate
      className="space-y-6"
    >
      {/* Progress */}
      <ol className="grid grid-cols-5 gap-1.5" aria-label="Étapes de la candidature">
        {STEPS.map((label, i) => (
          <li key={label} className="min-w-0">
            <span className={cn("block h-1.5 rounded-full transition-colors duration-300", i <= step ? "bg-accent-600" : "bg-ink-100")} aria-hidden />
            <span className={cn("mt-1.5 block truncate text-caption", i === step ? "font-semibold text-ink-900 max-sm:overflow-visible max-sm:whitespace-nowrap" : "text-ink-500 max-sm:sr-only")}>
              <span className="sr-only">{i < step ? "Terminé : " : i === step ? "Étape en cours : " : "À venir : "}</span>
              {i + 1}. {label}
            </span>
          </li>
        ))}
      </ol>

      <h3 ref={headingRef} tabIndex={-1} className="text-section font-bold text-ink-900 outline-none">
        Étape {step + 1} sur {STEPS.length} — {STEPS[step]}
      </h3>

      {state.message && !state.ok && !state.data?.rejectedPath ? <FormMessage state={state} /> : null}

      {/* Invisible to people; bots that fill it are ignored. */}
      <div aria-hidden className="absolute -left-[9999px] size-px overflow-hidden">
        <label>
          Site web de contrôle
          <input type="text" name="site_web" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {/* Step 1 — Organisation */}
      <fieldset hidden={step !== 0} className="space-y-4">
        <legend className="sr-only">Organisation</legend>
        <Field label="Nom de l’organisation" error={errors.org_name}>
          <Input {...field("org_name")} autoComplete="organization" maxLength={200} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type d’organisation" error={errors.org_type}>
            <Select {...field("org_type")} defaultValue="">
              <option value="" disabled>
                Choisir…
              </option>
              {Object.entries(ORG_TYPES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Secteur d’activité" optional error={errors.sector}>
            <Input {...field("sector")} maxLength={150} />
          </Field>
          <Field label="Pays" error={errors.country}>
            <Input {...field("country")} autoComplete="country-name" defaultValue="Maroc" maxLength={80} />
          </Field>
          <Field label="Ville" optional error={errors.city}>
            <Input {...field("city")} autoComplete="address-level2" maxLength={100} />
          </Field>
        </div>
        <Field label="Site web" optional error={errors.website}>
          <Input {...field("website")} inputMode="url" autoComplete="url" placeholder="www.exemple.ma" maxLength={300} />
        </Field>
        <Field label="Présentation de l’organisation" hint="Activités, engagement, lien avec l’éducation (20 caractères minimum)." error={errors.org_description}>
          <Textarea {...field("org_description")} rows={4} maxLength={2000} />
        </Field>
      </fieldset>

      {/* Step 2 — Contact */}
      <fieldset hidden={step !== 1} className="space-y-4">
        <legend className="sr-only">Personne de contact</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom complet" error={errors.contact_name}>
            <Input {...field("contact_name")} autoComplete="name" maxLength={150} />
          </Field>
          <Field label="Fonction" error={errors.contact_title}>
            <Input {...field("contact_title")} autoComplete="organization-title" maxLength={150} />
          </Field>
          <Field label="Adresse e-mail professionnelle" error={errors.contact_email}>
            <Input {...field("contact_email")} type="email" autoComplete="email" maxLength={254} />
          </Field>
          <Field label="Téléphone professionnel" optional error={errors.contact_phone}>
            <Input {...field("contact_phone")} type="tel" autoComplete="tel" maxLength={40} />
          </Field>
        </div>
      </fieldset>

      {/* Step 3 — Partnership interest */}
      <fieldset hidden={step !== 2} className="space-y-4">
        <legend className="sr-only">Votre proposition</legend>
        {projects.length ? (
          <Field label="Projet concerné" optional hint="Si vous répondez à un projet publié, son domaine d’intervention est retenu." error={errors.opportunity}>
            <Select {...field("opportunity")} defaultValue={defaultProject ?? ""}>
              <option value="">Proposition libre (aucun projet précis)</option>
              {projects.map((p) => (
                <option key={p.reference} value={p.reference}>
                  {p.reference} — {p.title}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Domaine d’intervention de la Fondation" error={errors.intervention_field}>
            <Select {...field("intervention_field")} defaultValue={defaultField ?? ""}>
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
          <Field label="Type de contribution" error={errors.contribution_type}>
            <Select {...field("contribution_type")} defaultValue="">
              <option value="" disabled>
                Choisir…
              </option>
              {Object.entries(CONTRIBUTION_TYPES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Contribution proposée" hint="Ce que votre organisation peut apporter (10 caractères minimum)." error={errors.contribution}>
          <Textarea {...field("contribution")} rows={3} maxLength={2000} />
        </Field>
        <Field label="Coopération envisagée" hint="Projet, public concerné, objectifs (30 caractères minimum)." error={errors.cooperation}>
          <Textarea {...field("cooperation")} rows={5} maxLength={4000} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Calendrier souhaité" optional error={errors.timeline}>
            <Input {...field("timeline")} placeholder="Ex. : année scolaire 2026-2027" maxLength={150} />
          </Field>
        </div>
        <Field label="Informations complémentaires" optional error={errors.extra}>
          <Textarea {...field("extra")} rows={3} maxLength={2000} />
        </Field>
      </fieldset>

      {/* Step 4 — Documents */}
      <fieldset hidden={step !== 3} className="space-y-4">
        <legend className="sr-only">Documents</legend>
        <p className="text-body text-ink-600">
          Facultatif : joignez une présentation ou une proposition au format PDF ({MAX_DOCUMENTS} documents, 10 Mo chacun au maximum).
        </p>
        <input type="hidden" name="documents" value={JSON.stringify(docs.map(({ path, name }) => ({ path, name })))} />
        {docs.length ? (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {docs.map((d) => (
              <li key={d.path} className="flex items-center gap-3 px-4 py-3">
                <FileText className="size-5 shrink-0 text-accent-700" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-body text-ink-800">{d.name}</span>
                <span className="text-caption text-ink-500">{formatSize(d.size)}</span>
                <Button type="button" variant="ghost" size="icon-sm" aria-label={`Retirer ${d.name}`} onClick={() => setDocs((all) => all.filter((x) => x.path !== d.path))}>
                  <Trash2 aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
        {docs.length < MAX_DOCUMENTS ? (
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-line-strong px-6 py-8 text-center transition hover:border-accent-600 hover:bg-accent-50/40 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent-600">
            {uploading ? <LoaderCircle className="size-6 animate-spin text-accent-700" aria-hidden /> : <Upload className="size-6 text-accent-700" aria-hidden />}
            <span className="text-body font-semibold text-ink-900">{uploading ? "Envoi en cours…" : "Ajouter un document PDF"}</span>
            <span className="text-caption text-ink-500">Stocké de façon privée, consulté uniquement par l’équipe partenariats.</span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              multiple
              disabled={uploading}
              className="sr-only"
              onChange={(e) => {
                void addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        ) : null}
        {uploadError ? (
          <p className="text-label font-medium text-danger-600" role="alert">
            {uploadError}
          </p>
        ) : null}
      </fieldset>

      {/* Step 5 — Review */}
      <fieldset hidden={step !== 4} className="space-y-4">
        <legend className="sr-only">Récapitulatif</legend>
        <dl className="divide-y divide-line rounded-xl border border-line text-body">
          {[
            ["Organisation", `${values.org_name ?? ""} — ${ORG_TYPES[values.org_type as keyof typeof ORG_TYPES] ?? ""}`],
            ["Pays / ville", [values.country, values.city].filter(Boolean).join(", ")],
            ["Contact", `${values.contact_name ?? ""}, ${values.contact_title ?? ""} — ${values.contact_email ?? ""}`],
            ...(values.opportunity ? [["Projet", projects.find((p) => p.reference === values.opportunity)?.title ?? values.opportunity]] : []),
            ["Domaine", INTERVENTION_FIELDS[values.intervention_field as InterventionField]?.name ?? ""],
            ["Contribution", CONTRIBUTION_TYPES[values.contribution_type as keyof typeof CONTRIBUTION_TYPES] ?? ""],
            ["Contribution proposée", values.contribution ?? ""],
            ["Coopération envisagée", values.cooperation ?? ""],
            ["Documents", docs.length ? docs.map((d) => d.name).join(", ") : "Aucun"],
          ].map(([k, v]) => (
            <div key={k} className="grid gap-1 px-4 py-3 sm:grid-cols-[11rem_1fr]">
              <dt className="font-medium text-ink-600">{k}</dt>
              <dd className="whitespace-pre-line break-words text-ink-900">{v}</dd>
            </div>
          ))}
        </dl>
        <Checkbox
          name="consent"
          label={
            <>
              J’accepte que la Fondation Sanady utilise ces informations pour étudier cette proposition de partenariat et me recontacter. Elles sont
              accessibles uniquement à l’équipe partenariats et conservées 24 mois au plus si la proposition n’aboutit pas.{" "}
              <Link href="/confidentialite#partenariats" className="font-medium text-accent-700 hover:underline">
                Confidentialité et données
              </Link>
            </>
          }
        />
        {errors.consent ? (
          <p className="text-label font-medium text-danger-600" role="alert">
            {errors.consent}
          </p>
        ) : null}
      </fieldset>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        {step > 0 ? (
          <Button type="button" variant="secondary" onClick={() => setStep((s) => s - 1)}>
            <ArrowLeft aria-hidden /> Précédent
          </Button>
        ) : (
          <span />
        )}
        {step < STEPS.length - 1 ? (
          // Distinct keys: React must not turn this button into the submit button
          // during its own click (that would send the application immediately).
          <Button key="next" type="button" variant="accent" onClick={next} disabled={uploading}>
            Continuer <ArrowRight aria-hidden />
          </Button>
        ) : (
          <Button key="send" type="submit" variant="accent" loading={pending}>
            Envoyer la candidature
          </Button>
        )}
      </div>
    </form>
  );
}
