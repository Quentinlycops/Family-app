"use client";
import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useFamily } from "@/lib/family";
import { ageLabel, fmtShort, today } from "@/lib/dates";
import type { KidProfile, Member } from "@/lib/types";

export default function EnfantsPage() {
  const { family } = useFamily();
  if (!family) return null;
  const kids = family.members.filter((m) => m.role === "enfant");
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Les enfants</h1>
      {kids.map((k) => <KidCard key={k.id} kid={k} fid={family.id} />)}
    </div>
  );
}

function KidCard({ kid, fid }: { kid: Member; fid: string }) {
  const [p, setP] = useState<KidProfile>({});
  const [loaded, setLoaded] = useState(false);
  const ref = doc(db, "families", fid, "kids", kid.id);

  useEffect(
    () => onSnapshot(doc(db, "families", fid, "kids", kid.id), (s) => {
      setP((s.data() as KidProfile) ?? {});
      setLoaded(true);
    }),
    [fid, kid.id],
  );

  // Chaque modification est enregistrée aussitôt (merge champ par champ).
  const save = (patch: Partial<KidProfile>) => {
    setP({ ...p, ...patch });
    return setDoc(ref, patch, { merge: true });
  };

  const [growth, setGrowth] = useState({ date: today(), weight: "", height: "" });
  const [vaccine, setVaccine] = useState({ name: "", date: today(), nextDue: "" });
  const [contact, setContact] = useState({ name: "", role: "", phone: "" });
  const num = (s: string) => (s ? Number(s.replace(",", ".")) : undefined);
  const lastGrowth = [...(p.growth ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  const dueSoon = (p.vaccines ?? []).filter((v) => v.nextDue && v.nextDue >= today());

  if (!loaded) return <div className="card text-stone-400">Chargement…</div>;

  return (
    <section id={kid.id} className="scroll-mt-20 space-y-3">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-full text-xl font-bold text-white" style={{ background: kid.color }}>
          {kid.name[0]}
        </span>
        <div>
          <h2 className="text-lg font-bold">{kid.name}</h2>
          <p className="text-sm text-stone-500">{ageLabel(kid.birthDate)} · née le {fmtShort(kid.birthDate)} {kid.birthDate.slice(0, 4)}</p>
        </div>
      </div>

      <div className="card">
        <h3 className="mb-2 font-semibold">👕 Tailles</h3>
        <div className="grid grid-cols-3 gap-2">
          {([["clothes", "Vêtements", "ex. 4 ans"], ["shoes", "Chaussures", "ex. 26"], ["head", "Tour de tête", "ex. 50 cm"]] as const).map(([k, label, ph]) => (
            <label key={k} className="text-sm">
              <span className="label">{label}</span>
              <input className="input" placeholder={ph} defaultValue={p.sizes?.[k] ?? ""}
                onBlur={(e) => e.target.value !== (p.sizes?.[k] ?? "") &&
                  save({ sizes: { ...p.sizes, [k]: e.target.value, updated: today() } })} />
            </label>
          ))}
        </div>
        {p.sizes?.updated && <p className="mt-1 text-xs text-stone-400">Mis à jour le {fmtShort(p.sizes.updated)}</p>}
      </div>

      <div className="card">
        <h3 className="mb-2 font-semibold">📏 Croissance</h3>
        <form className="flex flex-wrap gap-2" onSubmit={(e) => {
          e.preventDefault();
          if (!growth.weight && !growth.height) return;
          const entry = { date: growth.date, ...(num(growth.weight) && { weight: num(growth.weight) }), ...(num(growth.height) && { height: num(growth.height) }) };
          save({ growth: [...(p.growth ?? []), entry] });
          setGrowth({ ...growth, weight: "", height: "" });
        }}>
          <input type="date" className="input w-auto" value={growth.date} onChange={(e) => setGrowth({ ...growth, date: e.target.value })} />
          <input className="input w-24" inputMode="decimal" placeholder="kg" value={growth.weight} onChange={(e) => setGrowth({ ...growth, weight: e.target.value })} />
          <input className="input w-24" inputMode="decimal" placeholder="cm" value={growth.height} onChange={(e) => setGrowth({ ...growth, height: e.target.value })} />
          <button className="btn">Ajouter</button>
        </form>
        {lastGrowth.length > 0 && (
          <ul className="mt-2 divide-y divide-stone-100 text-sm">
            {lastGrowth.slice(0, 6).map((g, i) => (
              <li key={i} className="flex justify-between py-1">
                <span className="text-stone-500">{fmtShort(g.date)} {g.date.slice(0, 4)}</span>
                <span>{g.weight && `${g.weight.toLocaleString("fr-FR")} kg`}{g.weight && g.height && " · "}{g.height && `${g.height} cm`}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card space-y-2">
        <h3 className="font-semibold">🩺 Santé</h3>
        {([["doctor", "Médecin / pédiatre"], ["allergies", "Allergies"], ["bloodType", "Groupe sanguin"]] as const).map(([k, label]) => (
          <label key={k} className="block text-sm">
            <span className="label">{label}</span>
            <input className="input" defaultValue={p.health?.[k] ?? ""}
              onBlur={(e) => e.target.value !== (p.health?.[k] ?? "") && save({ health: { ...p.health, [k]: e.target.value } })} />
          </label>
        ))}
        <label className="block text-sm">
          <span className="label">Notes (traitements, antécédents…)</span>
          <textarea className="input" rows={2} defaultValue={p.health?.notes ?? ""}
            onBlur={(e) => e.target.value !== (p.health?.notes ?? "") && save({ health: { ...p.health, notes: e.target.value } })} />
        </label>
      </div>

      <div className="card">
        <h3 className="mb-2 font-semibold">💉 Vaccins</h3>
        {dueSoon.length > 0 && (
          <p className="mb-2 rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-800">
            Prochain rappel : {dueSoon.sort((a, b) => a.nextDue!.localeCompare(b.nextDue!))[0].name} le {fmtShort(dueSoon[0].nextDue!)}
          </p>
        )}
        <ul className="divide-y divide-stone-100 text-sm">
          {(p.vaccines ?? []).map((v, i) => (
            <li key={i} className="flex items-center gap-2 py-1.5">
              <span className="flex-1 font-medium">{v.name}</span>
              <span className="text-stone-500">{v.date && fmtShort(v.date)}{v.nextDue && ` → rappel ${fmtShort(v.nextDue)}`}</span>
              <button className="text-stone-400 hover:text-red-600" aria-label="Supprimer"
                onClick={() => save({ vaccines: p.vaccines!.filter((_, j) => j !== i) })}>×</button>
            </li>
          ))}
        </ul>
        <form className="mt-2 grid grid-cols-2 gap-2" onSubmit={(e) => {
          e.preventDefault();
          if (!vaccine.name.trim()) return;
          save({ vaccines: [...(p.vaccines ?? []), { name: vaccine.name.trim(), date: vaccine.date, ...(vaccine.nextDue && { nextDue: vaccine.nextDue }) }] });
          setVaccine({ ...vaccine, name: "", nextDue: "" });
        }}>
          <input className="input col-span-2" placeholder="Nom du vaccin" value={vaccine.name} onChange={(e) => setVaccine({ ...vaccine, name: e.target.value })} />
          <label className="text-xs text-stone-500">Fait le
            <input type="date" className="input" value={vaccine.date} onChange={(e) => setVaccine({ ...vaccine, date: e.target.value })} />
          </label>
          <label className="text-xs text-stone-500">Rappel prévu (facultatif)
            <input type="date" className="input" value={vaccine.nextDue} onChange={(e) => setVaccine({ ...vaccine, nextDue: e.target.value })} />
          </label>
          <button className="btn col-span-2">Ajouter</button>
        </form>
      </div>

      <div className="card">
        <h3 className="mb-2 font-semibold">📞 Contacts utiles</h3>
        <ul className="divide-y divide-stone-100 text-sm">
          {(p.contacts ?? []).map((c, i) => (
            <li key={i} className="flex items-center gap-2 py-1.5">
              <span className="flex-1"><b>{c.name}</b> <span className="text-stone-500">· {c.role}</span></span>
              {c.phone && <a className="text-teal-700" href={`tel:${c.phone.replace(/\s/g, "")}`}>{c.phone}</a>}
              <button className="text-stone-400 hover:text-red-600" aria-label="Supprimer"
                onClick={() => save({ contacts: p.contacts!.filter((_, j) => j !== i) })}>×</button>
            </li>
          ))}
        </ul>
        <form className="mt-2 grid grid-cols-2 gap-2" onSubmit={(e) => {
          e.preventDefault();
          if (!contact.name.trim()) return;
          save({ contacts: [...(p.contacts ?? []), { ...contact, name: contact.name.trim() }] });
          setContact({ name: "", role: "", phone: "" });
        }}>
          <input className="input" placeholder="Nom" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} />
          <input className="input" placeholder="Rôle : nounou, crèche…" value={contact.role} onChange={(e) => setContact({ ...contact, role: e.target.value })} />
          <input className="input" type="tel" placeholder="Téléphone" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} />
          <button className="btn">Ajouter</button>
        </form>
      </div>
    </section>
  );
}
