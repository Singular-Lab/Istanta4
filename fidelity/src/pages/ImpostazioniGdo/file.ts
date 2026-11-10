/** Contenuto di un file di testo scelto dall'utente. */
export const leggiFileComeTesto = (file: File): Promise<string> =>
  new Promise((risolvi, rifiuta) => {
    const lettore = new FileReader();
    lettore.onload = () => risolvi(String(lettore.result ?? ""));
    lettore.onerror = () => rifiuta(lettore.error ?? new Error("File non leggibile"));
    lettore.readAsText(file);
  });

/** Immagine scelta dall'utente in base64, senza il prefisso "data:...;base64,", come la salva il sito web. */
export const leggiFileComeBase64 = (file: File): Promise<string> =>
  new Promise((risolvi, rifiuta) => {
    const lettore = new FileReader();
    lettore.onload = () => risolvi(String(lettore.result ?? "").replace(/^data:.+;base64,/, ""));
    lettore.onerror = () => rifiuta(lettore.error ?? new Error("File non leggibile"));
    lettore.readAsDataURL(file);
  });

const BASE64 = /^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)?$/;

/** Sorgente di un'immagine salvata come base64 (senza prefisso) o come indirizzo. */
export const sorgenteImmagine = (valore: string | null | undefined): string => {
  if (!valore) return "";
  return BASE64.test(valore) ? `data:image/*;base64,${valore}` : valore;
};

/** Fa scaricare un testo come file. */
export const scaricaTesto = (testo: string, nomeFile: string, tipo = "application/json") => {
  const url = URL.createObjectURL(new Blob([testo], { type: tipo }));
  const collegamento = document.createElement("a");
  collegamento.href = url;
  collegamento.download = nomeFile;
  document.body.appendChild(collegamento);
  collegamento.click();
  collegamento.remove();
  URL.revokeObjectURL(url);
};

/** Due lettere per il monogramma di un nome ("Sapori & Dintorni" → "SD"). */
export const monogramma = (nome: string): string =>
  nome
    .split(/[\s&]+/)
    .filter(Boolean)
    .map((parola) => parola[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
