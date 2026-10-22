"use client";
import { useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { createFamily, DEFAULT_MEMBERS, joinFamily, useFamily } from "@/lib/family";

const PARENTS = DEFAULT_MEMBERS.filter((m) => m.role === "parent");

export default function FamilySetup() {
  const { user } = useFamily();
  const [mode, setMode] = useState<"create" | "join">("create");
  const [memberId, setMemberId] = useState("quentin");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      if (mode === "create") await createFamily(user.uid, "Notre famille", memberId);
      else await joinFamily(user.uid, code, memberId);
    } catch (err) {
      setError((err as Error).message || "Impossible de continuer.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="mb-6 text-center text-2xl font-bold text-teal-800">Bienvenue !</h1>
      <form onSubmit={submit} className="card space-y-4">
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-stone-100 p-1">
          {(["create", "join"] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)}
              className={`rounded-lg py-2 text-sm font-medium ${mode === m ? "bg-surface shadow" : "text-stone-500"}`}>
              {m === "create" ? "Créer la famille" : "Rejoindre"}
            </button>
          ))}
        </div>
        <div>
          <span className="label">Qui es-tu ?</span>
          <div className="grid grid-cols-2 gap-2">
            {PARENTS.map((p) => (
              <button key={p.id} type="button" onClick={() => setMemberId(p.id)}
                className={`rounded-xl border-2 py-3 font-medium ${memberId === p.id ? "border-current" : "border-stone-200"}`}
                style={{ color: p.color }}>
                {p.name}
              </button>
            ))}
          </div>
        </div>
        {mode === "create" ? (
          <p className="text-sm text-stone-500">
            La famille est créée avec Cristina, Quentin, Léa et Alba. Tu pourras
            ensuite donner le code à l&apos;autre parent.
          </p>
        ) : (
          <div>
            <label className="label" htmlFor="code">Code de la famille</label>
            <input id="code" className="input font-mono" value={code}
              onChange={(e) => setCode(e.target.value)} required />
            <p className="mt-1 text-xs text-stone-500">
              Il se trouve dans l&apos;onglet Famille de l&apos;autre parent.
            </p>
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn w-full" disabled={busy}>Continuer</button>
      </form>
      <button className="btn-ghost mx-auto mt-4 text-sm" onClick={() => signOut(auth)}>
        Se déconnecter ({user?.email})
      </button>
    </div>
  );
}
