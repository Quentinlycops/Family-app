/** Thème choisi sur cet appareil : automatique (celui du téléphone), clair ou sombre. */
export type ThemePref = "auto" | "light" | "dark";

const KEY = "theme";

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark") return v;
  } catch {}
  return "auto";
}

export function applyTheme(pref: ThemePref) {
  const dark = pref === "dark" || (pref === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

export function setThemePref(pref: ThemePref) {
  try {
    if (pref === "auto") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {}
  applyTheme(pref);
}

/** Script lancé avant l'affichage, pour éviter un flash de la mauvaise couleur. */
export const THEME_SCRIPT = `(function(){try{var p=localStorage.getItem("${KEY}");var m=matchMedia("(prefers-color-scheme: dark)");function a(){var d=p==="dark"||(p!=="light"&&m.matches);document.documentElement.dataset.theme=d?"dark":"light";}a();m.addEventListener("change",function(){p=localStorage.getItem("${KEY}");a();});}catch(e){}})();`;
