import { normalize } from "./search";
import { addDoc } from "firebase/firestore";
import { familyCol } from "./useCollection";

export const AISLES = [
  "Fruits & légumes",
  "Boucherie & poisson",
  "Crèmerie & frais",
  "Épicerie",
  "Boulangerie",
  "Surgelés",
  "Boissons",
  "Bébé",
  "Hygiène & maison",
  "Autre",
];

const KEYWORDS: Record<string, string[]> = {
  "Fruits & légumes": ["pomme", "banane", "tomate", "salade", "carotte", "oignon", "ail", "courgette", "poivron", "citron", "orange", "fraise", "poire", "patate", "pomme de terre", "avocat", "concombre", "brocoli", "épinard", "champignon", "légume", "fruit", "herbe", "persil", "basilic", "kiwi", "raisin", "melon", "poireau"],
  "Boucherie & poisson": ["poulet", "boeuf", "bœuf", "porc", "jambon", "lardon", "steak", "viande", "saucisse", "poisson", "saumon", "thon", "cabillaud", "crevette", "dinde", "veau", "agneau"],
  "Crèmerie & frais": ["lait", "beurre", "crème", "fromage", "yaourt", "oeuf", "œuf", "emmental", "mozzarella", "parmesan", "compote", "skyr"],
  "Boulangerie": ["pain", "baguette", "brioche", "croissant", "pain de mie"],
  "Surgelés": ["surgelé", "glace", "frites"],
  "Boissons": ["eau", "jus", "vin", "bière", "café", "thé", "sirop", "soda"],
  "Bébé": ["couche", "lingette", "petit pot", "lait bébé", "biberon"],
  "Hygiène & maison": ["savon", "shampo", "dentifrice", "papier", "lessive", "éponge", "liquide vaisselle", "sac poubelle", "gel douche", "mouchoir"],
  "Épicerie": ["pâtes", "riz", "farine", "sucre", "sel", "poivre", "huile", "vinaigre", "conserve", "céréale", "biscuit", "chocolat", "confiture", "miel", "semoule", "lentille", "sauce", "épice", "moutarde", "quinoa"],
};

export function guessAisle(name: string) {
  const n = name.toLowerCase();
  for (const [aisle, words] of Object.entries(KEYWORDS))
    if (words.some((w) => n.includes(w))) return aisle;
  return "Autre";
}

/** Ajoute les articles, sans doublon avec ceux déjà dans la liste (`existing`). */
export async function addShoppingItems(fid: string, names: string[], existing: string[] = []) {
  const seen = new Set(existing.map(normalize));
  await Promise.all(
    names
      .map((n) => n.trim())
      .filter((n) => n && !seen.has(normalize(n)) && seen.add(normalize(n)))
      .map((name) =>
        addDoc(familyCol(fid, "shopping"), {
          name,
          aisle: guessAisle(name),
          checked: false,
          createdAt: Date.now(),
        }),
      ),
  );
}
