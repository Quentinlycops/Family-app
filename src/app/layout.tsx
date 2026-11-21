import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import { FamilyProvider } from "@/lib/family";
import AppShell from "@/components/AppShell";
import { THEME_SCRIPT } from "@/lib/theme";

const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito", display: "swap" });

export const metadata: Metadata = {
  title: "Famille",
  description: "Agenda, courses, repas, to-do, sorties et voyages de la famille",
  appleWebApp: { capable: true, title: "Famille", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#faf7f2",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`h-full antialiased ${nunito.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full bg-stone-50 text-stone-900">
        <FamilyProvider>
          <AppShell>{children}</AppShell>
        </FamilyProvider>
      </body>
    </html>
  );
}
