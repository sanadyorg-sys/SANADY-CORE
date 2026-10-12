import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Megaphone } from "lucide-react";
import { OpportunityCard } from "@/components/partnerships/opportunity-card";
import { buttonClasses } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { CONTRIBUTION_TYPES, FIELD_SLUGS, INTERVENTION_FIELDS } from "@/lib/partnerships";
import { publicOpportunities } from "@/server/queries/partnerships";

/** Public directory of projects seeking partners (brief V2 §5). Hidden like /partenariats. */
export const metadata: Metadata = {
  title: "Projets à la recherche de partenaires",
  description: "Les projets éducatifs validés par la Fondation Sanady, ouverts aux partenaires.",
  robots: { index: false, follow: false },
};

const STATUSES = { ouverts: "Ouverts", clotures: "Clôturés", tous: "Tous" } as const;

export default async function OpportunitiesDirectory(props: PageProps<"/partenariats/opportunites">) {
  const sp = await props.searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim() : "");
  const domaine = str("domaine");
  const contribution = str("contribution");
  const zone = str("zone").slice(0, 80);
  const statut = (str("statut") in STATUSES ? str("statut") : "ouverts") as keyof typeof STATUSES;

  const all = await publicOpportunities();
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const list = all.filter(
    (o) =>
      (!domaine || o.intervention_field === domaine) &&
      (!contribution || o.contribution_types.includes(contribution as never)) &&
      (!zone || norm(o.geographic_scope ?? "").includes(norm(zone))) &&
      (statut === "tous" || (statut === "ouverts" ? o.open : !o.open)),
  );

  return (
    <>
      <section className="relative isolate overflow-hidden bg-brand-900 text-white">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-dots-light opacity-15" />
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
          <Link href="/partenariats" className="inline-flex items-center gap-1.5 text-label text-brand-200 hover:text-white">
            <ArrowLeft className="size-4" aria-hidden /> Partenariats &amp; Coopération
          </Link>
          <h1 className="mt-5 max-w-3xl text-[2.125rem] font-extrabold leading-[1.12] tracking-tight sm:text-[2.75rem]">Projets à la recherche de partenaires</h1>
          <p className="mt-4 max-w-2xl text-[1.0625rem] leading-relaxed text-brand-100">
            Des besoins éducatifs précis, validés par la Fondation Sanady. Choisissez un projet et proposez votre contribution.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <form className="grid gap-3 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto_auto]" role="search" aria-label="Filtrer les projets">
          <label>
            <span className="mb-1 block text-caption font-medium text-ink-700">Domaine</span>
            <Select name="domaine" defaultValue={domaine}>
              <option value="">Tous les domaines</option>
              {FIELD_SLUGS.map((s) => (
                <option key={s} value={s}>
                  {INTERVENTION_FIELDS[s].name}
                </option>
              ))}
            </Select>
          </label>
          <label>
            <span className="mb-1 block text-caption font-medium text-ink-700">Type de contribution</span>
            <Select name="contribution" defaultValue={contribution}>
              <option value="">Toutes</option>
              {Object.entries(CONTRIBUTION_TYPES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </label>
          <label>
            <span className="mb-1 block text-caption font-medium text-ink-700">Zone géographique</span>
            <Input name="zone" defaultValue={zone} placeholder="Ex. : Casablanca" maxLength={80} />
          </label>
          <label>
            <span className="mb-1 block text-caption font-medium text-ink-700">Statut</span>
            <Select name="statut" defaultValue={statut}>
              {Object.entries(STATUSES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </label>
          <div className="flex items-end">
            <button type="submit" className={buttonClasses({ variant: "secondary", className: "w-full" })}>
              Filtrer
            </button>
          </div>
        </form>

        <p className="mt-6 text-label text-ink-600" aria-live="polite">
          {list.length} projet{list.length > 1 ? "s" : ""}
        </p>
        {list.length ? (
          <ul className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((o) => (
              <li key={o.reference}>
                <OpportunityCard opportunity={o} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-4 rounded-3xl border border-dashed border-line-strong bg-ink-25 p-10 text-center">
            <Megaphone className="mx-auto size-8 text-ink-400" aria-hidden />
            <p className="mt-3 text-section font-bold text-ink-900">{all.length ? "Aucun projet ne correspond à ces filtres" : "Aucun projet publié pour le moment"}</p>
            <p className="mx-auto mt-1 max-w-xl text-body text-ink-600">
              Les projets sont publiés après validation par la Fondation Sanady. Vous pouvez dès maintenant proposer une coopération dans l’un des six
              domaines d’intervention.
            </p>
            <Link href="/partenariats#candidature" className={buttonClasses({ variant: "accent", className: "mt-5" })}>
              Proposer un partenariat
            </Link>
          </div>
        )}
      </section>
    </>
  );
}
