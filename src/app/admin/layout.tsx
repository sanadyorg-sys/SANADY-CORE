import { AppShell } from "@/components/layout/app-shell";
import { signOut } from "@/server/actions/auth";
import { requireStaff, staffRole } from "@/server/auth";
import { contextsFor, shellUser } from "@/server/shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Each page checks its own role; the layout admits every staff role.
  const viewer = await requireStaff(["admin", "manager", "trainer", "partners", "enterprise"]);
  const role = staffRole(viewer) ?? "admin";
  return (
    <AppShell
      area="admin"
      navRole={role}
      currentContextKey="admin"
      contexts={contextsFor(viewer)}
      user={shellUser(viewer)}
      signOutAction={signOut}
    >
      {children}
    </AppShell>
  );
}
