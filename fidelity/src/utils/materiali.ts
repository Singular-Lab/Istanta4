import dayjs from "dayjs";

/**
 * Supporto comune alle viste Volantini e POP e alle altre pagine dei materiali.
 */

type ValoreParametro = string | number | null | undefined;

/** Query string dei filtri, senza "?": i valori vuoti non si inviano, l'ordine resta quello dell'oggetto. */
export const parametriMateriali = (valori: Readonly<Record<string, ValoreParametro>>): string => {
  const parametri = new URLSearchParams();
  for (const [chiave, valore] of Object.entries(valori)) {
    if (valore !== undefined && valore !== null && valore !== "") parametri.set(chiave, String(valore));
  }
  return parametri.toString();
};

/**
 * Anteprima di un file del kit, servita dal proxy di Olimpo come per gli altri materiali;
 * PreviewImmaginePdf aggiunge "&page=N" per le pagine successive.
 */
export const urlAnteprimaMateriale = (idOlimpoCloud: string): string =>
  `/olimpo/materiali/getThumbnailMaterialePdfs?id=${encodeURIComponent(idOlimpoCloud)}`;

/** Misura in pixel in cui chiedere a Olimpo l'immagine di una pagina. */
export interface MisuraImmagine {
  larghezza: number;
  altezza: number;
}

/**
 * Immagine di una pagina (contata da 1) di un PDF del kit, dallo stesso proxy: serve a chi vede gli
 * insight del volantino, senza il permesso di scaricare il file. Con `misura` Olimpo la restituisce
 * già ridotta (e ritagliata al centro se le proporzioni sono diverse): per le miniature, che così
 * pesano pochi KB invece dell'immagine intera.
 */
export const urlPaginaMateriale = (idOlimpoCloud: string, pagina: number, misura?: MisuraImmagine): string => {
  const base = `${urlAnteprimaMateriale(idOlimpoCloud)}&page=${encodeURIComponent(String(pagina))}`;
  if (!misura) return base;
  const larghezza = Math.max(1, Math.round(misura.larghezza));
  const altezza = Math.max(1, Math.round(misura.altezza));
  return `${base}&width=${larghezza}&height=${altezza}`;
};

/** Proporzione larghezza/altezza di una pagina A4, quando non si conosce quella della pagina vera. */
const PROPORZIONE_A4 = 210 / 297;

/** Pixel dello schermo per px CSS con cui chiedere le miniature: il doppio, per gli schermi ad alta densità. */
const DENSITA_MINIATURE = 2;

/**
 * Miniatura di un volantino alla misura in cui la scheda la mostra. Le anteprime degli elenchi arrivano come
 * la pagina intera a 150 dpi (circa 9 MB di memoria una volta decodificata) per essere mostrate in poche
 * decine di pixel: con `width` e `height` Olimpo la restituisce già ridotta. Un indirizzo che non è di
 * Olimpo, o che ha già la sua misura, resta com'è. L'anteprima a pagina intera non passa di qui.
 */
export const urlMiniatura = (url: string, larghezzaCss: number, proporzione: number = PROPORZIONE_A4): string => {
  if (!url || !url.includes("/materiali/getThumbnailMaterialePdfs") || /[?&]width=/.test(url)) return url;
  if (!Number.isFinite(larghezzaCss) || larghezzaCss <= 0) return url;
  const valida = Number.isFinite(proporzione) && proporzione > 0 ? proporzione : PROPORZIONE_A4;
  const larghezza = Math.max(1, Math.round(larghezzaCss * DENSITA_MINIATURE));
  const altezza = Math.max(1, Math.round(larghezza / valida));
  return `${url}${url.includes("?") ? "&" : "?"}width=${larghezza}&height=${altezza}`;
};

/** Risoluzione delle pagine da leggere: quella delle foto dei volantini, sotto la quale le scritte piccole si perdono. */
export const DPI_LETTURA = 300;

/**
 * Immagine di una pagina da leggere da vicino, per esempio nel volantino degli insight: Olimpo
 * la disegna a 300 dpi, così allo zoom massimo si leggono le scritte sulle confezioni.
 * L'indirizzo è diverso da quello a 150 dpi, quindi il browser non ripropone l'immagine
 * vecchia che ha in cache. Per miniature e anteprime resta urlPaginaMateriale.
 */
export const urlPaginaDaLeggere = (idOlimpoCloud: string, pagina: number): string =>
  `${urlPaginaMateriale(idOlimpoCloud, pagina)}&dpi=${DPI_LETTURA}`;

/**
 * Validità compatta di una promo: "16/10 – 29/10/2026", con l'anno una volta sola quando le due
 * date cadono nello stesso anno. Date ISO (YYYY-MM-DD) come nel contratto; null se mancano entrambe.
 */
export const testoValidita = (dal: string | null | undefined, al: string | null | undefined): string | null => {
  const inizio = dal ? dayjs(dal) : null;
  const fine = al ? dayjs(al) : null;
  const valida = (data: dayjs.Dayjs | null): data is dayjs.Dayjs => Boolean(data?.isValid());
  if (valida(inizio) && valida(fine)) {
    const formatoInizio = inizio.year() === fine.year() ? "DD/MM" : "DD/MM/YYYY";
    return `${inizio.format(formatoInizio)} – ${fine.format("DD/MM/YYYY")}`;
  }
  if (valida(fine)) return `fino al ${fine.format("DD/MM/YYYY")}`;
  if (valida(inizio)) return `dal ${inizio.format("DD/MM/YYYY")}`;
  return null;
};

/**
 * Articolo plurale davanti a un numero scritto in cifre: "gli" quando si legge con una vocale
 * (otto…, undici, undicimila…), altrimenti "i". Serve per "Seleziona tutti i 1.842 file".
 */
export const articoloPlurale = (numero: number): "i" | "gli" => {
  const cifre = String(Math.trunc(Math.abs(numero)));
  return cifre.startsWith("8") || (cifre.startsWith("11") && cifre.length % 3 === 2) ? "gli" : "i";
};
