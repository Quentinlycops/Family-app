"use client";
import { useState } from "react";
import { addDoc, deleteDoc, deleteField, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useFamily } from "@/lib/family";
import { familyCol, useCollection } from "@/lib/useCollection";
import { normalize } from "@/lib/search";
import { fmtShort, today } from "@/lib/dates";
import type { Outing } from "@/lib/types";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";

type Kind = Outing["kind"];
const KINDS: Record<Kind, { label: string; emoji: string; soft: string; strong: string }> = {
  famille: { label: "En famille", emoji: "👨‍👩‍👧‍👧", soft: "#fef3c7", strong: "#b45309" },
  couple: { label: "En couple", emoji: "💑", soft: "#fce7f3", strong: "#be185d" },
};

const mapsUrl = (address: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
const withScheme = (url: string) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);

export default function SortiesPage() {
  const { family } = useFamily();
  const { items, loading } = useCollection<Outing>("outings");
  const [filter, setFilter] = useState<Kind | "">("");
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<Kind>("famille");
  const [editing, setEditing] = useState<Outing | null>(null);
  const [q, setQ] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  if (!family) return null;
  const ref = (id: string) => doc(db, "families", family.id, "outings", id);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await addDoc(familyCol(family!.id, "outings"), {
      title: title.trim(), kind, done: false, createdAt: Date.now(),
    });
    setTitle("");
  }

  const toggle = (o: Outing) =>
    updateDoc(ref(o.id), o.done ? { done: false, doneDate: deleteField() } : { done: true, doneDate: today() });

  const needle = normalize(q.trim());
  const list = items
    .filter((o) => !filter || o.kind === filter)
    .filter((o) => !needle || normalize(`${o.title} ${o.address ?? ""} ${o.notes ?? ""}`).includes(needle));
  const todo = list.filter((o) => !o.done).sort((a, b) => b.createdAt - a.createdAt);
  const done = list.filter((o) => o.done).sort((a, b) => (b.doneDate ?? "").localeCompare(a.doneDate ?? ""));
  const count = (k: Kind | "") => items.filter((o) => !o.done && (!k || o.kind === k)).length;

  // « On fait quoi ? » : une idée au hasard parmi celles pas encore faites.
  function surprise() {
    if (!todo.length) return;
    const others = todo.length > 1 ? todo.filter((o) => o.id !== picked) : todo;
    const o = others[crypto.getRandomValues(new Uint32Array(1))[0] % others.length];
    setPicked(o.id);
    setTimeout(() => document.getElementById(`sortie-${o.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  }

  const card = (o: Outing) => {
    const k = KINDS[o.kind];
    const isPicked = picked === o.id && !o.done;
    return (
      <li key={o.id} id={`sortie-${o.id}`}
        className={`card flex items-start gap-3 p-3.5 transition ${isPicked ? "pop ring-4 ring-pink-300" : ""} ${o.done ? "opacity-70" : ""}`}>
        <button onClick={() => toggle(o)} aria-label={o.done ? "Marquer comme pas encore faite" : "C'est fait !"}
          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition active:scale-90 ${o.done ? "border-transparent bg-green-500 text-white" : "border-stone-300 hover:border-green-500"}`}>
          {o.done && "✓"}
        </button>
        <button className="min-w-0 flex-1 text-left" onClick={() => setEditing(o)}>
          <span className={`block font-bold leading-snug ${o.done ? "line-through decoration-stone-400" : ""}`}>{o.title}</span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="rounded-full px-2 py-0.5 font-bold" style={{ background: k.soft, color: k.strong }}>{k.emoji} {k.label}</span>
            {o.done && o.doneDate && <span className="text-stone-500">Fait le {fmtShort(o.doneDate)}</span>}
          </span>
          {o.notes && <span className="mt-1.5 line-clamp-2 block whitespace-pre-line text-sm text-stone-500">{o.notes}</span>}
        </button>
        <span className="flex shrink-0 flex-col gap-1">
          {o.address && (
            <a href={mapsUrl(o.address)} target="_blank" rel="noreferrer" title={o.address} aria-label="Voir sur la carte"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 transition hover:bg-stone-200 active:scale-90">📍</a>
          )}
          {o.link && (
            <a href={withScheme(o.link)} target="_blank" rel="noreferrer" title={o.link} aria-label="Ouvrir le lien"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 transition hover:bg-stone-200 active:scale-90">🔗</a>
          )}
        </span>
      </li>
    );
  };

  return (
    <div className="space-y-4">
      <PageHeader subtitle="En famille ou à deux">
        <button className="btn-ghost bg-pink-50 text-pink-700 hover:bg-pink-100" onClick={surprise} disabled={!todo.length}>
          🎲 On fait quoi ?
        </button>
      </PageHeader>

      <form onSubmit={add} className="card space-y-3">
        <input className="input" placeholder="Une idée : zoo, resto, balade en forêt…" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(KINDS) as Kind[]).map((key) => {
            const k = KINDS[key];
            const on = kind === key;
            return (
              <button key={key} type="button" onClick={() => setKind(key)}
                className="rounded-full border-2 px-3 py-1.5 text-sm font-bold transition active:scale-95"
                style={{ borderColor: on ? k.strong : "transparent", background: k.soft, color: k.strong }}>
                {k.emoji} {key === "famille" ? "Famille" : "Couple"}
              </button>
            );
          })}
          <button className="btn ml-auto" disabled={!title.trim()}>Ajouter</button>
        </div>
      </form>

      <div className="flex gap-1 overflow-x-auto rounded-full bg-stone-100 p-1 text-sm font-bold">
        {(["", "famille", "couple"] as const).map((key) => (
          <button key={key} onClick={() => setFilter(key)}
            className={`flex-1 whitespace-nowrap rounded-full px-3 py-1.5 transition ${filter === key ? "bg-surface shadow-sm" : "text-stone-500"}`}>
            {key ? `${KINDS[key].emoji} ${KINDS[key].label}` : "Toutes"} <span className="text-stone-400">{count(key)}</span>
          </button>
        ))}
      </div>

      {items.length > 6 && (
        <input className="input" type="search" placeholder="🔍 Rechercher une idée…" value={q} onChange={(e) => setQ(e.target.value)} />
      )}

      {!loading && todo.length === 0 && (
        <div className="card py-8 text-center text-stone-500">
          <p className="text-4xl">🎈</p>
          <p className="mt-2">{items.length ? "Toutes les idées sont faites, bravo !" : "Notez ici vos idées de sorties pour ne plus les oublier."}</p>
        </div>
      )}
      <ul className="space-y-2.5">
        {todo.map(card)}
      </ul>

      {done.length > 0 && (
        <div>
          <button className="btn-ghost text-sm text-stone-500" onClick={() => setShowDone(!showDone)}>
            {showDone ? "▾" : "▸"} Déjà faites ({done.length})
          </button>
          {showDone && <ul className="mt-2 space-y-2.5">{done.map(card)}</ul>}
        </div>
      )}

      {editing && <OutingForm outing={editing} onClose={() => setEditing(null)}
        onSave={(patch) => updateDoc(ref(editing.id), patch)}
        onDelete={() => deleteDoc(ref(editing.id))} />}
    </div>
  );
}

function OutingForm({ outing, onClose, onSave, onDelete }: {
  outing: Outing;
  onClose: () => void;
  onSave: (patch: Record<string, unknown>) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [f, setF] = useState({
    title: outing.title, kind: outing.kind, address: outing.address ?? "", link: outing.link ?? "", notes: outing.notes ?? "",
  });
  const set = (patch: Partial<typeof f>) => setF({ ...f, ...patch });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.title.trim()) return;
    const opt = (v: string) => v.trim() || deleteField();
    await onSave({ title: f.title.trim(), kind: f.kind, address: opt(f.address), link: opt(f.link), notes: opt(f.notes) });
    onClose();
  }

  return (
    <Modal title="Idée de sortie" onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <label className="block">
          <span className="label">Idée</span>
          <input className="input" value={f.title} onChange={(e) => set({ title: e.target.value })} required />
        </label>
        <div className="flex gap-2">
          {(Object.keys(KINDS) as Kind[]).map((key) => {
            const k = KINDS[key];
            const on = f.kind === key;
            return (
              <button key={key} type="button" onClick={() => set({ kind: key })}
                className="flex-1 rounded-2xl border-2 px-3 py-2 text-sm font-bold transition active:scale-95"
                style={{ borderColor: on ? k.strong : "transparent", background: k.soft, color: k.strong }}>
                {k.emoji} {k.label}
              </button>
            );
          })}
        </div>
        <label className="block">
          <span className="label">📍 Adresse</span>
          <input className="input" value={f.address} onChange={(e) => set({ address: e.target.value })} placeholder="Facultatif" />
        </label>
        <label className="block">
          <span className="label">🔗 Lien (site, réservation…)</span>
          <input className="input" value={f.link} onChange={(e) => set({ link: e.target.value })} placeholder="Facultatif" inputMode="url" />
        </label>
        <label className="block">
          <span className="label">📝 Notes</span>
          <textarea className="input min-h-24" value={f.notes} onChange={(e) => set({ notes: e.target.value })}
            placeholder="Horaires, prix, à réserver, idéal quand il pleut…" />
        </label>
        <div className="flex items-center justify-between pt-1">
          <button type="button" className="btn-ghost text-sm text-red-600"
            onClick={async () => { if (confirm("Supprimer cette idée ?")) { await onDelete(); onClose(); } }}>
            Supprimer
          </button>
          <button className="btn">Enregistrer</button>
        </div>
      </form>
    </Modal>
  );
}
