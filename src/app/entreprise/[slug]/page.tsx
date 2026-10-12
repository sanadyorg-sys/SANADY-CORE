import { notFound, redirect } from "next/navigation";
import { requireViewer } from "@/server/auth";

/**
 * Address of a company workspace (brief V3 §8): /entreprise/<slug>.
 * The slug only selects; access is decided by verified membership (the
 * viewer's own memberships, read through RLS). Company administrators land
 * on their dashboard, employees on their learning space.
 */
export default async function EnterpriseEntry(props: PageProps<"/entreprise/[slug]">) {
  const { slug } = await props.params;
  if (!/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(slug)) notFound();
  const viewer = await requireViewer();
  const identifier = `ENT-${slug.toUpperCase()}`.slice(0, 40);
  const membership = viewer.institutions.find((i) => i.kind === "enterprise" && i.identifier === identifier);
  if (!membership) notFound();
  redirect(membership.role === "teacher" ? "/espace" : `/etablissement/${membership.id}`);
}
