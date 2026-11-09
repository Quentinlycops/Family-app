"use client";
import Link from "next/link";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useFamily } from "@/lib/family";
import { useCollection } from "@/lib/useCollection";
import { useEvents } from "@/lib/useEvents";
import { contactBirthDate, useContacts } from "@/lib/contacts";
import { fmtLong, fmtShort, nextBirthday, relativeDay, today, upcoming } from "@/lib/dates";
import type { MealSlot, Recipe, ShoppingItem, Todo, Trip } from "@/lib/types";

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? "Bonne nuit" : h < 18 ? "Bonjour" : "Bonsoir";
}

function Section({ title, href, linkLabel = "Tout voir ›", children }: { title: string; href?: string; linkLabel?: string; children: React.ReactNode }) {
  return (
    <section className="card">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        {href && <Link href={href} className="text-sm text-teal-700">{linkLabel}</Link>}
      </div>
      {children}
    </section>
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
    ...family.members.map((m) => ({ key: m.id, name: m.name, color: m.color, knownAge: true, ...nextBirthday(m.birthDate) })),
    ...contacts.filter((c) => c.birthday).map((c) => ({
      key: c.id, name: c.name, color: member(c.memberIds[0])?.color, knownAge: !!c.birthYear, ...nextBirthday(contactBirthDate(c)),
    })),
  ].sort((a, b) => a.days - b.days).slice(0, 8);

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

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm capitalize text-stone-500">{fmtLong(now)}</p>
        <h1 className="text-2xl font-bold">{greeting()} {me?.name ?? ""} 👋</h1>
      </div>

      <Section title="Prochains événements" href="/agenda">
        {next.length === 0 && <p className="py-2 text-sm text-stone-400">Rien de prévu ces deux prochaines semaines.</p>}
        <div className="space-y-4">
          {Object.entries(byDay).map(([date, list]) => {
            const rel = relativeDay(date);
            const named = rel === "Aujourd'hui" || rel === "Demain";
            return (
              <div key={date} className="space-y-1.5">
                <div className="flex items-center gap-3 pt-1">
                  <span className="h-px flex-1 bg-stone-300" />
                  <p className="text-center text-sm font-semibold">
                    <span className={`inline-block first-letter:uppercase ${date === now ? "text-teal-700" : ""}`}>{named ? rel : fmtLong(date)}</span>
                    {named && <span className="block text-xs font-normal text-stone-400 first-letter:uppercase">{fmtLong(date)}</span>}
                  </p>
                  <span className="h-px flex-1 bg-stone-300" />
                </div>
                {list.map(({ ev }) => {
                  const details = [
                    ev.memberIds.map((id) => member(id)?.name).filter(Boolean).join(", "),
                    ev.location && `📍 ${ev.location}`,
                    ev.endDate && ev.endDate > date && `jusqu'au ${fmtShort(ev.endDate)}`,
                  ].filter(Boolean).join(" · ");
                  return (
                    <Link key={ev.id + date} href="/agenda"
                      className="flex items-center gap-3 rounded-xl bg-stone-100/70 px-3 py-2 hover:bg-stone-100">
                      <span className="flex w-14 shrink-0 flex-col text-xs leading-tight text-stone-500">
                        {ev.startTime
                          ? <><b className="text-base text-stone-800">{ev.startTime}</b>{ev.endTime && `→ ${ev.endTime}`}</>
                          : ev.endTime ? <>jusqu&apos;à<b className="text-base text-stone-800">{ev.endTime}</b></>
                          : <b className="text-stone-700">Journée</b>}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{ev.title}</span>
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

      <div className="grid grid-cols-2 gap-4">
        <Link href="/repas" className="card block">
          <h2 className="mb-1 font-semibold">🍽️ Aujourd&apos;hui</h2>
          <p className="text-sm"><span className="text-stone-400">Midi · </span>{mealToday("midi") ?? <i className="text-stone-400">à définir</i>}</p>
          <p className="text-sm"><span className="text-stone-400">Soir · </span>{mealToday("soir") ?? <i className="text-stone-400">à définir</i>}</p>
        </Link>
        <Link href="/courses" className="card block">
          <h2 className="mb-1 font-semibold">🛒 Courses</h2>
          <p className="text-2xl font-bold">{toBuy.length}</p>
          <p className="truncate text-xs text-stone-500">{toBuy.slice(0, 4).map((s) => s.name).join(", ") || "Liste vide"}</p>
        </Link>
      </div>

      <Section title="À faire" href="/todo">
        {toShow.length === 0 && <p className="py-2 text-sm text-stone-400">Rien en attente 🎉</p>}
        <ul>
          {toShow.map((t) => (
            <li key={t.id} className="flex items-center gap-3 py-1.5">
              <input type="checkbox" className="h-5 w-5 accent-teal-700"
                onChange={() => updateDoc(doc(db, "families", family.id, "todos", t.id), { done: true })} />
              <span className="flex-1">{t.title}</span>
              {t.dueDate && (
                <span className={`text-xs ${t.dueDate < now ? "font-semibold text-red-600" : "text-stone-500"}`}>
                  {relativeDay(t.dueDate)}
                </span>
              )}
              {member(t.assigneeId) && <span className="text-xs text-stone-500">{member(t.assigneeId)?.name}</span>}
            </li>
          ))}
        </ul>
      </Section>

      <Link href="/voyages" className="card flex items-center gap-3">
        <span className="text-2xl">🧳</span>
        <span className="min-w-0 flex-1">
          <b className="block">Voyages</b>
          <span className="block truncate text-sm text-stone-500">
            {nextTrip
              ? `${nextTrip.name} · ${nextTrip.startDate <= now ? "en cours" : `départ ${relativeDay(nextTrip.startDate).toLowerCase()}`}`
              : "Billets, hébergement et infos pratiques"}
          </span>
        </span>
        <span className="text-stone-400">›</span>
      </Link>

      <Link href="/contacts" className="card flex items-center gap-3">
        <span className="text-2xl">📞</span>
        <span className="min-w-0 flex-1">
          <b className="block">Contacts</b>
          <span className="block truncate text-sm text-stone-500">
            {contacts.length ? `${contacts.length} contact${contacts.length > 1 ? "s" : ""} : pédiatre, crèche, famille…` : "Pédiatre, crèche, nounou, grands-parents…"}
          </span>
        </span>
        <span className="text-stone-400">›</span>
      </Link>

      <Section title="🎂 Anniversaires" href="/contacts?anniv=1" linkLabel="+ Ajouter">
        <ul className="space-y-1 text-sm">
          {birthdays.map(({ key, name, color, knownAge, date, age }) => (
            <li key={key} className="flex justify-between gap-2">
              <span><b style={{ color }}>{name}</b>{knownAge ? ` aura ${age} ans` : ""}</span>
              <span className={date === now ? "font-semibold text-teal-700" : "text-stone-500"}>
                {date === now ? "aujourd'hui 🎉" : fmtLong(date).replace(/^\S+ /, "")}
              </span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
