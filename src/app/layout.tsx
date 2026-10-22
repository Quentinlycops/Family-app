import type { Metadata, Viewport } from "next";
import "./globals.css";
import { FamilyProvider } from "@/lib/family";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Famille",
  description: "Agenda, courses, repas, to-do et budget de la famille",
  appleWebApp: { capable: true, title: "Famille", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#0f766e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full bg-stone-50 text-stone-900">
        <FamilyProvider>
          <AppShell>{children}</AppShell>
        </FamilyProvider>
      </body>
    </html>
  );
}
