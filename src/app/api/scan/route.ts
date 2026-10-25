import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";

export const maxDuration = 60;

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type ImageType = (typeof IMAGE_TYPES)[number];
const MAX_BYTES = 4 * 1024 * 1024; // limite de corps des fonctions Vercel (4,5 Mo)

// Ce que l'on demande à Claude de lire sur le document.
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "store", "address", "date", "time", "total", "subtotal", "vat", "discount", "currency",
    "paymentMethod", "invoiceNumber", "dueDate", "period", "items", "suggestedCategory", "notes"],
  properties: {
    kind: { type: "string", enum: ["ticket", "facture", "autre"] },
    store: { type: ["string", "null"], description: "Nom du magasin ou du fournisseur" },
    address: { type: ["string", "null"] },
    date: { type: ["string", "null"], description: "AAAA-MM-JJ" },
    time: { type: ["string", "null"], description: "HH:mm" },
    total: { type: ["number", "null"], description: "Montant total payé TTC" },
    subtotal: { type: ["number", "null"] },
    vat: { type: ["number", "null"], description: "Total TVA" },
    discount: { type: ["number", "null"], description: "Total des remises, positif" },
    currency: { type: "string", description: "Code ISO, ex. EUR" },
    paymentMethod: { type: ["string", "null"], description: "Carte, espèces, virement, prélèvement…" },
    invoiceNumber: { type: ["string", "null"] },
    dueDate: { type: ["string", "null"], description: "Échéance AAAA-MM-JJ (factures)" },
    period: { type: ["string", "null"], description: "Période facturée, ex. « octobre 2026 »" },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "quantity", "amount"],
        properties: {
          label: { type: "string" },
          quantity: { type: ["number", "null"] },
          amount: { type: "number", description: "Prix total de la ligne" },
        },
      },
    },
    suggestedCategory: { type: ["string", "null"], description: "Une des catégories proposées" },
    notes: { type: ["string", "null"], description: "Autre information utile, en français, courte" },
  },
} as const;

/** Vérifie le jeton Firebase de l'utilisateur pour que la clé ne serve qu'aux membres de l'app. */
async function signedIn(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!token || !key) return false;
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: token }),
  });
  return res.ok;
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY)
    return NextResponse.json({ error: "La lecture automatique n'est pas encore configurée (clé ANTHROPIC_API_KEY manquante sur Vercel)." }, { status: 503 });
  if (!(await signedIn(req)))
    return NextResponse.json({ error: "Connexion requise." }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const categories = String(form.get("categories") ?? "");
  if (!(file instanceof File)) return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Fichier trop lourd (4 Mo maximum)." }, { status: 413 });

  const data = Buffer.from(await file.arrayBuffer()).toString("base64");
  let doc: Anthropic.Beta.BetaContentBlockParam;
  if (file.type === "application/pdf") {
    doc = { type: "document", source: { type: "base64", media_type: "application/pdf", data } };
  } else if ((IMAGE_TYPES as readonly string[]).includes(file.type)) {
    doc = { type: "image", source: { type: "base64", media_type: file.type as ImageType, data } };
  } else {
    return NextResponse.json({ error: "Format non pris en charge : photo (JPEG, PNG) ou PDF." }, { status: 415 });
  }

  const client = new Anthropic();
  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      messages: [{
        role: "user",
        content: [
          doc,
          {
            type: "text",
            text:
              "Voici un ticket de caisse ou une facture d'une famille en France. " +
              "Relève les informations telles qu'elles sont écrites ; mets null quand une information n'apparaît pas, sans rien inventer. " +
              "Les montants sont des nombres (12.5, pas « 12,50 € »). Garde le libellé des lignes tel qu'imprimé, abréviations comprises. " +
              `Propose la catégorie la plus adaptée parmi : ${categories || "Courses, Enfants, Maison, Transport, Loisirs, Santé, Autre"}.`,
          },
        ],
      }],
    });
    if (response.stop_reason === "refusal")
      return NextResponse.json({ error: "Ce document n'a pas pu être lu." }, { status: 422 });
    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text" || response.stop_reason === "max_tokens")
      return NextResponse.json({ error: "Lecture incomplète, réessaie avec une photo plus nette." }, { status: 502 });
    return NextResponse.json(JSON.parse(text.text));
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError)
      return NextResponse.json({ error: "Trop de demandes, réessaie dans une minute." }, { status: 429 });
    if (e instanceof Anthropic.AuthenticationError)
      return NextResponse.json({ error: "La clé ANTHROPIC_API_KEY est refusée." }, { status: 503 });
    if (e instanceof Anthropic.APIError)
      return NextResponse.json({ error: `Lecture impossible pour le moment (${e.status}).` }, { status: 502 });
    throw e;
  }
}
