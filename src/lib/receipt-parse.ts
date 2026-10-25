import type { ScanResult } from "./types";

/*
 * Lecture par règles du texte d'un ticket de caisse ou d'une facture (français).
 * Pas d'intelligence artificielle : on cherche des mots-clés et des formats connus,
 * l'écran de vérification sert à corriger ce qui a été mal lu.
 */

const MONTHS = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"];

// Enseignes fréquentes et catégorie probable.
const BRANDS: [RegExp, string, string][] = [
  [/e\.?\s?leclerc|\bleclerc\b/, "E.Leclerc", "Courses"],
  [/carrefour/, "Carrefour", "Courses"],
  [/auchan/, "Auchan", "Courses"],
  [/intermarch/, "Intermarché", "Courses"],
  [/\blidl\b/, "Lidl", "Courses"],
  [/\baldi\b/, "Aldi", "Courses"],
  [/monoprix/, "Monoprix", "Courses"],
  [/franprix/, "Franprix", "Courses"],
  [/\bcasino\b/, "Casino", "Courses"],
  [/hyper\s?u\b|super\s?u\b|syst[eè]me\s?u\b|\bu express\b/, "Magasins U", "Courses"],
  [/\bcora\b/, "Cora", "Courses"],
  [/\bnetto\b/, "Netto", "Courses"],
  [/grand frais/, "Grand Frais", "Courses"],
  [/picard/, "Picard", "Courses"],
  [/biocoop/, "Biocoop", "Courses"],
  [/naturalia/, "Naturalia", "Courses"],
  [/delhaize/, "Delhaize", "Courses"],
  [/colruyt/, "Colruyt", "Courses"],
  [/boulangerie/, "Boulangerie", "Courses"],
  [/pharmacie/, "Pharmacie", "Santé"],
  [/docteur|\bdr\b|m[ée]decin|cabinet m[ée]dical|laboratoire|kin[ée]sith|dentist|orthophon|ophtalm|p[ée]diatre/, "", "Santé"],
  [/\bedf\b/, "EDF", "Maison"],
  [/engie/, "Engie", "Maison"],
  [/totalenergies/, "TotalEnergies", "Maison"],
  [/veolia|\bsuez\b|eau de/, "", "Maison"],
  [/\borange\b|\bsosh\b/, "Orange", "Maison"],
  [/\bsfr\b/, "SFR", "Maison"],
  [/\bfree\b|free mobile/, "Free", "Maison"],
  [/bouygues/, "Bouygues Telecom", "Maison"],
  [/leroy merlin/, "Leroy Merlin", "Maison"],
  [/castorama/, "Castorama", "Maison"],
  [/\bikea\b/, "IKEA", "Maison"],
  [/\baction\b/, "Action", "Maison"],
  [/boulanger\b/, "Boulanger", "Maison"],
  [/\bdarty\b/, "Darty", "Maison"],
  [/\bsncf\b|ouigo|tgv/, "SNCF", "Transport"],
  [/p[ée]age|autoroute|vinci|sanef|aprr/, "", "Transport"],
  [/parking|indigo/, "", "Transport"],
  [/station|carburant|gazole|sp95|sp98|\besso\b|\bshell\b|\bbp\b|total access/, "", "Transport"],
  [/kiabi|vertbaudet|okaidi|okaïdi|cr[eè]che|sergent major|jacadi|aubert|orchestra|cyrillus/, "", "Enfants"],
  [/decathlon/, "Decathlon", "Loisirs"],
  [/\bfnac\b/, "Fnac", "Loisirs"],
  [/cin[ée]ma|path[ée]|gaumont|ugc|kinepolis/, "", "Loisirs"],
  [/restaurant|brasserie|pizzeria|mcdonald|burger king|\bkfc\b/, "", "Loisirs"],
  [/amazon/, "Amazon", "Autre"],
  [/cdiscount/, "Cdiscount", "Autre"],
];

const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Montant avec décimales : 12,50 · 1 234,56 · 12.50 · -3,00 · 12,50€
const AMOUNT = /(-?\s?\d{1,3}(?:[ . ]\d{3})*[,.]\d{2}|-?\d+[,.]\d{2})(?!\d)\s*(?:€|eur\b|e\b)?/gi;

function amountsIn(line: string): number[] {
  if (/%/.test(line) && !/tva|total/i.test(line)) return [];
  const out: number[] = [];
  for (const m of line.matchAll(AMOUNT)) {
    // Ignore les pourcentages (« 5,50 % ») et les dates (« 12.10.26 »).
    const after = line.slice((m.index ?? 0) + m[0].length);
    if (/^\s*%/.test(after)) continue;
    if (/^[./]\d/.test(after)) continue;
    const before = line.slice(0, m.index ?? 0);
    if (/\d[./]$/.test(before)) continue;
    const v = parseFloat(m[1].replace(/[\s ]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
    if (!isNaN(v) && Math.abs(v) < 100000) out.push(v);
  }
  return out;
}

const iso = (y: number, m: number, d: number) => {
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > new Date().getFullYear() + 2) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};

function datesIn(line: string): string[] {
  const out: string[] = [];
  const l = strip(line);
  for (const m of l.matchAll(/\b(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4}|\d{2})\b/g)) {
    const d = iso(+m[3], +m[2], +m[1]);
    if (d) out.push(d);
  }
  for (const m of l.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) {
    const d = iso(+m[1], +m[2], +m[3]);
    if (d) out.push(d);
  }
  for (const m of l.matchAll(/\b(\d{1,2})(?:er)?\s+(janv|fevr?|mars|avr|mai|juin|juil|aout|sept|oct|nov|dec)[a-z]*\.?\s+(\d{4})\b/g)) {
    const month = MONTHS.findIndex((x) => x.startsWith(m[2].slice(0, 3))) + 1;
    const d = iso(+m[3], month, +m[1]);
    if (d) out.push(d);
  }
  return out;
}

const NOT_ITEM = /total|tva|t\.v\.a|\bht\b|ttc|carte|\bcb\b|visa|mastercard|esp[eè]ces|rendu|monnaie|paiement|pay[ée]|solde|remise|r[ée]duction|fid[ée]lit|avantage|cagnotte|points|montant|sous.?total|nombre|articles?\s*:|net a payer|a payer|du\s*:|ticket|siret|tel\b|t[ée]l[ée]phone|transaction|autorisation|merci/i;

function titleCase(s: string) {
  return s.toLowerCase().replace(/(^|[\s'\-])([a-zà-ÿ])/g, (_, a, b) => a + b.toUpperCase());
}

export function parseReceipt(raw: string, categories: string[] = []): ScanResult {
  const lines = raw.split(/\r?\n/).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const text = lines.join("\n");
  const low = strip(text);

  // Type de document
  const kind: ScanResult["kind"] = /\bfacture\b|\binvoice\b|avis d'echeance|echeancier/.test(low) ? "facture" : "ticket";

  // Total : par ordre de préférence des mots-clés.
  const TOTAL_KEYS = [
    /net a payer|montant a payer|total a payer|reste a payer|somme a payer|a payer/,
    /total\s*t\.?t\.?c|montant\s*t\.?t\.?c|ttc/,
    /^total\b(?!.*(ht|tva|remise|economi|point|article))|\btotal\s*(general|du ticket|facture)?\s*[:€]?\s*\d/,
    /\bmontant\b(?!.*(ht|tva))/,
    /carte bancaire|\bcb\b|\bvisa\b|mastercard|especes|debit/,
  ];
  let total: number | null = null;
  let totalLine = -1;
  for (const key of TOTAL_KEYS) {
    for (let i = 0; i < lines.length; i++) {
      const l = strip(lines[i]);
      if (!key.test(l) || /sous.?total|\bht\b(?!.*ttc)|total tva|remise|economi/.test(l)) continue;
      let a = amountsIn(lines[i]);
      if (!a.length && i + 1 < lines.length) a = amountsIn(lines[i + 1]);
      const v = a.filter((x) => x > 0).at(-1);
      if (v != null && (total == null || key !== TOTAL_KEYS[2] || v >= total)) {
        total = v;
        totalLine = i;
        if (key !== TOTAL_KEYS[2]) break; // pour « TOTAL » seul, on garde le plus grand
      }
    }
    if (total != null) break;
  }
  if (total == null) {
    const all = lines.flatMap(amountsIn).filter((x) => x > 0);
    if (all.length) total = Math.max(...all);
  }

  // Dates : échéance à part, sinon la date proche de « date », « le », « du », sinon la première.
  let date: string | null = null;
  let dueDate: string | null = null;
  for (const line of lines) {
    const l = strip(line);
    const ds = datesIn(line);
    if (!ds.length) continue;
    if (/echeance|a regler avant|payable (avant|le)|date limite|preleve le|prelevement le/.test(l)) {
      dueDate ??= ds[0];
      continue;
    }
    if (!date && /date|facture du|\ble\b|\bdu\b|emis/.test(l)) date = ds[0];
  }
  if (!date) {
    for (const line of lines) {
      const l = strip(line);
      if (/echeance|naissance|periode|validit|expir|jusqu/.test(l)) continue;
      const ds = datesIn(line);
      if (ds.length) { date = ds[0]; break; }
    }
  }

  // Heure : de préférence sur la ligne de la date.
  let time: string | null = null;
  const TIME = /\b([01]?\d|2[0-3])\s?[:hH]\s?([0-5]\d)(?::[0-5]\d)?\b/;
  const dated = lines.find((l) => datesIn(l).length && TIME.test(l));
  const tm = (dated ?? lines.find((l) => TIME.test(l) && !/[,.]\d{2}\s*(€|eur)/i.test(l)))?.match(TIME);
  if (tm) time = `${tm[1].padStart(2, "0")}:${tm[2]}`;

  // Magasin : enseigne connue, sinon première ligne « texte » en tête du document.
  let store: string | null = null;
  let category: string | null = null;
  for (const [re, name, cat] of BRANDS) {
    if (re.test(low)) {
      if (name) store ??= name;
      category ??= cat;
      if (store) break;
    }
  }
  if (!store) {
    const head = lines.slice(0, 8).find((l) => {
      const s = strip(l);
      const letters = (s.match(/[a-z]/g) ?? []).length;
      return letters >= 3 && letters / s.length > 0.5 &&
        !/bienvenue|ticket|facture|caisse|^date|tel|siret|www\.|@|^le |^du |client|page|copie|duplicata/.test(s);
    });
    if (head) store = head.length > 40 ? head.slice(0, 40) : titleCase(head);
  }

  // Adresse : ligne avec code postal.
  const address = lines.slice(0, 12).find((l) => /\b\d{5}\b\s+[A-Za-zÀ-ÿ]/.test(l) && !/siret|tel/i.test(l)) ?? null;

  // TVA
  let vat: number | null = null;
  const vatLine = lines.find((l) => /total\s*t\.?v\.?a|montant\s*t\.?v\.?a|^t\.?v\.?a\b/i.test(strip(l)));
  if (vatLine) {
    const a = amountsIn(vatLine).filter((x) => x > 0 && (total == null || x < total));
    if (a.length) vat = a.at(-1)!;
  }

  // Remises
  const discounts = lines.filter((l) => /remise|reduction|promo|bon d.achat|coupon/.test(strip(l)))
    .flatMap(amountsIn).map(Math.abs);
  const discount = discounts.length ? Math.round(discounts.reduce((s, x) => s + x, 0) * 100) / 100 : null;

  // Paiement
  const paymentMethod =
    /sans contact/.test(low) && /\bcb\b|carte|visa|mastercard/.test(low) ? "Carte bancaire (sans contact)"
    : /\bcb\b|carte bancaire|carte bleue|visa|mastercard|maestro/.test(low) ? "Carte bancaire"
    : /especes/.test(low) ? "Espèces"
    : /cheque/.test(low) ? "Chèque"
    : /prelevement/.test(low) ? "Prélèvement"
    : /virement/.test(low) ? "Virement"
    : /ticket restaurant|titre restaurant|swile|edenred/.test(low) ? "Titre-restaurant"
    : null;

  // Numéro de facture
  const inv = text.match(/(?:facture|invoice|n°\s*de\s*facture)\s*(?:n[°o]|num[ée]ro|#)?\s*[:.]?\s*([A-Z0-9][A-Z0-9\-/]{3,})/i);
  const invoiceNumber = inv && /\d/.test(inv[1]) ? inv[1] : null;

  // Période (factures d'énergie, téléphone…)
  const per = text.match(/p[ée]riode\s*(?:du|de)?\s*:?\s*([^\n]{4,40})/i);
  const period = per ? per[1].trim() : null;

  // Articles : lignes « libellé … montant » au-dessus du total.
  const items: ScanResult["items"] = [];
  const end = totalLine >= 0 ? totalLine : lines.length;
  for (let i = 0; i < end; i++) {
    const l = lines[i];
    if (NOT_ITEM.test(strip(l)) || datesIn(l).length) continue;
    const a = amountsIn(l);
    if (!a.length) continue;
    const firstAmount = l.search(AMOUNT);
    let label = l.slice(0, firstAmount).replace(/[*.:\-_]+$/, "").trim();
    let quantity: number | null = null;
    const q = label.match(/^(\d{1,3})\s*[xX*]\s*(.*)$/) ?? label.match(/^(.*?)\s+(\d{1,3})\s*[xX*]$/);
    if (q) {
      const n = /^\d/.test(q[1]) ? q : [q[0], q[2], q[1]];
      quantity = parseInt(n[1]);
      label = n[2].trim();
    }
    // « 2 x 0,89 » sous un article : c'est sa quantité (le montant de l'article est déjà le total de la ligne).
    if (!label || (label.match(/[A-Za-zÀ-ÿ]/g) ?? []).length < 2) {
      const prev = items.at(-1);
      const qm = l.match(/^(\d{1,3})\s*[xX*]/);
      if (prev && qm) prev.quantity = parseInt(qm[1]);
      continue;
    }
    items.push({ label: label.slice(0, 60), quantity, amount: a.at(-1)! });
  }

  const pick = (name: string | null) =>
    name && categories.length ? categories.find((c) => strip(c) === strip(name)) ?? null : name;
  const suggestedCategory = pick(category) ?? (kind === "ticket" && items.length > 4 ? pick("Courses") : null);

  return {
    kind,
    store,
    address,
    date,
    time,
    total,
    subtotal: null,
    vat,
    discount,
    currency: "EUR",
    paymentMethod,
    invoiceNumber,
    dueDate,
    period,
    items: items.length > 80 ? [] : items,
    suggestedCategory,
    notes: null,
  };
}
