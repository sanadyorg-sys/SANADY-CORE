import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { InstitutionForm } from "@/components/admin/institution-form";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Drawer } from "@/components/ui/overlay";
import { FilterSelect, SearchForm } from "@/components/ui/search-form";
import { Badge, Card, PageHeader } from "@/components/ui/surface";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { INSTITUTION_TYPES } from "@/lib/labels";
import { requireSanadyAdmin } from "@/server/auth";
import { listInstitutions } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Établissements" };

export default async function InstitutionsPage(props: PageProps<"/admin/etablissements">) {
  await requireSanadyAdmin();
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const statut = typeof sp.statut === "string" ? sp.statut : "";
  const institutions = await listInstitutions({ q, status: statut });

  const createDrawer = (
    <Drawer
      title="Nouvel établissement"
      description="Seuls les administrateurs SANADY peuvent créer un établissement."
      width="max-w-lg"
      trigger={
        <Button>
          <Plus aria-hidden /> Nouvel établissement
        </Button>
      }
    >
      <div className="p-5">
        <InstitutionForm />
      </div>
    </Drawer>
  );

  return (
    <>
      <PageHeader title="Établissements" description="Établissements partenaires, leurs administrateurs et leurs autorisations." actions={createDrawer} />
      <Card>
        <div className="border-b border-line px-5 py-4">
          <SearchForm action="/admin/etablissements" defaultValue={q} placeholder="Nom, identifiant ou ville">
            <FilterSelect
              name="statut"
              label="Statut"
              defaultValue={statut}
              options={[
                { value: "", label: "Tous les statuts" },
                { value: "active", label: "Actifs" },
                { value: "suspended", label: "Suspendus" },
              ]}
            />
          </SearchForm>
        </div>
        {institutions.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={q || statut ? "Aucun résultat" : "Aucun établissement"}
            description={q || statut ? "Modifiez votre recherche." : "Créez le premier établissement partenaire."}
          />
        ) : (
          <Table caption="Établissements">
            <THead>
              <tr>
                <TH>Établissement</TH>
                <TH>Type</TH>
                <TH align="right">Enseignants</TH>
                <TH align="right">Formations autorisées</TH>
                <TH>Statut</TH>
                <TH>Créé le</TH>
              </tr>
            </THead>
            <TBody>
              {institutions.map((i) => (
                <TR key={i.id}>
                  <TD>
                    <Link href={`/admin/etablissements/${i.id}`} className="font-medium text-ink-900 hover:underline">
                      {i.name}
                    </Link>
                    <p className="font-mono text-caption text-ink-500">
                      {i.identifier}
                      {i.city ? ` · ${i.city}` : ""}
                    </p>
                  </TD>
                  <TD>{INSTITUTION_TYPES[i.type]}</TD>
                  <TD align="right">{i.teachers}</TD>
                  <TD align="right">{i.authorized_courses}</TD>
                  <TD>{i.status === "active" ? <Badge tone="success">Actif</Badge> : <Badge tone="warning">Suspendu</Badge>}</TD>
                  <TD>{formatDate(i.created_at)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  );
}
