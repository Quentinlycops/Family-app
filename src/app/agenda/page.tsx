"use client";
import { useMemo, useState } from "react";
import { useFamily } from "@/lib/family";
import { colorKey, useCalendarSettings, useEvents } from "@/lib/useEvents";
import { deleteField, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import ColorSwatches from "@/components/ColorSwatches";
import type { CalendarEvent } from "@/lib/types";
import {
  addDays, eventsOn, fmtLong, fmtMonth, fmtShort, fromISO, relativeDay,
  startOfWeek, toISO, today, upcoming, WEEKDAYS,
} from "@/lib/dates";
import EventForm from "@/components/EventForm";
import Modal from "@/components/Modal";

type View = "mois" | "semaine" | "liste";

/** Couleur hexadécimale avec transparence, pour les fonds de pastilles. */
const tint = (hex: string, alpha: number) =>
  hex + Math.round(alpha * 255).toString(16).padStart(2, "0");

export default function AgendaPage() {
  const { family, member } = useFamily();
  const { events: all, errors } = useEvents();
  const eventColors = useCalendarSettings().eventColors ?? {};
  const [view, setViewState] = useState<View>(() => {
    if (typeof window === "undefined") return "mois";
    try {
      const saved = localStorage.getItem("agenda-view") as View | null;
      if (saved) return saved;
    } catch {}
    return window.innerWidth < 640 ? "liste" : "mois";
  });
  const setView = (v: View) => {
    setViewState(v);
    try { localStorage.setItem("agenda-view", v); } catch {}
  };
  const [selected, setSelected] = useState(today());
  const [filter, setFilter] = useState<string[]>([]);
  const [editing, setEditing] = useState<CalendarEvent | "new" | null>(null);
  const [viewing, setViewing] = useState<{ ev: CalendarEvent; date: string } | null>(null);

  const events = useMemo(
    () => filter.length ? all.filter((e) => e.memberIds.some((id) => filter.includes(id))) : all,
    [all, filter],
  );

  const sel = fromISO(selected);
  const move = (dir: number) =>
    setSelected(toISO(
      view === "mois" ? new Date(sel.getFullYear(), sel.getMonth() + dir, 1)
      : view === "semaine" ? addDays(sel, 7 * dir)
      : addDays(sel, 30 * dir),
    ));

  const monthStart = new Date(sel.getFullYear(), sel.getMonth(), 1);
  const gridStart = startOfWeek(monthStart);
  // 5 ou 6 semaines selon le mois, pour ne pas afficher une ligne vide.
  const weeks = Math.ceil(((monthStart.getDay() + 6) % 7 + new Date(sel.getFullYear(), sel.getMonth() + 1, 0).getDate()) / 7);
  const monthDays = Array.from({ length: weeks * 7 }, (_, i) => addDays(gridStart, i));
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(sel), i));

  // Les enfants passent en premier : « Pédiatre Léa » prend la couleur de Léa même si un parent l'accompagne.
  const colors = (ev: CalendarEvent) => {
    if (ev.color) return [ev.color];
    const ms = ev.memberIds.map((id) => member(id)).filter((m) => !!m);
    ms.sort((a, b) => (a.role === b.role ? 0 : a.role === "enfant" ? -1 : 1));
    return ms.length ? ms.map((m) => m.color) : ["#78716c"];
  };
  const color = (ev: CalendarEvent) => colors(ev)[0];
  // Bande verticale aux couleurs de tous les membres concernés.
  const stripe = (ev: CalendarEvent) => {
    const c = colors(ev);
    return c.length === 1 ? c[0] : `linear-gradient(${c.map((x, i) => `${x} ${(i * 100) / c.length}% ${((i + 1) * 100) / c.length}%`).join(", ")})`;
  };
  const open = (ev: CalendarEvent, date: string) => (ev.birthday || ev.source ? setViewing({ ev, date }) : setEditing(ev));
  const now = today();

  /** Pastille lisible : heure + titre, couleur du premier membre concerné. */
  const Chip = ({ ev, date, compact }: { ev: CalendarEvent; date: string; compact?: boolean }) => (
    <button
      onClick={(e) => { e.stopPropagation(); open(ev, date); }}
      title={`${ev.startTime ? ev.startTime + " " : ""}${ev.title}`}
      className={`relative w-full rounded-md text-left font-medium text-stone-800 ${compact ? "line-clamp-2 hyphens-auto break-words py-px pl-1.5 pr-0.5 text-[10px] leading-[1.15] sm:line-clamp-1 sm:pr-1 sm:text-xs" : "block truncate py-1 pl-3 pr-2 text-sm"}`}
      style={{ background: tint(color(ev), 0.16) }}
    >
      <span className="absolute inset-y-0 left-0 w-[3px] rounded-l-md" style={{ background: stripe(ev) }} />
      {ev.startTime && <span className={compact ? "hidden font-semibold sm:inline" : "font-semibold"}>{ev.startTime} </span>}
      {ev.title}
    </button>
  );

  const EventRow = ({ ev, date }: { ev: CalendarEvent; date: string }) => (
    <button onClick={() => open(ev, date)}
      className="flex w-full items-stretch gap-3 rounded-xl p-2 text-left hover:bg-stone-100">
      <span className="w-1 shrink-0 rounded-full" style={{ background: stripe(ev) }} />
      <span className="flex w-12 shrink-0 flex-col text-xs text-stone-500">
        {ev.startTime ? <><b className="text-sm text-stone-800">{ev.startTime}</b>{ev.endTime}</> : ev.endTime ? <>jusqu&apos;à<b className="text-sm text-stone-800">{ev.endTime}</b></> : "Journée"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{ev.title}</span>
        <span className="block truncate text-xs text-stone-500">
          {ev.memberIds.map((id) => member(id)?.name).join(", ")}
          {ev.location && ` · ${ev.location}`}
          {ev.recurrence !== "none" && !ev.birthday && " · 🔁"}
          {ev.source && ` · ${ev.source}`}
        </span>
      </span>
    </button>
  );

  const title =
    view === "mois" ? fmtMonth(sel)
    : view === "semaine" ? `Semaine du ${fmtShort(toISO(weekDays[0]))}`
    : `Dès le ${fmtShort(selected)}`;

  return (
    <div className="space-y-3">
      {errors.map((e) => <p key={e} className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">⚠️ {e}</p>)}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button className="btn-ghost px-2 text-xl" onClick={() => move(-1)} aria-label="Précédent">‹</button>
          <h1 className="min-w-0 text-lg font-semibold first-letter:uppercase sm:text-xl">{title}</h1>
          <button className="btn-ghost px-2 text-xl" onClick={() => move(1)} aria-label="Suivant">›</button>
          <button className="btn-ghost ml-1 text-sm" onClick={() => setSelected(now)}>Aujourd&apos;hui</button>
        </div>
        <div className="flex rounded-xl bg-stone-200/70 p-1 text-sm">
          {(["mois", "semaine", "liste"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={`rounded-lg px-3 py-1 capitalize ${view === v ? "bg-surface shadow" : "text-stone-600"}`}>
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {family?.members.map((m) => {
          const on = filter.includes(m.id);
          return (
            <button key={m.id}
              onClick={() => setFilter(on ? filter.filter((f) => f !== m.id) : [...filter, m.id])}
              className="rounded-full border-2 px-2.5 py-0.5 text-sm font-medium"
              style={{ borderColor: m.color, background: on ? m.color : "transparent", color: on ? "white" : m.color }}>
              {m.name}
            </button>
          );
        })}
      </div>

      {view === "mois" && (
        <>
          <div className="overflow-hidden rounded-2xl bg-surface ring-1 ring-stone-200">
            <div className="grid grid-cols-7 border-b border-stone-200 text-center text-[11px] font-semibold uppercase text-stone-400">
              {WEEKDAYS.map((d) => <div key={d} className="py-1.5">{d}</div>)}
            </div>
            <div className="grid grid-cols-7">
              {monthDays.map((d, i) => {
                const iso = toISO(d);
                const list = eventsOn(events, iso);
                const out = d.getMonth() !== sel.getMonth();
                const max = 3;
                return (
                  <div key={iso} onClick={() => setSelected(iso)}
                    className={`min-h-[84px] cursor-pointer space-y-0.5 border-stone-200 p-0.5 sm:min-h-[118px] sm:p-1 lg:min-h-[132px]
                      ${i % 7 ? "border-l" : ""} ${i >= 7 ? "border-t" : ""}
                      ${out ? "bg-stone-50/60" : ""} ${iso === selected ? "bg-teal-50 ring-2 ring-inset ring-teal-600" : "hover:bg-stone-50"}`}>
                    <div className="flex justify-center sm:justify-start">
                      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs sm:text-sm
                        ${iso === now ? "bg-brand font-bold text-white" : out ? "text-stone-300" : "text-stone-700"}`}>
                        {d.getDate()}
                      </span>
                    </div>
                    {list.slice(0, max).map((ev) => <Chip key={ev.id} ev={ev} date={iso} compact />)}
                    {list.length > max && (
                      <p className="px-1 text-[10px] font-medium text-stone-500 sm:text-xs">+{list.length - max} autre{list.length - max > 1 ? "s" : ""}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <section className="card">
            <h2 className="mb-1 font-semibold first-letter:uppercase">{fmtLong(selected)}</h2>
            {eventsOn(events, selected).length === 0 && <p className="py-3 text-center text-sm text-stone-400">Rien de prévu.</p>}
            {eventsOn(events, selected).map((ev) => <EventRow key={ev.id} ev={ev} date={selected} />)}
          </section>
        </>
      )}

      {view === "semaine" && (
        <div className="grid gap-3 lg:grid-cols-7 lg:gap-2">
          {weekDays.map((d) => {
            const iso = toISO(d);
            const list = eventsOn(events, iso);
            return (
              <section key={iso} className={`card p-3 lg:min-h-[60vh] ${iso === now ? "ring-2 ring-teal-600" : ""}`}>
                <button className="mb-2 flex w-full items-baseline justify-between text-left"
                  onClick={() => { setSelected(iso); setEditing("new"); }}>
                  <span className="font-semibold first-letter:uppercase">
                    <span className="lg:hidden">{fmtLong(iso)}</span>
                    <span className="hidden lg:inline">{WEEKDAYS[(d.getDay() + 6) % 7]} {d.getDate()}</span>
                  </span>
                  <span className="text-lg text-teal-700">+</span>
                </button>
                {list.length === 0 && <p className="text-sm text-stone-400">—</p>}
                <div className="space-y-1.5">
                  {list.map((ev) => (
                    <button key={ev.id} onClick={() => open(ev, iso)}
                      className="relative block w-full rounded-lg py-1.5 pl-3 pr-2 text-left"
                      style={{ background: tint(color(ev), 0.14) }}>
                      <span className="absolute inset-y-0 left-0 w-1 rounded-l-lg" style={{ background: stripe(ev) }} />
                      <span className="block text-xs font-semibold text-stone-600">
                        {ev.startTime ? `${ev.startTime}${ev.endTime ? ` – ${ev.endTime}` : ""}` : ev.endTime ? `jusqu'à ${ev.endTime}` : "Journée"}
                      </span>
                      <span className="block text-sm font-medium leading-snug text-stone-900">{ev.title}</span>
                      <span className="block truncate text-xs text-stone-500">
                        {ev.memberIds.map((id) => member(id)?.name).join(", ")}{ev.location && ` · ${ev.location}`}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {view === "liste" && (() => {
        const occ = upcoming(events, selected, 60);
        const days = [...new Set(occ.map((o) => o.date))];
        return (
          <div className="space-y-3">
            {days.length === 0 && <p className="card text-center text-sm text-stone-400">Rien de prévu sur les 60 prochains jours.</p>}
            {days.map((date) => (
              <section key={date} className={`card p-3 ${date === now ? "ring-2 ring-teal-600" : ""}`}>
                <h2 className="mb-1 font-semibold first-letter:uppercase">
                  {relativeDay(date) !== fmtShort(date) && <span className="text-teal-700">{relativeDay(date)} · </span>}
                  {fmtLong(date)}
                </h2>
                {occ.filter((o) => o.date === date).map(({ ev }) => <EventRow key={ev.id} ev={ev} date={date} />)}
              </section>
            ))}
          </div>
        );
      })()}

      <button onClick={() => setEditing("new")}
        className="fixed bottom-24 right-5 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-3xl text-white shadow-lg hover:bg-brand-dark"
        aria-label="Ajouter un événement">+</button>

      {editing && (
        <EventForm event={editing === "new" ? undefined : editing} date={selected} onClose={() => setEditing(null)} />
      )}
      {viewing && (
        <Modal title={viewing.ev.title} onClose={() => setViewing(null)}>
          <div className="space-y-2 text-sm">
            <p className="first-letter:uppercase">📅 {fmtLong(viewing.date)}{viewing.ev.startTime && ` · ${viewing.ev.startTime}${viewing.ev.endTime ? ` – ${viewing.ev.endTime}` : ""}`}</p>
            {viewing.ev.location && <p>📍 {viewing.ev.location}</p>}
            <p>👥 {viewing.ev.memberIds.map((id) => member(id)?.name).join(", ")}</p>
            <div className="space-y-1">
              <span className="label">Couleur dans l&apos;app</span>
              <ColorSwatches value={eventColors[colorKey(viewing.ev)]}
                autoLabel={viewing.ev.source ? "Celle de l'agenda" : "Auto (membres)"}
                onChange={(c) => {
                  const key = colorKey(viewing.ev);
                  if (family) setDoc(doc(db, "families", family.id, "settings", "calendars"),
                    { eventColors: { [key]: c ?? deleteField() } }, { merge: true });
                  setViewing(null);
                }} />
            </div>
            <p className="text-stone-500">
              {viewing.ev.source
                ? `Vient de l'agenda Google « ${viewing.ev.source} » : modifie-le dans Google Agenda.`
                : "Anniversaire ajouté automatiquement depuis la fiche de la famille."}
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
