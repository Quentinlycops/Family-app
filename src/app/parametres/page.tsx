"use client";
import Link from "next/link";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useFamily } from "@/lib/family";
import { ColorsEditor } from "@/components/AgendaColors";
import GoogleCalendarSettings from "@/components/GoogleCalendarSettings";

export default function ParametresPage() {
  const { family, user, me } = useFamily();
  if (!family) return null;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">⚙️ Paramètres</h1>

      <section className="card space-y-3">
        <div>
          <h2 className="text-lg font-semibold">🎨 Couleurs des agendas</h2>
          <p className="text-sm text-stone-500">Chacun choisit sa couleur, enregistrée tout de suite.</p>
        </div>
        <ColorsEditor />
      </section>

      <GoogleCalendarSettings />

      <Link href="/famille" className="card block font-medium text-teal-700">
        👨‍👩‍👧‍👧 Membres de la famille, dates de naissance, code d&apos;invitation ›
      </Link>

      <section className="card flex items-center justify-between">
        <p className="text-sm text-stone-600">
          Connecté(e) en tant que <b>{me?.name}</b> ({user?.email})
        </p>
        <button className="btn-ghost text-sm" onClick={() => signOut(auth)}>Se déconnecter</button>
      </section>
    </div>
  );
}
