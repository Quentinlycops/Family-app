"use client";
import { useFamily } from "@/lib/family";

/** Pastilles cliquables pour choisir un ou plusieurs membres. */
export default function MemberPicker({
  value,
  onChange,
  multiple = true,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  multiple?: boolean;
}) {
  const { family } = useFamily();
  return (
    <div className="flex flex-wrap gap-2">
      {family?.members.map((m) => {
        const on = value.includes(m.id);
        return (
          <button
            key={m.id}
            type="button"
            onClick={() =>
              onChange(
                multiple
                  ? on ? value.filter((v) => v !== m.id) : [...value, m.id]
                  : on ? [] : [m.id],
              )
            }
            className="rounded-full border-2 px-3 py-1 text-sm font-medium"
            style={{
              borderColor: m.color,
              background: on ? m.color : "transparent",
              color: on ? "white" : m.color,
            }}
          >
            {m.name}
          </button>
        );
      })}
    </div>
  );
}
