"use client";

import { useEffect } from "react";
import { RotateCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Generic error state: never shows technical details to the user. */
export function ErrorView({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto flex max-w-lg flex-col items-center px-6 py-16 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-lg bg-danger-50 text-danger-600">
        <TriangleAlert className="size-6" aria-hidden />
      </div>
      <h1 className="text-section font-semibold text-ink-900">Une erreur est survenue</h1>
      <p className="mt-2 text-body text-ink-600">
        La page n’a pas pu être affichée. Réessayez ; si le problème persiste, contactez l’administration SANADY
        {error.digest ? " en indiquant la référence ci-dessous" : ""}.
      </p>
      {error.digest ? <p className="mt-3 font-mono text-caption text-ink-500">Référence : {error.digest}</p> : null}
      <Button className="mt-6" onClick={reset}>
        <RotateCw aria-hidden /> Réessayer
      </Button>
    </div>
  );
}
