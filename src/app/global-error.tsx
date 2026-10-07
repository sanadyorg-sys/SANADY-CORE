"use client";

import { ErrorView } from "@/components/common/error-view";
import "./globals.css";

export default function GlobalError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fr">
      <body className="min-h-dvh bg-canvas font-sans">
        <ErrorView {...props} />
      </body>
    </html>
  );
}
