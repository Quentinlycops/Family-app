"use client";
import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useFamily } from "@/lib/family";
import { ageLabel, fmtShort, fromISO, today } from "@/lib/dates";
import Modal from "@/components/Modal";
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
      {/* Sur grand écran, les rubriques des deux fiches partagent les mêmes lignes : elles restent au même niveau. */}
      <div className="grid gap-x-4 gap-y-3 lg:grid-cols-2">
        {kids.map((k) => (
          <div key={k.id} id={k.id}
            className={`space-y-3 rounded-3xl border-t-8 bg-stone-100/60 p-3 sm:p-4 lg:row-span-6 lg:grid lg:grid-rows-subgrid lg:space-y-0 ${k.id === current ? "" : "hidden"}`}
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
  const [chart, setChart] = useState(false);
  const [editNote, setEditNote] = useState(false);
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
    <>
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-full text-xl font-bold text-white" style={{ background: kid.color }}>
          {kid.name[0]}
        </span>
        <div>
          <h2 className="flex items-center gap-1 text-lg font-bold">
            {kid.name}
            <button type="button" className="rounded-full px-1.5 text-sm font-normal text-stone-400 hover:bg-stone-200 hover:text-stone-700"
              aria-label={`Note sur ${kid.name}`} title="Écrire une note" onClick={() => setEditNote(true)}>✏️</button>
          </h2>
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
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-semibold">📏 Croissance</h3>
          {lastGrowth.length > 0 && (
            <button type="button" className="btn-ghost px-2 py-1 text-sm text-teal-700" onClick={() => setChart(true)}>📈 Voir la courbe</button>
          )}
        </div>
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
            {lastGrowth.map((g, i) => (
              <li key={i} className="flex items-center gap-2 py-1">
                <span className="flex-1 text-stone-500">{fmtShort(g.date)} {g.date.slice(0, 4)}</span>
                <span>{g.weight && `${g.weight.toLocaleString("fr-FR")} kg`}{g.weight && g.height && " · "}{g.height && `${g.height.toLocaleString("fr-FR")} cm`}</span>
                <button className="text-stone-400 hover:text-red-600" aria-label="Supprimer"
                  onClick={() => confirm("Supprimer cette mesure ?") && save({ growth: (p.growth ?? []).filter((x) => x !== g) })}>×</button>
              </li>
            ))}
          </ul>
        )}
        {chart && (
          <Modal title={`Courbe de croissance de ${kid.name}`} onClose={() => setChart(false)}>
            <div className="space-y-5">
              <GrowthChart title="Taille" unit="cm" color={kid.color} birthDate={kid.birthDate}
                points={lastGrowth.filter((g) => g.height).map((g) => ({ date: g.date, value: g.height! }))} />
              <GrowthChart title="Poids" unit="kg" color={kid.color} birthDate={kid.birthDate}
                points={lastGrowth.filter((g) => g.weight).map((g) => ({ date: g.date, value: g.weight! }))} />
            </div>
          </Modal>
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

      {/* Note libre, discrète, tout en bas : on l'écrit via le petit stylo à côté du prénom. */}
      <div>
        {editNote ? (
          <textarea className="input text-sm" rows={2} autoFocus defaultValue={p.note ?? ""}
            placeholder={`Une note sur ${kid.name}…`}
            onBlur={(e) => {
              setEditNote(false);
              if (e.target.value.trim() !== (p.note ?? "")) save({ note: e.target.value.trim() });
            }} />
        ) : p.note ? (
          <button type="button" className="w-full whitespace-pre-line text-left text-xs text-stone-500" onClick={() => setEditNote(true)}>
            📝 {p.note}
          </button>
        ) : null}
      </div>
    </>
  );
}

/** Âge en mois (avec décimales) à une date donnée. */
const monthsAt = (birthDate: string, date: string) =>
  (fromISO(date).getTime() - fromISO(birthDate).getTime()) / (30.4375 * 86400000);

const ageShort = (m: number) =>
  m < 24 ? `${Math.round(m)} mois` : `${Math.floor(m / 12)} ans${m % 12 >= 1 ? ` ${Math.floor(m % 12)} m` : ""}`;

/** Courbe simple (SVG) des mesures d'un enfant, en fonction de son âge. */
function GrowthChart({ title, unit, color, birthDate, points }: {
  title: string; unit: string; color: string; birthDate: string; points: { date: string; value: number }[];
}) {
  const pts = [...points].sort((a, b) => a.date.localeCompare(b.date)).map((p) => ({ ...p, m: monthsAt(birthDate, p.date) }));
  if (pts.length === 0) return <p className="text-sm text-stone-400">{title} : aucune mesure pour l&apos;instant.</p>;
  const W = 320, H = 180, L = 36, R = 10, T = 10, B = 24;
  const vals = pts.map((p) => p.value);
  const pad = Math.max((Math.max(...vals) - Math.min(...vals)) * 0.15, unit === "kg" ? 0.5 : 2);
  const y0 = Math.floor(Math.min(...vals) - pad), y1 = Math.ceil(Math.max(...vals) + pad);
  const x0 = Math.max(0, Math.floor(pts[0].m) - 1), x1 = Math.ceil(pts[pts.length - 1].m) + 1;
  const x = (m: number) => L + ((m - x0) / (x1 - x0)) * (W - L - R);
  const y = (v: number) => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
  const yTicks = Array.from({ length: 5 }, (_, i) => y0 + ((y1 - y0) * i) / 4);
  const xTicks = Array.from({ length: 4 }, (_, i) => x0 + ((x1 - x0) * i) / 3);
  const fmt = (v: number) => v.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
  const last = pts[pts.length - 1];
  return (
    <figure>
      <figcaption className="mb-1 flex justify-between text-sm">
        <b>{title} <span className="font-normal text-stone-500">({unit})</span></b>
        <span className="text-stone-500">dernière : {fmt(last.value)} {unit} le {fmtShort(last.date)} {last.date.slice(0, 4)}</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Courbe : ${title}`}>
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="stroke-stone-200" strokeWidth={1} />
            <text x={L - 4} y={y(v) + 3} textAnchor="end" className="fill-stone-500" fontSize={9}>{fmt(v)}</text>
          </g>
        ))}
        {xTicks.map((m, i) => (
          <text key={m} x={x(m)} y={H - 6} textAnchor={i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"} className="fill-stone-500" fontSize={9}>{ageShort(m)}</text>
        ))}
        {pts.length > 1 && (
          <polyline points={pts.map((p) => `${x(p.m)},${y(p.value)}`).join(" ")} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
        )}
        {pts.map((p) => (
          <circle key={p.date + p.value} cx={x(p.m)} cy={y(p.value)} r={3.5} fill={color}>
            <title>{`${fmtShort(p.date)} ${p.date.slice(0, 4)} : ${fmt(p.value)} ${unit}`}</title>
          </circle>
        ))}
      </svg>
      <p className="text-center text-[10px] text-stone-400">âge</p>
    </figure>
  );
}
