import { normalize } from "./search";
import { addDoc } from "firebase/firestore";
import { familyCol } from "./useCollection";

/** Ajoute les articles, sans doublon avec ceux déjà dans la liste (`existing`). */
export async function addShoppingItems(fid: string, names: string[], existing: string[] = []) {
  const seen = new Set(existing.map(normalize));
  await Promise.all(
    names
      .map((n) => n.trim())
      .filter((n) => n && !seen.has(normalize(n)) && seen.add(normalize(n)))
      .map((name, i) =>
        addDoc(familyCol(fid, "shopping"), {
          name,
          checked: false,
          createdAt: Date.now(),
          // Les nouveaux articles arrivent en bas de la liste.
          order: Date.now() + i,
        }),
      ),
  );
}
