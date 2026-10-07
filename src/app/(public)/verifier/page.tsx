import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Vérifier un certificat" };

export default async function VerifyLandingPage(props: PageProps<"/verifier">) {
  const { code } = await props.searchParams;
  if (typeof code === "string" && code.trim()) {
    redirect(`/verifier/${encodeURIComponent(code.trim().slice(0, 64))}`);
  }

  return (
    <>
      <h1 className="text-title font-semibold text-ink-900">Vérifier un certificat</h1>
      <p className="mb-8 mt-1 text-body text-ink-600">
        Saisissez le numéro figurant sur le certificat (par exemple SND-2026-4F7A21C9), ou scannez son code QR.
      </p>
      <form action="/verifier" method="get" className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="code" className="block text-label font-medium text-ink-800">
            Numéro du certificat
          </label>
          <Input id="code" name="code" required autoComplete="off" spellCheck={false} className="font-mono uppercase" />
        </div>
        <Button type="submit" size="lg" className="w-full">
          Vérifier
        </Button>
      </form>
    </>
  );
}
