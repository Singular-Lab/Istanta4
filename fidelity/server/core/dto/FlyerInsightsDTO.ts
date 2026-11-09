/**
 * DTO per le statistiche e insights dei volantini
 */

import type {
  BoxReportStorico,
  OrigineStorico,
  ReferenzaReportStorico
} from '../../../lib/types';
import type { EstensioneInsight } from '../../../lib/insightVolantino/tipi';

export interface ReferenzaPosizioneDTO {
  id: string;
  /**
   * Presente solo sulle lavorazioni recuperate dallo storico: dice se questa
   * referenza era a listino o se e stata compilata a mano perche nel volantino
   * c'era un box che a listino non esisteva.
   */
  origine?: 'listino' | 'fuori_listino';
  /** Campi dinamici estratti da dataFields secondo flyerInsightsConfig.json */
  [key: string]: any;
  posizione: {
    pag: number;
    x: number;
    y: number;
    w: number;
    h: number;
    wPage: number;
    hPage: number;
    percIngombro: number;
    aspectRatio: number;
  } | null;
}

export interface RepartoPaginaDTO {
  sigla: string;
  descrizione: string;
  count: number;
}

export interface RiepilogoPaginaDTO {
  pagina: number;
  numeroReferenze: number;
  ingombroTotalePerc: number;
  reparti: RepartoPaginaDTO[];
}

export interface RiepilogoRepartoDTO {
  sigla: string;
  descrizione: string;
  numeroReferenze: number;
  pagine: number[];
  [key: string]: any;
}

export interface RiepilogoMeccanicaDTO {
  [key: string]: any;
  numeroReferenze: number;
  percentuale: number;
}

export type ReferenzaStoricoDTO = ReferenzaReportStorico;
export type BoxFuoriListinoDTO = BoxReportStorico;
export type OrigineStoricoDTO = OrigineStorico;

export interface ContestoFlyerInsightsDTO {
  titolo: string;
  nomeArea?: string;
  nomeCanale?: string;
  idPromo: string;
}

/** Campi di sempre più le sezioni nuove (lib/insightVolantino/tipi.ts). */
export interface FlyerInsightsDTO extends EstensioneInsight {
  guidIdKitRuntime: string;
  contesto: ContestoFlyerInsightsDTO;
  /** Assente sulle lavorazioni normali: la scheda resta identica a prima. */
  origineStorico?: OrigineStoricoDTO;
  totaleReferenze: number;
  totalePagine: number;
  riepilogoPagine: RiepilogoPaginaDTO[];
  riepilogoReparti: RiepilogoRepartoDTO[];
  riepilogoMeccaniche: RiepilogoMeccanicaDTO[];
  referenze: ReferenzaPosizioneDTO[];
}
