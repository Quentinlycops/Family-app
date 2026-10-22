import { NextResponse, type NextRequest } from "next/server";
import { parseIcs } from "@/lib/ical";

// Seuls les agendas des grands fournisseurs sont relayés (pas de proxy ouvert).
const ALLOWED = [/^calendar\.google\.com$/, /^p\d+-caldav\.icloud\.com$/, /^outlook\.(live|office365)\.com$/];

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url") ?? "";
  let url: URL;
  try {
    url = new URL(raw.trim().replace(/^webcal:/, "https:"));
    url.pathname = url.pathname.replace(/@/g, "%40");
  } catch {
    return NextResponse.json({ error: "Adresse invalide." }, { status: 400 });
  }
  if (url.protocol !== "https:" || !ALLOWED.some((r) => r.test(url.hostname)))
    return NextResponse.json({ error: "Seuls les agendas Google, iCloud et Outlook sont acceptés." }, { status: 400 });

  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10000) });
  } catch {
    return NextResponse.json({ error: "Agenda injoignable pour le moment." }, { status: 502 });
  }
  if (!res.ok) {
    const hint = url.pathname.includes("/public/")
      ? "C'est l'adresse publique : copie plutôt l'« adresse secrète au format iCal » (elle contient « private- »)."
      : "Vérifie que l'adresse secrète a été copiée en entier.";
    return NextResponse.json({ error: `Google ne trouve pas cet agenda (${res.status}). ${hint}` }, { status: 502 });
  }
  const ics = await res.text();
  if (!ics.includes("BEGIN:VCALENDAR"))
    return NextResponse.json({ error: "Ce lien ne renvoie pas un agenda iCal." }, { status: 502 });

  const now = Date.now();
  const events = parseIcs(ics, new Date(now - 62 * 86400000), new Date(now + 400 * 86400000));
  const name = ics.match(/^X-WR-CALNAME:(.*)$/m)?.[1]?.trim();
  return NextResponse.json(
    { name, events },
    { headers: { "Cache-Control": "private, max-age=300" } },
  );
}
