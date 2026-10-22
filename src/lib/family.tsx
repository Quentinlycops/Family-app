"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  arrayUnion,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import type { Family, Member } from "./types";

export const DEFAULT_MEMBERS: Member[] = [
  { id: "cristina", name: "Cristina", birthDate: "1985-04-25", color: "#e11d48", role: "parent" },
  { id: "quentin", name: "Quentin", birthDate: "1989-02-09", color: "#2563eb", role: "parent" },
  { id: "lea", name: "Léa", birthDate: "2022-10-21", color: "#9333ea", role: "enfant" },
  { id: "alba", name: "Alba", birthDate: "2024-03-31", color: "#f59e0b", role: "enfant" },
];

type Ctx = {
  user: User | null | undefined; // undefined = chargement
  family: Family | null | undefined;
  me: Member | undefined;
  member: (id?: string) => Member | undefined;
};

const FamilyContext = createContext<Ctx>({
  user: undefined,
  family: undefined,
  me: undefined,
  member: () => undefined,
});

export function FamilyProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  // Chaque valeur est rangée avec la clé qui l'a produite, pour dériver « en chargement ».
  const [userDoc, setUserDoc] = useState<{ uid: string; familyId: string | null }>();
  const [famDoc, setFamDoc] = useState<{ id: string; family: Family | null }>();

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  const uid = user?.uid;
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(doc(db, "users", uid), (s) =>
      setUserDoc({ uid, familyId: (s.data()?.familyId as string) ?? null }),
    );
  }, [uid]);

  const familyId =
    user === undefined ? undefined
    : !user ? null
    : userDoc?.uid === user.uid ? userDoc.familyId
    : undefined;

  useEffect(() => {
    if (!familyId) return;
    return onSnapshot(doc(db, "families", familyId), (s) =>
      setFamDoc({
        id: familyId,
        family: s.exists() ? { ...(s.data() as Family), id: s.id } : null,
      }),
    );
  }, [familyId]);

  const family =
    familyId === undefined ? undefined
    : !familyId ? null
    : famDoc?.id === familyId ? famDoc.family
    : undefined;

  const member = (id?: string) => family?.members.find((m) => m.id === id);
  const me = family?.members.find((m) => m.uid && m.uid === user?.uid);

  return (
    <FamilyContext.Provider value={{ user, family, me, member }}>
      {children}
    </FamilyContext.Provider>
  );
}

export const useFamily = () => useContext(FamilyContext);

/** Crée la famille et lie le compte courant au membre choisi. */
export async function createFamily(uid: string, name: string, memberId: string) {
  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  const members = DEFAULT_MEMBERS.map((m) =>
    m.id === memberId ? { ...m, uid } : m,
  );
  await setDoc(doc(db, "families", id), { name, memberUids: [uid], members });
  await setDoc(doc(db, "users", uid), { familyId: id });
  return id;
}

/** Rejoint une famille existante grâce à son code. */
export async function joinFamily(uid: string, code: string, memberId: string) {
  const ref = doc(db, "families", code.trim());
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Code de famille introuvable.");
  const fam = snap.data() as Family;
  const members = fam.members.map((m) =>
    m.id === memberId ? { ...m, uid } : m,
  );
  await updateDoc(ref, { memberUids: arrayUnion(uid), members });
  await setDoc(doc(db, "users", uid), { familyId: ref.id });
}

export async function saveMembers(fid: string, members: Member[]) {
  await updateDoc(doc(db, "families", fid), { members });
}
