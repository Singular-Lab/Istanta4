/**
 * Contratto fra il server e le pagine di consultazione dei punti vendita (/punti-vendita e
 * /punti-vendita/:id), separate dalla gestione interna. Solo lettura: niente dispositivi, token
 * o contesti display, che restano alla gestione.
 *
 * Endpoint ("gdo.visualizza", sempre sui punti vendita della GDO della sessione):
 * - GET /api/punti-vendita                      -> PuntoVenditaConsultazione[] (per nome)
 * - GET /api/punti-vendita/:id                  -> PuntoVenditaConsultazione
 * - GET /api/punti-vendita/:id/volantini-attivi -> VolantinoAttivoDTO[]
 * Un punto vendita di un'altra GDO risponde come inesistente (404).
 * La storia del punto vendita ha il suo contratto in ./storia.ts.
 */

import type { StoriaInElenco } from './analisi';

/** Canale (per alcune GDO l'insegna) o area del punto vendita. */
export interface RiferimentoCodificato {
  id: string;
  nome: string;
  codice: string | null;
}

export interface PuntoVenditaConsultazione {
  id: string;
  nome: string;
  ragioneSociale: string | null;
  indirizzo: string | null;
  cap: string | null;
  citta: string | null;
  provincia: string | null;
  regione: string | null;
  telefono: string | null;
  /** Null se la combinazione canale-area del punto vendita non si trova. */
  canale: RiferimentoCodificato | null;
  area: RiferimentoCodificato | null;
  /** Codici del sistema della GDO (es. id ANACAN e codice Muro), dai meta dell'anagrafica. */
  meta: Record<string, unknown>;
  /** Null se il punto vendita non ha coordinate. */
  coordinate: { lat: number; lon: number } | null;
  /**
   * Solo nell'elenco (GET /api/punti-vendita), e solo se il punto vendita compare in almeno un
   * volantino: quanti volantini e con quale insegna, anno per anno (contratto in ./analisi.ts).
   */
  storia?: StoriaInElenco;
}
