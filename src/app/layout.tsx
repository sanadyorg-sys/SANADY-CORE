import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/toast";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "SANADY — Formation et développement professionnel des enseignants",
    template: "%s · SANADY",
  },
  description: "Plateforme de formation et de développement professionnel des enseignants.",
  robots: { index: false, follow: false },
  applicationName: "SANADY",
};

export const viewport: Viewport = {
  themeColor: "#123653",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={inter.variable}>
      <body className="min-h-dvh font-sans">
        <Toaster>{children}</Toaster>
      </body>
    </html>
  );
}
