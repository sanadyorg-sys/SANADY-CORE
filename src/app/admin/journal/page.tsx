import type { Metadata } from "next";
import { History } from "lucide-react";
import { EmptyState } from "@/components/ui/feedback";
import { FilterSelect } from "@/components/ui/search-form";
import { Badge, Card, PageHeader } from "@/components/ui/surface";
import { Pagination, TBody, TD, TH, THead, TR, Table, withParams } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/labels";
import { requireSanadyAdmin } from "@/server/auth";
import { listAuditLogs, type AuditRow } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Journal d’activité" };
const PAGE_SIZE = 50;

const FIELD_LABELS: Record<string, string> = {
  status: "statut",
  title: "titre",
  name: "nom",
  description: "description",
  revoked_at: "révocation",
  accepted_at: "acceptation",
  archived_at: "archivage",
  position: "ordre",
  role: "rôle",
  email_sent_at: "envoi",
  uses_count: "utilisations",
};

function describe(row: AuditRow) {
  const d = row.details ?? {};
  if (row.action === "quiz_attempts_reset") {
    return `${d.voided_attempts ?? 0} tentative(s) annulée(s) — motif : ${d.reason ?? "—"}`;
  }
  const parts: string[] = [];
  if (d.label) parts.push(`« ${d.label} »`);
  if (d.changed?.length) parts.push(`champs : ${d.changed.map((c) => FIELD_LABELS[c] ?? c).join(", ")}`);
  return parts.join(" · ") || "—";
}

export default async function AuditLogPage(props: PageProps<"/admin/journal">) {
  await requireSanadyAdmin();
  const sp = await props.searchParams;
  const entity = typeof sp.objet === "string" && sp.objet in AUDIT_ENTITIES ? sp.objet : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const { rows, total } = await listAuditLogs({ entity: entity || undefined, page, pageSize: PAGE_SIZE });

  return (
    <>
      <PageHeader
        title="Journal d’activité"
        description="Opérations d’administration enregistrées automatiquement par la base de données. Le journal ne peut être ni modifié ni supprimé."
      />
      <Card>
        <form action="/admin/journal" method="get" className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-4">
          <FilterSelect
            name="objet"
            label="Type d’objet"
            defaultValue={entity}
            options={[{ value: "", label: "Tous les objets" }, ...Object.entries(AUDIT_ENTITIES).map(([value, label]) => ({ value, label }))]}
          />
          <button type="submit" className="h-9 rounded-md border border-line-strong bg-surface px-3.5 text-body font-medium text-ink-800 shadow-xs hover:bg-ink-50">
            Filtrer
          </button>
        </form>
        {rows.length === 0 ? (
          <EmptyState icon={History} title="Aucune entrée" />
        ) : (
          <>
            <Table caption="Journal d’activité">
              <THead>
                <tr>
                  <TH>Date</TH>
                  <TH>Auteur</TH>
                  <TH>Opération</TH>
                  <TH>Objet</TH>
                  <TH>Détails</TH>
                </tr>
              </THead>
              <TBody>
                {rows.map((row) => (
                  <TR key={row.id}>
                    <TD className="whitespace-nowrap">{formatDateTime(row.created_at)}</TD>
                    <TD>{row.actor ? row.actor.full_name || row.actor.email : <span className="text-ink-500">Système</span>}</TD>
                    <TD>
                      <Badge tone={row.action === "delete" ? "danger" : row.action === "insert" ? "accent" : "neutral"}>
                        {AUDIT_ACTIONS[row.action] ?? row.action}
                      </Badge>
                    </TD>
                    <TD>{AUDIT_ENTITIES[row.entity_type] ?? row.entity_type}</TD>
                    <TD className="max-w-[420px] text-label text-ink-600">{describe(row)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} hrefFor={(p) => withParams("/admin/journal", { objet: entity, page: p > 1 ? p : undefined })} />
          </>
        )}
      </Card>
    </>
  );
}
