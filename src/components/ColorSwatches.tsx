"use client";

export const PALETTE = ["#e11d48", "#f97316", "#f59e0b", "#16a34a", "#0d9488", "#0284c7", "#2563eb", "#7c3aed", "#9333ea", "#db2777", "#78716c", "#1c1917"];

/** Choix d'une couleur : pastilles prédéfinies, sélecteur libre et, si `autoLabel`, retour à la couleur par défaut. */
export default function ColorSwatches({ value, onChange, autoLabel }: {
  value?: string;
  onChange: (color: string | undefined) => void;
  autoLabel?: string;
}) {
  const ring = "ring-2 ring-offset-2 ring-stone-800 ring-offset-white dark:ring-offset-stone-900";
  return (
    <div className="flex flex-wrap items-center gap-2">
      {autoLabel && (
        <button type="button" onClick={() => onChange(undefined)}
          className={`rounded-full border border-stone-300 px-3 py-1 text-xs ${!value ? ring : ""}`}>
          {autoLabel}
        </button>
      )}
      {PALETTE.map((c) => (
        <button key={c} type="button" onClick={() => onChange(c)} aria-label={`Couleur ${c}`}
          className={`h-7 w-7 rounded-full ${value?.toLowerCase() === c ? ring : ""}`} style={{ background: c }} />
      ))}
      <label className="relative h-7 w-7 cursor-pointer overflow-hidden rounded-full border border-stone-300 bg-[conic-gradient(red,yellow,lime,aqua,blue,magenta,red)]"
        title="Autre couleur">
        <input type="color" className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          value={value ?? "#0d9488"} onChange={(e) => onChange(e.target.value)} aria-label="Autre couleur" />
      </label>
    </div>
  );
}
