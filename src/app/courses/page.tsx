"use client";
import { useEffect, useRef, useState } from "react";
import { deleteDoc, deleteField, doc, increment, onSnapshot, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useFamily } from "@/lib/family";
import { useCollection } from "@/lib/useCollection";
import { addShoppingItems } from "@/lib/shopping";
import { normalize } from "@/lib/search";
import { today } from "@/lib/dates";

type Stats = Record<string, { name: string; count: number; last: string }>;
import type { ShoppingItem } from "@/lib/types";

export default function CoursesPage() {
  const { family } = useFamily();
  const { items } = useCollection<ShoppingItem>("shopping");
  const [text, setText] = useState("");
  const [stats, setStats] = useState<Stats>({});
  // Glisser-déposer : ordre provisoire pendant qu'on déplace un article.
  const [dragIds, setDragIds] = useState<string[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  // Note en cours d'écriture (petit stylo).
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const fid = family?.id;
  useEffect(() => {
    if (!fid) return;
    return onSnapshot(doc(db, "families", fid, "settings", "shoppingStats"), (s) =>
      setStats((s.data()?.items as Stats) ?? {}),
    );
  }, [fid]);
  if (!family) return null;
  const statsRef = doc(db, "families", family.id, "settings", "shoppingStats");

  // Chaque article coché est compté : c'est la base des suggestions « habituels ».
  async function check(i: ShoppingItem) {
    await updateDoc(ref(i.id), { checked: true });
    await setDoc(statsRef, {
      items: { [normalize(i.name)]: { name: i.name, count: increment(1), last: today() } },
    }, { merge: true });
  }
  const ref = (id: string) => doc(db, "families", family.id, "shopping", id);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    // Plusieurs articles possibles, séparés par des virgules.
    await addShoppingItems(family!.id, text.split(","), items.filter((i) => !i.checked).map((i) => i.name));
    setText("");
  }

  async function clearChecked() {
    const batch = writeBatch(db);
    items.filter((i) => i.checked).forEach((i) => batch.delete(ref(i.id)));
    await batch.commit();
  }

  const open = items.filter((i) => !i.checked);
  const checked = items.filter((i) => i.checked);
  const inList = new Set(items.map((i) => normalize(i.name)));
  const suggestions = Object.entries(stats)
    .filter(([k]) => !inList.has(k))
    .sort(([, a], [, b]) => b.count - a.count || b.last.localeCompare(a.last))
    .slice(0, 12)
    .map(([, v]) => v);

  const sorted = [...open].sort((x, y) => (x.order ?? x.createdAt) - (y.order ?? y.createdAt));
  const byId = new Map(sorted.map((i) => [i.id, i]));
  const shown = dragIds ? dragIds.map((id) => byId.get(id)).filter((i): i is ShoppingItem => !!i) : sorted;

  function startDrag(e: React.PointerEvent, id: string) {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragId(id);
    setDragIds(sorted.map((i) => i.id));
  }

  function moveDrag(e: React.PointerEvent) {
    if (!dragId || !dragIds || !listRef.current) return;
    // On place l'article selon la position du doigt par rapport au milieu des autres lignes.
    const rows = [...listRef.current.querySelectorAll<HTMLElement>("li[data-id]")].filter((r) => r.dataset.id !== dragId);
    let index = rows.length;
    for (let k = 0; k < rows.length; k++) {
      const r = rows[k].getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) { index = k; break; }
    }
    const next = dragIds.filter((id) => id !== dragId);
    next.splice(index, 0, dragId);
    if (next.some((id, k) => id !== dragIds[k])) setDragIds(next);
  }

  async function endDrag() {
    if (!dragIds) return;
    const finalIds = dragIds;
    const batch = writeBatch(db);
    let changed = false;
    finalIds.forEach((id, k) => {
      if (byId.get(id)?.order !== k) { batch.update(ref(id), { order: k }); changed = true; }
    });
    setDragId(null);
    if (changed) await batch.commit();
    setDragIds(null);
  }

  function openNote(i: ShoppingItem) {
    setEditing(i.id);
    setDraft(i.note ?? "");
  }

  async function saveNote(id: string) {
    setEditing(null);
    await updateDoc(ref(id), { note: draft.trim() || deleteField() });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Liste de courses</h1>
        <span className="text-sm text-stone-500">{open.length} article{open.length > 1 ? "s" : ""}</span>
      </div>
      <form onSubmit={add} className="flex gap-2">
        <input className="input" placeholder="Lait, pain, couches…" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn">Ajouter</button>
      </form>
      {suggestions.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-400">Vos habituels</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button key={s.name} onClick={() => addShoppingItems(family.id, [s.name], items.filter((i) => !i.checked).map((i) => i.name))}
                className="rounded-full border border-stone-300 px-3 py-1 text-sm hover:border-teal-600 hover:text-teal-700">
                + {s.name}
              </button>
            ))}
          </div>
        </div>
      )}
      {shown.length === 0 && <p className="card text-center text-sm text-stone-400">La liste est vide.</p>}
      {shown.length > 0 && (
        <section className="card py-2">
          <ul ref={listRef}>
            {shown.map((i) => (
              <li key={i.id} data-id={i.id}
                className={`flex items-start gap-2 border-b border-stone-100 py-2 last:border-0 ${dragId === i.id ? "rounded-xl bg-teal-50 shadow-md ring-1 ring-teal-200" : ""}`}>
                <button type="button" aria-label="Déplacer" title="Glisser pour déplacer"
                  className="cursor-grab touch-none select-none px-1 pt-0.5 text-xl leading-6 text-stone-400 active:cursor-grabbing"
                  onPointerDown={(e) => startDrag(e, i.id)} onPointerMove={moveDrag}
                  onPointerUp={endDrag} onPointerCancel={endDrag}>⠿</button>
                <input type="checkbox" className="mt-0.5 h-6 w-6 shrink-0 accent-teal-700" checked={false}
                  onChange={() => check(i)} />
                <div className="min-w-0 flex-1">
                  <span className="leading-7">{i.name}{i.quantity && <span className="text-stone-500"> · {i.quantity}</span>}</span>
                  {editing === i.id ? (
                    <input autoFocus className="input mt-1 py-1 text-sm" placeholder="Une note (marque, taille…)"
                      value={draft} onChange={(e) => setDraft(e.target.value)}
                      onBlur={() => saveNote(i.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                        if (e.key === "Escape") setEditing(null);
                      }} />
                  ) : i.note ? (
                    <p className="cursor-text text-sm text-stone-500" onClick={() => openNote(i)}>📝 {i.note}</p>
                  ) : null}
                </div>
                <button type="button" aria-label="Note" title="Ajouter une note"
                  className={`px-1 pt-0.5 text-lg leading-6 ${i.note ? "text-teal-700" : "text-stone-400"} hover:text-teal-700`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => (editing === i.id ? saveNote(i.id) : openNote(i))}>✎</button>
                <button type="button" className="px-1 pt-0.5 text-xl leading-6 text-stone-400 hover:text-red-600" aria-label="Supprimer"
                  onClick={() => deleteDoc(ref(i.id))}>×</button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {checked.length > 0 && (
        <section className="card">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-400">Dans le panier</h2>
            <button className="text-sm text-teal-700 underline" onClick={clearChecked}>Vider</button>
          </div>
          <ul>
            {checked.map((i) => (
              <li key={i.id} className="flex items-center gap-3 py-1">
                <input type="checkbox" className="h-5 w-5 accent-teal-700" checked
                  onChange={() => updateDoc(ref(i.id), { checked: false })} />
                <span className="text-stone-400 line-through">{i.name}</span>
                {i.note && <span className="truncate text-sm text-stone-400">· {i.note}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
