"use client";
import { useEffect, useState } from "react";
import {
  addDoc, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where, writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useFamily } from "@/lib/family";
import { familyCol, useCollection } from "@/lib/useCollection";
import { fmtShort, fromISO, today } from "@/lib/dates";
import { dataUrlToObjectUrl, prepareFile } from "@/lib/files";
import type { Trip, TripDoc, TripDocKind, TripExpense } from "@/lib/types";
import Modal from "@/components/Modal";
import MemberPicker from "@/components/MemberPicker";

const KINDS: Record<TripDocKind, { label: string; icon: string }> = {
  avion: { label: "Avion", icon: "✈️" },
  train: { label: "Train", icon: "🚆" },
  hebergement: { label: "Hébergement", icon: "🏨" },
  location: { label: "Location", icon: "🚗" },
  autre: { label: "Autre", icon: "📎" },
};

const euro = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

function fmtRange(start: string, end: string) {
  const f = (s: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("fr-FR", opts).format(fromISO(s));
  const year = end.slice(0, 4);
  if (start === end) return f(start, { day: "numeric", month: "long", year: "numeric" });
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  return `${f(start, sameMonth ? { day: "numeric" } : { day: "numeric", month: "short" })} – ${f(end, { day: "numeric", month: "short" })} ${year}`;
}

/** Le voyage ouvert est noté dans l'adresse (#id) : le bouton retour du téléphone ramène à la liste. */
function useHash() {
  const [hash, setHash] = useState("");
  useEffect(() => {
    const read = () => setHash(decodeURIComponent(window.location.hash.slice(1)));
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  return hash;
}

export default function VoyagesPage() {
  const { family } = useFamily();
  const { items: trips, loading } = useCollection<Trip>("trips");
  const openId = useHash();
  const [creating, setCreating] = useState(false);
  const [showPast, setShowPast] = useState(false);
  if (!family) return null;

  const open = trips.find((t) => t.id === openId);
  if (open) return <TripDetail key={open.id} trip={open} fid={family.id} />;

  const now = today();
  const coming = trips.filter((t) => t.endDate >= now).sort((a, b) => a.startDate.localeCompare(b.startDate));
  const past = trips.filter((t) => t.endDate < now).sort((a, b) => b.startDate.localeCompare(a.startDate));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Voyages</h1>
        <button className="btn" onClick={() => setCreating(true)}>+ Nouveau voyage</button>
      </div>

      {!loading && trips.length === 0 && (
        <div className="card text-center text-stone-500">
          <p className="text-3xl">🧳</p>
          <p className="mt-1">Créez un voyage pour y ranger les billets, l&apos;hébergement et les infos pratiques.</p>
        </div>
      )}

      {coming.map((t) => <TripCard key={t.id} trip={t} />)}

      {past.length > 0 && (
        <div>
          <button className="btn-ghost text-sm" onClick={() => setShowPast(!showPast)}>
            {showPast ? "▾" : "▸"} Voyages passés ({past.length})
          </button>
          {showPast && <div className="mt-2 space-y-3">{past.map((t) => <TripCard key={t.id} trip={t} />)}</div>}
        </div>
      )}

      {creating && <TripForm fid={family.id} onClose={() => setCreating(false)} />}
    </div>
  );
}

function TripCard({ trip }: { trip: Trip }) {
  const { member } = useFamily();
  const now = today();
  const ongoing = trip.startDate <= now && now <= trip.endDate;
  return (
    <a href={`#${trip.id}`} className="card flex items-center gap-3">
      <span className="text-3xl">🧳</span>
      <span className="min-w-0 flex-1">
        <b className="block truncate">{trip.name}</b>
        <span className="block truncate text-sm text-stone-500">
          {trip.destination ? `${trip.destination} · ` : ""}{fmtRange(trip.startDate, trip.endDate)}
        </span>
        <span className="text-xs text-stone-400">{trip.memberIds.map((id) => member(id)?.name).filter(Boolean).join(", ")}</span>
      </span>
      {ongoing && <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-700">En cours</span>}
      <span className="text-stone-400">›</span>
    </a>
  );
}

function TripForm({ fid, trip, onClose }: { fid: string; trip?: Trip; onClose: () => void }) {
  const { family } = useFamily();
  const [f, setF] = useState({
    name: trip?.name ?? "",
    destination: trip?.destination ?? "",
    startDate: trip?.startDate ?? today(),
    endDate: trip?.endDate ?? today(),
    memberIds: trip?.memberIds ?? family!.members.map((m) => m.id),
  });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const data = {
      ...f,
      name: f.name.trim() || f.destination.trim() || "Voyage",
      destination: f.destination.trim(),
      endDate: f.endDate < f.startDate ? f.startDate : f.endDate,
    };
    if (trip) await updateDoc(doc(db, "families", fid, "trips", trip.id), data);
    else {
      const ref = await addDoc(familyCol(fid, "trips"), { ...data, createdAt: Date.now() });
      window.location.hash = ref.id;
    }
    onClose();
  }

  return (
    <Modal title={trip ? "Modifier le voyage" : "Nouveau voyage"} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <input className="input" placeholder="Nom (ex. Vacances d'été)" value={f.name} autoFocus
          onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input className="input" placeholder="Destination (ex. Lisbonne)" value={f.destination}
          onChange={(e) => setF({ ...f, destination: e.target.value })} />
        <div className="grid grid-cols-2 gap-2">
          <label><span className="label">Départ</span>
            <input type="date" className="input" value={f.startDate} required
              onChange={(e) => setF({ ...f, startDate: e.target.value, endDate: f.endDate < e.target.value ? e.target.value : f.endDate })} />
          </label>
          <label><span className="label">Retour</span>
            <input type="date" className="input" value={f.endDate} min={f.startDate} required
              onChange={(e) => setF({ ...f, endDate: e.target.value })} />
          </label>
        </div>
        <div><span className="label">Qui part ?</span>
          <MemberPicker value={f.memberIds} onChange={(memberIds) => setF({ ...f, memberIds })} />
        </div>
        <button className="btn w-full">Enregistrer</button>
      </form>
    </Modal>
  );
}

type Tab = "billets" | "infos" | "depenses";

function TripDetail({ trip, fid }: { trip: Trip; fid: string }) {
  const { member } = useFamily();
  const [tab, setTab] = useState<Tab>("billets");
  const [editing, setEditing] = useState(false);
  const { items: docs } = useCollection<TripDoc>("tripDocs", where("tripId", "==", trip.id));
  const { items: expenses } = useCollection<TripExpense>("tripExpenses", where("tripId", "==", trip.id));

  async function remove() {
    if (!confirm(`Supprimer « ${trip.name} » avec ses billets et ses dépenses ?`)) return;
    const batch = writeBatch(db);
    for (const col of ["tripDocs", "tripFiles", "tripExpenses"]) {
      const snap = await getDocs(query(familyCol(fid, col), where("tripId", "==", trip.id)));
      snap.forEach((d) => batch.delete(d.ref));
    }
    batch.delete(doc(db, "families", fid, "trips", trip.id));
    await batch.commit();
    window.location.hash = "";
  }

  const tabs: [Tab, string][] = [
    ["billets", `Billets${docs.length ? ` (${docs.length})` : ""}`],
    ["infos", "Infos"],
    ["depenses", "Dépenses"],
  ];

  return (
    <div className="space-y-4">
      <a href="#" className="text-sm text-teal-700">‹ Tous les voyages</a>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl font-bold">{trip.name}</h1>
          <p className="text-sm text-stone-500">
            {trip.destination ? `${trip.destination} · ` : ""}{fmtRange(trip.startDate, trip.endDate)}
          </p>
          <p className="text-xs text-stone-400">{trip.memberIds.map((id) => member(id)?.name).filter(Boolean).join(", ")}</p>
        </div>
        <button className="btn-ghost text-sm" onClick={() => setEditing(true)}>Modifier</button>
      </div>

      <div className="grid grid-cols-3 gap-1 rounded-xl bg-stone-100 p-1 text-sm">
        {tabs.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`truncate rounded-lg px-2 py-1.5 ${tab === k ? "bg-surface font-semibold shadow-sm" : "text-stone-500"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "billets" && <Tickets trip={trip} fid={fid} docs={docs} />}
      {tab === "infos" && <Infos trip={trip} fid={fid} />}
      {tab === "depenses" && <Expenses trip={trip} fid={fid} expenses={expenses} />}

      <button className="w-full pt-4 text-sm text-stone-400 hover:text-red-600" onClick={remove}>Supprimer ce voyage</button>

      {editing && <TripForm fid={fid} trip={trip} onClose={() => setEditing(false)} />}
    </div>
  );
}

/* ---------- Billets ---------- */

function Tickets({ trip, fid, docs }: { trip: Trip; fid: string; docs: TripDoc[] }) {
  const { member } = useFamily();
  const [adding, setAdding] = useState(false);
  const [opened, setOpened] = useState<TripDoc>();
  const sorted = [...docs].sort((a, b) =>
    `${a.date ?? "9999"}${a.time ?? ""}`.localeCompare(`${b.date ?? "9999"}${b.time ?? ""}`) || a.createdAt - b.createdAt);

  return (
    <div className="space-y-3">
      {sorted.length === 0 && (
        <p className="card text-sm text-stone-500">Ajoutez vos billets d&apos;avion, de train, la réservation du logement… avec la photo ou le PDF.</p>
      )}
      {sorted.map((d) => (
        <button key={d.id} onClick={() => setOpened(d)} className="card flex w-full items-center gap-3 text-left">
          <span className="text-2xl">{KINDS[d.kind].icon}</span>
          <span className="min-w-0 flex-1">
            <b className="block truncate">{d.title}</b>
            <span className="block truncate text-sm text-stone-500">
              {[d.date && fmtShort(d.date), d.time, d.reference].filter(Boolean).join(" · ")}
            </span>
            {d.memberIds.length > 0 && d.memberIds.length < trip.memberIds.length && (
              <span className="text-xs text-stone-400">{d.memberIds.map((id) => member(id)?.name).join(", ")}</span>
            )}
          </span>
          {d.file && <span title="Fichier joint">📄</span>}
        </button>
      ))}
      <button className="btn w-full" onClick={() => setAdding(true)}>+ Ajouter un billet ou un document</button>

      {adding && <TicketForm trip={trip} fid={fid} onClose={() => setAdding(false)} />}
      {opened && <TicketView d={opened} trip={trip} fid={fid} onClose={() => setOpened(undefined)} />}
    </div>
  );
}

function TicketForm({ trip, fid, existing, onClose }: { trip: Trip; fid: string; existing?: TripDoc; onClose: () => void }) {
  const [f, setF] = useState({
    kind: existing?.kind ?? ("avion" as TripDocKind),
    title: existing?.title ?? "",
    date: existing?.date ?? trip.startDate,
    time: existing?.time ?? "",
    from: existing?.from ?? "",
    to: existing?.to ?? "",
    reference: existing?.reference ?? "",
    link: existing?.link ?? "",
    notes: existing?.notes ?? "",
    memberIds: existing?.memberIds ?? trip.memberIds,
  });
  const [file, setFile] = useState<File>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const travel = f.kind === "avion" || f.kind === "train";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const prepared = file ? await prepareFile(file) : undefined;
      const data: Omit<TripDoc, "id" | "createdAt"> = {
        tripId: trip.id,
        kind: f.kind,
        title: f.title.trim() || (travel && f.from && f.to ? `${f.from} → ${f.to}` : KINDS[f.kind].label),
        memberIds: f.memberIds,
        ...Object.fromEntries(
          (["date", "time", "from", "to", "reference", "link", "notes"] as const).map((k) => [k, f[k].trim()]),
        ),
        ...(prepared ? { file: { name: prepared.name, type: prepared.type, size: prepared.data.length } }
          : existing?.file ? { file: existing.file } : {}),
      };
      const ref = existing
        ? doc(db, "families", fid, "tripDocs", existing.id)
        : doc(familyCol(fid, "tripDocs"));
      if (prepared) await setDoc(doc(db, "families", fid, "tripFiles", ref.id), { tripId: trip.id, data: prepared.data });
      await setDoc(ref, { ...data, createdAt: existing?.createdAt ?? Date.now() });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
      setBusy(false);
    }
  }

  return (
    <Modal title={existing ? "Modifier" : "Nouveau billet ou document"} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(KINDS) as TripDocKind[]).map((k) => (
            <button key={k} type="button" onClick={() => setF({ ...f, kind: k })}
              className={`rounded-full border px-3 py-1 text-sm ${f.kind === k ? "border-teal-700 bg-teal-50 font-semibold text-teal-700" : "border-stone-300 text-stone-600"}`}>
              {KINDS[k].icon} {KINDS[k].label}
            </button>
          ))}
        </div>
        {travel && (
          <div className="grid grid-cols-2 gap-2">
            <input className="input" placeholder="Départ (ex. Paris CDG)" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
            <input className="input" placeholder="Arrivée" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
          </div>
        )}
        <input className="input" placeholder={travel ? "Titre (facultatif, ex. Vol aller AF1024)" : "Titre (ex. Hôtel du Port)"}
          value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <div className="grid grid-cols-2 gap-2">
          <input type="date" className="input" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
          <input type="time" className="input" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} />
        </div>
        <input className="input" placeholder="Code de réservation" value={f.reference}
          onChange={(e) => setF({ ...f, reference: e.target.value })} />
        <div><span className="label">Pour qui ?</span>
          <MemberPicker value={f.memberIds} onChange={(memberIds) => setF({ ...f, memberIds })} />
        </div>
        <label className="block">
          <span className="label">Photo ou PDF du billet {existing?.file && !file && <i className="font-normal text-stone-400">(déjà joint : {existing.file.name})</i>}</span>
          <input type="file" accept="image/*,application/pdf" className="input text-sm"
            onChange={(e) => setFile(e.target.files?.[0])} />
        </label>
        <input className="input" type="url" placeholder="Lien de la réservation (facultatif)" value={f.link}
          onChange={(e) => setF({ ...f, link: e.target.value })} />
        <textarea className="input" rows={2} placeholder="Notes (siège, bagages, quai…)" value={f.notes}
          onChange={(e) => setF({ ...f, notes: e.target.value })} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn w-full" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer"}</button>
      </form>
    </Modal>
  );
}

function TicketView({ d, trip, fid, onClose }: { d: TripDoc; trip: Trip; fid: string; onClose: () => void }) {
  const { member } = useFamily();
  const [url, setUrl] = useState<string>();
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!d.file) return;
    let objectUrl: string | undefined;
    getDoc(doc(db, "families", fid, "tripFiles", d.id)).then(async (s) => {
      const data = s.data()?.data as string | undefined;
      if (data) setUrl((objectUrl = await dataUrlToObjectUrl(data)));
    });
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [d.id, d.file, fid]);

  async function remove() {
    if (!confirm("Supprimer ce document ?")) return;
    await deleteDoc(doc(db, "families", fid, "tripFiles", d.id));
    await deleteDoc(doc(db, "families", fid, "tripDocs", d.id));
    onClose();
  }

  if (editing) return <TicketForm trip={trip} fid={fid} existing={d} onClose={onClose} />;

  const rows: [string, string | undefined][] = [
    ["Trajet", d.from || d.to ? `${d.from ?? "?"} → ${d.to ?? "?"}` : undefined],
    ["Date", d.date && `${fmtShort(d.date)}${d.time ? ` à ${d.time}` : ""}`],
    ["Réservation", d.reference],
    ["Pour", d.memberIds.map((id) => member(id)?.name).filter(Boolean).join(", ") || undefined],
    ["Notes", d.notes],
  ];

  return (
    <Modal title={`${KINDS[d.kind].icon} ${d.title}`} onClose={onClose}>
      <dl className="space-y-1 text-sm">
        {rows.filter(([, v]) => v).map(([k, v]) => (
          <div key={k} className="flex gap-3">
            <dt className="w-24 shrink-0 text-stone-500">{k}</dt>
            <dd className={`whitespace-pre-wrap ${k === "Réservation" ? "font-mono font-semibold" : ""}`}>{v}</dd>
          </div>
        ))}
      </dl>
      {d.file && (
        <div className="mt-4">
          {!url && <p className="text-sm text-stone-400">Chargement du fichier…</p>}
          {url && d.file.type.startsWith("image/") && (
            // eslint-disable-next-line @next/next/no-img-element
            <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={d.title} className="w-full rounded-xl ring-1 ring-stone-200" /></a>
          )}
          {url && (
            <div className="mt-2 flex gap-2">
              <a href={url} target="_blank" rel="noreferrer" className="btn flex-1">Ouvrir</a>
              <a href={url} download={d.file.name} className="btn-ghost flex-1">Télécharger</a>
            </div>
          )}
        </div>
      )}
      {d.link && (
        <a href={d.link} target="_blank" rel="noreferrer" className="mt-3 block truncate text-sm text-teal-700 underline">{d.link}</a>
      )}
      <div className="mt-5 flex justify-between">
        <button className="btn-ghost text-sm text-red-600" onClick={remove}>Supprimer</button>
        <button className="btn-ghost text-sm" onClick={() => setEditing(true)}>Modifier</button>
      </div>
    </Modal>
  );
}

/* ---------- Infos pratiques ---------- */

function Infos({ trip, fid }: { trip: Trip; fid: string }) {
  const ref = doc(db, "families", fid, "trips", trip.id);
  const [stay, setStay] = useState(trip.stay ?? {});
  const [info, setInfo] = useState(trip.info ?? "");
  // Enregistrement à la sortie du champ, comme dans les fiches enfants.
  const saveStay = () => updateDoc(ref, { stay });
  const field = (k: keyof NonNullable<Trip["stay"]>, placeholder: string, type = "text") => (
    <input className="input" type={type} placeholder={placeholder} value={stay[k] ?? ""}
      onChange={(e) => setStay({ ...stay, [k]: e.target.value })} onBlur={saveStay} />
  );
  const mapUrl = stay.address && `https://maps.google.com/?q=${encodeURIComponent(stay.address)}`;

  return (
    <div className="space-y-4">
      <section className="card space-y-2">
        <h2 className="font-semibold">🏠 Hébergement</h2>
        {field("name", "Nom (ex. Appartement Alfama)")}
        {field("address", "Adresse")}
        {mapUrl && <a href={mapUrl} target="_blank" rel="noreferrer" className="block text-sm text-teal-700 underline">Voir sur la carte</a>}
        <div className="grid grid-cols-2 gap-2">
          <label><span className="label">Arrivée</span>{field("checkIn", "15h", "text")}</label>
          <label><span className="label">Départ</span>{field("checkOut", "11h", "text")}</label>
        </div>
        {field("phone", "Téléphone", "tel")}
        {stay.phone && <a href={`tel:${stay.phone}`} className="block text-sm text-teal-700 underline">Appeler</a>}
      </section>

      <section className="card">
        <h2 className="mb-2 font-semibold">📝 Infos pratiques</h2>
        <textarea className="input" rows={8} value={info} onChange={(e) => setInfo(e.target.value)}
          onBlur={() => updateDoc(ref, { info })}
          placeholder={"Code wifi, digicode, numéros utiles, pharmacie, restaurants à tester, à ne pas oublier…"} />
        <p className="mt-1 text-xs text-stone-400">Enregistré automatiquement.</p>
      </section>
    </div>
  );
}

/* ---------- Dépenses ---------- */

function Expenses({ trip, fid, expenses }: { trip: Trip; fid: string; expenses: TripExpense[] }) {
  const { family, me, member } = useFamily();
  const parents = family!.members.filter((m) => m.role === "parent");
  const [f, setF] = useState({ label: "", amount: "", date: today() < trip.startDate ? trip.startDate : today(), paidBy: "" });
  const sorted = [...expenses].sort((a, b) => b.date.localeCompare(a.date));
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const paid = (id: string) => expenses.filter((e) => e.paidBy === id).reduce((s, e) => s + e.amount, 0);
  const days = Math.round((fromISO(trip.endDate).getTime() - fromISO(trip.startDate).getTime()) / 86400000) + 1;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(f.amount.replace(",", "."));
    if (!amount) return;
    await addDoc(familyCol(fid, "tripExpenses"), {
      tripId: trip.id,
      label: f.label.trim() || "Dépense",
      amount,
      date: f.date,
      paidBy: f.paidBy || me?.id || parents[0].id,
    });
    setF({ ...f, label: "", amount: "" });
  }

  return (
    <div className="space-y-4">
      <section className="card">
        <p className="text-sm text-stone-500">Total du voyage</p>
        <p className="text-3xl font-bold text-teal-800">{euro(total)}</p>
        {total > 0 && <p className="text-sm text-stone-500">soit {euro(total / days)} par jour</p>}
        <div className="mt-2 flex gap-4 text-sm">
          {parents.map((p) => <span key={p.id}><b>{p.name}</b> : {euro(paid(p.id))}</span>)}
        </div>
      </section>

      <form onSubmit={add} className="card grid grid-cols-2 gap-2">
        <input className="input col-span-2" placeholder="Libellé (ex. Restaurant, musée, essence)" value={f.label}
          onChange={(e) => setF({ ...f, label: e.target.value })} />
        <input className="input" inputMode="decimal" placeholder="Montant €" value={f.amount} required
          onChange={(e) => setF({ ...f, amount: e.target.value })} />
        <input type="date" className="input" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        <select className="input col-span-2" value={f.paidBy || me?.id} onChange={(e) => setF({ ...f, paidBy: e.target.value })}>
          {parents.map((p) => <option key={p.id} value={p.id}>{p.name} a payé</option>)}
        </select>
        <button className="btn col-span-2">Ajouter la dépense</button>
      </form>

      {sorted.length > 0 && (
        <ul className="card divide-y divide-stone-100">
          {sorted.map((e) => (
            <li key={e.id} className="flex items-center gap-3 py-2 text-sm">
              <span className="w-20 text-stone-500">{fmtShort(e.date)}</span>
              <span className="flex-1">
                {e.label}
                <span className="block text-xs text-stone-400">{member(e.paidBy)?.name}</span>
              </span>
              <b>{euro(e.amount)}</b>
              <button className="text-stone-400 hover:text-red-600" aria-label="Supprimer"
                onClick={() => confirm("Supprimer cette dépense ?") && deleteDoc(doc(db, "families", fid, "tripExpenses", e.id))}>×</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
