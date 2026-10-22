"use client";
import { useMemo, useState } from "react";
import { useFamily } from "@/lib/family";
import { useEvents } from "@/lib/useEvents";
import type { CalendarEvent } from "@/lib/types";
import {
  addDays, eventsOn, fmtLong, fmtMonth, fmtShort, fromISO,
  startOfWeek, toISO, today, WEEKDAYS,
} from "@/lib/dates";
import EventForm from "@/components/EventForm";

type View = "mois" | "semaine";

export default function AgendaPage() {
  const { family, member } = useFamily();
  const { events: all, errors } = useEvents();
  const [view, setView] = useState<View>("mois");
  const [selected, setSelected] = useState(today());
  const [filter, setFilter] = useState<string[]>([]);
  const [editing, setEditing] = useState<CalendarEvent | "new" | null>(null);

  const events = useMemo(() => {
    return filter.length
      ? all.filter((e) => e.memberIds.some((id) => filter.includes(id)))
      : all;
  }, [all, filter]);

  const sel = fromISO(selected);
  const move = (dir: number) =>
    setSelected(
      toISO(view === "mois"
        ? new Date(sel.getFullYear(), sel.getMonth() + dir, 1)
        : addDays(sel, 7 * dir)),
    );

  const monthStart = new Date(sel.getFullYear(), sel.getMonth(), 1);
  const gridStart = startOfWeek(monthStart);
  const weekStart = startOfWeek(sel);
  const days =
    view === "mois"
      ? Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
      : Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const colorsOf = (ev: CalendarEvent) =>
    ev.memberIds.map((id) => member(id)?.color ?? "#78716c");

  const EventRow = ({ ev }: { ev: CalendarEvent }) => (
    <button
      onClick={() => !ev.birthday && !ev.source && setEditing(ev)}
      className="flex w-full items-start gap-3 rounded-xl p-2 text-left hover:bg-stone-50"
    >
      <span className="flex w-14 shrink-0 flex-col pt-0.5 text-xs text-stone-500">
        {ev.startTime ? (
          <>
            <b className="text-sm text-stone-800">{ev.startTime}</b>
            {ev.endTime}
          </>
        ) : "Journée"}
      </span>
      <span className="flex shrink-0 gap-0.5 pt-1.5">
        {colorsOf(ev).map((c, i) => (
          <span key={i} className="h-3 w-3 rounded-full" style={{ background: c }} />
        ))}
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button className="btn-ghost" onClick={() => move(-1)} aria-label="Précédent">‹</button>
          <h1 className={`min-w-36 text-center text-lg font-semibold ${view === "mois" ? "capitalize" : ""}`}>
            {view === "mois"
              ? fmtMonth(sel)
              : `Semaine du ${fmtShort(toISO(weekStart))}`}
          </h1>
          <button className="btn-ghost" onClick={() => move(1)} aria-label="Suivant">›</button>
        </div>
        <div className="flex rounded-xl bg-stone-200/70 p-1 text-sm">
          {(["mois", "semaine"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={`rounded-lg px-3 py-1 capitalize ${view === v ? "bg-surface shadow" : "text-stone-600"}`}>
              {v}
            </button>
          ))}
        </div>
      </div>

      {errors.map((e) => <p key={e} className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">⚠️ {e}</p>)}

      <div className="flex flex-wrap items-center gap-2">
        {family?.members.map((m) => {
          const on = filter.includes(m.id);
          return (
            <button key={m.id}
              onClick={() => setFilter(on ? filter.filter((f) => f !== m.id) : [...filter, m.id])}
              className="rounded-full border-2 px-3 py-0.5 text-sm font-medium"
              style={{ borderColor: m.color, background: on ? m.color : "transparent", color: on ? "white" : m.color }}>
              {m.name}
            </button>
          );
        })}
        <button className="ml-auto text-sm text-teal-700 underline" onClick={() => setSelected(today())}>
          Aujourd&apos;hui
        </button>
      </div>

      {view === "mois" ? (
        <div className="card p-2">
          <div className="grid grid-cols-7 text-center text-xs font-medium uppercase text-stone-400">
            {WEEKDAYS.map((d) => <div key={d} className="py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d) => {
              const iso = toISO(d);
              const dayEvents = eventsOn(events, iso);
              const out = d.getMonth() !== sel.getMonth();
              return (
                <button key={iso} onClick={() => setSelected(iso)}
                  className={`flex h-14 flex-col items-center rounded-xl pt-1 text-sm ${
                    iso === selected ? "bg-brand text-white" : out ? "text-stone-300" : "hover:bg-stone-100"
                  }`}>
                  <span className={iso === today() && iso !== selected ? "font-bold text-teal-700" : ""}>
                    {d.getDate()}
                  </span>
                  <span className="mt-1 flex flex-wrap justify-center gap-0.5">
                    {dayEvents.slice(0, 4).map((ev) => (
                      <span key={ev.id} className="h-1.5 w-1.5 rounded-full"
                        style={{ background: iso === selected ? "white" : colorsOf(ev)[0] }} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {view === "mois" ? (
        <section className="card">
          <h2 className="mb-2 font-semibold capitalize">{fmtLong(selected)}</h2>
          {eventsOn(events, selected).length === 0 && (
            <p className="py-4 text-center text-sm text-stone-400">Rien de prévu.</p>
          )}
          {eventsOn(events, selected).map((ev) => <EventRow key={ev.id} ev={ev} />)}
        </section>
      ) : (
        <div className="space-y-3">
          {days.map((d) => {
            const iso = toISO(d);
            const list = eventsOn(events, iso);
            return (
              <section key={iso} className={`card ${iso === today() ? "ring-2 ring-teal-600" : ""}`}>
                <button className="mb-1 font-semibold capitalize" onClick={() => { setSelected(iso); setEditing("new"); }}>
                  {fmtLong(iso)} <span className="text-teal-700">+</span>
                </button>
                {list.length === 0 && <p className="text-sm text-stone-400">—</p>}
                {list.map((ev) => <EventRow key={ev.id} ev={ev} />)}
              </section>
            );
          })}
        </div>
      )}

      <button onClick={() => setEditing("new")}
        className="fixed bottom-24 right-5 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-3xl text-white shadow-lg hover:bg-brand-dark"
        aria-label="Ajouter un événement">+</button>

      {editing && (
        <EventForm
          event={editing === "new" ? undefined : editing}
          date={selected}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
