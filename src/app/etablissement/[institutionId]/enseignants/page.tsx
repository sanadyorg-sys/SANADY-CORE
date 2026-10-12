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
import { requireInstitutionViewer } from "@/server/auth";
import { getDepartments, getMembersWithDepartments, getTeacherSummaries } from "@/server/queries/institution";
import { wording } from "@/lib/enterprise";

export const metadata: Metadata = { title: "Nos enseignants" };
const PAGE_SIZE = 25;

export default async function TeacherDirectoryPage(props: PageProps<"/etablissement/[institutionId]/enseignants">) {
  const { institutionId } = await props.params;
  const sp = await props.searchParams;
  const { canManage, institution: scope } = await requireInstitutionViewer(institutionId);
  const say = wording(scope.kind);
  const base = `/etablissement/${institutionId}`;

  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const statut = typeof sp.statut === "string" ? sp.statut : "";
  const page = Math.max(1, Number(sp.page) || 1);

  const enterprise = scope.kind === "enterprise";
  const service = typeof sp.service === "string" ? sp.service : "";
  const [all, departments, members] = await Promise.all([
    getTeacherSummaries(institutionId),
    enterprise ? getDepartments(institutionId) : [],
    enterprise ? getMembersWithDepartments(institutionId) : [],
  ]);
  const departmentOf = new Map(members.map((m) => [m.user_id, m.department_id]));
  const departmentName = new Map(departments.map((d) => [d.id, d.name]));
  const filtered = all.filter((t) => {
    if (q && !`${t.full_name} ${t.email}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (service && departmentOf.get(t.user_id) !== service) return false;
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
              { value: "", label: say("Tous les enseignants") },
              { value: "accompagnement", label: "À accompagner" },
              { value: "sans_formation", label: "Sans formation affectée" },
            ]}
          />
          {departments.length ? (
            <FilterSelect
              name="service"
              label="Service"
              defaultValue={service}
              options={[{ value: "", label: "Tous les services" }, ...departments.map((d) => ({ value: d.id, label: d.name }))]}
            />
          ) : null}
        </SearchForm>
        {canManage ? (
          <Link href={`${base}/enseignants/invitations`} className={buttonClasses({ size: "sm" })}>
            Inviter
          </Link>
        ) : null}
      </div>

      {all.length === 0 ? (
        <EmptyState
          icon={Users}
          title={say("Aucun enseignant pour le moment")}
          description={canManage ? "Invitez vos enseignants par e-mail ou partagez un code d’inscription." : "Les enseignants rattachés à l’établissement apparaîtront ici."}
          action={
            canManage ? (
              <Link href={`${base}/enseignants/invitations`} className={buttonClasses()}>
                {say("Inviter des enseignants")}
              </Link>
            ) : undefined
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState compact title="Aucun résultat" description="Modifiez la recherche ou le filtre." />
      ) : (
        <>
          <Table caption={say("Enseignants de l’établissement")}>
            <THead>
              <tr>
                <TH>{say("Enseignant")}</TH>
                {departments.length ? <TH>Service</TH> : null}
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
                  {departments.length ? <TD>{departmentName.get(departmentOf.get(t.user_id) ?? "") ?? "—"}</TD> : null}
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
                      {canManage ? (
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
                      ) : null}
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
            hrefFor={(p) => withParams(`${base}/enseignants`, { q, statut, service: service || undefined, page: p > 1 ? p : undefined })}
          />
        </>
      )}
    </Card>
  );
}
