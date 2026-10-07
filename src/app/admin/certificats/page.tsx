import type { Metadata } from "next";
import { Award, Download, ExternalLink } from "lucide-react";
import { RevokeCertificateForm } from "@/components/admin/revoke-certificate-form";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { SearchForm } from "@/components/ui/search-form";
import { Badge, Card, PageHeader } from "@/components/ui/surface";
import { Pagination, TBody, TD, TH, THead, TR, Table, withParams } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { requireSanadyAdmin } from "@/server/auth";
import { listCertificates } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Certificats" };
const PAGE_SIZE = 30;

export default async function AdminCertificatesPage(props: PageProps<"/admin/certificats">) {
  await requireSanadyAdmin();
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const { rows, total } = await listCertificates({ q, page, pageSize: PAGE_SIZE });

  return (
    <>
      <PageHeader
        title="Certificats"
        description="Certificats délivrés automatiquement. Chaque certificat est vérifiable publiquement par son numéro ou son code QR."
      />
      <Card>
        <div className="border-b border-line px-5 py-4">
          <SearchForm action="/admin/certificats" defaultValue={q} placeholder="Numéro, titulaire ou formation" />
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={Award} title={q ? "Aucun résultat" : "Aucun certificat délivré"} />
        ) : (
          <>
            <Table caption="Certificats délivrés">
              <THead>
                <tr>
                  <TH>Numéro</TH>
                  <TH>Titulaire</TH>
                  <TH>Formation</TH>
                  <TH>Délivré le</TH>
                  <TH>Statut</TH>
                  <TH align="right">
                    <span className="sr-only">Actions</span>
                  </TH>
                </tr>
              </THead>
              <TBody>
                {rows.map((c) => (
                  <TR key={c.id}>
                    <TD className="font-mono text-label">{c.certificate_number}</TD>
                    <TD>{c.recipient_name}</TD>
                    <TD className="max-w-[280px] truncate">{c.course_title}</TD>
                    <TD>{formatDate(c.issued_at)}</TD>
                    <TD>
                      {c.revoked_at ? (
                        <Badge tone="danger" >Révoqué</Badge>
                      ) : (
                        <Badge tone="success">Valide</Badge>
                      )}
                    </TD>
                    <TD align="right">
                      <div className="flex justify-end gap-1">
                        <a href={`/verifier/${c.verification_code}`} target="_blank" rel="noreferrer" className={buttonClasses({ variant: "ghost", size: "icon-sm" })} aria-label="Page de vérification">
                          <ExternalLink />
                        </a>
                        {!c.revoked_at ? (
                          <>
                            <a href={`/api/certificats/${c.id}`} className={buttonClasses({ variant: "ghost", size: "icon-sm" })} aria-label="Télécharger le PDF">
                              <Download />
                            </a>
                            <RevokeCertificateForm certificateId={c.id} number={c.certificate_number} />
                          </>
                        ) : null}
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} hrefFor={(p) => withParams("/admin/certificats", { q, page: p > 1 ? p : undefined })} />
          </>
        )}
      </Card>
    </>
  );
}
