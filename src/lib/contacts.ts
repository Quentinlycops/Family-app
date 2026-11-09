"use client";
import { useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { useFamily } from "./family";
import { useCollection } from "./useCollection";
import type { CalendarEvent, Contact, KidProfile, Member } from "./types";

const checked = new Set<string>();

/**
 * Recopie une seule fois les contacts des anciennes fiches enfants dans la liste commune.
 * L'ancienne liste reste dans la fiche (rien n'est effacé) ; les identifiants fixes évitent les doublons.
 */
async function moveKidContacts(fid: string, kids: Member[]) {
  for (const kid of kids) {
    const ref = doc(db, "families", fid, "kids", kid.id);
    const p = ((await getDoc(ref)).data() ?? {}) as KidProfile;
    if (p.contactsMoved || !p.contacts?.length) continue;
    await Promise.all(
      p.contacts.map((c, i) =>
        setDoc(doc(db, "families", fid, "contacts", `fiche-${kid.id}-${i}`), clean({
          name: c.name,
          role: c.role,
          phone: c.phone,
          memberIds: [kid.id],
          createdAt: Date.now() + i,
        })),
      ),
    );
    await setDoc(ref, { contactsMoved: true }, { merge: true });
  }
}

/** Tous les contacts de la famille, en temps réel. */
export function useContacts() {
  const { family } = useFamily();
  const res = useCollection<Contact>("contacts");
  const fid = family?.id;
  useEffect(() => {
    if (!family || checked.has(family.id)) return;
    checked.add(family.id);
    moveKidContacts(family.id, family.members.filter((m) => m.role === "enfant")).catch(() => checked.delete(family.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fid]);
  return res;
}

/** Firestore refuse les champs `undefined` : on les retire, ainsi que les textes vides. */
export function clean<T extends object>(o: T): T {
  return Object.fromEntries(
    Object.entries(o).filter(([, v]) => v !== undefined && v !== ""),
  ) as T;
}

/** Date de naissance AAAA-MM-JJ d'un contact (année 2000 si inconnue, pour le calcul seulement). */
export const contactBirthDate = (c: Contact) => `${c.birthYear ?? 2000}-${c.birthday}`;

export function contactBirthdayEvents(contacts: Contact[]): CalendarEvent[] {
  return contacts
    .filter((c) => c.birthday)
    .map((c) => ({
      id: `anniv-c-${c.id}`,
      title: `🎂 Anniversaire de ${c.name}`,
      date: contactBirthDate(c),
      memberIds: c.memberIds,
      recurrence: "yearly",
      birthday: true,
    }));
}
