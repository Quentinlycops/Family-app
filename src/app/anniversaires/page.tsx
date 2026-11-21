"use client";
import Link from "next/link";
import { useFamily } from "@/lib/family";
import { contactBirthDate, useContacts } from "@/lib/contacts";
import { ageLabel, fmtLong, nextBirthday, today } from "@/lib/dates";
import PageHeader from "@/components/PageHeader";

export default function AnniversairesPage() {
  const { family, member } = useFamily();
  const { items: contacts } = useContacts();
  if (!family) return null;
  const now = today();

  // La famille et les anniversaires notés dans les contacts (grands-parents, cousines…), du plus proche au plus lointain.
  const birthdays = [
    ...family.members.map((m) => ({ key: m.id, name: m.name, color: m.color, ageNow: ageLabel(m.birthDate), ...nextBirthday(m.birthDate) })),
    ...contacts.filter((c) => c.birthday).map((c) => ({
      key: c.id, name: c.name, color: member(c.memberIds[0])?.color,
      ageNow: c.birthYear ? ageLabel(contactBirthDate(c)) : undefined, ...nextBirthday(contactBirthDate(c)),
    })),
  ].sort((a, b) => a.days - b.days);

  return (
    <div className="space-y-4">
      <PageHeader subtitle="Du plus proche au plus lointain">
        <Link href="/contacts?anniv=1" className="btn">+ Ajouter</Link>
      </PageHeader>
      <ul className="card divide-y divide-stone-100 py-1">
        {birthdays.map(({ key, name, color, ageNow, date, days }) => (
          <li key={key} className="flex items-center gap-3 py-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-extrabold text-white" style={{ background: color ?? "#a8a29e" }}>
              {name.slice(0, 1)}
            </span>
            <span className="min-w-0 flex-1">
              <b className="block truncate">{name}</b>
              {ageNow && <span className="text-xs text-stone-500">{ageNow}</span>}
            </span>
            <span className={`text-right text-sm ${date === now ? "font-bold text-teal-700" : "text-stone-500"}`}>
              {date === now ? "Aujourd'hui 🎉" : <>{fmtLong(date).replace(/^\S+ /, "")}<span className="block text-xs text-stone-400">dans {days} j</span></>}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-center text-sm text-stone-500">
        Les anniversaires des grands-parents, cousins… se notent dans <Link href="/contacts?anniv=1" className="font-bold text-teal-700">📞 Contacts</Link>.
      </p>
    </div>
  );
}
