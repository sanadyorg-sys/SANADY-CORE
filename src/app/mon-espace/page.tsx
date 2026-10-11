import { redirect } from "next/navigation";
import { getViewer, homeFor } from "@/server/auth";

/** Sends a signed-in user to their own area (teacher, institution or admin). */
export default async function MySpacePage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/connexion");
  if (!viewer.profile.onboarded_at) redirect("/bienvenue");
  redirect(homeFor(viewer));
}
