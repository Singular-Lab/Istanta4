import type { AnteprimaImportVendite, ImportVendite, RiepilogoVendite } from '../../../lib/vendite/tipi';

/** Il file caricato: contenuto e nome originale (gia' in UTF-8). */
export interface FileVendite {
  contenuto: Buffer;
  nome: string;
}

/** La GDO ha gia' un import delle vendite in corso (anche avviato da un altro processo): risposta 409. */
export class ImportVenditeInCorso extends Error {
  constructor(readonly importInCorso: ImportVendite) {
    super("Un import delle vendite e' gia' in corso per questa GDO: attendi che finisca o annullalo");
    this.name = 'ImportVenditeInCorso';
  }
}

/**
 * Import delle vendite del cliente (contratto in lib/vendite/tipi.ts), sempre sulla GDO indicata dal
 * controller. Il file si legge con il tracciato della libreria agenzia (importVendite) o con quello
 * generico; il punto vendita si riconosce fra quelli della GDO. File illeggibile, senza righe o
 * senza righe importabili: BadRequestError (400).
 */
export interface IImportVenditeService {
  /** Cosa importerebbe il file, senza scrivere nulla. */
  anteprima(file: FileVendite, idGdo: string): Promise<AnteprimaImportVendite>;
  /**
   * Crea l'import e lo esegue in background; risponde subito con il suo stato iniziale.
   * ImportVenditeInCorso se la GDO ne ha gia' uno in corso.
   */
  avvia(file: FileVendite, idGdo: string, idUtente: string): Promise<ImportVendite>;
  /** L'ultimo import della GDO (quello in corso, se c'e'); null se non ne ha mai fatti. */
  stato(idGdo: string): Promise<ImportVendite | null>;
  /**
   * Chiede di fermare l'import in corso della GDO: il lavoro si ferma al blocco successivo e le
   * vendite gia' scritte restano. Restituisce l'ultimo import (ancora 'in_corso' finche' il lavoro non
   * se ne accorge); null se la GDO non ne ha mai fatti.
   */
  annulla(idGdo: string): Promise<ImportVendite | null>;
  riepilogo(idGdo: string): Promise<RiepilogoVendite>;
}
