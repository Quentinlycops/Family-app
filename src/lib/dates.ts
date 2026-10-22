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
