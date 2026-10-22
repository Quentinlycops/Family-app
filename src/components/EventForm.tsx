"use client";
import { useState } from "react";
import { addDoc, deleteDoc, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { familyCol } from "@/lib/useCollection";
import { useFamily } from "@/lib/family";
import type { CalendarEvent, Recurrence } from "@/lib/types";
import Modal from "./Modal";
import MemberPicker from "./MemberPicker";
import { googleTemplateUrl } from "@/lib/ical-export";

const RECURRENCES: { value: Recurrence; label: string }[] = [
  { value: "none", label: "Une seule fois" },
  { value: "daily", label: "Tous les jours" },
  { value: "weekly", label: "Toutes les semaines" },
  { value: "monthly", label: "Tous les mois" },
  { value: "yearly", label: "Tous les ans" },
];

export default function EventForm({
  event,
  date,
  onClose,
}: {
  event?: CalendarEvent;
  date: string;
  onClose: () => void;
}) {
  const { family, me, member } = useFamily();
  const [form, setForm] = useState<Omit<CalendarEvent, "id">>(
    event ?? {
      title: "",
      date,
      startTime: "09:00",
      endTime: "10:00",
      memberIds: me ? [me.id] : [],
      recurrence: "none",
    },
  );
  const allDay = !form.startTime;
  const set = (patch: Partial<CalendarEvent>) => setForm({ ...form, ...patch });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!family) return;
    // Firestore refuse les champs `undefined` : on les retire.
    const data = Object.fromEntries(
      Object.entries(form).filter(([k, v]) => v !== undefined && v !== "" && k !== "id"),
    );
    if (event) await setDoc(doc(db, "families", family.id, "events", event.id), data);
    else await addDoc(familyCol(family.id, "events"), data);
    onClose();
  }

  async function remove() {
    if (!family || !event || !confirm("Supprimer cet événement ?")) return;
    await deleteDoc(doc(db, "families", family.id, "events", event.id));
    onClose();
  }

  return (
    <Modal title={event ? "Modifier l'événement" : "Nouvel événement"} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <input className="input text-lg" placeholder="Titre (ex. Crèche, pédiatre…)"
          value={form.title} onChange={(e) => set({ title: e.target.value })} required autoFocus />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={form.date}
              onChange={(e) => set({ date: e.target.value })} required />
          </div>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input type="checkbox" className="h-5 w-5 accent-teal-700" checked={allDay}
              onChange={(e) => set(e.target.checked
                ? { startTime: undefined, endTime: undefined }
                : { startTime: "09:00", endTime: "10:00" })} />
            Toute la journée
          </label>
        </div>
        {!allDay && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Début</label>
              <input type="time" className="input" value={form.startTime}
                onChange={(e) => {
                  // La fin suit le début : on garde la même durée (1 h par défaut).
                  const start = e.target.value;
                  const toMin = (t?: string) => (t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) : NaN);
                  const dur = toMin(form.endTime) - toMin(form.startTime);
                  const end = Math.min(toMin(start) + (dur > 0 ? dur : 60), 23 * 60 + 59);
                  set({ startTime: start, endTime: start ? `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}` : form.endTime });
                }} required />
            </div>
            <div>
              <label className="label">Fin</label>
              <input type="time" className="input" value={form.endTime ?? ""}
                onChange={(e) => set({ endTime: e.target.value })} />
            </div>
          </div>
        )}
        <div>
          <span className="label">Pour qui ?</span>
          <MemberPicker value={form.memberIds} onChange={(memberIds) => set({ memberIds })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Répétition</label>
            <select className="input" value={form.recurrence}
              onChange={(e) => set({ recurrence: e.target.value as Recurrence })}>
              {RECURRENCES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          {form.recurrence !== "none" && (
            <div>
              <label className="label">Jusqu&apos;au (facultatif)</label>
              <input type="date" className="input" value={form.until ?? ""}
                onChange={(e) => set({ until: e.target.value || undefined })} />
            </div>
          )}
        </div>
        <input className="input" placeholder="Lieu" value={form.location ?? ""}
          onChange={(e) => set({ location: e.target.value })} />
        <textarea className="input" rows={2} placeholder="Notes" value={form.notes ?? ""}
          onChange={(e) => set({ notes: e.target.value })} />
        {event && (
          <a className="btn-ghost w-full border border-stone-200 text-sm" target="_blank" rel="noreferrer"
            href={googleTemplateUrl(event, event.memberIds.map((id) => member(id)?.name).join(", "))}>
            📆 Ajouter à Google Agenda
          </a>
        )}
        <div className="flex justify-between">
          {event ? (
            <button type="button" className="btn-ghost text-red-600" onClick={remove}>Supprimer</button>
          ) : <span />}
          <button className="btn">Enregistrer</button>
        </div>
      </form>
    </Modal>
  );
}
