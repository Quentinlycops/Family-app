// Copie les fichiers de l'OCR (Tesseract) dans public/ocr pour les servir depuis l'app,
// sans dépendre d'un CDN. Lancé automatiquement avant `next dev` et `next build`.
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";

const out = "public/ocr";
mkdirSync(out, { recursive: true });
copyFileSync("node_modules/tesseract.js/dist/worker.min.js", `${out}/worker.min.js`);
for (const f of readdirSync("node_modules/tesseract.js-core"))
  if (/^tesseract-core.*-?lstm\.wasm\.js$/.test(f)) copyFileSync(`node_modules/tesseract.js-core/${f}`, `${out}/${f}`);
copyFileSync("node_modules/@tesseract.js-data/fra/4.0.0_best_int/fra.traineddata.gz", `${out}/fra.traineddata.gz`);
