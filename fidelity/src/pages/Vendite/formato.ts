import type { TonoStato } from "@/constants/stati";
import { formatData, formatNumero, VALORE_ASSENTE } from "@/utils/format";
import type { ImportVendite, StatoImportVendite } from "../../../lib/vendite/tipi";

/**
 * Le colonne del tracciato generico, usato quando la libreria agenzia del cliente non ha il suo
 * (server/core/vendite/tracciatoGenerico.ts): solo per spiegarlo prima della scelta del file.
 * Dopo, vale il tracciato che l'anteprima dice di aver usato. Una sola fonte con il server.
 */
export { COLONNE_TRACCIATO_GENERICO } from "../../../lib/vendite/tipi";

/*
 * Testi e calcoli della pagina Vendite, senza React: si provano da soli (formato.test.ts).
 * Nota: il client compila con lib ES6, quindi niente Array.prototype.includes.
 */

/** I formati che il server legge: Excel e CSV. */
export const ESTENSIONI_VENDITE: readonly string[] = [".xlsx", ".xls", ".csv"];

/** Valore di accept dell'input: estensioni e tipi MIME, per i browser che filtrano solo per tipo. */
export const ACCEPT_VENDITE = [
  ...ESTENSIONI_VENDITE,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
].join(",");

/** Il file ha uno dei formati letti dal server (il controllo vero lo fa il server). */
export const eFileVendite = (file: Pick<File, "name">): boolean => {
  const nome = (file.name || "").toLowerCase();
  return ESTENSIONI_VENDITE.some(estensione => nome.endsWith(estensione));
};

/** "1 riga", "1.234 righe". */
export const conteggio = (n: number, singolare: string, plurale: string): string =>
  n === 1 ? `1 ${singolare}` : `${formatNumero(n)} ${plurale}`;

/** Periodo di date YYYY-MM-DD: "dal 01/01/2026 al 31/03/2026", un giorno solo, o N/D. */
export const formatPeriodo = (dal: string | null | undefined, al: string | null | undefined): string => {
  if (!dal || !al) return VALORE_ASSENTE;
  if (dal === al) return formatData(dal);
  return `dal ${formatData(dal)} al ${formatData(al)}`;
};

/** Righe lette su quelle del file, da 0 a 100; 0 finche' il file non e' stato contato. */
export const percentualeImport = (importazione: Pick<ImportVendite, "elaborate" | "righe">): number => {
  if (!importazione.righe || importazione.righe <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((importazione.elaborate / importazione.righe) * 100)));
};

export interface DescrizioneEsito {
  etichetta: string;
  tono: TonoStato;
  icona: string;
}

/** Etichetta, tono e icona (nomi canonici Lucide) di ogni stato dell'import. */
export const ESITI_IMPORT: Readonly<Record<StatoImportVendite, DescrizioneEsito>> = {
  in_corso: { etichetta: "In corso", tono: "info", icona: "LoaderCircle" },
  completato: { etichetta: "Completato", tono: "success", icona: "CircleCheck" },
  annullato: { etichetta: "Annullato", tono: "warning", icona: "Ban" },
  fallito: { etichetta: "Non riuscito", tono: "danger", icona: "CircleX" },
  interrotto: { etichetta: "Interrotto", tono: "warning", icona: "TriangleAlert" },
};

export const esitoImport = (stato: StatoImportVendite): DescrizioneEsito =>
  ESITI_IMPORT[stato] ?? { etichetta: stato, tono: "neutral", icona: "Info" };

/** "1.200 di 5.000 righe · 1.150 scritte · 50 scartate". */
export const descriviAvanzamento = (importazione: Pick<ImportVendite, "elaborate" | "righe" | "scritte" | "scartate">): string =>
  [
    `${formatNumero(importazione.elaborate)} di ${conteggio(importazione.righe, "riga", "righe")}`,
    conteggio(importazione.scritte, "scritta", "scritte"),
    conteggio(importazione.scartate, "scartata", "scartate"),
  ].join(" · ");

/** La frase finale di un import che non è più in corso. */
export const fraseEsito = (importazione: ImportVendite): string => {
  const scritte = formatNumero(importazione.scritte);
  switch (importazione.stato) {
    case "completato":
      return `Import completato: ${conteggio(importazione.scritte, "riga scritta", "righe scritte")}, ${conteggio(importazione.scartate, "scartata", "scartate")}.`;
    case "annullato":
      return `Import annullato. Righe scritte prima dell'annullamento: ${scritte}; restano finché non reimporti il file dello stesso periodo.`;
    case "fallito":
      return `Import non riuscito${importazione.errore ? `: ${importazione.errore}` : ""}. Righe scritte prima dell'errore: ${scritte}.`;
    case "interrotto":
      return `Import interrotto: il server si è fermato durante il lavoro. Righe scritte: ${scritte}; reimporta il file per completarlo.`;
    default:
      return descriviAvanzamento(importazione);
  }
};
