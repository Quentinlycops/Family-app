"use client";
import Link from "next/link";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useFamily } from "@/lib/family";
import { useCollection } from "@/lib/useCollection";
import { useEvents } from "@/lib/useEvents";
import { fmtLong, fmtShort, relativeDay, today, upcoming } from "@/lib/dates";
import type { Outing, ShoppingItem, Todo, Trip } from "@/lib/types";
import { space } from "@/lib/spaces";

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? "Bonne nuit" : h < 18 ? "Bonjour" : "Bonsoir";
}

function Section({ title, href, linkLabel = "Tout voir", children }: { title: string; href?: string; linkLabel?: string; children: React.ReactNode }) {
  return (
    <section className="card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-extrabold">{title}</h2>
        {href && <Link href={href} className="rounded-full bg-teal-50 px-3 py-1 text-sm font-bold text-teal-700 transition hover:bg-teal-100">{linkLabel}</Link>}
      </div>
      {children}
    </section>
  );
}

/** Petite tuile colorée vers un espace : emoji, nom et un chiffre ou un mot. */
function Tile({ href, value, hint }: { href: string; value: React.ReactNode; hint?: string }) {
  const s = space(href)!;
  return (
    <Link href={href} title={hint} className="flex min-w-0 items-center gap-2 rounded-2xl px-3 py-2.5 transition hover:brightness-[0.98] active:scale-[0.97]"
      style={{ background: s.soft, color: s.strong }}>
      <span className="text-lg">{s.emoji}</span>
      <span className="shrink-0 text-sm font-bold">{s.label}</span>
      <span className="min-w-0 flex-1 truncate text-right text-sm font-extrabold">{value}</span>
    </Link>
  );
}

export default function AccueilPage() {
  const { family, me, member } = useFamily();
  const { events } = useEvents();
  const { items: todos } = useCollection<Todo>("todos");
  const { items: shopping } = useCollection<ShoppingItem>("shopping");
  const { items: trips } = useCollection<Trip>("trips");
  const { items: outings } = useCollection<Outing>("outings");

  if (!family) return null;
  const now = today();
  // Un événement sur plusieurs jours n'est montré qu'une fois (son premier jour visible).
  const seen = new Set<string>();
  const all = upcoming(events.filter((e) => !e.birthday), now, 14)
    .filter(({ ev }) => {
      const key = `${ev.title}|${ev.source ?? ""}|${ev.memberIds.join()}`;
      const spans = !!ev.endDate || (ev.source && !ev.startTime);
      if (spans && seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  // Environ 8 événements, mais un jour affiché l'est toujours en entier.
  const lastDay = all[Math.min(all.length, 8) - 1]?.date;
  const next = all.filter((o) => lastDay && o.date <= lastDay);
  const byDay = next.reduce<Record<string, typeof next>>((acc, o) => {
    (acc[o.date] ??= []).push(o);
    return acc;
  }, {});

  const openTodos = todos
    .filter((t) => !t.done)
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
  const urgent = openTodos.filter((t) => t.dueDate && t.dueDate <= now);
  const toShow = (urgent.length ? urgent : openTodos).slice(0, 5);

  const toBuy = shopping.filter((s) => !s.checked);
  const nextTrip = trips.filter((t) => t.endDate >= now).sort((a, b) => a.startDate.localeCompare(b.startDate))[0];

  const ideas = outings.filter((o) => !o.done);
  const todays = byDay[now] ?? [];
  const later = Object.entries(byDay).filter(([date]) => date !== now);
  const nextUp = later[0]?.[1][0];

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold capitalize text-stone-500">{fmtLong(now)}</p>
        <h1 className="text-3xl font-extrabold tracking-tight">{greeting()} {me?.name ?? ""} 👋</h1>
      </div>

      {/* Le jour en un coup d'œil. */}
      <Link href="/agenda" className="block overflow-hidden rounded-[2rem] bg-gradient-to-br from-teal-500 to-teal-800 p-5 text-white shadow-lg shadow-teal-600/20 transition active:scale-[0.98] dark:from-[#6a52e6] dark:to-[#3b2a99]">
        <p className="text-sm font-bold uppercase tracking-wider text-white/70">Aujourd&apos;hui</p>
        {todays.length === 0 ? (
          <p className="mt-1 text-white/90">
            Rien de prévu.
            {nextUp && <> Prochain : <b>{nextUp.ev.title}</b> · {relativeDay(nextUp.date).toLowerCase()}{nextUp.ev.startTime && ` à ${nextUp.ev.startTime}`}</>}
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {todays.map(({ ev }) => (
              <li key={ev.id} className="flex items-baseline gap-3">
                <span className="w-12 shrink-0 text-sm font-bold text-white/70">{ev.startTime ?? "Journée"}</span>
                <span className="min-w-0 flex-1 truncate text-lg font-extrabold leading-snug">
                  {ev.title}
                  {ev.memberIds.length > 0 && (
                    <span className="text-sm font-semibold text-white/70"> · {ev.memberIds.map((id) => member(id)?.name).filter(Boolean).join(", ")}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Link>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile href="/courses" value={toBuy.length || "✓"} hint={toBuy.slice(0, 5).map((s) => s.name).join(", ")} />
        <Tile href="/todo" value={openTodos.length || "✓"} />
        <Tile href="/sorties" value={ideas.length} />
        <Tile href="/voyages" value={nextTrip ? nextTrip.name : "—"}
          hint={nextTrip && (nextTrip.startDate <= now ? "En cours" : `Départ ${relativeDay(nextTrip.startDate).toLowerCase()}`)} />
      </div>

      <Section title="À venir" href="/agenda">
        {later.length === 0 && <p className="py-2 text-sm text-stone-400">Rien de prévu ces deux prochaines semaines.</p>}
        <div className="space-y-4">
          {later.map(([date, list]) => {
            const rel = relativeDay(date);
            const named = rel === "Aujourd'hui" || rel === "Demain";
            return (
              <div key={date} className="space-y-1.5">
                <p className="text-sm font-extrabold">
                  <span className={`first-letter:uppercase ${date === now ? "text-teal-700" : ""}`}>{named ? rel : fmtLong(date).replace(/^./, (c) => c.toUpperCase())}</span>
                  {named && <span className="font-semibold text-stone-400"> · {fmtLong(date)}</span>}
                </p>
                {list.map(({ ev }) => {
                  const details = [
                    ev.memberIds.map((id) => member(id)?.name).filter(Boolean).join(", "),
                    ev.location && `📍 ${ev.location}`,
                    ev.endDate && ev.endDate > date && `jusqu'au ${fmtShort(ev.endDate)}`,
                  ].filter(Boolean).join(" · ");
                  const c = ev.color ?? member(ev.memberIds.find((id) => member(id)?.role === "enfant") ?? ev.memberIds[0])?.color ?? "#a8a29e";
                  return (
                    <Link key={ev.id + date} href="/agenda"
                      className="flex items-center gap-3 rounded-2xl bg-stone-100/70 py-2 pl-2 pr-3 transition hover:bg-stone-100">
                      <span className="w-1.5 self-stretch rounded-full" style={{ background: c }} />
                      <span className="flex w-12 shrink-0 flex-col text-xs leading-tight text-stone-500">
                        {ev.startTime
                          ? <><b className="text-base text-stone-800">{ev.startTime}</b>{ev.endTime && `→ ${ev.endTime}`}</>
                          : ev.endTime ? <>jusqu&apos;à<b className="text-base text-stone-800">{ev.endTime}</b></>
                          : <b className="text-stone-700">Journée</b>}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-bold">{ev.title}</span>
                        {details && <span className="block truncate text-xs text-stone-500">{details}</span>}
                      </span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
      </Section>

      {toShow.length > 0 && (
        <Section title={urgent.length ? "À faire aujourd'hui" : "À faire"} href="/todo">
          <ul>
            {toShow.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-1.5">
                <input type="checkbox" className="h-5 w-5"
                  onChange={() => updateDoc(doc(db, "families", family.id, "todos", t.id), { done: true })} />
                <span className="flex-1 font-semibold">{t.title}</span>
                {t.dueDate && (
                  <span className={`text-xs ${t.dueDate < now ? "font-bold text-red-600" : "text-stone-500"}`}>
                    {relativeDay(t.dueDate)}
                  </span>
                )}
                {member(t.assigneeId) && (
                  <span className="rounded-full px-2 py-0.5 text-xs font-bold text-white" style={{ background: member(t.assigneeId)?.color }}>
                    {member(t.assigneeId)?.name}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

    </div>
  );
}
