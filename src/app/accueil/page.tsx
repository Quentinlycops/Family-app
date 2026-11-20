"use client";
import Link from "next/link";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useFamily } from "@/lib/family";
import { useCollection } from "@/lib/useCollection";
import { useEvents } from "@/lib/useEvents";
import { contactBirthDate, useContacts } from "@/lib/contacts";
import { ageLabel, fmtLong, fmtShort, nextBirthday, relativeDay, today, upcoming } from "@/lib/dates";
import type { MealSlot, Outing, Recipe, ShoppingItem, Todo, Trip } from "@/lib/types";
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

/** Tuile colorée vers un espace, avec un chiffre ou une phrase courte. */
function Tile({ href, big, small }: { href: string; big: React.ReactNode; small: React.ReactNode }) {
  const s = space(href)!;
  return (
    <Link href={href} className="flex min-w-0 flex-col gap-1 rounded-3xl p-4 transition hover:brightness-[0.98] active:scale-[0.97]"
      style={{ background: s.soft }}>
      <span className="flex items-center justify-between">
        <span className="text-2xl">{s.emoji}</span>
        <span className="text-sm font-bold" style={{ color: s.strong }}>{s.label}</span>
      </span>
      <span className="mt-1 truncate text-2xl font-extrabold" style={{ color: s.strong }}>{big}</span>
      <span className="truncate text-xs font-semibold opacity-75" style={{ color: s.strong }}>{small}</span>
    </Link>
  );
}

export default function AccueilPage() {
  const { family, me, member } = useFamily();
  const { events } = useEvents();
  const { items: todos } = useCollection<Todo>("todos");
  const { items: shopping } = useCollection<ShoppingItem>("shopping");
  const { items: meals } = useCollection<MealSlot>("meals");
  const { items: recipes } = useCollection<Recipe>("recipes");
  const { items: trips } = useCollection<Trip>("trips");
  const { items: contacts } = useContacts();
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

  // La famille et les anniversaires notés dans les contacts (grands-parents, cousines…).
  const birthdays = [
    ...family.members.map((m) => ({ key: m.id, name: m.name, color: m.color, ageNow: ageLabel(m.birthDate), ...nextBirthday(m.birthDate) })),
    ...contacts.filter((c) => c.birthday).map((c) => ({
      key: c.id, name: c.name, color: member(c.memberIds[0])?.color,
      ageNow: c.birthYear ? ageLabel(contactBirthDate(c)) : undefined, ...nextBirthday(contactBirthDate(c)),
    })),
  ].sort((a, b) => a.days - b.days).slice(0, 6);

  const mealToday = (slot: string) => {
    const s = meals.find((x) => x.id === `${now}_${slot}`);
    return recipes.find((r) => r.id === s?.recipeId)?.name ?? s?.text;
  };

  const openTodos = todos
    .filter((t) => !t.done)
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
  const urgent = openTodos.filter((t) => t.dueDate && t.dueDate <= now);
  const toShow = (urgent.length ? urgent : openTodos).slice(0, 5);

  const toBuy = shopping.filter((s) => !s.checked);
  const nextTrip = trips.filter((t) => t.endDate >= now).sort((a, b) => a.startDate.localeCompare(b.startDate))[0];

  const ideas = outings.filter((o) => !o.done);
  const todayCount = (byDay[now] ?? []).length;
  const nextUp = next.find(({ date, ev }) => date > now || !ev.startTime || ev.startTime >= new Date().toTimeString().slice(0, 5));

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold capitalize text-stone-500">{fmtLong(now)}</p>
        <h1 className="text-3xl font-extrabold tracking-tight">{greeting()} {me?.name ?? ""} 👋</h1>
      </div>

      {/* Le jour en un coup d'œil. */}
      <Link href="/agenda" className="block overflow-hidden rounded-[2rem] bg-gradient-to-br from-teal-500 to-teal-800 p-5 text-white shadow-lg shadow-teal-600/20 transition active:scale-[0.98] dark:from-[#6a52e6] dark:to-[#3b2a99]">
        <p className="text-sm font-bold uppercase tracking-wider text-white/70">Aujourd&apos;hui</p>
        <p className="mt-1 text-2xl font-extrabold">
          {todayCount === 0 ? "Journée tranquille ☀️" : `${todayCount} chose${todayCount > 1 ? "s" : ""} au programme`}
        </p>
        {nextUp && (
          <p className="mt-1 truncate text-white/90">
            Ensuite : <b>{nextUp.ev.title}</b>
            {nextUp.date !== now ? ` · ${relativeDay(nextUp.date).toLowerCase()}` : nextUp.ev.startTime ? ` à ${nextUp.ev.startTime}` : ""}
          </p>
        )}
        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <span className="truncate rounded-2xl bg-white/15 px-3 py-2"><span className="text-white/70">🍝 Midi · </span>{mealToday("midi") ?? "à définir"}</span>
          <span className="truncate rounded-2xl bg-white/15 px-3 py-2"><span className="text-white/70">🌙 Soir · </span>{mealToday("soir") ?? "à définir"}</span>
        </div>
      </Link>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile href="/courses" big={toBuy.length || "✓"} small={toBuy.slice(0, 3).map((s) => s.name).join(", ") || "Liste vide"} />
        <Tile href="/todo" big={openTodos.length || "✓"} small={urgent.length ? `${urgent.length} pour aujourd'hui` : openTodos.length ? "à faire" : "Rien en attente"} />
        <Tile href="/sorties" big={ideas.length} small={ideas.length ? `idée${ideas.length > 1 ? "s" : ""} de sortie` : "Ajoutez une idée"} />
        <Tile href="/voyages" big={nextTrip ? nextTrip.name : "—"}
          small={nextTrip ? (nextTrip.startDate <= now ? "en cours" : `départ ${relativeDay(nextTrip.startDate).toLowerCase()}`) : "Aucun voyage prévu"} />
      </div>

      <Section title="Prochains événements" href="/agenda">
        {next.length === 0 && <p className="py-2 text-sm text-stone-400">Rien de prévu ces deux prochaines semaines.</p>}
        <div className="space-y-4">
          {Object.entries(byDay).map(([date, list]) => {
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

      <Section title="🎂 Anniversaires" href="/contacts?anniv=1" linkLabel="+ Ajouter">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {birthdays.map(({ key, name, color, ageNow, date, days }) => (
            <div key={key} className={`flex min-w-[7.5rem] shrink-0 flex-col items-center gap-1 rounded-2xl p-3 text-center ${date === now ? "bg-teal-100" : "bg-stone-100/70"}`}>
              <span className="flex h-10 w-10 items-center justify-center rounded-full text-lg font-extrabold text-white" style={{ background: color ?? "#a8a29e" }}>
                {name.slice(0, 1)}
              </span>
              <b className="text-sm leading-tight">{name}</b>
              <span className="text-xs text-stone-500">
                {date === now ? "aujourd'hui 🎉" : days <= 31 ? `dans ${days} j` : fmtLong(date).replace(/^\S+ /, "")}
              </span>
              {ageNow && <span className="text-[11px] text-stone-400">{ageNow}</span>}
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
