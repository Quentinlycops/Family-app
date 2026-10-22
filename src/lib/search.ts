/** Minuscules sans accents, pour une recherche tolérante. */
export const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Vrai si tous les mots de la recherche apparaissent dans l'un des textes. */
export function matches(query: string, ...texts: (string | undefined)[]) {
  const hay = normalize(texts.filter(Boolean).join(" "));
  return normalize(query).split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
}
