import Link from "next/link";
import { SearchX } from "lucide-react";
import { Wordmark } from "@/components/brand/wordmark";
import { buttonClasses } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="contenu" className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-6 text-center">
      <Wordmark className="mb-10 text-lg" />
      <div className="mb-4 flex size-12 items-center justify-center rounded-lg border border-line bg-surface text-ink-500">
        <SearchX className="size-6" aria-hidden />
      </div>
      <h1 className="text-title font-semibold text-ink-900">Page introuvable</h1>
      <p className="mt-2 max-w-md text-body text-ink-600">
        Cette page n’existe pas ou vous n’y avez pas accès. Si vous avez suivi un lien, il est peut-être incomplet ou expiré.
      </p>
      <Link href="/" className={buttonClasses({ className: "mt-6" })}>
        Retour à l’accueil
      </Link>
    </main>
  );
}
