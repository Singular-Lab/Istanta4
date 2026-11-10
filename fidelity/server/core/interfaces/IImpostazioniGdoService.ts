import type { Request } from 'express';
import type { EsitoVerificaConfigurazione, ImpostazioniGdo } from '../../../lib/impostazioniGdo/tipi';

/**
 * Impostazioni GDO (spec impostazioni-gdo, contratto in lib/impostazioniGdo/tipi.ts). Ogni salvataggio
 * cambia solo la sua sezione e restituisce le impostazioni aggiornate. La richiesta, facoltativa,
 * serve a leggere da Istanta il catalogo dei loghi delle linee del distributore.
 */
export interface IImpostazioniGdoService {
  leggi(idGdo: string, richiesta?: Request): Promise<ImpostazioniGdo>;
  /** { colore }: #rrggbb o null. */
  salvaIdentita(idGdo: string, dati: unknown, richiesta?: Request): Promise<ImpostazioniGdo>;
  /** { reparti }: codice, nome nei dati, nome per il marketing, colore. */
  salvaReparti(idGdo: string, dati: unknown, richiesta?: Request): Promise<ImpostazioniGdo>;
  /** { campiReferenze }: i data_fields_refs di WebPliant. */
  salvaCampiReferenze(idGdo: string, dati: unknown, richiesta?: Request): Promise<ImpostazioniGdo>;
  /** Solo le chiavi presenti; loghi e icona in base64 si caricano su Olimpo con la chiave dell'utente. */
  salvaSitoWeb(idGdo: string, dati: unknown, chiaveOlimpo: string | undefined, richiesta?: Request): Promise<ImpostazioniGdo>;
  verificaInsightVolantino(configurazione: unknown): EsitoVerificaConfigurazione;
  /** BadRequestError se la configurazione non e' valida (il controller la verifica prima). */
  salvaInsightVolantino(idGdo: string, configurazione: unknown, idUtente: string | null, richiesta?: Request): Promise<ImpostazioniGdo>;
  /** Si torna alla configurazione del file dell'installazione. */
  eliminaInsightVolantino(idGdo: string, richiesta?: Request): Promise<ImpostazioniGdo>;
}
