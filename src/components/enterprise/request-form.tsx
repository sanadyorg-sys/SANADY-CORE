"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, FileText, LoaderCircle, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import { EMPLOYEE_COUNTS, ENTERPRISE_SERVICES, EXISTING_CONTENT, LANGUAGES, type EnterpriseService } from "@/lib/enterprise";
import { ENTERPRISE_STEPS } from "@/lib/enterprise-schema";
import { DOCUMENT_MIME, MAX_DOCUMENT_BYTES, MAX_DOCUMENTS, ORG_TYPES } from "@/lib/partnerships";
import { createClient } from "@/lib/supabase/browser";
import { INITIAL_ACTION_STATE } from "@/lib/types";
import { prepareEnterpriseUpload, submitEnterpriseRequest } from "@/server/actions/enterprise";

const STEPS = ["Organisation", "Contact", "Service", "Besoins", "Documents", "Envoi"] as const;
const DRAFT_KEY = "sanady-entreprise-brouillon";
const STEP_FIELDS: string[][] = ENTERPRISE_STEPS.map((s) => Object.keys(s.shape));
type Doc = { path: string; name: string; size: number };
type Values = Record<string, string>;
const kb = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} Ko` : `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} Mo`);

/**
 * Enterprise request in six steps (brief V3 §6). Same mechanics as the
 * partnership form: one <form> (hidden steps stay mounted), validation per
 * step in the browser and again on the server, manual submission (React
 * would otherwise clear the fields after a refusal), browser-only draft.
 */
export function EnterpriseRequestForm({ defaultService }: { defaultService?: EnterpriseService }) {
  const [state, action, pending] = useActionState(submitEnterpriseRequest, INITIAL_ACTION_STATE);
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [values, setValues] = useState<Values>({});
  const [docs, setDocs] = useState<Doc[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null") as Values | null;
      const form = formRef.current;
      if (!saved || !form) return;
      for (const [k, v] of Object.entries(saved)) {
        const el = form.elements.namedItem(k);
        if (el instanceof HTMLInputElement && el.type === "radio") continue;
        if (el instanceof RadioNodeList) {
          for (const r of Array.from(el)) if (r instanceof HTMLInputElement) r.checked = r.value === v;
        } else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) el.value = v;
      }
    } catch {
      /* storage unavailable */
    }
  }, []);

  const [handled, setHandled] = useState(state);
  if (state !== handled) {
    setHandled(state);
    setErrors(state.fieldErrors ?? {});
    const rejected = state.data?.rejectedPath;
    if (typeof rejected === "string") {
      setDocs((all) => all.filter((d) => d.path !== rejected));
      setUploadError(state.fieldErrors?.documents ?? null);
      setStep(4);
    } else if (state.fieldErrors) {
      const first = STEP_FIELDS.findIndex((f) => f.some((k) => state.fieldErrors?.[k]));
      if (first >= 0) setStep(first);
    }
  }

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
    headingRef.current?.focus();
  }, [step]);

  function read(): Values {
    const v: Values = {};
    for (const [k, val] of new FormData(formRef.current!).entries()) if (typeof val === "string" && !["documents", "consent", "site_web"].includes(k)) v[k] = val;
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
    if (step < ENTERPRISE_STEPS.length) {
      const result = ENTERPRISE_STEPS[step]!.safeParse(read());
      if (!result.success) {
        const e: Record<string, string> = {};
        for (const i of result.error.issues) e[String(i.path[0])] ??= i.message;
        setErrors(e);
        requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], input[name="service"]')?.focus());
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
    if (files.length > MAX_DOCUMENTS - docs.length) return setUploadError(`${MAX_DOCUMENTS} documents maximum.`);
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.type !== DOCUMENT_MIME || !/\.pdf$/i.test(file.name)) throw new Error(`« ${file.name} » n’est pas un PDF.`);
        if (file.size > MAX_DOCUMENT_BYTES) throw new Error(`« ${file.name} » dépasse 10 Mo.`);
        const ticket = await prepareEnterpriseUpload({ name: file.name, size: file.size, type: file.type });
        if (!ticket.ok) throw new Error(ticket.message);
        const { error } = await createClient().storage.from("enterprise").uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: DOCUMENT_MIME });
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
        <h3 className="mt-5 text-[1.375rem] font-bold text-ink-900">Demande envoyée</h3>
        {reference ? (
          <p className="mt-2 text-body text-ink-700">
            Votre référence : <strong className="font-mono">{reference}</strong>
          </p>
        ) : null}
        <p className="mt-2 max-w-md text-body leading-relaxed text-ink-600">
          Merci. Ces services sont en projet : l’équipe de la Fondation Sanady étudiera votre demande et reviendra vers vous, sans engagement de part et
          d’autre.
        </p>
        <Link href="/partenariats" className="mt-6 text-body font-medium text-accent-700 hover:underline">
          Retour à Partenariats &amp; Coopération
        </Link>
      </div>
    );
  }

  const f = (name: string) => ({ name, invalid: Boolean(errors[name]) });
  const E = (name: string) => errors[name];

  return (
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
      <ol className="grid grid-cols-6 gap-1.5" aria-label="Étapes de la demande">
        {STEPS.map((label, i) => (
          <li key={label} className="min-w-0">
            <span className={cn("block h-1.5 rounded-full transition-colors duration-300", i <= step ? "bg-accent-600" : "bg-ink-100")} aria-hidden />
            <span className={cn("mt-1.5 block truncate text-caption", i === step ? "font-semibold text-ink-900 max-sm:overflow-visible" : "text-ink-500 max-sm:sr-only")}>
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
      <div aria-hidden className="absolute -left-[9999px] size-px overflow-hidden">
        <label>
          Site web de contrôle
          <input type="text" name="site_web" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <fieldset hidden={step !== 0} className="space-y-4">
        <legend className="sr-only">Organisation</legend>
        <Field label="Nom de l’organisation" error={E("org_name")}>
          <Input {...f("org_name")} autoComplete="organization" maxLength={200} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Forme juridique / type" error={E("org_type")}>
            <Select {...f("org_type")} defaultValue="">
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
          <Field label="Effectif" error={E("employee_count")}>
            <Select {...f("employee_count")} defaultValue="">
              <option value="" disabled>
                Choisir…
              </option>
              {Object.entries(EMPLOYEE_COUNTS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v} salariés
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Pays" error={E("country")}>
            <Input {...f("country")} defaultValue="Maroc" maxLength={80} />
          </Field>
          <Field label="Ville" optional error={E("city")}>
            <Input {...f("city")} maxLength={100} />
          </Field>
          <Field label="Secteur d’activité" optional error={E("sector")}>
            <Input {...f("sector")} maxLength={150} />
          </Field>
          <Field label="Site web" optional error={E("website")}>
            <Input {...f("website")} inputMode="url" placeholder="www.exemple.ma" maxLength={300} />
          </Field>
        </div>
      </fieldset>

      <fieldset hidden={step !== 1} className="space-y-4">
        <legend className="sr-only">Contact</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom complet" error={E("contact_name")}>
            <Input {...f("contact_name")} autoComplete="name" maxLength={150} />
          </Field>
          <Field label="Fonction" error={E("contact_title")}>
            <Input {...f("contact_title")} autoComplete="organization-title" maxLength={150} />
          </Field>
          <Field label="Adresse e-mail professionnelle" error={E("contact_email")}>
            <Input {...f("contact_email")} type="email" autoComplete="email" maxLength={254} />
          </Field>
          <Field label="Téléphone" optional error={E("contact_phone")}>
            <Input {...f("contact_phone")} type="tel" autoComplete="tel" maxLength={40} />
          </Field>
        </div>
      </fieldset>

      <fieldset hidden={step !== 2} className="space-y-3">
        <legend className="text-label font-medium text-ink-800">Service souhaité</legend>
        {(Object.keys(ENTERPRISE_SERVICES) as EnterpriseService[]).map((k) => (
          <label
            key={k}
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-4 transition has-[:checked]:border-accent-600 has-[:checked]:bg-accent-50/50 hover:border-line-strong"
          >
            <input type="radio" name="service" value={k} defaultChecked={k === defaultService} className="mt-1 size-4 accent-accent-600" />
            <span>
              <span className="block text-card font-semibold text-ink-900">{ENTERPRISE_SERVICES[k].label}</span>
              <span className="mt-0.5 block text-label text-ink-600">{ENTERPRISE_SERVICES[k].text}</span>
            </span>
          </label>
        ))}
        {E("service") ? (
          <p className="text-caption font-medium text-danger-600" role="alert">
            {E("service")}
          </p>
        ) : null}
      </fieldset>

      <fieldset hidden={step !== 3} className="space-y-4">
        <legend className="sr-only">Besoins de formation</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Thème de la formation" error={E("topic")}>
            <Input {...f("topic")} placeholder="Ex. : sécurité au travail" maxLength={200} />
          </Field>
          <Field label="Nombre estimé d’apprenants" optional error={E("learner_count")}>
            <Input {...f("learner_count")} inputMode="numeric" maxLength={9} />
          </Field>
        </div>
        <Field label="Public concerné" error={E("target_population")}>
          <Input {...f("target_population")} placeholder="Ex. : managers de proximité, nouveaux collaborateurs…" maxLength={500} />
        </Field>
        <Field label="Résultats attendus" hint="Ce que les collaborateurs doivent savoir faire à l’issue de la formation (20 caractères minimum)." error={E("outcomes")}>
          <Textarea {...f("outcomes")} rows={4} maxLength={3000} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contenus existants" error={E("existing_content")}>
            <Select {...f("existing_content")} defaultValue="">
              <option value="" disabled>
                Choisir…
              </option>
              {Object.entries(EXISTING_CONTENT).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Langue de la formation" error={E("language")}>
            <Select {...f("language")} defaultValue="fr">
              {Object.entries(LANGUAGES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Calendrier souhaité" optional error={E("timeline")}>
            <Input {...f("timeline")} placeholder="Ex. : avant juin 2027" maxLength={150} />
          </Field>
        </div>
        <Field label="Suivi et rapports attendus" optional error={E("reporting")}>
          <Textarea {...f("reporting")} rows={2} maxLength={1000} />
        </Field>
        <Field label="Besoins d’accessibilité" optional error={E("accessibility")}>
          <Textarea {...f("accessibility")} rows={2} maxLength={1000} />
        </Field>
        <Field label="Informations complémentaires" optional error={E("extra")}>
          <Textarea {...f("extra")} rows={2} maxLength={2000} />
        </Field>
      </fieldset>

      <fieldset hidden={step !== 4} className="space-y-4">
        <legend className="sr-only">Documents</legend>
        <p className="text-body text-ink-600">Facultatif : cahier des charges, programme ou supports existants, au format PDF ({MAX_DOCUMENTS} documents, 10 Mo chacun au maximum).</p>
        <input type="hidden" name="documents" value={JSON.stringify(docs.map(({ path, name }) => ({ path, name })))} />
        {docs.length ? (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {docs.map((d) => (
              <li key={d.path} className="flex items-center gap-3 px-4 py-3">
                <FileText className="size-5 shrink-0 text-accent-700" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-body text-ink-800">{d.name}</span>
                <span className="text-caption text-ink-500">{kb(d.size)}</span>
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
            <span className="text-caption text-ink-500">Stocké de façon privée, consulté uniquement par l’équipe de la Fondation.</span>
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

      <fieldset hidden={step !== 5} className="space-y-4">
        <legend className="sr-only">Récapitulatif</legend>
        <dl className="divide-y divide-line rounded-xl border border-line text-body">
          {[
            ["Organisation", `${values.org_name ?? ""} — ${EMPLOYEE_COUNTS[values.employee_count as keyof typeof EMPLOYEE_COUNTS] ?? ""} salariés`],
            ["Contact", `${values.contact_name ?? ""}, ${values.contact_title ?? ""} — ${values.contact_email ?? ""}`],
            ["Service", ENTERPRISE_SERVICES[values.service as EnterpriseService]?.label ?? ""],
            ["Thème", values.topic ?? ""],
            ["Public", `${values.target_population ?? ""}${values.learner_count ? ` (${values.learner_count} apprenants)` : ""}`],
            ["Résultats attendus", values.outcomes ?? ""],
            ["Documents", docs.length ? docs.map((d) => d.name).join(", ") : "Aucun"],
          ].map(([k, v]) => (
            <div key={k} className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_1fr]">
              <dt className="font-medium text-ink-600">{k}</dt>
              <dd className="whitespace-pre-line break-words text-ink-900">{v}</dd>
            </div>
          ))}
        </dl>
        <Checkbox
          name="consent"
          label={
            <>
              J’accepte que la Fondation Sanady utilise ces informations pour étudier cette demande et me recontacter. Elles sont accessibles
              uniquement à l’équipe concernée et conservées 24 mois au plus si la demande n’aboutit pas.{" "}
              <Link href="/confidentialite#entreprises" className="font-medium text-accent-700 hover:underline">
                Confidentialité et données
              </Link>
            </>
          }
        />
        {E("consent") ? (
          <p className="text-label font-medium text-danger-600" role="alert">
            {E("consent")}
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
          <Button key="next" type="button" variant="accent" onClick={next} disabled={uploading}>
            Continuer <ArrowRight aria-hidden />
          </Button>
        ) : (
          <Button key="send" type="submit" variant="accent" loading={pending}>
            Envoyer la demande
          </Button>
        )}
      </div>
    </form>
  );
}
