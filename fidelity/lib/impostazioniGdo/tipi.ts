import type { ConfigWebpliant } from '../types';

/**
 * Contratto delle Impostazioni GDO (spec impostazioni-gdo), condiviso fra server e client.
 *
 * Tutte le rotte richiedono "impostazioni.modifica_generali" e valgono per la GDO della sessione
 * (superadmin e agenzia: quella in ?gdo=, altrimenti la GDO dell'installazione). Ogni PUT salva
 * soltanto la sua sezione, senza toccare le altre impostazioni della GDO, e risponde con le
 * impostazioni aggiornate.
 *
 * - GET    /api/impostazioni-gdo                               -> ImpostazioniGdo
 * - PUT    /api/impostazioni-gdo/identita                      IdentitaGdoDaSalvare -> ImpostazioniGdo
 * - PUT    /api/impostazioni-gdo/reparti                       RepartiDaSalvare -> ImpostazioniGdo
 * - PUT    /api/impostazioni-gdo/campi-referenze               CampiReferenzeDaSalvare -> ImpostazioniGdo
 * - PUT    /api/impostazioni-gdo/sito-web                      SitoWebDaSalvare -> ImpostazioniGdo
 * - POST   /api/impostazioni-gdo/insight-volantino/verifica    { configurazione } -> EsitoVerificaConfigurazione
 * - PUT    /api/impostazioni-gdo/insight-volantino             { configurazione } -> ImpostazioniGdo
 *          (non valida: 400 BadRequestError del progetto, con l'EsitoVerificaConfigurazione in details:
 *          details.errori con percorso e messaggio)
 * - DELETE /api/impostazioni-gdo/insight-volantino             -> ImpostazioniGdo (si torna al file dell'installazione)
 *
 * Il mapping dei campi e il suo Sync restano su /api/referenze/campi-non-tradotti (spec
 * referenze-webpliant); l'icona della GDO resta su POST /api/gdo/icona.
 */

export const PERCORSO_IMPOSTAZIONI_GDO = '/impostazioni-gdo';
export const percorsiImpostazioniGdo = {
  impostazioni: PERCORSO_IMPOSTAZIONI_GDO,
  identita: `${PERCORSO_IMPOSTAZIONI_GDO}/identita`,
  reparti: `${PERCORSO_IMPOSTAZIONI_GDO}/reparti`,
  campiReferenze: `${PERCORSO_IMPOSTAZIONI_GDO}/campi-referenze`,
  sitoWeb: `${PERCORSO_IMPOSTAZIONI_GDO}/sito-web`,
  insightVolantino: `${PERCORSO_IMPOSTAZIONI_GDO}/insight-volantino`,
  verificaInsightVolantino: `${PERCORSO_IMPOSTAZIONI_GDO}/insight-volantino/verifica`,
} as const;

/** Un reparto della GDO come lo vede e lo nomina il marketing. */
export interface RepartoGdo {
  /** Codice come arriva nei dati (con gli zeri iniziali dell'anagrafica quando c'e'). */
  codice: string;
  /** Nome che il reparto ha nei dati: descrizione dell'anagrafica o, in mancanza, quella delle referenze. */
  nomeDati: string;
  /** Nome per il marketing; null finche' non e' impostato. */
  nomeMarketing: string | null;
  /** Colore esadecimale (#rrggbb); null: quello della configurazione degli insight o automatico. */
  colore: string | null;
  /** Referenze dei volantini della GDO con questo reparto. */
  referenze: number;
  /** Trovato nelle referenze e senza nome per il marketing. */
  daNominare: boolean;
  /** Nome proposto (es. da dictionary_translation.json), da accettare a mano; null se nessuno. */
  suggerimento: string | null;
}

export interface LineaDichiarata {
  sigla: string;
  nome: string;
  colore: string | null;
  /** URL dell'immagine del logo (proxy pubblico /olimpo), null se il catalogo non ce l'ha. */
  logo: string | null;
}

export interface BolloDichiarato {
  sigla: string;
  nome: string;
  logo: string | null;
}

export type OrigineConfigurazione = 'gdo' | 'file' | 'assente';

export interface ConfigurazioneInsightGdo {
  /** La configurazione in uso per la GDO (salvata, o quella del file); null se non c'e' nessuna delle due. */
  configurazione: Record<string, unknown> | null;
  origine: OrigineConfigurazione;
  /** ISO; solo per origine "gdo". */
  aggiornatoIl: string | null;
  /** Nome dell'utente che l'ha salvata; solo per origine "gdo". */
  aggiornatoDa: string | null;
}

export interface ImpostazioniGdo {
  gdo: { id: string; nome: string; haIcona: boolean };
  identita: { colore: string | null };
  reparti: RepartoGdo[];
  /** Linee e bolli dichiarati dalla libreria agenzia del cliente; null se non ne dichiara. Sola lettura. */
  lineeDistributore: { linee: LineaDichiarata[]; bolli: BolloDichiarato[] } | null;
  campiReferenze: ConfigWebpliant['data_fields_refs'];
  sitoWeb: Pick<ConfigWebpliant, 'css_text' | 'icona_pagina' | 'logo_header' | 'stili'> & {
    stili_minimal?: ConfigWebpliant['stili_minimal'];
    meta_volantino?: ConfigWebpliant['meta_volantino'];
  };
  insightVolantino: ConfigurazioneInsightGdo;
}

export interface IdentitaGdoDaSalvare {
  colore: string | null;
}

export interface RepartiDaSalvare {
  reparti: Array<Pick<RepartoGdo, 'codice' | 'nomeDati' | 'nomeMarketing' | 'colore'>>;
}

export interface CampiReferenzeDaSalvare {
  campiReferenze: ConfigWebpliant['data_fields_refs'];
}

/** Solo i campi presenti si salvano; gli altri restano come sono. */
export type SitoWebDaSalvare = Partial<ImpostazioniGdo['sitoWeb']>;

export interface ErroreConfigurazione {
  /** Percorso nel JSON, es. "reparti.colorStrategy.type"; "" per la radice. */
  percorso: string;
  messaggio: string;
}

export interface EsitoVerificaConfigurazione {
  valida: boolean;
  errori: ErroreConfigurazione[];
  /** Sezioni riconosciute (dataMapping, reparti, meccaniche, pagine, mappa, marche) quando valida. */
  sezioni: string[];
}
