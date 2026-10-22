"use client";
import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "./firebase";
import { useFamily } from "./family";

/** Abonnement en temps réel à une collection de la famille. */
export function useCollection<T extends { id: string }>(
  name: string,
  ...constraints: QueryConstraint[]
) {
  const { family } = useFamily();
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const fid = family?.id;

  useEffect(() => {
    if (!fid) return;
    const q = query(collection(db, "families", fid, name), ...constraints);
    return onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ ...(d.data() as T), id: d.id })));
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fid, name]);

  return { items, loading };
}

export const familyCol = (fid: string, name: string) =>
  collection(db, "families", fid, name);
