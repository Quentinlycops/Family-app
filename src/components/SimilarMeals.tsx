"use client";

/** Encart « Ce repas existe peut-être déjà » : choisir un repas existant ou garder ce qui a été écrit. */
export default function SimilarMeals<T extends { label: string }>({ typed, options, onPick, onKeep, className = "" }: {
  typed: string;
  options: T[];
  onPick: (m: T) => void;
  onKeep: () => void;
  className?: string;
}) {
  if (!options.length) return null;
  return (
    <div className={`rounded-lg bg-teal-50 p-2 text-xs text-teal-800 ${className}`}>
      <p>Ce repas existe peut-être déjà :</p>
      <div className="mt-1 flex flex-wrap gap-1">
        {options.map((m) => (
          // preventDefault : le champ garde le focus, le choix n'est pas perdu au passage.
          <button type="button" key={m.label} className="rounded-full bg-surface px-2 py-0.5 shadow-sm"
            onMouseDown={(e) => e.preventDefault()} onClick={() => onPick(m)}>
            {m.label}
          </button>
        ))}
        <button type="button" className="rounded-full px-2 py-0.5 text-teal-700 underline"
          onMouseDown={(e) => e.preventDefault()} onClick={onKeep}>
          Garder « {typed.trim()} »
        </button>
      </div>
    </div>
  );
}
