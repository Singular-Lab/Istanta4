import type { ImportVendite, StatoImportVendite } from '../../../lib/vendite/tipi';

/** Una riga di importazioni_vendite come la legge VenditeRepository. */
export interface RigaImportVendite {
  id: string;
  id_gdo: string;
  stato: StatoImportVendite;
  nome_file: string;
  righe: number;
  elaborate: number;
  scritte: number;
  scartate: number;
  errore: string | null;
  avviato_da: string | null;
  avviato_il: Date | string;
  terminato_il: Date | string | null;
  battito_il: Date | string;
  annullato: boolean;
  /**
   * 'in_corso' senza battito da piu' di MINUTI_IMPORT_INTERROTTO minuti, con l'orologio del database:
   * il server che lo eseguiva si e' fermato.
   */
  senza_battito: boolean;
}

export const MESSAGGIO_IMPORT_VENDITE_INTERROTTO =
  "Import interrotto: il server che lo eseguiva si e' fermato. Le vendite gia' scritte restano; " +
  "reimportando il file si completano (la stessa vendita si sostituisce, non si somma)";

const iso = (valore: Date | string): string => (valore instanceof Date ? valore : new Date(valore)).toISOString();

/** Lo stato dell'import per il client: un 'in_corso' senza battito risulta 'interrotto'. */
export function importDaRiga(riga: RigaImportVendite): ImportVendite {
  const interrotto = riga.stato === 'in_corso' && Boolean(riga.senza_battito);
  return {
    id: riga.id,
    stato: interrotto ? 'interrotto' : riga.stato,
    nomeFile: riga.nome_file,
    righe: Number(riga.righe),
    elaborate: Number(riga.elaborate),
    scritte: Number(riga.scritte),
    scartate: Number(riga.scartate),
    errore: interrotto ? riga.errore ?? MESSAGGIO_IMPORT_VENDITE_INTERROTTO : riga.errore ?? null,
    avviatoIl: iso(riga.avviato_il),
    // L'interrotto si e' fermato con l'ultimo battito
    terminatoIl: interrotto ? iso(riga.battito_il) : riga.terminato_il ? iso(riga.terminato_il) : null,
  };
}
