/**
 * DTO per le statistiche e insights dei volantini
 */

export interface ReferenzaPosizioneDTO {
  id: string;
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

export interface FlyerInsightsDTO {
  guidIdKitRuntime: string;
  totaleReferenze: number;
  totalePagine: number;
  riepilogoPagine: RiepilogoPaginaDTO[];
  riepilogoReparti: RiepilogoRepartoDTO[];
  riepilogoMeccaniche: RiepilogoMeccanicaDTO[];
  referenze: ReferenzaPosizioneDTO[];
}
