"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useFamily } from "@/lib/family";
import { MAIN_TABS, SPACES } from "@/lib/spaces";
import Login from "./Login";
import FamilySetup from "./FamilySetup";

const tabs = SPACES.filter((s) => MAIN_TABS.includes(s.href));
const more = SPACES.filter((s) => !MAIN_TABS.includes(s.href));

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, family, me } = useFamily();
  const path = usePathname();
  // Le menu « Plus » est lié à la page où on l'a ouvert : il se referme dès qu'on change de page.
  const [moreAt, setMoreAt] = useState<string | null>(null);
  const moreOpen = moreAt === path;
  const setMoreOpen = (open: boolean) => setMoreAt(open ? path : null);

  if (user === undefined || (user && family === undefined))
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-stone-500">
        <span className="animate-bounce text-5xl">🏡</span>
        Chargement…
      </div>
    );
  if (!user) return <Login />;
  if (!family) return <FamilySetup />;

  // L'agenda et les deux fiches enfants côte à côte profitent de toute la largeur de l'écran.
  const width = path.startsWith("/agenda") ? "max-w-[1600px]" : path.startsWith("/enfants") ? "max-w-6xl" : "max-w-3xl";
  const inMore = more.some((s) => path.startsWith(s.href));

  return (
    <div className="min-h-screen lg:flex">
      {/* Grand écran : menu latéral avec tous les espaces. */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-1 overflow-y-auto border-r border-stone-200/70 bg-surface/60 p-4 lg:flex">
        <Link href="/accueil" className="mb-4 flex items-center gap-2 px-2 text-lg font-extrabold text-teal-800">
          <span className="text-2xl">🏡</span> {family.name}
        </Link>
        {SPACES.map((s) => {
          const active = path.startsWith(s.href);
          return (
            <Link key={s.href} href={s.href}
              className={`flex items-center gap-3 rounded-2xl px-3 py-2 font-semibold transition ${active ? "shadow-sm" : "text-stone-600 hover:bg-stone-100"}`}
              style={active ? { background: s.soft, color: s.strong } : undefined}>
              <span className="text-xl">{s.emoji}</span>
              {s.label}
            </Link>
          );
        })}
        {me && (
          <Link href="/parametres" className="mt-auto flex items-center gap-2 rounded-2xl px-3 py-2 text-sm text-stone-500 hover:bg-stone-100">
            <span className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: me.color }}>{me.name.slice(0, 1)}</span>
            {me.name}
          </Link>
        )}
      </aside>

      <div className={`mx-auto flex min-h-screen w-full ${width} min-w-0 flex-col`}>
        {/* Téléphone : petit bandeau discret. */}
        <header className="sticky top-0 z-10 flex items-center justify-between bg-stone-50/85 px-4 py-2.5 backdrop-blur-md lg:hidden">
          <Link href="/accueil" className="flex items-center gap-2 font-extrabold text-teal-800">
            <span className="text-xl">🏡</span> {family.name}
          </Link>
          {me && (
            <Link href="/parametres" aria-label="Réglages" title="Réglages"
              className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm transition active:scale-90"
              style={{ background: me.color }}>
              {me.name.slice(0, 1)}
            </Link>
          )}
        </header>

        <main key={path} className="page-in flex-1 px-4 pb-32 pt-3 lg:px-8 lg:pb-12 lg:pt-8">{children}</main>
      </div>

      {/* Téléphone : barre du bas, 4 onglets + « Plus ». */}
      <nav className="fixed inset-x-0 bottom-0 z-20 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 rounded-[1.75rem] bg-surface/95 p-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.12)] ring-1 ring-stone-200/70 backdrop-blur-md">
          {tabs.map((t) => {
            const active = path.startsWith(t.href);
            return (
              <Link key={t.href} href={t.href}
                className={`flex flex-col items-center gap-0.5 rounded-3xl py-1.5 text-[11px] font-semibold transition active:scale-90 ${active ? "" : "text-stone-500"}`}
                style={active ? { background: t.soft, color: t.strong } : undefined}>
                <span className={`text-xl transition ${active ? "scale-110" : "grayscale-[40%]"}`}>{t.emoji}</span>
                {t.label}
              </Link>
            );
          })}
          <button onClick={() => setMoreOpen(true)}
            className={`flex flex-col items-center gap-0.5 rounded-3xl py-1.5 text-[11px] font-semibold transition active:scale-90 ${inMore ? "" : "text-stone-500"}`}
            style={inMore ? { background: "var(--color-teal-50)", color: "var(--color-teal-700)" } : undefined}>
            <span className={`text-xl transition ${inMore ? "scale-110" : ""}`}>✨</span>
            Plus
          </button>
        </div>
      </nav>

      {moreOpen && (
        <div className="fade-in fixed inset-0 z-30 flex items-end bg-black/30 backdrop-blur-[2px] lg:hidden" onClick={() => setMoreOpen(false)}>
          <div className="sheet-in w-full rounded-t-[2rem] bg-surface p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-stone-200" />
            <div className="grid grid-cols-3 gap-3">
              {more.map((s) => (
                <Link key={s.href} href={s.href}
                  className="flex flex-col items-center gap-1.5 rounded-3xl p-3 text-center text-sm font-bold transition active:scale-95"
                  style={{ background: s.soft, color: s.strong }}>
                  <span className="text-3xl">{s.emoji}</span>
                  {s.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
