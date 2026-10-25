"use client";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { saveMembers, useFamily } from "@/lib/family";
import { useCalendarSettings } from "@/lib/useEvents";
import ColorSwatches from "./ColorSwatches";
import Modal from "./Modal";

/** Chacun choisit la couleur de son agenda (et de ses agendas Google), enregistrée tout de suite. */
export default function AgendaColors({ onClose }: { onClose: () => void }) {
  const { family, me } = useFamily();
  const feeds = useCalendarSettings().feeds ?? [];
  if (!family) return null;
  // Le membre connecté en premier : c'est sa couleur qu'il vient changer.
  const members = [...family.members].sort((a, b) => (a.id === me?.id ? -1 : b.id === me?.id ? 1 : 0));

  const setMemberColor = (id: string, color: string) =>
    saveMembers(family.id, family.members.map((m) => (m.id === id ? { ...m, color } : m)), family.name);

  const setFeedColor = (id: string, color: string | undefined) =>
    setDoc(doc(db, "families", family.id, "settings", "calendars"), {
      feeds: feeds.map((f) => {
        if (f.id !== id) return f;
        const { color: _old, ...rest } = f; // eslint-disable-line @typescript-eslint/no-unused-vars
        return color ? { ...rest, color } : rest;
      }),
    }, { merge: true });

  return (
    <Modal title="Couleurs des agendas" onClose={onClose}>
      <div className="space-y-4">
        {members.map((m) => (
          <div key={m.id} className="space-y-1.5">
            <p className="font-medium" style={{ color: m.color }}>
              {m.name}{m.id === me?.id && <span className="text-xs font-normal text-stone-500"> (toi)</span>}
            </p>
            <ColorSwatches value={m.color} onChange={(c) => c && setMemberColor(m.id, c)} />
          </div>
        ))}
        {feeds.length > 0 && (
          <div className="space-y-4 border-t border-stone-200 pt-4">
            <p className="text-sm text-stone-500">Agendas Google</p>
            {feeds.map((f) => (
              <div key={f.id} className="space-y-1.5">
                <p className="font-medium">{f.name}</p>
                <ColorSwatches value={f.color} autoLabel="Couleurs des membres" onChange={(c) => setFeedColor(f.id, c)} />
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
