"use client";
import { useEffect, useState } from "react";
import { deleteDoc, doc, onSnapshot, setDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useFamily } from "@/lib/family";
import { useCollection } from "@/lib/useCollection";
import { fmtMonth, fmtShort, today } from "@/lib/dates";
import type { BudgetSettings, Expense } from "@/lib/types";
import Modal from "@/components/Modal";
import ExpenseForm from "@/components/ExpenseForm";
import { JOINT, balance } from "@/lib/budget";

const DEFAULT_CATEGORIES = [
  { name: "Courses", monthly: 600 },
  { name: "Enfants", monthly: 300 },
  { name: "Maison", monthly: 150 },
  { name: "Transport", monthly: 150 },
  { name: "Loisirs", monthly: 150 },
  { name: "Santé", monthly: 50 },
  { name: "Autre", monthly: 100 },
];

const euro = (n: number) =>
  n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

export default function BudgetPage() {
  const { family, member } = useFamily();
  const { items } = useCollection<Expense>("expenses");
  const [month, setMonth] = useState(today().slice(0, 7));
  const [settings, setSettings] = useState<BudgetSettings>({ categories: DEFAULT_CATEGORIES });
  const [editingBudget, setEditingBudget] = useState(false);
  const [editing, setEditing] = useState<Expense | "new">();
  const [catFilter, setCatFilter] = useState<string>();
  const fid = family?.id;

  useEffect(() => {
    if (!fid) return;
    return onSnapshot(doc(db, "families", fid, "settings", "budget"), (s) => {
      if (s.exists()) setSettings(s.data() as BudgetSettings);
    });
  }, [fid]);

  if (!family) return null;
  const parents = family.members.filter((m) => m.role === "parent");
  const owed = balance(items, parents);

  async function settle() {
    if (!owed || !confirm(`${owed.from.name} a remboursé ${euro(owed.amount)} à ${owed.to.name} ?`)) return;
    const batch = writeBatch(db);
    for (const e of owed.open) batch.update(doc(db, "families", family!.id, "expenses", e.id), { settled: true });
    await batch.commit();
  }

  const shift = (n: number) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + n, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const monthly = items.filter((e) => e.date.startsWith(month)).sort((a, b) => b.date.localeCompare(a.date));
  const shown = catFilter ? monthly.filter((e) => e.category === catFilter) : monthly;
  const total = monthly.reduce((s, e) => s + e.amount, 0);
  const planned = settings.categories.reduce((s, c) => s + c.monthly, 0);
  const spentIn = (cat: string) => monthly.filter((e) => e.category === cat).reduce((s, e) => s + e.amount, 0);
  const paidBy = (id: string) => monthly.filter((e) => e.paidBy === id).reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button className="btn-ghost" onClick={() => shift(-1)}>‹</button>
        <h1 className="text-xl font-semibold capitalize">{fmtMonth(new Date(`${month}-01T12:00`))}</h1>
        <button className="btn-ghost" onClick={() => shift(1)}>›</button>
      </div>

      <button className="btn w-full py-3 text-base" onClick={() => setEditing("new")}>
        ＋ Ajouter une dépense
      </button>

      <section className="card">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-stone-500">Dépensé</span>
          <span className="text-sm text-stone-500">Budget {euro(planned)}</span>
        </div>
        <p className={`text-3xl font-bold ${total > planned ? "text-red-600" : "text-teal-800"}`}>{euro(total)}</p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 whitespace-nowrap text-sm">
          {parents.map((p) => (
            <span key={p.id}><b style={{ color: p.color }}>{p.name}</b> : {euro(paidBy(p.id))}</span>
          ))}
          {paidBy(JOINT) > 0 && <span><b>Ensemble</b> : {euro(paidBy(JOINT))}</span>}
        </div>
      </section>

      {owed && owed.open.length > 0 && (
        <section className="card flex items-center gap-3">
          <span className="flex-1 text-sm">
            <span className="block text-stone-500">Comptes entre vous</span>
            {owed.amount > 0
              ? <><b style={{ color: owed.from.color }}>{owed.from.name}</b> doit <b>{euro(owed.amount)}</b> à <b style={{ color: owed.to.color }}>{owed.to.name}</b></>
              : <>Vous êtes quittes.</>}
            <span className="block text-xs text-stone-400">{owed.open.length} dépense{owed.open.length > 1 ? "s" : ""} partagée{owed.open.length > 1 ? "s" : ""} à régler</span>
          </span>
          <button className="btn-ghost text-sm ring-1 ring-stone-200" onClick={settle}>C&apos;est réglé</button>
        </section>
      )}

      <section className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Par catégorie</h2>
          <button className="text-sm text-teal-700 underline" onClick={() => setEditingBudget(true)}>Modifier le budget</button>
        </div>
        {settings.categories.map((c) => {
          const spent = spentIn(c.name);
          const pct = c.monthly ? Math.min(100, (spent / c.monthly) * 100) : 0;
          return (
            <button key={c.name} type="button" className={`block w-full text-left ${catFilter && catFilter !== c.name ? "opacity-40" : ""}`}
              onClick={() => setCatFilter(catFilter === c.name ? undefined : c.name)}>
              <div className="flex justify-between text-sm">
                <span>{c.name}</span>
                <span className={spent > c.monthly ? "font-semibold text-red-600" : "text-stone-500"}>
                  {euro(spent)} / {euro(c.monthly)}
                </span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-stone-100">
                <div className={`h-2 rounded-full ${spent > c.monthly ? "bg-red-500" : "bg-teal-600"}`} style={{ width: `${pct}%` }} />
              </div>
            </button>
          );
        })}
      </section>

      <section className="card">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Dépenses du mois</h2>
          {catFilter && <button className="chip" onClick={() => setCatFilter(undefined)}>{catFilter} ×</button>}
        </div>
        {shown.length === 0 && <p className="text-sm text-stone-400">Aucune dépense.</p>}
        <ul className="divide-y divide-stone-100">
          {shown.map((e) => (
            <li key={e.id} className="flex items-center gap-3 py-2 text-sm">
              <button className="flex flex-1 items-center gap-3 text-left" onClick={() => setEditing(e)}>
                <span className="w-20 text-stone-500">{fmtShort(e.date)}</span>
                <span className="flex-1">
                  {e.label}{e.hasScan && <span className="ml-1 text-xs" aria-label="Justificatif joint">📎</span>}
                  <span className="block text-xs text-stone-400">
                    {e.category} · {e.paidBy === JOINT ? "Ensemble" : member(e.paidBy)?.name}
                    {e.shared && (e.settled ? " · partagé, réglé" : " · partagé")}
                    {e.memberIds?.length ? ` · pour ${e.memberIds.map((id) => member(id)?.name).filter(Boolean).join(", ")}` : ""}
                  </span>
                </span>
                <b>{euro(e.amount)}</b>
              </button>
              <button className="text-stone-400 hover:text-red-600" aria-label="Supprimer"
                onClick={async () => {
                  if (!confirm("Supprimer cette dépense ?")) return;
                  await deleteDoc(doc(db, "families", family.id, "expenses", e.id));
                  if (e.hasScan) await deleteDoc(doc(db, "families", family.id, "receipts", e.id));
                }}>×</button>
            </li>
          ))}
        </ul>
      </section>

      {editing && (
        <ExpenseForm expense={editing === "new" ? undefined : editing} settings={settings} onClose={() => setEditing(undefined)} />
      )}

      {editingBudget && (
        <BudgetEditor settings={settings} onClose={() => setEditingBudget(false)}
          onSave={(s) => setDoc(doc(db, "families", family.id, "settings", "budget"), s)} />
      )}
    </div>
  );
}

function BudgetEditor({ settings, onSave, onClose }: {
  settings: BudgetSettings;
  onSave: (s: BudgetSettings) => Promise<void>;
  onClose: () => void;
}) {
  const [cats, setCats] = useState(settings.categories);
  const set = (i: number, patch: Partial<{ name: string; monthly: number }>) =>
    setCats(cats.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  return (
    <Modal title="Budget mensuel" onClose={onClose}>
      <div className="space-y-2">
        {cats.map((c, i) => (
          <div key={i} className="flex gap-2">
            <input className="input" value={c.name} onChange={(e) => set(i, { name: e.target.value })} />
            <input className="input w-28" inputMode="decimal" value={c.monthly}
              onChange={(e) => set(i, { monthly: Number(e.target.value.replace(",", ".")) || 0 })} />
            <button className="btn-ghost" onClick={() => setCats(cats.filter((_, j) => j !== i))} aria-label="Retirer">×</button>
          </div>
        ))}
        <button className="btn-ghost text-sm" onClick={() => setCats([...cats, { name: "Nouvelle catégorie", monthly: 0 }])}>
          + Ajouter une catégorie
        </button>
        <div className="flex justify-end">
          <button className="btn" onClick={async () => { await onSave({ categories: cats.filter((c) => c.name.trim()) }); onClose(); }}>
            Enregistrer
          </button>
        </div>
      </div>
    </Modal>
  );
}
