import type { Metadata } from "next";
import Link from "next/link";
import { UserPlus, Users } from "lucide-react";
import { InviteForm } from "@/components/common/invite-form";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Drawer } from "@/components/ui/overlay";
import { FilterSelect, SearchForm } from "@/components/ui/search-form";
import { Badge, Card, PageHeader } from "@/components/ui/surface";
import { Pagination, TBody, TD, TH, THead, TR, Table, withParams } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { requireSanadyAdmin } from "@/server/auth";
import { listPeople } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Gestion des enseignants" };
const PAGE_SIZE = 30;

export default async function PeoplePage(props: PageProps<"/admin/enseignants">) {
  await requireSanadyAdmin();
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const statut = typeof sp.statut === "string" ? sp.statut : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const { rows, total } = await listPeople({ q, status: statut, page, pageSize: PAGE_SIZE });

  return (
    <>
      <PageHeader
        title="Gestion des enseignants"
        description="Comptes personnels de la plateforme. Un enseignant conserve un compte unique, qu’il soit rattaché ou non à un établissement."
        actions={
          <Drawer
            title="Inviter un enseignant"
            description="Compte individuel, sans rattachement à un établissement."
            width="max-w-lg"
            trigger={
              <Button>
                <UserPlus aria-hidden /> Inviter un enseignant
              </Button>
            }
          >
            <div className="p-5">
              <InviteForm kinds={["teacher"]} />
            </div>
          </Drawer>
        }
      />
      <Card>
        <div className="border-b border-line px-5 py-4">
          <SearchForm action="/admin/enseignants" defaultValue={q} placeholder="Nom ou adresse e-mail">
            <FilterSelect
              name="statut"
              label="Statut du compte"
              defaultValue={statut}
              options={[
                { value: "", label: "Tous les comptes" },
                { value: "active", label: "Actifs" },
                { value: "suspended", label: "Suspendus" },
              ]}
            />
          </SearchForm>
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={Users} title="Aucun compte" description={q ? "Aucun compte ne correspond à votre recherche." : "Invitez le premier enseignant."} />
        ) : (
          <>
            <Table caption="Comptes">
              <THead>
                <tr>
                  <TH>Nom</TH>
                  <TH>Établissements</TH>
                  <TH>Statut</TH>
                  <TH>Créé le</TH>
                </tr>
              </THead>
              <TBody>
                {rows.map((p) => (
                  <TR key={p.id}>
                    <TD>
                      <Link href={`/admin/enseignants/${p.id}`} className="font-medium text-ink-900 hover:underline">
                        {p.full_name || "Profil non complété"}
                      </Link>
                      <p className="text-caption text-ink-500">{p.email}</p>
                    </TD>
                    <TD className="max-w-[280px]">
                      {p.institutions.length ? (
                        <span className="line-clamp-2 text-label text-ink-700">{p.institutions.join(", ")}</span>
                      ) : (
                        <span className="text-label text-ink-400">Compte individuel</span>
                      )}
                    </TD>
                    <TD>
                      <div className="flex flex-wrap gap-1.5">
                        {p.status === "active" ? <Badge tone="success">Actif</Badge> : <Badge tone="danger">Suspendu</Badge>}
                        {p.is_admin ? <Badge tone="navy">Admin SANADY</Badge> : null}
                      </div>
                    </TD>
                    <TD>{formatDate(p.created_at)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              hrefFor={(p) => withParams("/admin/enseignants", { q, statut, page: p > 1 ? p : undefined })}
            />
          </>
        )}
      </Card>
    </>
  );
}
