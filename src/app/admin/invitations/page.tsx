import type { Metadata } from "next";
import { InvitationTable } from "@/components/common/invitation-table";
import { InviteForm } from "@/components/common/invite-form";
import { FilterSelect } from "@/components/ui/search-form";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/surface";
import { createClient } from "@/lib/supabase/server";
import type { Invitation } from "@/lib/types";
import { requireSanadyAdmin } from "@/server/auth";

export const metadata: Metadata = { title: "Invitations" };

export default async function AdminInvitationsPage(props: PageProps<"/admin/invitations">) {
  await requireSanadyAdmin();
  const sp = await props.searchParams;
  const etat = typeof sp.etat === "string" ? sp.etat : "ouvertes";
  const supabase = await createClient();

  let query = supabase
    .from("invitations")
    .select("id, kind, email, institution_id, enrollment_code_id, invited_by, expires_at, email_sent_at, accepted_at, revoked_at, created_at")
    .order("created_at", { ascending: false })
    .limit(300);
  if (etat === "ouvertes") query = query.is("accepted_at", null).is("revoked_at", null);
  if (etat === "acceptees") query = query.not("accepted_at", "is", null);

  const [{ data: invitations }, { data: institutions }] = await Promise.all([
    query,
    supabase.from("institutions").select("id, name").eq("status", "active").order("name"),
  ]);
  const insts = (institutions ?? []) as Array<{ id: string; name: string }>;

  return (
    <>
      <PageHeader
        title="Invitations"
        description="L’inscription sur SANADY se fait exclusivement sur invitation. Chaque lien est personnel, à usage unique, révocable et expire automatiquement."
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card className="self-start">
          <CardHeader title="Nouvelle invitation" />
          <CardBody>
            <InviteForm kinds={["teacher", "institution_admin", "institution_teacher", "platform_admin"]} institutions={insts} />
          </CardBody>
        </Card>
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
            <h2 className="text-card font-semibold text-ink-900">Invitations</h2>
            <form action="/admin/invitations" method="get" className="flex items-center gap-2">
              <FilterSelect
                name="etat"
                label="État"
                defaultValue={etat}
                options={[
                  { value: "ouvertes", label: "En attente" },
                  { value: "acceptees", label: "Acceptées" },
                  { value: "toutes", label: "Toutes" },
                ]}
              />
              <button type="submit" className="h-9 rounded-md border border-line-strong bg-surface px-3 text-body font-medium text-ink-800 shadow-xs hover:bg-ink-50">
                Afficher
              </button>
            </form>
          </div>
          <InvitationTable invitations={(invitations ?? []) as Invitation[]} showKind institutionNames={Object.fromEntries(insts.map((i) => [i.id, i.name]))} />
        </Card>
      </div>
    </>
  );
}
