"use client";
import Link from "next/link";
import { useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useFamily } from "@/lib/family";
import { getThemePref, setThemePref, type ThemePref } from "@/lib/theme";
import PageHeader from "@/components/PageHeader";

const THEMES: { value: ThemePref; label: string; emoji: string }[] = [
  { value: "light", label: "Clair", emoji: "☀️" },
  { value: "dark", label: "Sombre", emoji: "🌙" },
  { value: "auto", label: "Auto", emoji: "📱" },
];

const LINKS = [
  { href: "/parametres/couleurs", emoji: "🎨", label: "Couleurs", hint: "La couleur de chacun dans l'agenda" },
  { href: "/parametres/google", emoji: "📆", label: "Agendas Google", hint: "Importer et partager avec Google Agenda" },
  { href: "/famille", emoji: "👨‍👩‍👧‍👧", label: "Famille", hint: "Membres, dates de naissance, invitation" },
  { href: "/contacts", emoji: "📞", label: "Contacts", hint: "Pédiatre, crèche, grands-parents…" },
];

export default function ParametresPage() {
  const { family, user, me } = useFamily();
  const [theme, setTheme] = useState<ThemePref>(() => (typeof window === "undefined" ? "auto" : getThemePref()));
  if (!family) return null;

  return (
    <div className="space-y-4">
      <PageHeader />

      <section className="card space-y-3">
        <h2 className="font-extrabold">Affichage</h2>
        <div className="flex gap-1 rounded-full bg-stone-100 p-1 text-sm font-bold">
          {THEMES.map((t) => (
            <button key={t.value} onClick={() => { setTheme(t.value); setThemePref(t.value); }}
              className={`flex-1 rounded-full px-3 py-2 transition ${theme === t.value ? "bg-surface shadow-sm" : "text-stone-500"}`}>
              {t.emoji} {t.label}
            </button>
          ))}
        </div>
        {theme === "auto" && <p className="text-xs text-stone-500">Suit le réglage clair ou sombre du téléphone.</p>}
      </section>

      <nav className="card divide-y divide-stone-100 py-1">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="flex items-center gap-3 py-3 transition active:opacity-70">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-stone-100 text-xl">{l.emoji}</span>
            <span className="min-w-0 flex-1">
              <b className="block">{l.label}</b>
              <span className="block truncate text-xs text-stone-500">{l.hint}</span>
            </span>
            <span className="text-xl text-stone-300">›</span>
          </Link>
        ))}
      </nav>

      <section className="card flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-stone-600">
          Connecté(e) : <b>{me?.name}</b> <span className="text-stone-400">({user?.email})</span>
        </p>
        <button className="btn-ghost text-sm text-red-600" onClick={() => signOut(auth)}>Se déconnecter</button>
      </section>
    </div>
  );
}
