"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/overlay";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/surface";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/browser";

export function MfaCard({ enrolled, required }: { enrolled: boolean; required: boolean }) {
  const router = useRouter();
  const toast = useToast();

  if (!enrolled) {
    return (
      <div className="space-y-3">
        <p className="text-body text-ink-600">
          Ajoutez un code temporaire, généré sur votre téléphone, à chaque connexion. Votre compte reste protégé même si votre mot de
          passe est découvert.
        </p>
        <Link href="/securite/activer?suite=/espace/profil" className={buttonClasses({ variant: "secondary" })}>
          <ShieldCheck aria-hidden /> Activer la double authentification
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 text-body text-ink-800">
        <ShieldCheck className="size-5 text-success-600" aria-hidden />
        Double authentification activée
        {required ? <Badge tone="brand">Obligatoire pour les administrateurs</Badge> : null}
      </p>
      {!required ? (
        <ConfirmDialog
          trigger={
            <Button variant="danger-ghost" size="sm">
              <ShieldOff aria-hidden /> Désactiver
            </Button>
          }
          title="Désactiver la double authentification ?"
          description="Votre compte ne sera plus protégé que par votre mot de passe."
          confirmLabel="Désactiver"
          onConfirm={async () => {
            const supabase = createClient();
            const { data } = await supabase.auth.mfa.listFactors();
            for (const f of data?.totp ?? []) {
              const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id });
              if (error) return { ok: false, message: "La désactivation a échoué. Reconnectez-vous et réessayez." };
            }
            await supabase.auth.refreshSession();
            toast({ tone: "success", title: "Double authentification désactivée." });
            router.refresh();
            return { ok: true };
          }}
        />
      ) : null}
    </div>
  );
}
