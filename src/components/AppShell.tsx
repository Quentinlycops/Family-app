"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useFamily } from "@/lib/family";
import Login from "./Login";
import FamilySetup from "./FamilySetup";

const TABS = [
  { href: "/accueil", label: "Accueil", icon: "🏠" },
  { href: "/agenda", label: "Agenda", icon: "📅" },
  { href: "/todo", label: "To-do", icon: "✅" },
  { href: "/courses", label: "Courses", icon: "🛒" },
  { href: "/repas", label: "Repas", icon: "🍽️" },
  { href: "/budget", label: "Budget", icon: "💶" },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, family, me } = useFamily();
  const path = usePathname();

  if (user === undefined || (user && family === undefined))
    return <div className="p-8 text-center text-stone-500">Chargement…</div>;
  if (!user) return <Login />;
  if (!family) return <FamilySetup />;

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200 bg-stone-50/90 px-4 py-3 backdrop-blur">
        <Link href="/accueil" className="text-lg font-semibold text-teal-800">
          🏡 {family.name}
        </Link>
        <Link
          href="/famille"
          className="flex items-center gap-2 rounded-full px-2 py-1 text-sm hover:bg-stone-100"
        >
          {family.members.map((m) => (
            <span
              key={m.id}
              title={m.name}
              className="-ml-1 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white ring-2 ring-stone-50"
              style={{ background: m.color }}
            >
              {m.name[0]}
            </span>
          ))}
          <span className="sr-only">Famille ({me?.name})</span>
        </Link>
      </header>
      <main className="flex-1 px-4 pb-28 pt-4">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-stone-200 bg-surface pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-3xl grid-cols-6">
          {TABS.map((t) => {
            const active = path.startsWith(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`flex flex-col items-center py-2 text-[11px] ${active ? "font-semibold text-teal-700" : "text-stone-500"}`}
              >
                <span className="text-xl">{t.icon}</span>
                {t.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
