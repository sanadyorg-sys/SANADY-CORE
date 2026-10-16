"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Prints the current page (or saves it as PDF from the browser's print dialog). */
export function PrintButton({ label = "Imprimer ou enregistrer en PDF" }: { label?: string }) {
  return (
    <Button type="button" variant="secondary" onClick={() => window.print()} className="print:hidden">
      <Printer aria-hidden /> {label}
    </Button>
  );
}
