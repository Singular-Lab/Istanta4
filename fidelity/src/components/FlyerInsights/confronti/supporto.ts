import { TINTA_NEUTRA, type Tinta } from "@/components/Grafici/colori";
import type { TonoStato } from "@/constants/stati";
import { formatNumero } from "@/utils/format";
import type {
  BoxInsight,
  DifferenzaProdotto,
  PdfVolantino,
  StatoDifferenza,
  VolantinoDiRiferimento,
} from "../../../../lib/insightVolantino/tipi";

/**
 * Supporto dei confronti del volantino (edizione precedente e varianti della stessa promo):
 * etichette, colori degli stati e formati. Funzioni pure, condivise fra i componenti dei confronti
 * e il visualizzatore delle pagine.
 */

export interface DescrizioneStato {
  /** Etichetta estesa, per legenda e badge. */
  etichetta: string;
  /** Etichetta breve, per il filtro dell'elenco. */
  breve: string;
  /** Tono del badge nell'elenco delle differenze. */
  tono: TonoStato;
  /** Riempimento dei riquadri SVG (classi fill-*, tema scuro compreso). */
  tinta: Tinta;
  /** Lo stesso colore come sfondo, per i riquadri disegnati in HTML. */
  sfondo: string;
}

/**
 * Come si mostra lo stato di un prodotto fra due varianti. Il visualizzatore colora i box con
 * statoBox: deve usare queste tinte, perché legenda, elenco e pagine dicano la stessa cosa.
 * I quattro colori restano distinguibili anche fra loro in scala di grigi (chiaro, medio, scuro, neutro).
 */
export const STATI_DIFFERENZA: Record<StatoDifferenza, DescrizioneStato> = {
  "solo-qui": {
    etichetta: "Solo in questo volantino",
    breve: "Solo qui",
    tono: "success",
    tinta: { classe: "fill-teal-500 dark:fill-teal-400", classeTesto: "fill-white dark:fill-slate-900" },
    sfondo: "bg-teal-500 dark:bg-teal-400",
  },
  "solo-altra": {
    etichetta: "Solo nell'altra variante",
    breve: "Solo nell'altra",
    tono: "warning",
    tinta: { classe: "fill-amber-400 dark:fill-amber-300", classeTesto: "fill-slate-900" },
    sfondo: "bg-amber-400 dark:bg-amber-300",
  },
  "prezzo-diverso": {
    etichetta: "Prezzo o sconto diverso",
    breve: "Prezzo diverso",
    tono: "brand",
    tinta: { classe: "fill-violet-600 dark:fill-violet-300", classeTesto: "fill-white dark:fill-slate-900" },
    sfondo: "bg-violet-600 dark:bg-violet-300",
  },
  uguale: {
    etichetta: "Uguale nelle due varianti",
    breve: "Uguale",
    tono: "neutral",
    tinta: TINTA_NEUTRA,
    sfondo: "bg-slate-200 dark:bg-darkmode-400",
  },
};

/** Ordine degli stati in legenda e nel filtro: prima le differenze, per ultimo ciò che coincide. */
export const ORDINE_STATI: readonly StatoDifferenza[] = ["solo-qui", "solo-altra", "prezzo-diverso", "uguale"];

/** Filtro dell'elenco delle differenze: gli "uguale" non sono nell'elenco (contratto DifferenzeVarianti). */
export type FiltroDifferenze = "tutte" | Exclude<StatoDifferenza, "uguale">;

export const filtraDifferenze = (differenze: readonly DifferenzaProdotto[], filtro: FiltroDifferenze): DifferenzaProdotto[] =>
  filtro === "tutte" ? differenze.filter(voce => voce.stato !== "uguale") : differenze.filter(voce => voce.stato === filtro);

/**
 * Nome di una variante: area e canale, che distinguono le varianti della stessa promo (titolo e
 * periodo di solito coincidono); il titolo solo se mancano entrambi.
 */
export const etichettaVariante = (variante: Pick<VolantinoDiRiferimento, "area" | "canale" | "titolo">): string =>
  [variante.area, variante.canale].map(parte => parte?.trim()).filter(Boolean).join(" · ") || variante.titolo || "Variante senza nome";

/**
 * Le etichette di un elenco di varianti, per id del kit. Se due varianti hanno la stessa area e lo
 * stesso canale, si aggiunge il titolo: altrimenti nella scelta sarebbero indistinguibili.
 */
export const etichetteVarianti = (varianti: readonly VolantinoDiRiferimento[]): Map<string, string> => {
  const etichette = varianti.map(etichettaVariante);
  const ripetute = new Set(etichette.filter((etichetta, indice) => etichette.indexOf(etichetta) !== indice));
  return new Map(
    varianti.map((variante, indice): [string, string] => {
      const etichetta = etichette[indice];
      const titolo = variante.titolo?.trim();
      return [variante.idKit, ripetute.has(etichetta) && titolo && titolo !== etichetta ? `${etichetta} (${titolo})` : etichetta];
    })
  );
};

/**
 * Pagine di una variante per il visualizzatore: quelle del PDF, o l'ultima pagina con un box se il
 * PDF manca o ne ha meno (i kit dello storico possono non avere il PDF in Olimpo).
 */
export const pagineVariante = (pdf: PdfVolantino | null, box: readonly BoxInsight[]): number =>
  Math.max(0, pdf?.pagine ?? 0, ...box.map(voce => voce.pagina ?? 0));

/** Differenza di un conteggio col segno: "+12", "−3", "stabile"; "—" se manca uno dei due valori. */
export const formatDifferenzaNumero = (differenza: number | null | undefined): string => {
  if (differenza === null || differenza === undefined || !Number.isFinite(differenza)) return "—";
  const arrotondata = Math.round(differenza * 10) / 10;
  if (arrotondata === 0) return "stabile";
  return `${arrotondata > 0 ? "+" : "−"}${formatNumero(Math.abs(arrotondata), Number.isInteger(arrotondata) ? 0 : 1)}`;
};
