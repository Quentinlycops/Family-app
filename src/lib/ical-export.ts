import { TIME_ZONE } from "./config";
import type { CalendarEvent } from "./types";

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
const compact = (date: string, time?: string) =>
  date.replace(/-/g, "") + (time ? `T${time.replace(":", "")}00` : "");
const nextDay = (date: string) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

const RRULE: Record<string, string> = {
  daily: "DAILY", weekly: "WEEKLY", monthly: "MONTHLY", yearly: "YEARLY",
};

/** Règle de récurrence iCal d'un événement de l'app, ou null. */
export function rrule(ev: Pick<CalendarEvent, "recurrence" | "until">) {
  if (ev.recurrence === "none") return null;
  return `RRULE:FREQ=${RRULE[ev.recurrence]}${ev.until ? `;UNTIL=${compact(ev.until)}T235959Z` : ""}`;
}

/** Les lignes iCal sont limitées à 75 octets : on replie les plus longues. */
function fold(line: string) {
  const enc = new TextEncoder();
  const parts: string[] = [];
  let cur = "";
  for (const ch of line) {
    if (enc.encode(cur + ch).length > 73) {
      parts.push(cur);
      cur = "";
    }
    cur += ch;
  }
  parts.push(cur);
  return parts.join("\r\n ");
}

/** Génère un fichier iCal à partir des événements de la famille, pour abonnement depuis Google Agenda. */
export function buildIcs(name: string, events: (CalendarEvent & { who?: string })[]) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Famille//Agenda familial//FR",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${esc(name)}`,
    `X-WR-TIMEZONE:${TIME_ZONE}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    // Définition du fuseau (heure d'été / heure d'hiver européennes).
    "BEGIN:VTIMEZONE", `TZID:${TIME_ZONE}`,
    "BEGIN:DAYLIGHT", "TZOFFSETFROM:+0100", "TZOFFSETTO:+0200", "TZNAME:CEST",
    "DTSTART:19700329T020000", "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU", "END:DAYLIGHT",
    "BEGIN:STANDARD", "TZOFFSETFROM:+0200", "TZOFFSETTO:+0100", "TZNAME:CET",
    "DTSTART:19701025T030000", "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU", "END:STANDARD",
    "END:VTIMEZONE",
  ];
  for (const ev of events) {
    lines.push("BEGIN:VEVENT", `UID:${ev.id}@famille`, `DTSTAMP:${stamp}`, `SUMMARY:${esc(ev.title)}`);
    if (ev.startTime) {
      lines.push(`DTSTART;TZID=${TIME_ZONE}:${compact(ev.date, ev.startTime)}`);
      lines.push(`DTEND;TZID=${TIME_ZONE}:${compact(ev.date, ev.endTime && ev.endTime > ev.startTime ? ev.endTime : ev.startTime)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${compact(ev.date)}`, `DTEND;VALUE=DATE:${compact(nextDay(ev.endDate ?? ev.date))}`);
    }
    const rule = rrule(ev);
    if (rule) lines.push(rule);
    if (ev.location) lines.push(`LOCATION:${esc(ev.location)}`);
    const desc = [ev.who && `Pour : ${ev.who}`, ev.notes].filter(Boolean).join("\n");
    if (desc) lines.push(`DESCRIPTION:${esc(desc)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** Lien qui ouvre Google Agenda avec l'événement prérempli. */
export function googleTemplateUrl(ev: CalendarEvent, who?: string) {
  const dates = ev.startTime
    ? `${compact(ev.date, ev.startTime)}/${compact(ev.date, ev.endTime && ev.endTime > ev.startTime ? ev.endTime : ev.startTime)}`
    : `${compact(ev.date)}/${compact(nextDay(ev.endDate ?? ev.date))}`;
  const p = new URLSearchParams({ action: "TEMPLATE", text: ev.title, dates, ctz: TIME_ZONE });
  if (ev.location) p.set("location", ev.location);
  const details = [who && `Pour : ${who}`, ev.notes].filter(Boolean).join("\n");
  if (details) p.set("details", details);
  const rule = rrule(ev);
  if (rule) p.set("recur", rule);
  return `https://calendar.google.com/calendar/render?${p}`;
}
