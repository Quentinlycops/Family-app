import { normalize } from "./search";

// Petits mots qui ne changent pas le plat : « Poulet au riz » = « Riz, poulet ».
const STOP = new Set([
  "a", "au", "aux", "avec", "de", "des", "du", "d", "en", "et", "l", "la", "le", "les",
  "un", "une", "sur", "sans", "facon", "maison", "mode", "plat",
]);

/** Mots significatifs d'un nom de repas, sans accents, au singulier, sans doublon. */
export function mealTokens(name: string): string[] {
  const words = normalize(name)
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !STOP.has(w))
    .map((w) => (w.length > 3 && /[sx]$/.test(w) ? w.slice(0, -1) : w));
  return [...new Set(words)];
}

/** Distance d'édition (pour tolérer une faute de frappe). */
function distance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

function sameWord(a: string, b: string) {
  if (a === b) return true;
  const min = Math.min(a.length, b.length);
  if (min < 4) return false;
  // « spaghetti » / « spagheti », « carotte » / « carottes »…
  return distance(a, b) <= (min >= 7 ? 2 : 1);
}

/** Ressemblance entre deux noms de repas, de 0 (rien à voir) à 1 (mêmes ingrédients). */
export function mealSimilarity(a: string, b: string) {
  const ta = mealTokens(a);
  const tb = mealTokens(b);
  if (!ta.length || !tb.length) return 0;
  const used = new Set<number>();
  let common = 0;
  for (const w of ta) {
    const j = tb.findIndex((x, i) => !used.has(i) && sameWord(w, x));
    if (j >= 0) {
      used.add(j);
      common++;
    }
  }
  return common / (ta.length + tb.length - common);
}

/**
 * Repas existants qui pourraient être le même plat que `name`
 * (mêmes ingrédients dans un autre ordre, majuscules, accents, faute de frappe…).
 * Le nom exact lui-même n'est jamais proposé.
 */
export function similarMeals<T extends { label: string }>(name: string, existing: T[], max = 3): T[] {
  const key = normalize(name.trim());
  if (!key) return [];
  return existing
    .filter((m) => normalize(m.label.trim()) !== key)
    .map((m) => ({ m, score: mealSimilarity(name, m.label) }))
    .filter((x) => x.score >= 0.6)
    .sort((x, y) => y.score - x.score)
    .slice(0, max)
    .map((x) => x.m);
}
