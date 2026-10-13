import { AppShell } from "@/components/layout/app-shell";
import { signOut } from "@/server/actions/auth";
import { requirePartnerMember } from "@/server/auth";
import { contextsFor, shellUser } from "@/server/shell";

/** Partner portal (partnerships phase 6): one organisation, what is meant for partners only. */
export default async function PartnerLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requirePartnerMember();
  return (
    <AppShell area="partner" currentContextKey="partner" contexts={contextsFor(viewer)} user={shellUser(viewer)} signOutAction={signOut}>
      {children}
    </AppShell>
  );
}
