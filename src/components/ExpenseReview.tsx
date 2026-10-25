"use client";
import { useEffect, useState } from "react";
import { addDoc, doc, getDoc, setDoc, updateDoc, deleteField } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useFamily } from "@/lib/family";
import { familyCol } from "@/lib/useCollection";
import { today } from "@/lib/dates";
import type { BudgetSettings, Expense, ExpenseItem, ScanResult } from "@/lib/types";
import Modal from "@/components/Modal";
import MemberPicker from "@/components/MemberPicker";

const euro = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const num = (s: string) => parseFloat(s.replace(",", ".").replace(/\s/g, ""));
const MAX_KEPT = 900_000; // une image gardée doit tenir dans un document Firestore (1 Mo)

const toDataUrl = (b: Blob) =>
  new Promise<string>((ok, ko) => {
    const r = new FileReader();
    r.onload = () => ok(r.result as string);
    r.onerror = ko;
    r.readAsDataURL(b);
  });

type Draft = {
  label: string;
  store: string;
  amount: string;
  date: string;
  time: string;
  category: string;
  memberIds: string[];
  paidBy: string;
  kind: "ticket" | "facture";
  paymentMethod: string;
  invoiceNumber: string;
  dueDate: string;
  vat: string;
  notes: string;
  items: { label: string; quantity: string; amount: string }[];
};

const fromExpense = (e: Expense): Draft => ({
  label: e.label,
  store: e.store ?? "",
  amount: String(e.amount),
  date: e.date,
  time: e.time ?? "",
  category: e.category,
  memberIds: e.memberIds ?? [],
  paidBy: e.paidBy,
  kind: e.kind ?? "ticket",
  paymentMethod: e.paymentMethod ?? "",
  invoiceNumber: e.invoiceNumber ?? "",
  dueDate: e.dueDate ?? "",
  vat: e.vat != null ? String(e.vat) : "",
  notes: e.notes ?? "",
  items: (e.items ?? []).map((i) => ({ label: i.label, quantity: i.quantity != null ? String(i.quantity) : "", amount: String(i.amount) })),
});

const fromScan = (s: ScanResult, categories: string[], paidBy: string, allIds: string[]): Draft => ({
  label: s.store ?? "",
  store: s.store ?? "",
  amount: s.total != null ? String(s.total) : "",
  date: s.date ?? today(),
  time: s.time ?? "",
  category: categories.find((c) => c.toLowerCase() === s.suggestedCategory?.toLowerCase()) ?? categories[0] ?? "Autre",
  memberIds: allIds,
  paidBy,
  kind: s.kind === "facture" ? "facture" : "ticket",
  paymentMethod: s.paymentMethod ?? "",
  invoiceNumber: s.invoiceNumber ?? "",
  dueDate: s.dueDate ?? "",
  vat: s.vat != null ? String(s.vat) : "",
  notes: [s.period && `Période : ${s.period}`, s.discount && `Remises : ${euro(s.discount)}`, s.address, s.notes]
    .filter(Boolean).join("\n"),
  items: s.items.map((i) => ({ label: i.label, quantity: i.quantity != null ? String(i.quantity) : "", amount: String(i.amount) })),
});

/**
 * Boutons « Scanner un ticket » / « Importer une facture » : le document est lu dans le navigateur
 * (texte du PDF ou OCR), analysé par règles, puis ouvert dans l'écran de vérification.
 */
export function ScanButtons({ settings }: { settings: BudgetSettings }) {
  const { family, me } = useFamily();
  const [busy, setBusy] = useState<{ image?: string; label: string; pct?: number }>();
  const [error, setError] = useState<string>();
  const [review, setReview] = useState<{ draft: Draft; scan?: string; preview: string; text: string }>();
  if (!family) return null;
  const parents = family.members.filter((m) => m.role === "parent");

  async function read(file: File) {
    setError(undefined);
    const isPdf = file.type === "application/pdf";
    const image = isPdf ? undefined : URL.createObjectURL(file);
    setBusy({ image, label: "Préparation…" });
    try {
      const [{ readDocument }, { parseReceipt }] = await Promise.all([import("@/lib/receipt-read"), import("@/lib/receipt-parse")]);
      const { text, preview } = await readDocument(file, (label, pct) => setBusy({ image, label, pct }));
      // On garde le PDF d'origine s'il est léger, sinon l'image de la première page.
      let kept: string | undefined = preview;
      if (isPdf) {
        const data = await toDataUrl(file);
        if (data.length < MAX_KEPT) kept = data;
      }
      if (kept.length > MAX_KEPT) kept = undefined;
      const names = settings.categories.map((c) => c.name);
      setReview({
        draft: fromScan(parseReceipt(text, names), names,
          me?.role === "parent" ? me.id : parents[0].id, family!.members.map((m) => m.id)),
        scan: kept,
        preview,
        text,
      });
    } catch (e) {
      console.error(e);
      setError(isPdf ? "Ce PDF n'a pas pu être lu." : "Cette image n'a pas pu être lue.");
    } finally {
      if (image) URL.revokeObjectURL(image);
      setBusy(undefined);
    }
  }

  const picker = (icon: string, label: string, hint: string, accept: string, capture?: boolean) => (
    <label className="btn flex-1 cursor-pointer flex-col py-3 text-center">
      <span className="text-2xl">{icon}</span>
      <span>{label}</span>
      <span className="text-xs font-normal opacity-80">{hint}</span>
      <input type="file" accept={accept} capture={capture ? "environment" : undefined} className="hidden" disabled={!!busy}
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) read(f); }} />
    </label>
  );

  return (
    <>
      <div className="flex gap-2">
        {picker("📷", "Scanner un ticket", "prendre une photo", "image/*", true)}
        {picker("📄", "Importer une facture", "PDF ou image", "image/*,application/pdf")}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {busy && (
        <Modal title="Lecture en cours…" onClose={() => {}}>
          <div className="flex flex-col items-center gap-3 py-4 text-sm text-stone-500">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {busy.image && <img src={busy.image} alt="" className="max-h-60 rounded-xl object-contain opacity-70" />}
            <span className="animate-pulse">{busy.label}</span>
            {busy.pct != null && (
              <div className="h-2 w-full max-w-xs rounded-full bg-stone-100">
                <div className="h-2 rounded-full bg-teal-600 transition-all" style={{ width: `${busy.pct}%` }} />
              </div>
            )}
          </div>
        </Modal>
      )}
      {review && (
        <ExpenseReview initial={review.draft} settings={settings} scan={review.scan} preview={review.preview}
          text={review.text} onClose={() => setReview(undefined)} />
      )}
    </>
  );
}

/** Ouvre une dépense existante dans l'écran de vérification. */
export function EditExpense({ expense, settings, onClose }: { expense: Expense; settings: BudgetSettings; onClose: () => void }) {
  return <ExpenseReview initial={fromExpense(expense)} settings={settings} expense={expense} onClose={onClose} />;
}

function ExpenseReview({ initial, settings, expense, scan, preview, text, onClose }: {
  initial: Draft;
  settings: BudgetSettings;
  expense?: Expense;
  scan?: string; // image ou PDF (data URL) à garder avec la dépense
  preview?: string;
  text?: string; // texte reconnu, pour comparer
  onClose: () => void;
}) {
  const { family } = useFamily();
  const [d, setD] = useState(initial);
  const [newCat, setNewCat] = useState("");
  const [saved, setSaved] = useState<string>();
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<Draft>) => setD({ ...d, ...patch });
  const fid = family?.id;

  // Document conservé d'une dépense déjà enregistrée.
  useEffect(() => {
    if (!fid || !expense?.hasScan) return;
    getDoc(doc(db, "families", fid, "receipts", expense.id)).then((s) => s.exists() && setSaved(s.data().data));
  }, [fid, expense]);

  if (!family) return null;
  const parents = family.members.filter((m) => m.role === "parent");
  const allIds = family.members.map((m) => m.id);
  const everyone = d.memberIds.length === 0 || d.memberIds.length === allIds.length;
  const image = preview ?? saved ?? scan;
  const isPdf = image?.startsWith("data:application/pdf");
  const total = num(d.amount);
  const itemsSum = d.items.reduce((s, i) => s + (num(i.amount) || 0), 0);
  const mismatch = d.items.length > 0 && total > 0 && Math.abs(itemsSum - total) > 0.05;
  const setItem = (i: number, patch: Partial<Draft["items"][number]>) =>
    set({ items: d.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) });

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
    const opt = (v: string | number | string[] | ExpenseItem[] | undefined | false) =>
      v === undefined || v === false || v === "" || (Array.isArray(v) && !v.length) || (typeof v === "number" && isNaN(v)) ? undefined : v;
    const fields: Record<string, unknown> = {
      store: opt(d.store.trim()),
      time: opt(d.time),
      memberIds: opt(everyone ? undefined : d.memberIds),
      kind: d.kind,
      items: opt(items),
      vat: opt(d.vat ? num(d.vat) : undefined),
      paymentMethod: opt(d.paymentMethod.trim()),
      invoiceNumber: opt(d.invoiceNumber.trim()),
      dueDate: opt(d.dueDate),
      notes: opt(d.notes.trim()),
    };
    const base = {
      label: d.label.trim() || d.store.trim() || category,
      amount: total,
      category,
      date: d.date,
      paidBy: d.paidBy,
    };
    if (expense) {
      // Les champs vidés sont retirés du document.
      await updateDoc(doc(db, "families", family!.id, "expenses", expense.id), {
        ...base,
        ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v === undefined ? deleteField() : v])),
      });
    } else {
      const clean = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
      const ref = await addDoc(familyCol(family!.id, "expenses"), { ...base, ...clean, ...(scan && { hasScan: true }) });
      if (scan) await setDoc(doc(db, "families", family!.id, "receipts", ref.id), { data: scan });
    }
    onClose();
  }

  return (
    <Modal title={expense ? "Dépense" : "Vérifie avant d'enregistrer"} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        {image && (
          isPdf
            ? <a href={image} target="_blank" rel="noreferrer" className="block text-sm text-teal-700 underline">Voir la facture (PDF)</a>
            // eslint-disable-next-line @next/next/no-img-element
            : <a href={image} target="_blank" rel="noreferrer"><img src={image} alt="Document scanné" className="mx-auto max-h-56 rounded-xl object-contain ring-1 ring-stone-200" /></a>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Field label="Magasin / fournisseur" className="col-span-2">
            <input className="input" value={d.store} onChange={(e) => set({ store: e.target.value, label: d.label === d.store ? e.target.value : d.label })} />
          </Field>
          <Field label="Libellé" className="col-span-2">
            <input className="input" value={d.label} placeholder={d.store || "ex. Courses de la semaine"} onChange={(e) => set({ label: e.target.value })} />
          </Field>
          <Field label="Total €">
            <input className="input font-semibold" inputMode="decimal" value={d.amount} onChange={(e) => set({ amount: e.target.value })} required />
          </Field>
          <Field label="Type">
            <select className="input" value={d.kind} onChange={(e) => set({ kind: e.target.value as Draft["kind"] })}>
              <option value="ticket">Ticket de caisse</option>
              <option value="facture">Facture</option>
            </select>
          </Field>
          <Field label="Date">
            <input type="date" className="input" value={d.date} onChange={(e) => set({ date: e.target.value })} required />
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

        <Field label="Payé par">
          <select className="input" value={d.paidBy} onChange={(e) => set({ paidBy: e.target.value })}>
            {parents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>

        <details className="rounded-xl ring-1 ring-stone-200" open={mismatch}>
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
            Détail des articles ({d.items.length}){mismatch && <span className="ml-2 text-red-600">· à vérifier</span>}
          </summary>
          <div className="space-y-1 px-3 pb-3">
            {d.items.map((it, i) => (
              <div key={i} className="flex gap-1">
                <input className="input flex-1 py-1 text-sm" value={it.label} onChange={(e) => setItem(i, { label: e.target.value })} />
                <input className="input w-12 py-1 text-sm" inputMode="decimal" placeholder="qté" value={it.quantity} onChange={(e) => setItem(i, { quantity: e.target.value })} />
                <input className="input w-20 py-1 text-right text-sm" inputMode="decimal" value={it.amount} onChange={(e) => setItem(i, { amount: e.target.value })} />
                <button type="button" className="px-1 text-stone-400 hover:text-red-600" aria-label="Retirer"
                  onClick={() => set({ items: d.items.filter((_, j) => j !== i) })}>×</button>
              </div>
            ))}
            <button type="button" className="text-sm text-teal-700 underline"
              onClick={() => set({ items: [...d.items, { label: "", quantity: "", amount: "" }] })}>+ Ajouter une ligne</button>
            {d.items.length > 0 && (
              <p className={`text-right text-xs ${mismatch ? "font-semibold text-red-600" : "text-stone-500"}`}>
                Somme des lignes : {euro(itemsSum)}{mismatch && ` (total ${euro(total)})`}
              </p>
            )}
          </div>
        </details>

        <details className="rounded-xl ring-1 ring-stone-200">
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Autres informations</summary>
          <div className="grid grid-cols-2 gap-2 px-3 pb-3">
            <Field label="Paiement"><input className="input" value={d.paymentMethod} onChange={(e) => set({ paymentMethod: e.target.value })} /></Field>
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

        {text != null && (
          <details className="rounded-xl ring-1 ring-stone-200">
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Texte reconnu</summary>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap px-3 pb-3 text-xs text-stone-500">{text.trim() || "Aucun texte trouvé."}</pre>
          </details>
        )}

        <button className="btn w-full" disabled={saving}>{expense ? "Enregistrer" : "Valider et ajouter"}</button>
      </form>
    </Modal>
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
