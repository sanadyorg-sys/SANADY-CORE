import type { Metadata } from "next";
import Link from "next/link";
import { UserMinus, Users } from "lucide-react";
import { ActionButton } from "@/components/common/action-button";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { FilterSelect, SearchForm } from "@/components/ui/search-form";
import { Badge, Card } from "@/components/ui/surface";
import { Pagination, TBody, TD, TH, THead, TR, Table, withParams } from "@/components/ui/table";
import { formatDate, formatRelative } from "@/lib/format";
import { MEMBERSHIP_SOURCES } from "@/lib/labels";
import { revokeMembership } from "@/server/actions/institution";
import { requireInstitutionAdmin } from "@/server/auth";
import { getTeacherSummaries } from "@/server/queries/institution";

export const metadata: Metadata = { title: "Nos enseignants" };
const PAGE_SIZE = 25;

export default async function TeacherDirectoryPage(props: PageProps<"/etablissement/[institutionId]/enseignants">) {
  const { institutionId } = await props.params;
  const sp = await props.searchParams;
  await requireInstitutionAdmin(institutionId);
  const base = `/etablissement/${institutionId}`;

  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const statut = typeof sp.statut === "string" ? sp.statut : "";
  const page = Math.max(1, Number(sp.page) || 1);

  const all = await getTeacherSummaries(institutionId);
  const filtered = all.filter((t) => {
    if (q && !`${t.full_name} ${t.email}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (statut === "accompagnement") return t.inactive || t.exhausted_quizzes > 0;
    if (statut === "sans_formation") return t.assigned_courses === 0;
    return true;
  });
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <SearchForm action={`${base}/enseignants`} defaultValue={q} placeholder="Nom ou adresse e-mail">
          <FilterSelect
            name="statut"
            label="Filtrer"
            defaultValue={statut}
            options={[
              { value: "", label: "Tous les enseignants" },
              { value: "accompagnement", label: "À accompagner" },
              { value: "sans_formation", label: "Sans formation affectée" },
            ]}
          />
        </SearchForm>
        <Link href={`${base}/enseignants/invitations`} className={buttonClasses({ size: "sm" })}>
          Inviter
        </Link>
      </div>

      {all.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Aucun enseignant pour le moment"
          description="Invitez vos enseignants par e-mail ou partagez un code d’inscription."
          action={
            <Link href={`${base}/enseignants/invitations`} className={buttonClasses()}>
              Inviter des enseignants
            </Link>
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState compact title="Aucun résultat" description="Modifiez la recherche ou le filtre." />
      ) : (
        <>
          <Table caption="Enseignants de l’établissement">
            <THead>
              <tr>
                <TH>Enseignant</TH>
                <TH>Inscription</TH>
                <TH align="right">Formations</TH>
                <TH align="right">Terminées</TH>
                <TH>Dernière activité</TH>
                <TH>Indicateurs</TH>
                <TH align="right">
                  <span className="sr-only">Actions</span>
                </TH>
              </tr>
            </THead>
            <TBody>
              {rows.map((t) => (
                <TR key={t.user_id}>
                  <TD>
                    <Link href={`${base}/suivi/${t.user_id}`} className="font-medium text-ink-900 hover:underline">
                      {t.full_name || "—"}
                    </Link>
                    <p className="text-caption text-ink-500">{t.email}</p>
                  </TD>
                  <TD>
                    <p>{formatDate(t.joined_at)}</p>
                    <p className="text-caption text-ink-500">{MEMBERSHIP_SOURCES[t.source]}</p>
                  </TD>
                  <TD align="right">{t.assigned_courses}</TD>
                  <TD align="right">{t.completed_courses}</TD>
                  <TD className="whitespace-nowrap">{t.last_activity_at ? formatRelative(t.last_activity_at) : "—"}</TD>
                  <TD>
                    <div className="flex flex-wrap gap-1.5">
                      {t.inactive ? <Badge tone="warning">Inactif</Badge> : null}
                      {t.exhausted_quizzes > 0 ? <Badge tone="danger">Tentatives épuisées</Badge> : null}
                      {!t.inactive && t.exhausted_quizzes === 0 ? <span className="text-caption text-ink-400">—</span> : null}
                    </div>
                  </TD>
                  <TD align="right">
                    <div className="flex justify-end gap-1">
                      <Link href={`${base}/suivi/${t.user_id}`} className={buttonClasses({ variant: "ghost", size: "sm" })}>
                        Suivi
                      </Link>
                      <ActionButton
                        variant="danger-ghost"
                        action={revokeMembership.bind(null, t.membership_id, institutionId)}
                        confirm={{
                          title: `Retirer ${t.full_name || t.email} de l’établissement ?`,
                          description:
                            "Ses affectations de formation seront retirées et l’établissement n’aura plus accès à son suivi. Son compte personnel, sa progression et ses certificats sont conservés.",
                          confirmLabel: "Retirer",
                        }}
                      >
                        <UserMinus aria-hidden />
                        <span className="sr-only sm:not-sr-only">Retirer</span>
                      </ActionButton>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={filtered.length}
            hrefFor={(p) => withParams(`${base}/enseignants`, { q, statut, page: p > 1 ? p : undefined })}
          />
        </>
      )}
    </Card>
  );
}
