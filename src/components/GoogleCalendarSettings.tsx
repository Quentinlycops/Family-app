"use client";
import { useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useFamily } from "@/lib/family";
import { useCalendarSettings, useEvents } from "@/lib/useEvents";
import type { CalendarFeed } from "@/lib/types";
import MemberPicker from "./MemberPicker";

export default function GoogleCalendarSettings() {
  const { family, me } = useFamily();
  const settings = useCalendarSettings();
  const { errors } = useEvents();
  const [form, setForm] = useState({ name: "", url: "", memberIds: me ? [me.id] : [] as string[] });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  if (!family) return null;
  const ref = doc(db, "families", family.id, "settings", "calendars");
  const feeds = settings.feeds ?? [];

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      // On vérifie le lien avant de l'enregistrer.
      const res = await fetch(`/api/ical?url=${encodeURIComponent(form.url.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const feed: CalendarFeed = {
        id: crypto.randomUUID().slice(0, 8),
        name: form.name.trim() || data.name || "Google Agenda",
        url: form.url.trim(),
        memberIds: form.memberIds,
      };
      await setDoc(ref, { feeds: [...feeds, feed] }, { merge: true });
      setForm({ ...form, name: "", url: "" });
    } catch (err) {
      setError((err as Error).message || "Lien invalide.");
    } finally {
      setBusy(false);
    }
  }

  const remove = (id: string) =>
    confirm("Retirer cet agenda ?") && setDoc(ref, { feeds: feeds.filter((f) => f.id !== id) }, { merge: true });

  async function enableExport() {
    const token = Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(36).padStart(2, "0")).join("").replace(/[^a-z0-9]/g, "");
    await setDoc(ref, { exportToken: token }, { merge: true });
  }

  const exportUrl = settings.exportToken
    ? `${location.origin}/api/agenda/${settings.exportToken}.ics`
    : "";

  return (
    <section className="card space-y-4">
      <h2 className="text-lg font-semibold">📆 Google Agenda</h2>

      <div className="space-y-2">
        <h3 className="font-semibold">Afficher vos agendas Google ici</h3>
        {feeds.map((f) => (
          <div key={f.id} className="flex items-center gap-2 rounded-xl bg-stone-100 px-3 py-2 text-sm">
            <span className="flex-1"><b>{f.name}</b> <span className="text-stone-500">· {f.memberIds.map((id) => family.members.find((m) => m.id === id)?.name).join(", ")}</span></span>
            <button className="text-stone-400 hover:text-red-600" onClick={() => remove(f.id)} aria-label="Retirer">×</button>
          </div>
        ))}
        {errors.map((e) => <p key={e} className="text-sm text-red-600">{e}</p>)}
        <details className="text-sm text-stone-600">
          <summary className="cursor-pointer text-teal-700">Où trouver l&apos;adresse secrète ?</summary>
          <ol className="mt-1 list-decimal space-y-0.5 pl-5">
            <li>Ouvre <a className="underline" href="https://calendar.google.com/calendar/r/settings" target="_blank" rel="noreferrer">les paramètres de Google Agenda</a> sur ordinateur.</li>
            <li>À gauche, clique sur ton agenda sous « Paramètres de mes agendas ».</li>
            <li>Section « Intégrer l&apos;agenda » : copie l&apos;<b>adresse secrète au format iCal</b>.</li>
          </ol>
        </details>
        <form onSubmit={add} className="space-y-2">
          <input className="input" placeholder="https://calendar.google.com/calendar/ical/…/private-…/basic.ics" value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })} required />
          <input className="input" placeholder="Nom affiché (ex. Agenda de Quentin)" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div className="text-sm">
            <span className="label">Ces événements concernent :</span>
            <MemberPicker value={form.memberIds} onChange={(memberIds) => setForm({ ...form, memberIds })} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn w-full" disabled={busy}>{busy ? "Vérification…" : "Ajouter cet agenda"}</button>
        </form>
      </div>

      <div className="space-y-2 border-t border-stone-200 pt-4">
        <h3 className="font-semibold">Voir l&apos;agenda familial dans Google Agenda</h3>
        {!exportUrl ? (
          <button className="btn w-full" onClick={enableExport}>Créer le lien d&apos;abonnement</button>
        ) : (
          <>
            <div className="flex gap-2">
              <code className="input flex-1 truncate select-all font-mono text-xs">{exportUrl}</code>
              <button className="btn" onClick={() => { navigator.clipboard.writeText(exportUrl); setCopied(true); }}>
                {copied ? "Copié" : "Copier"}
              </button>
            </div>
            <ol className="list-decimal space-y-0.5 pl-5 text-sm text-stone-600">
              <li>Dans <a className="underline" href="https://calendar.google.com/calendar/r/settings/addbyurl" target="_blank" rel="noreferrer">Google Agenda › Ajouter un agenda › À partir de l&apos;URL</a>, colle ce lien.</li>
              <li>Google rafraîchit l&apos;abonnement toutes les quelques heures. Pour un événement urgent, utilise le bouton « Ajouter à Google Agenda » de l&apos;événement.</li>
            </ol>
            <p className="text-xs text-stone-400">Garde ce lien pour vous : toute personne qui le connaît peut voir l&apos;agenda.</p>
          </>
        )}
      </div>
    </section>
  );
}
