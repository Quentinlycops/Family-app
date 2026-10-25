/**
 * Les fichiers des voyages sont rangés dans Firestore (Firebase Storage n'est pas inclus
 * dans l'offre gratuite) : un document par fichier, sous forme de texte base64.
 * Un document Firestore est limité à 1 Mo, d'où la compression des photos.
 */
const MAX_CHARS = 950_000;
export const MAX_PDF_KB = Math.floor((MAX_CHARS * 3) / 4 / 1024) - 10;

function readAsDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image illisible.")); };
    img.src = url;
  });
}

/** Photo réduite en JPEG, assez nette pour lire un QR code de carte d'embarquement. */
async function compressImage(file: File) {
  const img = await loadImage(file);
  for (const [dim, quality] of [[2000, 0.85], [1600, 0.8], [1280, 0.7], [1024, 0.6]]) {
    const scale = Math.min(1, dim / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL("image/jpeg", quality);
    if (url.length <= MAX_CHARS) return url;
  }
  throw new Error("Photo trop lourde, même compressée.");
}

/** Fichier prêt à être enregistré : `data:` URL et type final. */
export async function prepareFile(file: File) {
  if (file.type.startsWith("image/")) {
    return { data: await compressImage(file), type: "image/jpeg", name: file.name.replace(/\.\w+$/, "") + ".jpg" };
  }
  const data = await readAsDataUrl(file);
  if (data.length > MAX_CHARS)
    throw new Error(`Fichier trop lourd (${Math.round(file.size / 1024)} Ko, maximum ${MAX_PDF_KB} Ko). Prends plutôt une capture d'écran du billet, ou ajoute le lien de la réservation.`);
  return { data, type: file.type || "application/octet-stream", name: file.name };
}

export async function dataUrlToObjectUrl(data: string) {
  return URL.createObjectURL(await (await fetch(data)).blob());
}
