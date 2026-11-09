/**
 * Import delle vendite del cliente (spec vendite-volantino), condiviso fra server e client.
 *
 * Tutte con il permesso "analisi.importa_vendite", sempre sulla GDO operativa della sessione, anche
 * per chi opera per piu' GDO (?gdo= non conta); una sessione senza GDO operativa riceve 403:
 * - POST /api/vendite/import/anteprima  multipart "file" (xlsx, xls, csv) -> AnteprimaImportVendite, non scrive nulla
 * - POST /api/vendite/import            multipart "file" -> 202 ImportVendite; 409 con l'import in corso della GDO
 *                                        ({ message, stato: ImportVendite, httpStatus: 409, code: 'IMPORT_VENDITE_IN_CORSO' })
 * - GET  /api/vendite/import/stato      -> ImportVendite | null (l'ultimo della GDO)
 * - POST /api/vendite/import/annulla    -> ImportVendite (le righe gia' scritte restano); 404 se la GDO non ne ha
 * - GET  /api/vendite/riepilogo         -> RiepilogoVendite
 *
 * Il file si legge con il tracciato della libreria agenzia del cliente (importVendite); senza, con
 * il tracciato generico (server/core/vendite/tracciatoGenerico.ts: colonne codice, punto_vendita,
 * dal, al, pezzi, valore). Reimportare stesso prodotto, punto vendita e periodo sostituisce il dato.
 *
 * Tabelle (migrazione 0018_vendite_prodotti.sql):
 * - vendite_prodotti: id uuid, id_gdo uuid, codice_prodotto varchar(100) (gia' normalizzato con
 *   normalizzaCodiceProdotto), id_punto_vendita uuid -> punti_vendita (on delete cascade), dal date,
 *   al date, pezzi numeric(14,3), valore numeric(14,2) null, id_import uuid null, aggiornato_il
 *   timestamptz; unica (id_gdo, codice_prodotto, id_punto_vendita, dal, al); indice
 *   (id_gdo, codice_prodotto, dal, al).
 * - importazioni_vendite: id uuid, id_gdo uuid, stato varchar(20), nome_file, righe, elaborate,
 *   scritte, scartate (integer), errore text, avviato_da uuid, avviato_il, terminato_il,
 *   battito_il timestamptz (ultimo segno di vita del lavoro), annullato boolean.
 */

export const PERCORSI_VENDITE = {
  anteprima: '/vendite/import/anteprima',
  importa: '/vendite/import',
  stato: '/vendite/import/stato',
  annulla: '/vendite/import/annulla',
  riepilogo: '/vendite/riepilogo',
} as const;

/** Colonne del tracciato generico, usato quando la libreria agenzia non dichiara importVendite. */
export const COLONNE_TRACCIATO_GENERICO: readonly string[] = ['codice', 'punto_vendita', 'dal', 'al', 'pezzi', 'valore'];

/** Una riga di vendita letta dal file, prima di riconoscere il punto vendita. */
export interface RigaVendita {
  codiceProdotto: string;
  /** Il punto vendita come lo scrive il cliente (chiave nei meta, es. id ANACAN, o nome). */
  puntoVendita: string;
  /** YYYY-MM-DD, inclusi. */
  dal: string;
  al: string;
  pezzi: number;
  /** Euro; null se il file non lo porta. */
  valore: number | null;
}

export interface RigaScartata {
  /** Numero di riga come in Excel (l'intestazione e' la riga 1). */
  riga: number;
  motivo: string;
}

/** Righe scartate mostrate nell'anteprima; il conteggio resta completo. */
export const MAX_SCARTATE_ANTEPRIMA = 200;

/** Dopo questo silenzio un import "in_corso" si considera interrotto (server fermato). */
export const MINUTI_IMPORT_INTERROTTO = 5;

export interface AnteprimaImportVendite {
  tracciato: { nome: string; colonne: string[] };
  righe: number;
  importabili: number;
  scartate: number;
  dettaglioScartate: RigaScartata[];
  periodo: { dal: string; al: string } | null;
  prodotti: number;
  puntiVendita: number;
}

export type StatoImportVendite = 'in_corso' | 'completato' | 'annullato' | 'fallito' | 'interrotto';

export interface ImportVendite {
  id: string;
  stato: StatoImportVendite;
  nomeFile: string;
  righe: number;
  elaborate: number;
  scritte: number;
  scartate: number;
  errore: string | null;
  /** ISO 8601. */
  avviatoIl: string;
  terminatoIl: string | null;
}

export interface RiepilogoVendite {
  /** La GDO operativa della sessione, di cui sono le vendite. */
  gdo: { id: string; nome: string };
  righe: number;
  prodotti: number;
  puntiVendita: number;
  /** Periodo coperto dalle vendite della GDO, YYYY-MM-DD. */
  dal: string | null;
  al: string | null;
  ultimoImport: ImportVendite | null;
}

/**
 * Forma unica del codice prodotto per confrontare vendite e referenze del volantino: senza spazi ai
 * lati, maiuscolo, e senza zeri iniziali quando e' tutto cifre ("000123" e "123" sono lo stesso).
 */
export function normalizzaCodiceProdotto(codice: unknown): string {
  const testo = String(codice ?? '').trim().toUpperCase();
  if (/^\d+$/.test(testo)) return testo.replace(/^0+(?=\d)/, '');
  return testo;
}
