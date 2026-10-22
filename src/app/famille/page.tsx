"use client";
import { useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { saveMembers, useFamily } from "@/lib/family";
import { ageLabel, fmtLong } from "@/lib/dates";
import type { Member } from "@/lib/types";
import GoogleCalendarSettings from "@/components/GoogleCalendarSettings";
import Link from "next/link";

export default function FamillePage() {
  const { family, user, me } = useFamily();
  const [members, setMembers] = useState<Member[]>(family?.members ?? []);
  const [name, setName] = useState(family?.name ?? "");
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  if (!family) return null;

  const update = (id: string, patch: Partial<Member>) =>
    setMembers(members.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  async function save() {
    await saveMembers(family!.id, members, name.trim() || family!.name);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const otherParentLinked = family.members.filter((m) => m.role === "parent" && m.uid).length > 1;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">La famille</h1>

      {!otherParentLinked && (
        <section className="card space-y-2 bg-teal-50 ring-teal-200">
          <h2 className="font-semibold">Inviter l&apos;autre parent</h2>
          <p className="text-sm text-stone-600">
            Il ou elle crée son compte, choisit « Rejoindre » et colle ce code :
          </p>
          <div className="flex gap-2">
            <code className="input flex-1 select-all font-mono">{family.id}</code>
            <button className="btn" onClick={() => {
              navigator.clipboard.writeText(family.id);
              setCopied(true);
            }}>
              {copied ? "Copié" : "Copier"}
            </button>
          </div>
        </section>
      )}

      <section className="card space-y-4">
        <label className="block">
          <span className="label">Nom de la famille (affiché en haut)</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. Famille Lycops" />
        </label>
        {members.map((m) => (
          <div key={m.id} className="flex items-center gap-3">
            <input type="color" value={m.color} onChange={(e) => update(m.id, { color: e.target.value })}
              className="h-10 w-10 shrink-0 cursor-pointer rounded-full border-0 bg-transparent" aria-label={`Couleur de ${m.name}`} />
            <div className="min-w-0 flex-1">
              <input className="w-full bg-transparent font-medium outline-none" value={m.name}
                onChange={(e) => update(m.id, { name: e.target.value })} />
              <p className="text-xs text-stone-500">
                {ageLabel(m.birthDate)} · né(e) le {fmtLong(m.birthDate).replace(/^\S+ /, "")}{" "}
                {m.birthDate.slice(0, 4)}
                {m.role === "parent" && (m.uid ? " · compte lié" : " · pas encore de compte")}
              </p>
            </div>
            <input type="date" className="input w-40" value={m.birthDate}
              onChange={(e) => update(m.id, { birthDate: e.target.value })} />
          </div>
        ))}
        <div className="flex justify-end">
          <button className="btn" onClick={save}>{saved ? "Enregistré ✓" : "Enregistrer"}</button>
        </div>
      </section>

      <Link href="/enfants" className="card block font-medium text-teal-700">
        👧 Fiches des enfants : santé, vaccins, tailles, contacts ›
      </Link>

      <GoogleCalendarSettings />

      <section className="card flex items-center justify-between">
        <p className="text-sm text-stone-600">
          Connecté(e) en tant que <b>{me?.name}</b> ({user?.email})
        </p>
        <button className="btn-ghost text-sm" onClick={() => signOut(auth)}>Se déconnecter</button>
      </section>
    </div>
  );
}
