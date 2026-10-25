"use client";
/*
 * Extraction du texte d'un ticket ou d'une facture, entièrement dans le navigateur et gratuite :
 * - PDF « numérique » (facture téléchargée) : texte lu directement avec pdf.js ;
 * - photo ou PDF scanné : reconnaissance de caractères (OCR) avec Tesseract, en français.
 * Les modules (quelques Mo, dont le dictionnaire français) ne sont chargés qu'au premier scan.
 */

type Progress = (label: string, pct?: number) => void;

const OCR_MAX = 2400; // px : assez pour lire les petits caractères d'un ticket

async function loadPdf(file: File) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  return pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
}

type Pdf = Awaited<ReturnType<typeof loadPdf>>;

/** Texte d'une page, reconstitué ligne par ligne (les éléments sont regroupés par hauteur). */
async function pageText(pdf: Pdf, n: number) {
  const page = await pdf.getPage(n);
  const content = await page.getTextContent();
  const rows: { y: number; parts: { x: number; s: string }[] }[] = [];
  for (const it of content.items) {
    if (!("str" in it) || !it.str.trim()) continue;
    const [, , , h, x, y] = it.transform as number[];
    const row = rows.find((r) => Math.abs(r.y - y) < Math.max(2, Math.abs(h) * 0.5));
    if (row) row.parts.push({ x, s: it.str });
    else rows.push({ y, parts: [{ x, s: it.str }] });
  }
  return rows
    .sort((a, b) => b.y - a.y)
    .map((r) => r.parts.sort((a, b) => a.x - b.x).map((p) => p.s).join(" "))
    .join("\n");
}

async function renderPage(pdf: Pdf, n: number, max: number) {
  const page = await pdf.getPage(n);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: max / Math.max(base.width, base.height) });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  await page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport }).promise;
  return canvas;
}

/** Photo → canevas redimensionné en niveaux de gris, plus facile à lire pour l'OCR. */
async function imageCanvas(file: Blob, max: number) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1.5, max / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.filter = "grayscale(1) contrast(1.3)";
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function ocr(canvases: HTMLCanvasElement[], progress: Progress) {
  const { createWorker } = await import("tesseract.js");
  let page = 0;
  // Fichiers servis par l'app (copiés par scripts/copy-ocr.mjs).
  const worker = await createWorker("fra", 1, {
    workerPath: "/ocr/worker.min.js",
    corePath: "/ocr",
    langPath: "/ocr",
    logger: (m) => {
      if (m.status === "recognizing text")
        progress("Lecture du texte…", Math.round(((page + m.progress) / canvases.length) * 100));
      else if (m.status.startsWith("loading")) progress("Préparation de la lecture (une seule fois)…");
    },
  });
  try {
    // Mode « une colonne » : garde le libellé et le prix d'un article sur la même ligne.
    await worker.setParameters({ tessedit_pageseg_mode: "4" as never, preserve_interword_spaces: "1" });
    const texts: string[] = [];
    for (; page < canvases.length; page++) texts.push((await worker.recognize(canvases[page])).data.text);
    return texts.join("\n");
  } finally {
    await worker.terminate();
  }
}

export async function canvasToJpeg(canvas: HTMLCanvasElement, max: number, quality: number) {
  const scale = Math.min(1, max / Math.max(canvas.width, canvas.height));
  const out = document.createElement("canvas");
  out.width = Math.round(canvas.width * scale);
  out.height = Math.round(canvas.height * scale);
  out.getContext("2d")!.drawImage(canvas, 0, 0, out.width, out.height);
  return out.toDataURL("image/jpeg", quality);
}

/**
 * Lit un fichier et renvoie son texte, plus un aperçu JPEG (première page pour un PDF)
 * à conserver avec la dépense.
 */
export async function readDocument(file: File, progress: Progress): Promise<{ text: string; preview: string }> {
  if (file.type === "application/pdf") {
    progress("Ouverture du PDF…");
    const pdf = await loadPdf(file);
    const pages = Math.min(pdf.numPages, 3);
    let text = "";
    for (let n = 1; n <= pages; n++) text += (await pageText(pdf, n)) + "\n";
    const first = await renderPage(pdf, 1, OCR_MAX);
    const preview = await canvasToJpeg(first, 1100, 0.6);
    // Peu ou pas de texte : c'est un scan, on passe par l'OCR.
    if (text.replace(/\s/g, "").length < 40 * pages) {
      const canvases = [first];
      for (let n = 2; n <= pages; n++) canvases.push(await renderPage(pdf, n, OCR_MAX));
      text = await ocr(canvases, progress);
    }
    return { text, preview };
  }
  progress("Préparation de l'image…");
  const canvas = await imageCanvas(file, OCR_MAX);
  const preview = await canvasToJpeg(canvas, 1100, 0.6);
  return { text: await ocr([canvas], progress), preview };
}
