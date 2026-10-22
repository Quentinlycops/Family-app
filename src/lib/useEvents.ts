"use client";
import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { useFamily } from "./family";
import { useCollection } from "./useCollection";
import { birthdayEvents } from "./dates";
import type { CalendarEvent, CalendarFeed, CalendarSettings } from "./types";

type FeedResult = { at: number; events: CalendarEvent[]; error?: string };
// Cache partagé entre les pages : un agenda externe est relu au plus toutes les 10 minutes.
const feedCache = new Map<string, FeedResult>();
const TTL = 10 * 60 * 1000;
let lastExport = "";

async function loadFeed(feed: CalendarFeed): Promise<FeedResult> {
  const cached = feedCache.get(feed.url);
  if (cached && Date.now() - cached.at < TTL) return cached;
  try {
    const res = await fetch(`/api/ical?url=${encodeURIComponent(feed.url)}`);
    const data = await res.json();
    const result = res.ok
      ? { at: Date.now(), events: data.events as CalendarEvent[] }
      : { at: Date.now(), events: [], error: data.error as string };
    feedCache.set(feed.url, result);
    return result;
  } catch {
    return { at: Date.now(), events: [], error: "Agenda injoignable." };
  }
}

export function useCalendarSettings() {
  const { family } = useFamily();
  const [settings, setSettings] = useState<CalendarSettings>({});
  const fid = family?.id;
  useEffect(() => {
    if (!fid) return;
    return onSnapshot(doc(db, "families", fid, "settings", "calendars"), (s) =>
      setSettings((s.data() as CalendarSettings) ?? {}),
    );
  }, [fid]);
  return settings;
}

/** Tous les événements à afficher : ceux de l'app, les anniversaires et les agendas Google liés. */
export function useEvents() {
  const { family, member } = useFamily();
  const { items, loading } = useCollection<CalendarEvent>("events");
  const settings = useCalendarSettings();
  const [external, setExternal] = useState<Record<string, FeedResult>>({});
  const feeds = settings.feeds;

  useEffect(() => {
    let cancelled = false;
    const run = () =>
      (feeds ?? []).forEach((f) =>
        loadFeed(f).then((r) => !cancelled && setExternal((cur) => ({ ...cur, [f.id]: r }))),
      );
    run();
    const timer = setInterval(run, TTL);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [feeds]);

  const own = useMemo(
    () => [...items, ...birthdayEvents(family?.members ?? [])],
    [items, family],
  );

  // Publie l'agenda familial pour l'abonnement Google (seulement quand il change).
  const token = settings.exportToken;
  useEffect(() => {
    if (!family || !token || loading) return;
    const payload = own.map((e) => ({
      ...e,
      who: e.memberIds.map((id) => member(id)?.name).filter(Boolean).join(", "),
    }));
    const json = JSON.stringify(payload);
    if (json === lastExport) return;
    const t = setTimeout(() => {
      lastExport = json;
      setDoc(doc(db, "feeds", token), { fid: family.id, name: `Famille`, json }).catch(() => (lastExport = ""));
    }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [own, token, loading, family]);

  const events = useMemo(() => {
    const ext = (feeds ?? []).flatMap((f) =>
      (external[f.id]?.events ?? []).map((e) => ({
        ...e,
        id: `${f.id}_${e.id}`,
        memberIds: f.memberIds,
        source: f.name,
      })),
    );
    return [...own, ...ext];
  }, [own, feeds, external]);

  const errors = (feeds ?? [])
    .filter((f) => external[f.id]?.error)
    .map((f) => `${f.name} : ${external[f.id].error}`);

  return { events, loading, errors };
}
