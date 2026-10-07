import { AppShell } from "@/components/layout/app-shell";
import { signOut } from "@/server/actions/auth";
import { requireSanadyAdmin } from "@/server/auth";
import { contextsFor, shellUser } from "@/server/shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireSanadyAdmin();
  return (
    <AppShell
      area="admin"
      currentContextKey="admin"
      contexts={contextsFor(viewer)}
      user={shellUser(viewer)}
      signOutAction={signOut}
    >
      {children}
    </AppShell>
  );
}
