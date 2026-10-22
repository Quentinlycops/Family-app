import { buildIcs } from "@/lib/ical-export";
import type { CalendarEvent } from "@/lib/types";

/**
 * Agenda familial au format iCal, auquel Google Agenda peut s'abonner.
 * Les données viennent du document public `feeds/{token}` que l'app tient à jour ;
 * le jeton, long et aléatoire, fait office de mot de passe.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const id = token.replace(/\.ics$/, "");
  if (!/^[a-zA-Z0-9]{20,}$/.test(id)) return new Response("Introuvable", { status: 404 });

  const project = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const base = process.env.NEXT_PUBLIC_USE_EMULATORS === "1"
    ? "http://127.0.0.1:8080/v1"
    : "https://firestore.googleapis.com/v1";
  const res = await fetch(`${base}/projects/${project}/databases/(default)/documents/feeds/${id}?key=${key}`, { cache: "no-store" });
  if (!res.ok) return new Response("Introuvable", { status: 404 });
  const doc = await res.json();
  const name: string = doc.fields?.name?.stringValue ?? "Famille";
  const events: CalendarEvent[] = JSON.parse(doc.fields?.json?.stringValue ?? "[]");

  return new Response(buildIcs(name, events), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
