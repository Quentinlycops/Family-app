import IcalExpander from "ical-expander";
import { TIME_ZONE } from "./config";
import type { CalendarEvent } from "./types";

type ICalTime = {
  isDate: boolean;
  year: number;
  month: number;
  day: number;
  toJSDate(): Date;
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Date (AAAA-MM-JJ) et heure (HH:mm) d'un instant dans le fuseau de la famille. */
function local(d: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("fr-FR", {
      timeZone: TIME_ZONE,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(d).map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

const dateOf = (t: ICalTime) => `${t.year}-${pad(t.month)}-${pad(t.day)}`;

/**
 * Transforme un fichier iCal (agenda Google, iCloud, Outlook…) en événements datés
 * entre `from` et `to`, récurrences et exceptions comprises.
 */
export function parseIcs(ics: string, from: Date, to: Date): Omit<CalendarEvent, "memberIds">[] {
  const expander = new IcalExpander({ ics, maxIterations: 500 });
  const { events, occurrences } = expander.between(from, to);
  const items = [
    ...events.map((e) => ({ uid: e.uid, title: e.summary, location: e.location, start: e.startDate, end: e.endDate })),
    ...occurrences.map((o) => ({ uid: o.item.uid, title: o.item.summary, location: o.item.location, start: o.startDate, end: o.endDate })),
  ] as { uid: string; title: string; location?: string; start: ICalTime; end: ICalTime }[];

  const out: Omit<CalendarEvent, "memberIds">[] = [];
  for (const it of items) {
    const base = { uid: it.uid, title: it.title || "(sans titre)", recurrence: "none" as const, ...(it.location && { location: it.location }) };
    if (it.start.isDate) {
      // Journée entière, éventuellement sur plusieurs jours (la fin est exclusive).
      const d = new Date(Date.UTC(it.start.year, it.start.month - 1, it.start.day));
      const end = it.end ? dateOf(it.end) : null;
      for (let i = 0; i < 31; i++) {
        const iso = d.toISOString().slice(0, 10);
        if (i > 0 && (!end || iso >= end)) break;
        out.push({ ...base, id: `${it.uid}_${iso}`, date: iso });
        d.setUTCDate(d.getUTCDate() + 1);
      }
    } else {
      const s = local(it.start.toJSDate());
      const e = it.end ? local(it.end.toJSDate()) : undefined;
      if (!e || e.date === s.date) {
        out.push({ ...base, id: `${it.uid}_${s.date}_${s.time}`, date: s.date, startTime: s.time, ...(e && { endTime: e.time }) });
        continue;
      }
      // Sur plusieurs jours : heure de début le 1er jour, journée entière ensuite,
      // heure de fin le dernier jour (sauf si elle tombe à minuit pile).
      const d = new Date(`${s.date}T12:00:00Z`);
      for (let i = 0; i < 62; i++) {
        const iso = d.toISOString().slice(0, 10);
        if (iso > e.date || (iso === e.date && e.time === "00:00")) break;
        const part = iso === s.date ? { startTime: s.time } : iso === e.date ? { endTime: e.time } : {};
        out.push({ ...base, id: `${it.uid}_${iso}`, date: iso, ...part });
        d.setUTCDate(d.getUTCDate() + 1);
      }
    }
  }
  return out;
}
