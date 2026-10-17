import { AppShell } from "@/components/layout/app-shell";
import { flushNotificationsLater } from "@/server/notifications";
import { signOut } from "@/server/actions/auth";
import { requireStaff, staffRole } from "@/server/auth";
import { contextsFor, shellUser } from "@/server/shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Each page checks its own role; the layout admits every staff role.
  const viewer = await requireStaff(["admin", "manager", "trainer", "partners", "enterprise"]);
  const role = staffRole(viewer) ?? "admin";
  // E-mails queued by what this person just did go out after the response.
  flushNotificationsLater();
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
