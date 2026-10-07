import { redirect } from "next/navigation";
import { getViewer, homeFor } from "@/server/auth";

export default async function RootPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/connexion");
  if (!viewer.profile.onboarded_at) redirect("/bienvenue");
  redirect(homeFor(viewer));
}
