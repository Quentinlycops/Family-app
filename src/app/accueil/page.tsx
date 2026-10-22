"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useFamily } from "@/lib/family";
import { useCollection } from "@/lib/useCollection";
import { useEvents } from "@/lib/useEvents";
import { ageLabel, fmtLong, nextBirthday, relativeDay, today, upcoming } from "@/lib/dates";
import type { BudgetSettings, Expense, MealSlot, Recipe, ShoppingItem, Todo } from "@/lib/types";

const euro = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? "Bonne nuit" : h < 18 ? "Bonjour" : "Bonsoir";
}

function Section({ title, href, children }: { title: string; href?: string; children: React.ReactNode }) {
  return (
    <section className="card">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        {href && <Link href={href} className="text-sm text-teal-700">Tout voir ›</Link>}
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
  const { items: expenses } = useCollection<Expense>("expenses");
  const [budget, setBudget] = useState<BudgetSettings>();
  const fid = family?.id;

  useEffect(() => {
    if (!fid) return;
    return onSnapshot(doc(db, "families", fid, "settings", "budget"), (s) =>
      setBudget(s.exists() ? (s.data() as BudgetSettings) : undefined),
    );
  }, [fid]);

  if (!family) return null;
  const now = today();
  // Un événement sur plusieurs jours n'est montré qu'une fois (son premier jour visible).
  const seen = new Set<string>();
  const next = upcoming(events.filter((e) => !e.birthday), now, 14)
    .filter(({ ev }) => {
      const key = `${ev.title}|${ev.source ?? ""}|${ev.memberIds.join()}`;
      const spans = !!ev.endDate || (ev.source && !ev.startTime);
      if (spans && seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
  const byDay = next.reduce<Record<string, typeof next>>((acc, o) => {
    (acc[o.date] ??= []).push(o);
    return acc;
  }, {});

  const birthdays = family.members
    .map((m) => ({ m, ...nextBirthday(m.birthDate) }))
    .sort((a, b) => a.days - b.days);

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
  const month = now.slice(0, 7);
  const spent = expenses.filter((e) => e.date.startsWith(month)).reduce((s, e) => s + e.amount, 0);
  const planned = (budget?.categories ?? []).reduce((s, c) => s + c.monthly, 0) || 1500;
  const kids = family.members.filter((m) => m.role === "enfant");

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm capitalize text-stone-500">{fmtLong(now)}</p>
        <h1 className="text-2xl font-bold">{greeting()} {me?.name ?? ""} 👋</h1>
      </div>

      <Section title="Prochains événements" href="/agenda">
        {next.length === 0 && <p className="py-2 text-sm text-stone-400">Rien de prévu ces deux prochaines semaines.</p>}
        <div className="space-y-3">
          {Object.entries(byDay).map(([date, list]) => (
            <div key={date}>
              <p className={`text-xs font-semibold uppercase tracking-wide ${date === now ? "text-teal-700" : "text-stone-400"}`}>
                {relativeDay(date)}
              </p>
              {list.map(({ ev }) => (
                <div key={ev.id + date} className="flex items-center gap-3 py-1">
                  <span className="w-12 text-sm font-semibold">{ev.startTime ?? (ev.endTime ? `→${ev.endTime}` : "—")}</span>
                  <span className="flex gap-0.5">
                    {ev.memberIds.map((id) => (
                      <span key={id} className="h-2.5 w-2.5 rounded-full" style={{ background: member(id)?.color }} />
                    ))}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{ev.title}</span>
                  {ev.source && <span className="chip">Google</span>}
                </div>
              ))}
            </div>
          ))}
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
              {member(t.assigneeId) && (
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: member(t.assigneeId)?.color }} />
              )}
            </li>
          ))}
        </ul>
      </Section>

      <Link href="/budget" className="card block">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">💶 Budget du mois</h2>
          <span className="text-sm text-stone-500">{euro(spent)} / {euro(planned)}</span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-stone-100">
          <div className={`h-2 rounded-full ${spent > planned ? "bg-red-500" : "bg-teal-600"}`}
            style={{ width: `${Math.min(100, (spent / planned) * 100)}%` }} />
        </div>
      </Link>

      <Section title="Les enfants" href="/enfants">
        <div className="grid grid-cols-2 gap-3">
          {kids.map((k) => (
            <Link key={k.id} href={`/enfants#${k.id}`} className="flex items-center gap-3 rounded-xl p-2 hover:bg-stone-100">
              <span className="flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold text-white" style={{ background: k.color }}>
                {k.name[0]}
              </span>
              <span>
                <b>{k.name}</b>
                <span className="block text-xs text-stone-500">{ageLabel(k.birthDate)}</span>
              </span>
            </Link>
          ))}
        </div>
      </Section>

      <Section title="🎂 Anniversaires">
        <ul className="space-y-1 text-sm">
          {birthdays.map(({ m, days, age }) => (
            <li key={m.id} className="flex justify-between">
              <span><b style={{ color: m.color }}>{m.name}</b> aura {age} ans</span>
              <span className={days <= 7 ? "font-semibold text-teal-700" : "text-stone-500"}>
                {days === 0 ? "aujourd'hui 🎉" : days === 1 ? "demain" : `dans ${days} jours`}
              </span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
