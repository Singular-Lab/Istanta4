import type { Request } from 'express';
import type { EsitoProvaMenabo, EsitoVerificaConfigurazione, ImpostazioniGdo, SuggerimentiCampiMenabo, SuggerimentiValoriMenabo, VolantinoProvaMenabo } from '../../../lib/impostazioniGdo/tipi';

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
  /** { regole }: le regole delle sezioni del menabò degli insight; BadRequestError se non valide. */
  salvaRegoleMenabo(idGdo: string, dati: unknown, richiesta?: Request): Promise<ImpostazioniGdo>;
  /** Gli ultimi volantini della GDO su cui provare le regole del menabò. */
  volantiniPerProvaMenabo(idGdo: string): Promise<VolantinoProvaMenabo[]>;
  /** I campi reali delle referenze della GDO (senza `campo`) o i valori reali di un campo, per autocompilare le regole. */
  suggerimentiMenabo(idGdo: string, campo?: string): Promise<SuggerimentiCampiMenabo | SuggerimentiValoriMenabo>;
  /** { idKit, regole }: il menabò del volantino prima e dopo le regole, senza salvare niente. */
  provaRegoleMenabo(idGdo: string, dati: unknown): Promise<EsitoProvaMenabo>;
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
