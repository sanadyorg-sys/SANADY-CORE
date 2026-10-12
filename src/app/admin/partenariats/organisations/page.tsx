import type { Metadata } from "next";
import Link from "next/link";
import { Building, Plus, Search } from "lucide-react";
import { OrganizationForm } from "@/components/partnerships/admin-forms";
import { Button, buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Input, Select } from "@/components/ui/field";
import { Drawer } from "@/components/ui/overlay";
import { Badge, Card, PageHeader } from "@/components/ui/surface";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { cn } from "@/lib/cn";
import { displayName, formatRelative } from "@/lib/format";
import { FIELD_SLUGS, INTERVENTION_FIELDS, ORG_TYPES, PIPELINE, PIPELINE_ORDER, stageTone, type PipelineStatus } from "@/lib/partnerships";
import { requirePartnershipStaff } from "@/server/auth";
import { listOrganizations } from "@/server/queries/partnerships";

export const metadata: Metadata = { title: "Organisations partenaires" };

export default async function OrganizationsPage(props: PageProps<"/admin/partenariats/organisations">) {
  await requirePartnershipStaff();
  const sp = await props.searchParams;
  const status = typeof sp.etape === "string" && sp.etape in PIPELINE ? sp.etape : "";
  const field = typeof sp.domaine === "string" && sp.domaine in INTERVENTION_FIELDS ? sp.domaine : "";
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";

  const [all, rows] = await Promise.all([
    listOrganizations({}),
    status || field || q ? listOrganizations({ status: status || undefined, field: field || undefined, q: q || undefined }) : null,
  ]);
  const list = rows ?? all;
  const byStage = new Map<PipelineStatus, number>();
  for (const o of all) byStage.set(o.status, (byStage.get(o.status) ?? 0) + 1);

  const createDrawer = (
    <Drawer
      title="Nouvelle organisation"
      description="Un prospect identifié par l’équipe (les candidatures du site créent leur fiche depuis la boîte de réception)."
      width="max-w-xl"
      trigger={
        <Button>
          <Plus aria-hidden /> Nouvelle organisation
        </Button>
      }
    >
      <div className="p-5">
        <OrganizationForm />
      </div>
    </Drawer>
  );

  return (
    <>
      <PageHeader title="Organisations partenaires" description="Suivi des relations, du premier contact au renouvellement." actions={createDrawer} />

      {/* Pipeline overview: one chip per stage, links filter the list. */}
      <nav aria-label="Étapes du suivi" className="mb-6 overflow-x-auto pb-1">
        <ol className="flex min-w-max gap-2">
          {PIPELINE_ORDER.map((s, i) => {
            const n = byStage.get(s) ?? 0;
            const active = status === s;
            return (
              <li key={s}>
                <Link
                  href={active ? "/admin/partenariats/organisations" : `/admin/partenariats/organisations?etape=${s}`}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-3 py-2 text-label transition-colors",
                    active ? "border-accent-600 bg-accent-50 text-accent-900" : "border-line bg-surface text-ink-700 hover:border-line-strong",
                    !n && !active && "text-ink-500",
                  )}
                >
                  {i < 11 ? <span className="tabular text-caption text-ink-500">{i + 1}.</span> : null}
                  {PIPELINE[s]}
                  <span className={cn("tabular rounded-full px-1.5 text-caption font-semibold", n ? "bg-ink-100 text-ink-800" : "text-ink-400")}>{n}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      </nav>

      <form className="mb-4 flex flex-wrap items-end gap-3" role="search">
        {status ? <input type="hidden" name="etape" value={status} /> : null}
        <label className="relative min-w-56 flex-1">
          <span className="sr-only">Rechercher une organisation</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" aria-hidden />
          <Input name="q" defaultValue={q} placeholder="Nom de l’organisation" className="pl-9" />
        </label>
        <label>
          <span className="sr-only">Domaine</span>
          <Select name="domaine" defaultValue={field}>
            <option value="">Tous les domaines</option>
            {FIELD_SLUGS.map((s) => (
              <option key={s} value={s}>
                {INTERVENTION_FIELDS[s].name}
              </option>
            ))}
          </Select>
        </label>
        <button type="submit" className={buttonClasses({ variant: "secondary" })}>
          Filtrer
        </button>
      </form>

      {list.length === 0 ? (
        <Card>
          <EmptyState
            icon={Building}
            title={all.length ? "Aucune organisation ne correspond" : "Aucune organisation pour l’instant"}
            description={all.length ? "Modifiez les filtres." : "Créez une fiche depuis une candidature, ou ajoutez un prospect identifié par l’équipe."}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table caption="Organisations partenaires">
            <THead>
              <TR>
                <TH>Organisation</TH>
                <TH>Domaines</TH>
                <TH>Étape</TH>
                <TH>Responsable</TH>
                <TH>Mise à jour</TH>
              </TR>
            </THead>
            <TBody>
              {list.map((o) => (
                <TR key={o.id}>
                  <TD>
                    <Link href={`/admin/partenariats/organisations/${o.id}`} className="font-semibold text-ink-900 hover:text-accent-700 hover:underline">
                      {o.name}
                    </Link>
                    <span className="block text-caption text-ink-500">
                      {ORG_TYPES[o.org_type]}
                      {o.country ? ` · ${o.country}` : ""}
                    </span>
                  </TD>
                  <TD className="text-label">{o.fields.length ? o.fields.map((f) => INTERVENTION_FIELDS[f]?.name ?? f).join(", ") : "—"}</TD>
                  <TD>
                    <Badge tone={stageTone(o.status)}>{PIPELINE[o.status]}</Badge>
                  </TD>
                  <TD>{o.assignee ? displayName(o.assignee) : "—"}</TD>
                  <TD>{formatRelative(o.updated_at)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </>
  );
}
