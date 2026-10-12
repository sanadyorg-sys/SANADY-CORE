import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Building, Trash2 } from "lucide-react";
import { ActionButton } from "@/components/common/action-button";
import { DepartmentForm, MemberDepartmentSelect } from "@/components/institution/department-forms";
import { EmptyState } from "@/components/ui/feedback";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/surface";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { deleteDepartment } from "@/server/actions/departments";
import { requireInstitutionAdmin } from "@/server/auth";
import { getDepartments, getMembersWithDepartments } from "@/server/queries/institution";

export const metadata: Metadata = { title: "Services" };

/** Company workspaces only: group employees by service (department). */
export default async function DepartmentsPage(props: PageProps<"/etablissement/[institutionId]/services">) {
  const { institutionId } = await props.params;
  const { institution } = await requireInstitutionAdmin(institutionId);
  if (institution.kind !== "enterprise") notFound();
  const [departments, members] = await Promise.all([getDepartments(institutionId), getMembersWithDepartments(institutionId)]);
  const count = (id: string) => members.filter((m) => m.department_id === id).length;

  return (
    <>
      <PageHeader title="Services" description="Regroupez vos collaborateurs par service pour suivre leur progression et filtrer les rapports." />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-6 self-start">
          <Card>
            <CardHeader title="Nouveau service" />
            <CardBody>
              <DepartmentForm institutionId={institutionId} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Services" description={`${departments.length} service(s)`} />
            {departments.length ? (
              <ul className="divide-y divide-line">
                {departments.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink-900">{d.name}</p>
                      <p className="text-caption text-ink-500">{count(d.id)} collaborateur(s)</p>
                    </div>
                    <ActionButton
                      variant="danger-ghost"
                      action={deleteDepartment.bind(null, d.id, institutionId)}
                      confirm={{ title: `Supprimer « ${d.name} » ?`, description: "Les collaborateurs restent dans l’espace, sans service.", confirmLabel: "Supprimer" }}
                    >
                      <Trash2 aria-hidden /> <span className="sr-only">Supprimer {d.name}</span>
                    </ActionButton>
                  </li>
                ))}
              </ul>
            ) : (
              <CardBody>
                <p className="text-body text-ink-600">Aucun service pour l’instant.</p>
              </CardBody>
            )}
          </Card>
        </div>
        <Card className="overflow-hidden">
          <CardHeader title="Collaborateurs par service" />
          {members.length === 0 ? (
            <EmptyState icon={Building} title="Aucun collaborateur" description="Invitez vos collaborateurs depuis « Nos collaborateurs »." />
          ) : (
            <Table caption="Service de chaque collaborateur">
              <THead>
                <TR>
                  <TH>Collaborateur</TH>
                  <TH>Service</TH>
                </TR>
              </THead>
              <TBody>
                {members.map((m) => {
                  const name = m.profile?.full_name || m.profile?.email || "Collaborateur";
                  return (
                    <TR key={m.user_id}>
                      <TD>
                        <span className="font-medium text-ink-900">{name}</span>
                        {m.profile?.full_name ? <span className="block text-caption text-ink-500">{m.profile.email}</span> : null}
                      </TD>
                      <TD>
                        {departments.length ? (
                          <MemberDepartmentSelect institutionId={institutionId} userId={m.user_id} value={m.department_id} departments={departments} label={`Service de ${name}`} />
                        ) : (
                          "—"
                        )}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
