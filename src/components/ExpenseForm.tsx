"use client";
import { useEffect, useState } from "react";
import { addDoc, deleteDoc, deleteField, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useFamily } from "@/lib/family";
import { familyCol } from "@/lib/useCollection";
import { today } from "@/lib/dates";
import { dataUrlToObjectUrl, prepareFile } from "@/lib/files";
import type { BudgetSettings, Expense, ExpenseItem } from "@/lib/types";
import Modal from "@/components/Modal";
import MemberPicker from "@/components/MemberPicker";

const euro = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const num = (s: string) => parseFloat(s.replace(",", ".").replace(/\s/g, ""));
const PAYMENTS = ["Carte bancaire", "Espèces", "Virement", "Prélèvement", "Chèque", "Titre-restaurant"];

type Draft = {
  label: string;
  store: string;
  amount: string;
  date: string;
  time: string;
  category: string;
  memberIds: string[];
  paidBy: string;
  kind: "" | "ticket" | "facture";
  paymentMethod: string;
  invoiceNumber: string;
  dueDate: string;
  vat: string;
  notes: string;
  items: { label: string; quantity: string; amount: string }[];
};

// Justificatif : déjà enregistré, nouveau (pas encore enregistré) ou retiré.
type Attachment = { name: string; type: string; data?: string; saved?: boolean };

/**
 * Saisie complète d'une dépense, avec un justificatif optionnel (photo d'un ticket, facture PDF…)
 * rangé dans `receipts/{id}`. Sert aussi à ouvrir et corriger une dépense existante.
 */
export default function ExpenseForm({ settings, expense, onClose }: {
  settings: BudgetSettings;
  expense?: Expense;
  onClose: () => void;
}) {
  const { family, me } = useFamily();
  const parents = family?.members.filter((m) => m.role === "parent") ?? [];
  const [d, setD] = useState<Draft>(() => expense ? {
    label: expense.label,
    store: expense.store ?? "",
    amount: expense.amount.toFixed(2).replace(".", ","),
    date: expense.date,
    time: expense.time ?? "",
    category: expense.category,
    memberIds: expense.memberIds ?? [],
    paidBy: expense.paidBy,
    kind: expense.kind ?? "",
    paymentMethod: expense.paymentMethod ?? "",
    invoiceNumber: expense.invoiceNumber ?? "",
    dueDate: expense.dueDate ?? "",
    vat: expense.vat != null ? String(expense.vat) : "",
    notes: expense.notes ?? "",
    items: (expense.items ?? []).map((i) => ({ label: i.label, quantity: i.quantity != null ? String(i.quantity) : "", amount: String(i.amount) })),
  } : {
    label: "", store: "", amount: "", date: today(), time: "",
    category: settings.categories[0]?.name ?? "Autre",
    memberIds: [],
    paidBy: me?.role === "parent" ? me.id : parents[0]?.id ?? "",
    kind: "", paymentMethod: "", invoiceNumber: "", dueDate: "", vat: "", notes: "", items: [],
  });
  const [newCat, setNewCat] = useState("");
  const [file, setFile] = useState<Attachment | undefined>(() =>
    expense?.hasScan ? { name: expense.fileName ?? "Justificatif", type: expense.fileType ?? "", saved: true } : undefined);
  const [fileUrl, setFileUrl] = useState<string>();
  const [fileError, setFileError] = useState<string>();
  const [preparing, setPreparing] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<Draft>) => setD({ ...d, ...patch });
  const fid = family?.id;

  // Charge le justificatif déjà enregistré pour l'afficher.
  useEffect(() => {
    if (!fid || !expense?.hasScan) return;
    let url: string | undefined;
    getDoc(doc(db, "families", fid, "receipts", expense.id)).then(async (s) => {
      const data = s.data()?.data as string | undefined;
      if (!data) return;
      const type = data.slice(5, data.indexOf(";"));
      setFile((f) => (f?.saved ? { ...f, type: f.type || type, data } : f));
      setFileUrl((url = await dataUrlToObjectUrl(data)));
    });
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [fid, expense]);

  if (!family) return null;
  const allIds = family.members.map((m) => m.id);
  const everyone = d.memberIds.length === 0 || d.memberIds.length === allIds.length;
  const total = num(d.amount);
  const itemsSum = d.items.reduce((s, i) => s + (num(i.amount) || 0), 0);
  const mismatch = d.items.length > 0 && total > 0 && Math.abs(itemsSum - total) > 0.05;
  const setItem = (i: number, patch: Partial<Draft["items"][number]>) =>
    set({ items: d.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) });

  async function attach(f: File) {
    setFileError(undefined);
    setPreparing(true);
    try {
      const p = await prepareFile(f);
      if (fileUrl) URL.revokeObjectURL(fileUrl);
      setFile({ name: p.name, type: p.type, data: p.data });
      setFileUrl(await dataUrlToObjectUrl(p.data));
    } catch (e) {
      setFileError(e instanceof Error ? e.message : "Fichier illisible.");
    } finally {
      setPreparing(false);
    }
  }

  function detach() {
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    setFile(undefined);
    setFileUrl(undefined);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!total) return;
    setSaving(true);
    let category = d.category;
    if (category === "__new") {
      category = newCat.trim() || "Autre";
      if (!settings.categories.some((c) => c.name === category))
        await setDoc(doc(db, "families", family!.id, "settings", "budget"),
          { categories: [...settings.categories, { name: category, monthly: 0 }] });
    }
    const items: ExpenseItem[] = d.items
      .filter((i) => i.label.trim() && !isNaN(num(i.amount)))
      .map((i) => ({ label: i.label.trim(), amount: num(i.amount), ...(i.quantity && !isNaN(num(i.quantity)) && { quantity: num(i.quantity) }) }));
    const opt = <T,>(v: T) =>
      v === "" || (Array.isArray(v) && !v.length) || (typeof v === "number" && isNaN(v)) ? undefined : v;
    const fields: Record<string, unknown> = {
      store: opt(d.store.trim()),
      time: opt(d.time),
      memberIds: everyone ? undefined : d.memberIds,
      kind: opt(d.kind),
      items: opt(items),
      vat: d.vat ? opt(num(d.vat)) : undefined,
      paymentMethod: opt(d.paymentMethod.trim()),
      invoiceNumber: d.kind === "facture" ? opt(d.invoiceNumber.trim()) : undefined,
      dueDate: d.kind === "facture" ? opt(d.dueDate) : undefined,
      notes: opt(d.notes.trim()),
      hasScan: file ? true : undefined,
      fileName: file?.name,
      fileType: file?.type || undefined,
    };
    const base = {
      label: d.label.trim() || d.store.trim() || category,
      amount: total,
      category,
      date: d.date,
      paidBy: d.paidBy,
    };
    const fam = family!.id;
    let id = expense?.id;
    if (id) {
      // Les champs vidés sont retirés du document.
      await updateDoc(doc(db, "families", fam, "expenses", id), {
        ...base,
        ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v === undefined ? deleteField() : v])),
      });
      if (expense?.hasScan && !file) await deleteDoc(doc(db, "families", fam, "receipts", id));
    } else {
      const clean = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
      id = (await addDoc(familyCol(fam, "expenses"), { ...base, ...clean })).id;
    }
    if (file && !file.saved && file.data)
      await setDoc(doc(db, "families", fam, "receipts", id), { data: file.data, name: file.name, type: file.type });
    onClose();
  }

  const isImage = file?.type.startsWith("image/");

  return (
    <Modal title={expense ? "Dépense" : "Nouvelle dépense"} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Libellé" className="col-span-2">
            <input className="input" value={d.label} placeholder="ex. Courses de la semaine" autoFocus={!expense}
              onChange={(e) => set({ label: e.target.value })} />
          </Field>
          <Field label="Montant €">
            <input className="input font-semibold" inputMode="decimal" value={d.amount} onChange={(e) => set({ amount: e.target.value })} required />
          </Field>
          <Field label="Date">
            <input type="date" className="input" value={d.date} onChange={(e) => set({ date: e.target.value })} required />
          </Field>
          <Field label="Magasin / fournisseur">
            <input className="input" value={d.store} placeholder="ex. Carrefour" onChange={(e) => set({ store: e.target.value })} />
          </Field>
          <Field label="Heure">
            <input type="time" className="input" value={d.time} onChange={(e) => set({ time: e.target.value })} />
          </Field>
          <Field label="Catégorie" className="col-span-2">
            <select className="input" value={d.category} onChange={(e) => set({ category: e.target.value })}>
              {settings.categories.map((c) => <option key={c.name}>{c.name}</option>)}
              {!settings.categories.some((c) => c.name === d.category) && d.category !== "__new" && <option>{d.category}</option>}
              <option value="__new">+ Nouvelle catégorie…</option>
            </select>
            {d.category === "__new" && (
              <input className="input mt-2" placeholder="Nom de la catégorie" value={newCat} autoFocus onChange={(e) => setNewCat(e.target.value)} />
            )}
          </Field>
        </div>

        <div>
          <span className="mb-1 block text-xs font-medium text-stone-500">Qui est concerné ?</span>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => set({ memberIds: everyone ? [] : allIds })}
              className={`rounded-full border-2 border-stone-700 px-3 py-1 text-sm font-medium ${everyone ? "bg-stone-700 text-white" : "text-stone-700"}`}>
              Tout le monde
            </button>
            <MemberPicker value={everyone ? [] : d.memberIds} onChange={(ids) => set({ memberIds: ids })} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Payé par">
            <select className="input" value={d.paidBy} onChange={(e) => set({ paidBy: e.target.value })}>
              {parents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Moyen de paiement">
            <select className="input" value={d.paymentMethod} onChange={(e) => set({ paymentMethod: e.target.value })}>
              <option value="">—</option>
              {[...PAYMENTS, ...(d.paymentMethod && !PAYMENTS.includes(d.paymentMethod) ? [d.paymentMethod] : [])]
                .map((p) => <option key={p}>{p}</option>)}
            </select>
          </Field>
        </div>

        {/* Justificatif */}
        <div className="rounded-xl p-3 ring-1 ring-stone-200">
          <span className="mb-2 block text-xs font-medium text-stone-500">Justificatif (ticket de caisse, facture…)</span>
          {file ? (
            <div className="flex items-center gap-3">
              {isImage && fileUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <a href={fileUrl} target="_blank" rel="noreferrer"><img src={fileUrl} alt="Justificatif" className="h-16 w-16 rounded-lg object-cover ring-1 ring-stone-200" /></a>
                : <span className="flex h-16 w-16 items-center justify-center rounded-lg bg-stone-100 text-2xl">📄</span>}
              <span className="min-w-0 flex-1 truncate text-sm">
                {file.name}
                {fileUrl && <a href={fileUrl} target="_blank" rel="noreferrer" className="block text-teal-700 underline">Ouvrir</a>}
              </span>
              <button type="button" className="text-sm text-stone-500 hover:text-red-600" onClick={detach}>Retirer</button>
            </div>
          ) : (
            <div className="flex gap-2">
              <FilePick label="📷 Prendre une photo" accept="image/*" capture disabled={preparing} onFile={attach} />
              <FilePick label="📎 Joindre un fichier" accept="image/*,application/pdf" disabled={preparing} onFile={attach} />
            </div>
          )}
          {preparing && <p className="mt-2 text-sm text-stone-500">Préparation du fichier…</p>}
          {fileError && <p className="mt-2 text-sm text-red-600">{fileError}</p>}
        </div>

        <details className="rounded-xl ring-1 ring-stone-200" open={!!(d.kind || d.vat || d.notes)}>
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Plus de détails (facture, TVA, notes)</summary>
          <div className="grid grid-cols-2 gap-2 px-3 pb-3">
            <Field label="Type">
              <select className="input" value={d.kind} onChange={(e) => set({ kind: e.target.value as Draft["kind"] })}>
                <option value="">—</option>
                <option value="ticket">Ticket de caisse</option>
                <option value="facture">Facture</option>
              </select>
            </Field>
            <Field label="TVA €"><input className="input" inputMode="decimal" value={d.vat} onChange={(e) => set({ vat: e.target.value })} /></Field>
            {d.kind === "facture" && <>
              <Field label="N° de facture"><input className="input" value={d.invoiceNumber} onChange={(e) => set({ invoiceNumber: e.target.value })} /></Field>
              <Field label="Échéance"><input type="date" className="input" value={d.dueDate} onChange={(e) => set({ dueDate: e.target.value })} /></Field>
            </>}
            <Field label="Notes" className="col-span-2">
              <textarea className="input" rows={2} value={d.notes} onChange={(e) => set({ notes: e.target.value })} />
            </Field>
          </div>
        </details>

        <details className="rounded-xl ring-1 ring-stone-200" open={mismatch}>
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
            Détail des articles{d.items.length > 0 && ` (${d.items.length})`}
            {mismatch && <span className="ml-2 text-red-600">· à vérifier</span>}
          </summary>
          <div className="space-y-1 px-3 pb-3">
            {d.items.map((it, i) => (
              <div key={i} className="flex gap-1">
                <input className="input flex-1 py-1 text-sm" placeholder="Article" value={it.label} onChange={(e) => setItem(i, { label: e.target.value })} />
                <input className="input w-12 py-1 text-sm" inputMode="decimal" placeholder="qté" value={it.quantity} onChange={(e) => setItem(i, { quantity: e.target.value })} />
                <input className="input w-20 py-1 text-right text-sm" inputMode="decimal" placeholder="€" value={it.amount} onChange={(e) => setItem(i, { amount: e.target.value })} />
                <button type="button" className="px-1 text-stone-400 hover:text-red-600" aria-label="Retirer"
                  onClick={() => set({ items: d.items.filter((_, j) => j !== i) })}>×</button>
              </div>
            ))}
            <button type="button" className="text-sm text-teal-700 underline"
              onClick={() => set({ items: [...d.items, { label: "", quantity: "", amount: "" }] })}>+ Ajouter un article</button>
            {d.items.length > 0 && (
              <p className={`text-right text-xs ${mismatch ? "font-semibold text-red-600" : "text-stone-500"}`}>
                Somme des articles : {euro(itemsSum)}{mismatch && ` (montant ${euro(total)})`}
              </p>
            )}
          </div>
        </details>

        <button className="btn w-full" disabled={saving || preparing}>{expense ? "Enregistrer" : "Ajouter la dépense"}</button>
      </form>
    </Modal>
  );
}

function FilePick({ label, accept, capture, disabled, onFile }: {
  label: string; accept: string; capture?: boolean; disabled?: boolean; onFile: (f: File) => void;
}) {
  return (
    <label className="btn-ghost flex-1 cursor-pointer text-sm ring-1 ring-stone-200">
      {label}
      <input type="file" accept={accept} capture={capture ? "environment" : undefined} className="hidden" disabled={disabled}
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onFile(f); }} />
    </label>
  );
}

function Field({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-stone-500">{label}</span>
      {children}
    </label>
  );
}
