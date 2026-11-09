"use client";
import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useFamily } from "@/lib/family";
import { ageLabel, fmtShort, today } from "@/lib/dates";
import type { KidProfile, Member, SizeEntry } from "@/lib/types";

const SIZE_FIELDS = [["clothes", "Vêtements", "4 ans"], ["shoes", "Chaussures", "26"], ["head", "Tour de tête", "50 cm"]] as const;

export default function EnfantsPage() {
  const { family } = useFamily();
  const kids = family?.members.filter((m) => m.role === "enfant") ?? [];
  // Sur téléphone, une fiche à la fois (on passe de l'une à l'autre) ; sur grand écran, les deux côte à côte.
  const [sel, setSel] = useState(() => (typeof window === "undefined" ? "" : window.location.hash.slice(1)));
  if (!family) return null;
  const current = kids.some((k) => k.id === sel) ? sel : kids[0]?.id;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Les enfants</h1>
      <div className="grid grid-cols-2 gap-2 lg:hidden">
        {kids.map((k) => {
          const on = k.id === current;
          return (
            <button key={k.id} onClick={() => { setSel(k.id); history.replaceState(null, "", `#${k.id}`); }}
              className="flex items-center gap-2 rounded-2xl border-2 px-3 py-2 text-left"
              style={{ borderColor: k.color, background: on ? k.color : "transparent", color: on ? "white" : undefined }}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-bold text-white"
                style={{ background: on ? "rgb(255 255 255 / 0.25)" : k.color }}>{k.name[0]}</span>
              <span>
                <b className="block leading-tight">{k.name}</b>
                <span className={`text-xs ${on ? "text-white/80" : "text-stone-500"}`}>{ageLabel(k.birthDate)}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        {kids.map((k) => (
          <div key={k.id} className={`rounded-3xl border-t-8 bg-stone-100/60 p-3 sm:p-4 ${k.id === current ? "" : "hidden lg:block"}`}
            style={{ borderColor: k.color }}>
            <KidCard kid={k} fid={family.id} />
          </div>
        ))}
      </div>
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

  const [size, setSize] = useState({ date: today(), clothes: "", shoes: "", head: "" });
  const [growth, setGrowth] = useState({ date: today(), weight: "", height: "" });
  const [vaccine, setVaccine] = useState({ name: "", date: today(), nextDue: "" });
  const num = (s: string) => (s ? Number(s.replace(",", ".")) : undefined);
  // Historique des tailles, du plus récent au plus ancien ; l'ancienne fiche unique y est reprise.
  const legacy = p.sizes && (p.sizes.clothes || p.sizes.shoes || p.sizes.head)
    ? [{ date: p.sizes.updated ?? today(), ...Object.fromEntries(SIZE_FIELDS.map(([k]) => [k, p.sizes![k]]).filter(([, v]) => v)) }]
    : [];
  const sizeHistory: SizeEntry[] = [...(p.sizeHistory ?? legacy)].sort((a, b) => b.date.localeCompare(a.date));
  const lastGrowth = [...(p.growth ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  const dueSoon = (p.vaccines ?? []).filter((v) => v.nextDue && v.nextDue >= today());

  if (!loaded) return <div className="card text-stone-400">Chargement…</div>;

  return (
    <section id={kid.id} className="space-y-3">
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
        {sizeHistory.length > 0 && (
          <div className="mb-3 grid grid-cols-3 gap-2 text-center">
            {SIZE_FIELDS.map(([k, label]) => {
              const last = sizeHistory.find((e) => e[k]);
              return (
                <div key={k} className="rounded-xl bg-stone-100 px-2 py-2">
                  <p className="text-xs text-stone-500">{label}</p>
                  <p className="font-semibold">{last?.[k] ?? "—"}</p>
                  {last && <p className="text-[10px] text-stone-400">{fmtShort(last.date)} {last.date.slice(0, 4)}</p>}
                </div>
              );
            })}
          </div>
        )}
        <form className="space-y-2" onSubmit={(e) => {
          e.preventDefault();
          const entry = { date: size.date, ...Object.fromEntries(SIZE_FIELDS.map(([k]) => [k, size[k].trim()]).filter(([, v]) => v)) };
          if (Object.keys(entry).length === 1) return;
          save({ sizeHistory: [...sizeHistory, entry] });
          setSize({ date: size.date, clothes: "", shoes: "", head: "" });
        }}>
          <div className="grid grid-cols-3 gap-2">
            {SIZE_FIELDS.map(([k, label, ph]) => (
              <label key={k} className="text-sm">
                <span className="label">{label}</span>
                <input className="input" placeholder={ph} value={size[k]} onChange={(e) => setSize({ ...size, [k]: e.target.value })} />
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <input type="date" className="input flex-1" value={size.date} onChange={(e) => setSize({ ...size, date: e.target.value })} />
            <button className="btn">Ajouter</button>
          </div>
        </form>
        {sizeHistory.length > 0 && (
          <ul className="mt-2 divide-y divide-stone-100 text-sm">
            {sizeHistory.map((e, i) => (
              <li key={i} className="flex items-center gap-2 py-1">
                <span className="w-24 shrink-0 text-stone-500">{fmtShort(e.date)} {e.date.slice(0, 4)}</span>
                <span className="flex-1">{SIZE_FIELDS.filter(([k]) => e[k]).map(([k, label]) => `${label} ${e[k]}`).join(" · ")}</span>
                <button className="text-stone-400 hover:text-red-600" aria-label="Supprimer"
                  onClick={() => save({ sizeHistory: sizeHistory.filter((x) => x !== e) })}>×</button>
              </li>
            ))}
          </ul>
        )}
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

    </section>
  );
}
