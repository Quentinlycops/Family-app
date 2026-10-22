import type { CalendarEvent, Member } from "./types";

export const pad = (n: number) => String(n).padStart(2, "0");
export const toISO = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromISO = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const startOfWeek = (d: Date) => addDays(d, -((d.getDay() + 6) % 7)); // lundi
export const today = () => toISO(new Date());

const fr = (opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("fr-FR", opts);
export const fmtLong = (s: string) =>
  fr({ weekday: "long", day: "numeric", month: "long" }).format(fromISO(s));
export const fmtMonth = (d: Date) =>
  fr({ month: "long", year: "numeric" }).format(d);
export const fmtShort = (s: string) =>
  fr({ weekday: "short", day: "numeric", month: "short" }).format(fromISO(s));
export const WEEKDAYS = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];

export function age(birthDate: string, on = new Date()) {
  const b = fromISO(birthDate);
  let a = on.getFullYear() - b.getFullYear();
  if (
    on.getMonth() < b.getMonth() ||
    (on.getMonth() === b.getMonth() && on.getDate() < b.getDate())
  )
    a--;
  return a;
}

export function ageLabel(birthDate: string) {
  const a = age(birthDate);
  if (a >= 2) return `${a} ans`;
  const b = fromISO(birthDate);
  const now = new Date();
  const months =
    (now.getFullYear() - b.getFullYear()) * 12 +
    now.getMonth() -
    b.getMonth() -
    (now.getDate() < b.getDate() ? 1 : 0);
  return `${months} mois`;
}

/** Vrai si l'événement a lieu le jour `day` (AAAA-MM-JJ), récurrence comprise. */
export function occursOn(ev: CalendarEvent, day: string) {
  if (day < ev.date) return false;
  if (ev.until && day > ev.until) return false;
  const a = fromISO(ev.date);
  const b = fromISO(day);
  switch (ev.recurrence) {
    case "none":
      return day === ev.date;
    case "daily":
      return true;
    case "weekly":
      return a.getDay() === b.getDay();
    case "monthly":
      return a.getDate() === b.getDate();
    case "yearly":
      return a.getDate() === b.getDate() && a.getMonth() === b.getMonth();
  }
}

export function birthdayEvents(members: Member[]): CalendarEvent[] {
  return members.map((m) => ({
    id: `anniv-${m.id}`,
    title: `🎂 Anniversaire de ${m.name}`,
    date: m.birthDate,
    memberIds: [m.id],
    recurrence: "yearly",
    birthday: true,
  }));
}

export function eventsOn(events: CalendarEvent[], day: string) {
  return events
    .filter((e) => occursOn(e, day))
    .sort((x, y) => (x.startTime ?? "").localeCompare(y.startTime ?? ""));
}

/** Occurrences des événements sur `days` jours à partir de `from`. */
export function upcoming(events: CalendarEvent[], from: string, days: number) {
  const start = fromISO(from);
  return Array.from({ length: days }, (_, i) => toISO(addDays(start, i))).flatMap(
    (date) => eventsOn(events, date).map((ev) => ({ date, ev })),
  );
}

/** Prochain anniversaire d'un membre : date, âge atteint et nombre de jours restants. */
export function nextBirthday(birthDate: string, from = new Date()) {
  const b = fromISO(birthDate);
  const base = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  let next = new Date(base.getFullYear(), b.getMonth(), b.getDate());
  if (next < base) next = new Date(base.getFullYear() + 1, b.getMonth(), b.getDate());
  const days = Math.round((next.getTime() - base.getTime()) / 86400000);
  return { date: toISO(next), age: next.getFullYear() - b.getFullYear(), days };
}

export function relativeDay(date: string, from = today()) {
  const diff = Math.round((fromISO(date).getTime() - fromISO(from).getTime()) / 86400000);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return "Demain";
  if (diff === -1) return "Hier";
  if (diff > 1 && diff < 7) return fmtLong(date).split(" ")[0];
  return fmtShort(date);
}

export function daysAgo(date: string, from = today()) {
  const diff = Math.round((fromISO(from).getTime() - fromISO(date).getTime()) / 86400000);
  if (diff === 0) return "aujourd'hui";
  if (diff === 1) return "hier";
  if (diff < 0) return `dans ${-diff} j`;
  if (diff < 31) return `il y a ${diff} j`;
  const months = Math.round(diff / 30);
  return months < 12 ? `il y a ${months} mois` : `il y a ${Math.round(diff / 365)} an(s)`;
}
