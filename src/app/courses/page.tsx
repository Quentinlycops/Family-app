"use client";
import { useEffect, useState } from "react";
import { deleteDoc, doc, increment, onSnapshot, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useFamily } from "@/lib/family";
import { useCollection } from "@/lib/useCollection";
import { addShoppingItems, AISLES } from "@/lib/shopping";
import { normalize } from "@/lib/search";
import { today } from "@/lib/dates";

type Stats = Record<string, { name: string; count: number; last: string }>;
import type { ShoppingItem } from "@/lib/types";

export default function CoursesPage() {
  const { family } = useFamily();
  const { items } = useCollection<ShoppingItem>("shopping");
  const [text, setText] = useState("");
  const [stats, setStats] = useState<Stats>({});
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

  const byAisle = AISLES.map((a) => ({
    aisle: a,
    list: open.filter((i) => i.aisle === a).sort((x, y) => x.name.localeCompare(y.name)),
  })).filter((g) => g.list.length);

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
      {byAisle.length === 0 && <p className="card text-center text-sm text-stone-400">La liste est vide.</p>}
      {byAisle.map((g) => (
        <section key={g.aisle} className="card">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-teal-800">{g.aisle}</h2>
          <ul>
            {g.list.map((i) => (
              <li key={i.id} className="flex items-center gap-3 py-1.5">
                <input type="checkbox" className="h-6 w-6 accent-teal-700" checked={false}
                  onChange={() => check(i)} />
                <span className="flex-1">{i.name}{i.quantity && <span className="text-stone-500"> · {i.quantity}</span>}</span>
                <select className="max-w-28 bg-transparent text-xs text-stone-400" value={i.aisle}
                  onChange={(e) => updateDoc(ref(i.id), { aisle: e.target.value })} aria-label="Rayon">
                  {AISLES.map((a) => <option key={a}>{a}</option>)}
                </select>
                <button className="text-stone-400 hover:text-red-600" aria-label="Supprimer"
                  onClick={() => deleteDoc(ref(i.id))}>×</button>
              </li>
            ))}
          </ul>
        </section>
      ))}
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
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
