"use client";
import { useState } from "react";
import { deleteDoc, doc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useFamily } from "@/lib/family";
import { useCollection } from "@/lib/useCollection";
import { addShoppingItems, AISLES } from "@/lib/shopping";
import type { ShoppingItem } from "@/lib/types";

export default function CoursesPage() {
  const { family } = useFamily();
  const { items } = useCollection<ShoppingItem>("shopping");
  const [text, setText] = useState("");
  if (!family) return null;
  const ref = (id: string) => doc(db, "families", family.id, "shopping", id);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    // Plusieurs articles possibles, séparés par des virgules.
    await addShoppingItems(family!.id, text.split(","));
    setText("");
  }

  async function clearChecked() {
    const batch = writeBatch(db);
    items.filter((i) => i.checked).forEach((i) => batch.delete(ref(i.id)));
    await batch.commit();
  }

  const open = items.filter((i) => !i.checked);
  const checked = items.filter((i) => i.checked);
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
      {byAisle.length === 0 && <p className="card text-center text-sm text-stone-400">La liste est vide.</p>}
      {byAisle.map((g) => (
        <section key={g.aisle} className="card">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-teal-800">{g.aisle}</h2>
          <ul>
            {g.list.map((i) => (
              <li key={i.id} className="flex items-center gap-3 py-1.5">
                <input type="checkbox" className="h-6 w-6 accent-teal-700" checked={false}
                  onChange={() => updateDoc(ref(i.id), { checked: true })} />
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
