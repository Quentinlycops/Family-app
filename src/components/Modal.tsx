"use client";
import type { ReactNode } from "react";

export default function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fade-in fixed inset-0 z-40 flex items-end justify-center bg-black/30 backdrop-blur-[2px] sm:items-center"
      onClick={onClose}
    >
      <div
        className="sheet-in max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-[2rem] bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-[2rem]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-extrabold">{title}</h2>
          <button className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-xl text-stone-500 transition hover:bg-stone-200 active:scale-90" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
