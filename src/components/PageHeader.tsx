"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { space } from "@/lib/spaces";

/** En-tête commun : bulle colorée de l'espace, titre, sous-titre et actions à droite. */
export default function PageHeader({ title, subtitle, children, href }: {
  title?: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
  href?: string;
}) {
  const path = usePathname();
  const s = space(href ?? path);
  return (
    <div className="flex flex-wrap items-center gap-3">
      {s && (
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl shadow-sm"
          style={{ background: s.soft }} aria-hidden>
          {s.emoji}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-extrabold tracking-tight">{title ?? s?.label}</h1>
        {subtitle && <p className="text-sm text-stone-500">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
