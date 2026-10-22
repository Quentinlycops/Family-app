"use client";
import { useState } from "react";
import { addDoc, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useFamily } from "@/lib/family";
import { familyCol, useCollection } from "@/lib/useCollection";
import { fmtShort, today } from "@/lib/dates";
import type { Todo } from "@/lib/types";
import MemberPicker from "@/components/MemberPicker";

export default function TodoPage() {
  const { family, member } = useFamily();
  const { items } = useCollection<Todo>("todos");
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState<string[]>([]);
  const [due, setDue] = useState("");
  const [who, setWho] = useState<string>("");
  const [showDone, setShowDone] = useState(false);
  if (!family) return null;
  const ref = (id: string) => doc(db, "families", family.id, "todos", id);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await addDoc(familyCol(family!.id, "todos"), {
      title: title.trim(),
      done: false,
      createdAt: Date.now(),
      ...(assignee[0] && { assigneeId: assignee[0] }),
      ...(due && { dueDate: due }),
    });
    setTitle("");
    setDue("");
  }

  const list = items
    .filter((t) => !who || t.assigneeId === who)
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || a.createdAt - b.createdAt);
  const open = list.filter((t) => !t.done);
  const done = list.filter((t) => t.done);

  const Row = ({ t }: { t: Todo }) => {
    const m = member(t.assigneeId);
    const late = t.dueDate && !t.done && t.dueDate < today();
    return (
      <li className="flex items-center gap-3 py-2">
        <input type="checkbox" checked={t.done} className="h-5 w-5 accent-teal-700"
          onChange={() => updateDoc(ref(t.id), { done: !t.done })} />
        <span className={`flex-1 ${t.done ? "text-stone-400 line-through" : ""}`}>
          {t.title}
          <span className="block text-xs text-stone-500">
            {m && <b style={{ color: m.color }}>{m.name}</b>}
            {m && t.dueDate && " · "}
            {t.dueDate && <span className={late ? "font-semibold text-red-600" : ""}>{fmtShort(t.dueDate)}</span>}
          </span>
        </span>
        <button className="text-stone-400 hover:text-red-600" aria-label="Supprimer"
          onClick={() => deleteDoc(ref(t.id))}>×</button>
      </li>
    );
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">To-do</h1>
      <form onSubmit={add} className="card space-y-3">
        <input className="input" placeholder="Nouvelle tâche…" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="flex flex-wrap items-center gap-2">
          <MemberPicker value={assignee} onChange={setAssignee} multiple={false} />
          <input type="date" className="input w-auto" value={due} onChange={(e) => setDue(e.target.value)} />
          <button className="btn ml-auto">Ajouter</button>
        </div>
      </form>
      <div className="flex gap-2 text-sm">
        <select className="input w-auto" value={who} onChange={(e) => setWho(e.target.value)}>
          <option value="">Tout le monde</option>
          {family.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>
      <ul className="card divide-y divide-stone-100">
        {open.length === 0 && <li className="py-4 text-center text-sm text-stone-400">Tout est fait 🎉</li>}
        {open.map((t) => <Row key={t.id} t={t} />)}
      </ul>
      {done.length > 0 && (
        <div>
          <button className="text-sm text-stone-500 underline" onClick={() => setShowDone(!showDone)}>
            {showDone ? "Masquer" : "Voir"} les {done.length} tâches faites
          </button>
          {showDone && (
            <ul className="card mt-2 divide-y divide-stone-100">
              {done.map((t) => <Row key={t.id} t={t} />)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
