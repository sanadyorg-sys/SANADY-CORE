import { AppShell } from "@/components/layout/app-shell";
import { signOut } from "@/server/actions/auth";
import { requireViewer } from "@/server/auth";
import { contextsFor, shellUser } from "@/server/shell";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();
  return (
    <AppShell
      area="teacher"
      currentContextKey="teacher"
      contexts={contextsFor(viewer)}
      user={shellUser(viewer)}
      signOutAction={signOut}
    >
      {children}
    </AppShell>
  );
}
