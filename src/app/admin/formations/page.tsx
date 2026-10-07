import type { Metadata } from "next";
import Link from "next/link";
import { Library, Plus } from "lucide-react";
import { CreateCourseForm } from "@/components/admin/course-forms";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Dialog } from "@/components/ui/overlay";
import { SearchForm } from "@/components/ui/search-form";
import { Badge, Card, PageHeader } from "@/components/ui/surface";
import { LinkTabs } from "@/components/ui/tabs";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { COURSE_STATUSES } from "@/lib/labels";
import type { CourseStatus } from "@/lib/types";
import { requireSanadyAdmin } from "@/server/auth";
import { getCategories, listCourses } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Formations" };

const STATUS_TONE: Record<CourseStatus, "neutral" | "success" | "warning"> = { draft: "neutral", published: "success", archived: "warning" };

export default async function AdminCoursesPage(props: PageProps<"/admin/formations">) {
  await requireSanadyAdmin();
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const statut = typeof sp.statut === "string" && ["draft", "published", "archived"].includes(sp.statut) ? sp.statut : "";
  const [courses, categories] = await Promise.all([listCourses({ q, status: statut }), getCategories()]);
  const tab = (s: string) => (s ? `/admin/formations?statut=${s}` : "/admin/formations");

  return (
    <>
      <PageHeader
        title="Formations"
        description="Conception, publication et autorisation des formations. Seuls les administrateurs SANADY peuvent modifier les contenus."
        actions={
          <Dialog
            title="Nouvelle formation"
            trigger={
              <Button>
                <Plus aria-hidden /> Nouvelle formation
              </Button>
            }
          >
            <CreateCourseForm categories={categories} />
          </Dialog>
        }
      />
      <LinkTabs
        className="mb-6"
        activeHref={tab(statut)}
        items={[
          { href: tab(""), label: "Toutes" },
          { href: tab("published"), label: "Publiées" },
          { href: tab("draft"), label: "Brouillons" },
          { href: tab("archived"), label: "Archivées" },
        ]}
      />
      <Card>
        <div className="border-b border-line px-5 py-4">
          <SearchForm action="/admin/formations" defaultValue={q} placeholder="Rechercher une formation">
            {statut ? <input type="hidden" name="statut" value={statut} /> : null}
          </SearchForm>
        </div>
        {courses.length === 0 ? (
          <EmptyState icon={Library} title={q ? "Aucun résultat" : "Aucune formation"} description={q ? undefined : "Créez votre première formation."} />
        ) : (
          <Table caption="Formations">
            <THead>
              <tr>
                <TH>Formation</TH>
                <TH>Statut</TH>
                <TH align="right">Modules</TH>
                <TH align="right">Inscrits</TH>
                <TH>Dernière modification</TH>
              </tr>
            </THead>
            <TBody>
              {courses.map((c) => (
                <TR key={c.id}>
                  <TD>
                    <Link href={`/admin/formations/${c.id}`} className="font-medium text-ink-900 hover:underline">
                      {c.title}
                    </Link>
                    <p className="text-caption text-ink-500">{c.category ?? "Sans catégorie"}</p>
                  </TD>
                  <TD>
                    <Badge tone={STATUS_TONE[c.status]} dot>
                      {COURSE_STATUSES[c.status]}
                    </Badge>
                  </TD>
                  <TD align="right">{c.modules}</TD>
                  <TD align="right">{c.enrollments}</TD>
                  <TD className="whitespace-nowrap">{formatDateTime(c.updated_at)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  );
}
