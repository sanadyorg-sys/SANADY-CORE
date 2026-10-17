import { AppShell } from "@/components/layout/app-shell";
import { flushNotificationsLater } from "@/server/notifications";
import { signOut } from "@/server/actions/auth";
import { requirePartnerMember } from "@/server/auth";
import { contextsFor, shellUser } from "@/server/shell";

/** Partner portal (partnerships phase 6): one organisation, what is meant for partners only. */
export default async function PartnerLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requirePartnerMember();
  // E-mails queued by what this person just did go out after the response.
  flushNotificationsLater();
  return (
    <AppShell area="partner" currentContextKey="partner" contexts={contextsFor(viewer)} user={shellUser(viewer)} signOutAction={signOut}>
      {children}
    </AppShell>
  );
}
