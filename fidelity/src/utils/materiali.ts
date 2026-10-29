import dayjs from "dayjs";
import type { PeriodoMateriali } from "../../lib/materiali/periodi";

/**
 * Supporto comune alle viste Volantini e POP (contratto in lib/materiali/tipi.ts).
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

/** Elenco delle promozioni in cui nascono i kit del periodo: le valide stanno nello storico promozioni. */
export const PROMOZIONI_DEL_PERIODO: Readonly<Record<PeriodoMateriali, { etichetta: string; percorso: string }>> = {
  "in-corso": { etichetta: "Vai alle promozioni in corso", percorso: "/promozioni/in-corso" },
  attivi: { etichetta: "Vai allo storico promozioni", percorso: "/promozioni/storico" },
  storico: { etichetta: "Vai allo storico promozioni", percorso: "/promozioni/storico" },
};

/**
 * Articolo plurale davanti a un numero scritto in cifre: "gli" quando si legge con una vocale
 * (otto…, undici, undicimila…), altrimenti "i". Serve per "Seleziona tutti i 1.842 file".
 */
export const articoloPlurale = (numero: number): "i" | "gli" => {
  const cifre = String(Math.trunc(Math.abs(numero)));
  return cifre.startsWith("8") || (cifre.startsWith("11") && cifre.length % 3 === 2) ? "gli" : "i";
};
