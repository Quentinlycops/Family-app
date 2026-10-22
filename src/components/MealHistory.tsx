"use client";
import { useMemo, useState } from "react";
import { deleteDoc, deleteField, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useFamily } from "@/lib/family";
import { addDays, daysAgo, fmtShort, toISO, today } from "@/lib/dates";
import { matches } from "@/lib/search";
import type { MealSlot, Recipe } from "@/lib/types";

/** Historique de tous les repas passés, avec recherche par mot-clé et statistiques. */
export default function MealHistory({ meals, recipes }: { meals: MealSlot[]; recipes: Recipe[] }) {
  const { family } = useFamily();
  const [q, setQ] = useState("");
  const [log, setLog] = useState({ date: today(), slot: "soir" as "midi" | "soir", dish: "", note: "" });
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const recipe = (id?: string) => recipes.find((r) => r.id === id);
  const nameOf = (m: MealSlot) => recipe(m.recipeId)?.name ?? m.text ?? "";

  const past = useMemo(
    () => meals.filter((m) => m.date <= today() && (m.recipeId || m.text))
      .sort((a, b) => b.id.localeCompare(a.id)),
    [meals],
  );

  const results = q.trim()
    ? past.filter((m) => {
        const r = recipe(m.recipeId);
        return matches(q, nameOf(m), m.note, r?.tags?.join(" "), r?.ingredients.join(" "), r?.notes, fmtShort(m.date));
      })
    : past;

  // Plats les plus mangés et date de la dernière fois.
  const stats = useMemo(() => {
    const map = new Map<string, { name: string; count: number; last: string }>();
    for (const m of past) {
      const name = nameOf(m);
      const key = name.toLowerCase();
      const cur = map.get(key);
      if (cur) cur.count++;
      else map.set(key, { name, count: 1, last: m.date });
    }
    return [...map.values()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [past, recipes]);
  const top = [...stats].sort((a, b) => b.count - a.count).slice(0, 5);
  const forgotten = recipes
    .map((r) => ({ r, last: stats.find((s) => s.name.toLowerCase() === r.name.toLowerCase())?.last }))
    .filter((x) => !x.last || x.last < toISO(addDays(new Date(), -30)))
    .sort((a, b) => (a.last ?? "").localeCompare(b.last ?? ""))
    .slice(0, 5);

  async function addLog(e: React.FormEvent) {
    e.preventDefault();
    if (!family || !log.dish.trim()) return;
    const r = recipes.find((x) => x.name.toLowerCase() === log.dish.trim().toLowerCase());
    await setDoc(doc(db, "families", family.id, "meals", `${log.date}_${log.slot}`), {
      date: log.date,
      slot: log.slot,
      ...(r ? { recipeId: r.id, text: deleteField() } : { text: log.dish.trim(), recipeId: deleteField() }),
      ...(log.note.trim() ? { note: log.note.trim() } : {}),
    }, { merge: true });
    setLog({ ...log, dish: "", note: "" });
  }

  const saveNote = (m: MealSlot, note: string) =>
    setDoc(doc(db, "families", family!.id, "meals", m.id), { note: note.trim() || deleteField() }, { merge: true });

  return (
    <div className="space-y-4">
      <input className="input" type="search" placeholder="🔍 Rechercher : poulet, pâtes, mamie, anniversaire…"
        value={q} onChange={(e) => setQ(e.target.value)} />

      {!q && (
        <form onSubmit={addLog} className="card space-y-2">
          <h2 className="font-semibold">Noter un repas</h2>
          <div className="flex gap-2">
            <input type="date" className="input w-auto" value={log.date} max={today()}
              onChange={(e) => setLog({ ...log, date: e.target.value })} />
            <select className="input w-auto" value={log.slot}
              onChange={(e) => setLog({ ...log, slot: e.target.value as "midi" | "soir" })}>
              <option value="midi">Midi</option>
              <option value="soir">Soir</option>
            </select>
          </div>
          <input className="input" list="recettes-hist" placeholder="Qu'avez-vous mangé ?" value={log.dish}
            onChange={(e) => setLog({ ...log, dish: e.target.value })} />
          <datalist id="recettes-hist">
            {recipes.map((r) => <option key={r.id} value={r.name} />)}
            {stats.filter((s) => !recipes.some((r) => r.name === s.name)).map((s) => <option key={s.name} value={s.name} />)}
          </datalist>
          <input className="input" placeholder="Souvenir (facultatif) : chez mamie, Léa a adoré…" value={log.note}
            onChange={(e) => setLog({ ...log, note: e.target.value })} />
          <button className="btn w-full">Enregistrer</button>
        </form>
      )}

      {!q && top.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <section className="card">
            <h2 className="mb-2 font-semibold">🏆 Les plus mangés</h2>
            <ol className="space-y-1 text-sm">
              {top.map((s) => (
                <li key={s.name} className="flex justify-between gap-2">
                  <button className="truncate text-left hover:underline" onClick={() => setQ(s.name)}>{s.name}</button>
                  <span className="shrink-0 text-stone-500">{s.count}× · {daysAgo(s.last)}</span>
                </li>
              ))}
            </ol>
          </section>
          {forgotten.length > 0 && (
            <section className="card">
              <h2 className="mb-2 font-semibold">💡 Pas mangé depuis longtemps</h2>
              <ul className="space-y-1 text-sm">
                {forgotten.map(({ r, last }) => (
                  <li key={r.id} className="flex justify-between gap-2">
                    <span className="truncate">{r.name}</span>
                    <span className="shrink-0 text-stone-500">{last ? daysAgo(last) : "jamais"}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <section className="card">
        <h2 className="mb-2 font-semibold">
          {q ? `${results.length} résultat${results.length > 1 ? "s" : ""}` : `Tous les repas (${past.length})`}
        </h2>
        {results.length === 0 && <p className="py-3 text-center text-sm text-stone-400">Aucun repas trouvé.</p>}
        <ul className="divide-y divide-stone-100">
          {results.slice(0, q ? 200 : 60).map((m) => (
            <li key={m.id} className="py-2">
              <div className="flex items-baseline gap-3">
                <span className="w-24 shrink-0 text-xs text-stone-500">{fmtShort(m.date)} · {m.slot}</span>
                <span className="flex-1 font-medium">{nameOf(m)}</span>
                <button className="text-xs text-stone-400 hover:text-teal-700" onClick={() => setEditingNote(m.id)}>
                  {m.note ? "✏️" : "+ souvenir"}
                </button>
                <button className="text-stone-400 hover:text-red-600" aria-label="Supprimer"
                  onClick={() => confirm("Retirer ce repas de l'historique ?") && deleteDoc(doc(db, "families", family!.id, "meals", m.id))}>×</button>
              </div>
              {editingNote === m.id ? (
                <input autoFocus className="input mt-1 py-1 text-sm" defaultValue={m.note}
                  placeholder="Souvenir, appréciation…"
                  onBlur={(e) => { saveNote(m, e.target.value); setEditingNote(null); }}
                  onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />
              ) : m.note && (
                <p className="ml-27 text-sm text-stone-500">💬 {m.note}</p>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
