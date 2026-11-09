import {
  MISURE_CALORE,
  unitaMisura,
  valoriPerBox,
  type DatiMisure,
  type MisuraCalore,
  type UnitaMisura,
} from "../../../../lib/insightVolantino/calore";
import type { ReportVolantino } from "../../../../lib/insightVolantino/report";
import type { BoxInsight } from "../../../../lib/insightVolantino/tipi";
import {
  boxPerPagina,
  pagineDaSfogliare,
  proporzioneDelVolantino,
  proporzioneDellaPagina,
} from "../volantino/geometria";

/**
 * Le pagine del volantino nel report PDF: quali pagine, quali immagini scaricare, quali box mettere
 * in evidenza per ogni misura. Funzioni pure.
 */

/** Le pagine del volantino, dalla prima: quelle dichiarate, o di piu' se un box sta oltre. */
export const pagineDelReport = (report: Pick<ReportVolantino, "totalePagine" | "box">): number[] =>
  Array.from({ length: pagineDaSfogliare(report.totalePagine, report.box) }, (_, indice) => indice + 1);

/** Il report ha almeno una sezione con le pagine del volantino. */
export const conSezioniPagine = (report: Pick<ReportVolantino, "sezioni">): boolean =>
  report.sezioni.some((sezione) => sezione.tipo === "pagine");

/**
 * Pagine di cui scaricare l'immagine da Olimpo: tutte se il report le mostra, altrimenti solo la
 * prima, per la copertina. Mai oltre le pagine del PDF (se le dichiara); nessuna senza PDF.
 */
export function pagineDaCaricare(report: Pick<ReportVolantino, "pdf" | "totalePagine" | "box" | "sezioni">): number[] {
  const pdf = report.pdf;
  if (!pdf?.idOlimpoCloud) return [];
  const pagine = conSezioniPagine(report) ? pagineDelReport(report) : [1];
  return pagine.filter((pagina) => pdf.pagine <= 0 || pagina <= pdf.pagine);
}

/** Proporzione (larghezza/altezza) di ogni pagina: quella dei suoi box, o quella del volantino. */
export function proporzioniPagine(box: readonly BoxInsight[]): (pagina: number) => number {
  const delVolantino = proporzioneDelVolantino(box);
  return (pagina) => proporzioneDellaPagina(box, pagina, delVolantino);
}

export const datiMisure = (report: Pick<ReportVolantino, "rendimento" | "previsione">): DatiMisure => ({
  rendimento: report.rendimento,
  previsione: report.previsione,
});

/** Un box in evidenza su una pagina: numerato dal valore piu' alto. */
export interface BoxEvidenziato {
  numero: number;
  box: BoxInsight;
  valore: number;
  /** Il valore piu' alto di tutto il volantino: l'unico in colore d'accento. */
  migliore: boolean;
}

export interface DatiSezionePagine {
  misura: MisuraCalore;
  etichetta: string;
  descrizione: string;
  unita: UnitaMisura;
  /** Valore di ogni box con geometria che ha il dato. */
  valori: ReadonlyMap<string, number>;
  /** Il valore piu' alto del volantino (0 senza valori positivi): fondo scala della legenda. */
  massimo: number;
  /** Id del box con il valore piu' alto, null senza valori positivi. */
  migliore: string | null;
  /** I box disegnabili di ogni pagina. */
  boxPerPagina: ReadonlyMap<number, BoxInsight[]>;
  /** I box in evidenza di ogni pagina, al massimo `boxInEvidenza`, dal valore piu' alto. */
  evidenza: ReadonlyMap<number, BoxEvidenziato[]>;
}

/** Dal valore piu' alto; a parita' prima il box piu' visibile, poi quello che viene prima. */
const ordinaPerValore = (a: { box: BoxInsight; valore: number }, b: { box: BoxInsight; valore: number }): number =>
  b.valore - a.valore || b.box.visibilita - a.box.visibilita || a.box.id.localeCompare(b.box.id);

/**
 * Valori, massimo e box in evidenza di una sezione 'pagine' per la sua misura. In evidenza vanno i
 * primi `boxInEvidenza` box di ogni pagina per valore, solo quelli con un valore maggiore di zero.
 */
export function datiSezionePagine(
  report: Pick<ReportVolantino, "box" | "rendimento" | "previsione">,
  misura: MisuraCalore,
  boxInEvidenza: number
): DatiSezionePagine {
  const dati = datiMisure(report);
  const valori = valoriPerBox(misura, report.box, dati);
  const disegnabili = boxPerPagina(report.box);

  let massimo = 0;
  let migliore: { box: BoxInsight; valore: number } | null = null;
  for (const elenco of disegnabili.values()) {
    for (const box of elenco) {
      const valore = valori.get(box.id);
      if (valore === undefined || !(valore > 0)) continue;
      const voce = { box, valore };
      if (!migliore || ordinaPerValore(voce, migliore) < 0) migliore = voce;
      massimo = Math.max(massimo, valore);
    }
  }

  const quanti = Math.max(0, Math.floor(boxInEvidenza));
  const evidenza = new Map<number, BoxEvidenziato[]>();
  for (const [pagina, elenco] of disegnabili) {
    const conValore = elenco
      .map((box) => ({ box, valore: valori.get(box.id) ?? 0 }))
      .filter((voce) => voce.valore > 0)
      .sort(ordinaPerValore)
      .slice(0, quanti);
    evidenza.set(
      pagina,
      conValore.map((voce, indice) => ({ numero: indice + 1, box: voce.box, valore: voce.valore, migliore: voce.box.id === migliore?.box.id }))
    );
  }

  return {
    misura,
    etichetta: MISURE_CALORE[misura].etichetta,
    descrizione: MISURE_CALORE[misura].descrizione,
    unita: unitaMisura(misura, dati),
    valori,
    massimo,
    migliore: migliore?.box.id ?? null,
    boxPerPagina: disegnabili,
    evidenza,
  };
}

/** Riga secondaria di un box in evidenza: marca e reparto, quando ci sono. */
export function dettaglioBox(box: Pick<BoxInsight, "marca" | "reparto" | "codiceBox">): string {
  const parti = [box.marca, box.reparto?.descrizione].filter((parte): parte is string => Boolean(parte && parte.trim()));
  return parti.length > 0 ? parti.join(" · ") : `Box ${box.codiceBox}`;
}
