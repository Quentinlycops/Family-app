"use client";
import Link from "next/link";
import GoogleCalendarSettings from "@/components/GoogleCalendarSettings";
import PageHeader from "@/components/PageHeader";

export default function GooglePage() {
  return (
    <div className="space-y-4">
      <Link href="/parametres" className="btn-ghost -ml-3 text-sm text-stone-500">‹ Réglages</Link>
      <PageHeader title="Agendas Google" subtitle="Importer vos agendas Google et partager celui de la famille." />
      <GoogleCalendarSettings />
    </div>
  );
}
