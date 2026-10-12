import { redirect } from "next/navigation";
import { requireViewer } from "@/server/auth";

/** The teachers' library is not part of company workspaces (the database refuses it too). */
export default async function LibraryLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();
  if (viewer.isEmployeeOnly) redirect("/espace");
  return children;
}
