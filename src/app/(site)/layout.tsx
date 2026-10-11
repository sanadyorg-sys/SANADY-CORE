import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/server/auth";

/** Public website: home, catalog, course pages, about, access request. */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const [viewer, { data: info }] = await Promise.all([getViewer(), supabase.rpc("public_platform_info")]);
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2 focus:shadow-md"
      >
        Aller au contenu
      </a>
      <SiteHeader signedIn={Boolean(viewer)} />
      <main id="contenu" className="flex-1">
        {children}
      </main>
      <SiteFooter supportEmail={(info as { support_email?: string | null } | null)?.support_email} />
    </div>
  );
}
