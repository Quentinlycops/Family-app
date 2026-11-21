"use client";
import Link from "next/link";
import { ColorsEditor } from "@/components/AgendaColors";
import PageHeader from "@/components/PageHeader";

export default function CouleursPage() {
  return (
    <div className="space-y-4">
      <Link href="/parametres" className="btn-ghost -ml-3 text-sm text-stone-500">‹ Réglages</Link>
      <PageHeader title="Couleurs" subtitle="Chacun choisit sa couleur, enregistrée tout de suite." />
      <section className="card"><ColorsEditor /></section>
    </div>
  );
}
