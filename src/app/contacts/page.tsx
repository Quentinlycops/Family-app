"use client";
import { useState } from "react";
import { addDoc, deleteDoc, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useFamily } from "@/lib/family";
import { familyCol } from "@/lib/useCollection";
import { clean, contactBirthDate, useContacts } from "@/lib/contacts";
import { ageLabel, fmtLong, nextBirthday } from "@/lib/dates";
import { matches } from "@/lib/search";
import type { Contact } from "@/lib/types";
import MemberPicker from "@/components/MemberPicker";
import Modal from "@/components/Modal";

type Editing = { contact?: Contact; birthdayFirst?: boolean; memberIds?: string[] };

export default function ContactsPage() {
  const { family, member } = useFamily();
  const { items: contacts, loading } = useContacts();
  // ?pour=lea (depuis la fiche d'un enfant) ou ?anniv=1 (depuis l'accueil).
  const params = typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
  const [filter, setFilter] = useState(() => params.get("pour") ?? "");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Editing | null>(() => (params.get("anniv") ? { birthdayFirst: true } : null));
  if (!family) return null;

  const list = contacts
    .filter((c) => (filter === "anniv" ? !!c.birthday : !filter || c.memberIds.includes(filter)))
    .filter((c) => !q.trim() || matches(q, c.name, c.role, c.notes, c.address))
    .sort((a, b) =>
      filter === "anniv"
        ? nextBirthday(contactBirthDate(a)).days - nextBirthday(contactBirthDate(b)).days
        : a.name.localeCompare(b.name),
    );

  const chip = (id: string, label: string, color?: string) => {
    const on = filter === id;
    return (
      <button key={id} onClick={() => setFilter(on ? "" : id)}
        className="rounded-full border-2 px-3 py-1 text-sm font-medium"
        style={{
          borderColor: color ?? "#78716c",
          background: on ? color ?? "#78716c" : "transparent",
          color: on ? "white" : color,
        }}>
        {label}
      </button>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">📞 Contacts</h1>
        <div className="flex gap-2">
          <button className="btn-ghost text-sm" onClick={() => setEditing({ birthdayFirst: true })}>🎂 + Anniversaire</button>
          <button className="btn" onClick={() => setEditing({ memberIds: filter && filter !== "anniv" ? [filter] : [] })}>+ Contact</button>
        </div>
      </div>

      <input className="input" type="search" placeholder="🔍 Rechercher : pédiatre, mamie, crèche…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        {chip("", "Tous")}
        {family.members.map((m) => chip(m.id, m.name, m.color))}
        {chip("anniv", "🎂 Anniversaires")}
      </div>

      {!loading && list.length === 0 && (
        <p className="card text-center text-sm text-stone-400">
          {contacts.length === 0 ? "Aucun contact pour l'instant. Ajoute le pédiatre, la crèche, les grands-parents…" : "Aucun contact ne correspond."}
        </p>
      )}

      <ul className="space-y-2">
        {list.map((c) => {
          const who = c.memberIds.map((id) => member(id)).filter((m) => !!m);
          const nb = c.birthday && nextBirthday(contactBirthDate(c));
          return (
            <li key={c.id} className="card flex items-start gap-3 p-3">
              <button className="min-w-0 flex-1 text-left" onClick={() => setEditing({ contact: c })}>
                <p className="font-semibold">{c.name}{c.role && <span className="font-normal text-stone-500"> · {c.role}</span>}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  {who.length === family.members.length
                    ? <span className="chip">Toute la famille</span>
                    : who.map((m) => (
                      <span key={m.id} className="rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ background: m.color }}>{m.name}</span>
                    ))}
                  {nb && (
                    <span className="chip">
                      🎂 {fmtLong(nb.date).replace(/^\S+ /, "")}
                      {c.birthYear ? ` · ${ageLabel(contactBirthDate(c))}` : ""}
                      {nb.days === 0 ? " · aujourd'hui 🎉" : nb.days <= 30 ? ` · dans ${nb.days} j` : ""}
                    </span>
                  )}
                </div>
                {c.address && <p className="mt-1 truncate text-xs text-stone-500">📍 {c.address}</p>}
                {c.notes && <p className="mt-1 line-clamp-2 text-xs text-stone-500">{c.notes}</p>}
              </button>
              <div className="flex shrink-0 flex-col items-end gap-1 text-sm">
                {c.phone && <a className="text-teal-700" href={`tel:${c.phone.replace(/\s/g, "")}`}>📞 {c.phone}</a>}
                {c.email && <a className="max-w-40 truncate text-teal-700" href={`mailto:${c.email}`}>✉️ {c.email}</a>}
              </div>
            </li>
          );
        })}
      </ul>

      {editing && <ContactForm {...editing} fid={family.id} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ContactForm({ contact, birthdayFirst, memberIds, fid, onClose }: Editing & { fid: string; onClose: () => void }) {
  const { family } = useFamily();
  const [f, setF] = useState({
    name: contact?.name ?? "",
    role: contact?.role ?? "",
    memberIds: contact?.memberIds ?? memberIds ?? [],
    phone: contact?.phone ?? "",
    email: contact?.email ?? "",
    address: contact?.address ?? "",
    notes: contact?.notes ?? "",
    birth: contact?.birthday ? contactBirthDate(contact) : "",
    noYear: !!contact?.birthday && !contact.birthYear,
  });
  const set = (patch: Partial<typeof f>) => setF({ ...f, ...patch });
  const all = family?.members.map((m) => m.id) ?? [];
  const showBirthday = birthdayFirst || !!contact?.birthday;
  const [moreBirthday, setMoreBirthday] = useState(showBirthday);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.name.trim()) return;
    const data = clean({
      name: f.name.trim(),
      role: f.role.trim(),
      memberIds: f.memberIds,
      phone: f.phone.trim(),
      email: f.email.trim(),
      address: f.address.trim(),
      notes: f.notes.trim(),
      birthday: f.birth ? f.birth.slice(5) : undefined,
      birthYear: f.birth && !f.noYear ? Number(f.birth.slice(0, 4)) : undefined,
      createdAt: contact?.createdAt ?? Date.now(),
    });
    // setDoc sans fusion : un champ vidé disparaît bien de la fiche.
    if (contact) await setDoc(doc(db, "families", fid, "contacts", contact.id), data);
    else await addDoc(familyCol(fid, "contacts"), data);
    onClose();
  }

  async function remove() {
    if (!contact || !confirm(`Supprimer ${contact.name} des contacts ?`)) return;
    await deleteDoc(doc(db, "families", fid, "contacts", contact.id));
    onClose();
  }

  const birthdayField = (
    <div className="space-y-1">
      <label className="block text-sm">
        <span className="label">🎂 Anniversaire</span>
        <input type="date" className="input" value={f.birth} required={birthdayFirst} onChange={(e) => set({ birth: e.target.value })} />
      </label>
      <label className="flex items-center gap-2 text-sm text-stone-600">
        <input type="checkbox" className="h-4 w-4 accent-teal-700" checked={f.noYear} onChange={(e) => set({ noYear: e.target.checked })} />
        Je ne connais pas l&apos;année de naissance
      </label>
    </div>
  );

  return (
    <Modal title={contact ? contact.name : birthdayFirst ? "Nouvel anniversaire" : "Nouveau contact"} onClose={onClose}>
      <form className="space-y-3" onSubmit={save}>
        <label className="block text-sm">
          <span className="label">Nom</span>
          <input className="input" autoFocus={!contact} required value={f.name} onChange={(e) => set({ name: e.target.value })}
            placeholder={birthdayFirst ? "ex. Mamie Josée, cousine Emma" : "ex. Dr Martin"} />
        </label>
        <label className="block text-sm">
          <span className="label">Qui est-ce ?</span>
          <input className="input" value={f.role} onChange={(e) => set({ role: e.target.value })}
            placeholder="pédiatre, crèche, nounou, grand-mère, cousine…" />
        </label>
        {birthdayFirst && birthdayField}
        <div className="space-y-1">
          <span className="label">Pour qui ?</span>
          <MemberPicker value={f.memberIds} onChange={(ids) => set({ memberIds: ids })} />
          <button type="button" className="text-sm text-teal-700"
            onClick={() => set({ memberIds: f.memberIds.length === all.length ? [] : all })}>
            {f.memberIds.length === all.length ? "Tout désélectionner" : "Toute la famille"}
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="label">Téléphone</span>
            <input className="input" type="tel" value={f.phone} onChange={(e) => set({ phone: e.target.value })} />
          </label>
          <label className="block text-sm">
            <span className="label">E-mail</span>
            <input className="input" type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} />
          </label>
        </div>
        <label className="block text-sm">
          <span className="label">Adresse</span>
          <input className="input" value={f.address} onChange={(e) => set({ address: e.target.value })} />
        </label>
        {!birthdayFirst && (moreBirthday
          ? birthdayField
          : <button type="button" className="text-sm text-teal-700" onClick={() => setMoreBirthday(true)}>🎂 Ajouter son anniversaire</button>)}
        <label className="block text-sm">
          <span className="label">Notes</span>
          <textarea className="input" rows={2} value={f.notes} onChange={(e) => set({ notes: e.target.value })}
            placeholder="horaires, code de la porte…" />
        </label>
        <div className="flex items-center justify-between gap-2 pt-1">
          {contact ? <button type="button" className="btn-ghost text-red-600" onClick={remove}>Supprimer</button> : <span />}
          <button className="btn">Enregistrer</button>
        </div>
      </form>
    </Modal>
  );
}
