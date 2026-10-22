"use client";
import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

const MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "Email ou mot de passe incorrect.",
  "auth/email-already-in-use": "Un compte existe déjà avec cet email.",
  "auth/weak-password": "Le mot de passe doit faire au moins 6 caractères.",
  "auth/invalid-email": "Adresse email invalide.",
};

export default function Login() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") await signInWithEmailAndPassword(auth, email, password);
      else await createUserWithEmailAndPassword(auth, email, password);
    } catch (err) {
      const code = (err as { code?: string }).code ?? "";
      setError(MESSAGES[code] ?? "Une erreur est survenue, réessaie.");
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (!email) return setError("Indique ton email d'abord.");
    await sendPasswordResetEmail(auth, email).catch(() => {});
    setInfo("Si ce compte existe, un email de réinitialisation a été envoyé.");
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="mb-1 text-center text-3xl font-bold text-teal-800">🏡 Famille</h1>
      <p className="mb-8 text-center text-stone-500">
        L&apos;organisation de la maison, à deux.
      </p>
      <form onSubmit={submit} className="card space-y-3">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" className="input" type="email" autoComplete="email"
            value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="pw">Mot de passe</label>
          <input id="pw" className="input" type="password" minLength={6}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {info && <p className="text-sm text-teal-700">{info}</p>}
        <button className="btn w-full" disabled={busy}>
          {mode === "login" ? "Se connecter" : "Créer mon compte"}
        </button>
        <div className="flex justify-between text-sm">
          <button type="button" className="text-teal-700 underline"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}>
            {mode === "login" ? "Créer un compte" : "J'ai déjà un compte"}
          </button>
          {mode === "login" && (
            <button type="button" className="text-stone-500 underline" onClick={reset}>
              Mot de passe oublié
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
