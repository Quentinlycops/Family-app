"use client";
import { useState } from "react";
import { addDoc, deleteDoc, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useFamily } from "@/lib/family";
import { familyCol, useCollection } from "@/lib/useCollection";
import { addDays, fmtShort, fromISO, startOfWeek, toISO, today } from "@/lib/dates";
import { addShoppingItems } from "@/lib/shopping";
import type { MealSlot, Recipe } from "@/lib/types";
import Modal from "@/components/Modal";

const SLOTS = ["midi", "soir"] as const;

export default function RepasPage() {
  const { family } = useFamily();
  const { items: recipes } = useCollection<Recipe>("recipes");
  const { items: plan } = useCollection<MealSlot>("meals");
  const [tab, setTab] = useState<"semaine" | "recettes">("semaine");
  const [week, setWeek] = useState(toISO(startOfWeek(new Date())));
  const [editing, setEditing] = useState<Recipe | "new" | null>(null);
  const [message, setMessage] = useState("");
  if (!family) return null;

  const days = Array.from({ length: 7 }, (_, i) => toISO(addDays(fromISO(week), i)));
  const slotOf = (date: string, slot: string) => plan.find((p) => p.id === `${date}_${slot}`);
  const recipe = (id?: string) => recipes.find((r) => r.id === id);

  async function setSlot(date: string, slot: "midi" | "soir", value: string) {
    const id = `${date}_${slot}`;
    const ref = doc(db, "families", family!.id, "meals", id);
    if (!value) return deleteDoc(ref);
    const isRecipe = value.startsWith("r:");
    await setDoc(ref, { date, slot, ...(isRecipe ? { recipeId: value.slice(2) } : { text: value }) });
  }

  function randomIdea(date: string, slot: "midi" | "soir") {
    if (!recipes.length) return;
    const r = recipes[Math.floor(Math.random() * recipes.length)];
    setSlot(date, slot, `r:${r.id}`);
  }

  async function weekToShopping() {
    const ingredients = days.flatMap((d) =>
      SLOTS.flatMap((s) => recipe(slotOf(d, s)?.recipeId)?.ingredients ?? []),
    );
    const unique = [...new Set(ingredients.map((i) => i.trim()).filter(Boolean))];
    await addShoppingItems(family!.id, unique);
    setMessage(`${unique.length} ingrédient(s) ajouté(s) à la liste de courses.`);
    setTimeout(() => setMessage(""), 3000);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Repas</h1>
        <div className="flex rounded-xl bg-stone-200/70 p-1 text-sm">
          {(["semaine", "recettes"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-lg px-3 py-1 capitalize ${tab === t ? "bg-white shadow" : "text-stone-600"}`}>
              {t === "semaine" ? "Planning" : "Recettes"}
            </button>
          ))}
        </div>
      </div>

      {tab === "semaine" ? (
        <>
          <div className="flex items-center justify-between">
            <button className="btn-ghost" onClick={() => setWeek(toISO(addDays(fromISO(week), -7)))}>‹</button>
            <span className="font-medium">Semaine du {fmtShort(week)}</span>
            <button className="btn-ghost" onClick={() => setWeek(toISO(addDays(fromISO(week), 7)))}>›</button>
          </div>
          {days.map((d) => (
            <section key={d} className={`card ${d === today() ? "ring-2 ring-teal-600" : ""}`}>
              <h2 className="mb-2 font-semibold capitalize">{fmtShort(d)}</h2>
              {SLOTS.map((s) => {
                const cur = slotOf(d, s);
                const value = cur?.recipeId ? `r:${cur.recipeId}` : cur?.text ?? "";
                return (
                  <div key={s} className="mb-2 flex items-center gap-2">
                    <span className="w-10 text-xs uppercase text-stone-400">{s}</span>
                    <input list="recettes" className="input py-1.5"
                      placeholder="Choisir ou écrire…"
                      defaultValue={recipe(cur?.recipeId)?.name ?? cur?.text ?? ""}
                      key={value}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        const r = recipes.find((x) => x.name === v);
                        const next = r ? `r:${r.id}` : v;
                        if (next !== value) setSlot(d, s, next);
                      }} />
                    <button className="btn-ghost px-2" title="Idée au hasard" onClick={() => randomIdea(d, s)}>🎲</button>
                  </div>
                );
              })}
            </section>
          ))}
          <datalist id="recettes">
            {recipes.map((r) => <option key={r.id} value={r.name} />)}
          </datalist>
          <button className="btn w-full" onClick={weekToShopping}>🛒 Ajouter les ingrédients de la semaine aux courses</button>
          {message && <p className="text-center text-sm text-teal-700">{message}</p>}
        </>
      ) : (
        <>
          <button className="btn w-full" onClick={() => setEditing("new")}>+ Nouvelle recette</button>
          {recipes.length === 0 && (
            <p className="card text-center text-sm text-stone-400">
              Ajoutez vos plats préférés pour les retrouver dans le planning.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {[...recipes].sort((a, b) => a.name.localeCompare(b.name)).map((r) => (
              <button key={r.id} className="card text-left" onClick={() => setEditing(r)}>
                <h3 className="font-semibold">{r.name}</h3>
                <p className="line-clamp-2 text-sm text-stone-500">{r.ingredients.join(", ")}</p>
                {!!r.tags?.length && (
                  <p className="mt-1 flex flex-wrap gap-1">
                    {r.tags.map((t) => <span key={t} className="rounded-full bg-teal-50 px-2 text-xs text-teal-800">{t}</span>)}
                  </p>
                )}
              </button>
            ))}
          </div>
        </>
      )}

      {editing && <RecipeForm recipe={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function RecipeForm({ recipe, onClose }: { recipe?: Recipe; onClose: () => void }) {
  const { family } = useFamily();
  const [name, setName] = useState(recipe?.name ?? "");
  const [ingredients, setIngredients] = useState(recipe?.ingredients.join("\n") ?? "");
  const [tags, setTags] = useState(recipe?.tags?.join(", ") ?? "");
  const [notes, setNotes] = useState(recipe?.notes ?? "");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const data = {
      name: name.trim(),
      ingredients: ingredients.split("\n").map((s) => s.trim()).filter(Boolean),
      tags: tags.split(",").map((s) => s.trim()).filter(Boolean),
      notes,
    };
    if (recipe) await setDoc(doc(db, "families", family!.id, "recipes", recipe.id), data);
    else await addDoc(familyCol(family!.id, "recipes"), data);
    onClose();
  }

  async function remove() {
    if (!recipe || !confirm("Supprimer cette recette ?")) return;
    await deleteDoc(doc(db, "families", family!.id, "recipes", recipe.id));
    onClose();
  }

  return (
    <Modal title={recipe ? "Modifier la recette" : "Nouvelle recette"} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <input className="input text-lg" placeholder="Nom du plat" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        <div>
          <label className="label">Ingrédients (un par ligne)</label>
          <textarea className="input" rows={6} value={ingredients} onChange={(e) => setIngredients(e.target.value)} />
        </div>
        <input className="input" placeholder="Étiquettes : rapide, enfants, végé…" value={tags} onChange={(e) => setTags(e.target.value)} />
        <textarea className="input" rows={3} placeholder="Notes, étapes, lien…" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div className="flex justify-between">
          {recipe ? <button type="button" className="btn-ghost text-red-600" onClick={remove}>Supprimer</button> : <span />}
          <button className="btn">Enregistrer</button>
        </div>
      </form>
    </Modal>
  );
}
