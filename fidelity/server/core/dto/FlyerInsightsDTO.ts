/**
 * DTO per le statistiche e insights dei volantini
 */

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

/**
 * Un record di listino come lo mostra il report: non impaginato o compilato in un
 * box fuori listino. Il tracciato e del cliente, quindi sono la sua agenzia lib a
 * decidere quali campi mostrare e la UI a stamparli cosi come arrivano.
 */
export interface ReferenzaStoricoDTO {
  codice: string;
  descrizione: string;
  campi: Array<{ label: string; valore: string }>;
}

/** Un box del volantino che a listino non c'era: compilato a mano oppure ignorato. */
export interface BoxFuoriListinoDTO {
  codiceBox: string;
  pag?: number;
  ignorato: boolean;
  /** Il testo letto nel box, vuoto sugli import precedenti. */
  testoBox: string[];
  referenze: ReferenzaStoricoDTO[];
}

/**
 * Presente solo se la lavorazione e stata recuperata dallo storico. Sta sul kit,
 * non sulle referenze: sono loro a ereditarlo.
 */
export interface OrigineStoricoDTO {
  importatoIl: string;
  nomeFile?: string;
  /** Assenti sugli import precedenti. */
  boxNelVolantino?: number;
  referenzeDaListino?: number;
  nonImpaginate: ReferenzaStoricoDTO[];
  lasciapassareNonImpaginate: boolean;
  /** Quante referenze del kit sono nate da un box fuori listino. */
  totaleFuoriListino: number;
  /** Box fuori listino che l'operatore ha deciso di ignorare: nessuna referenza. */
  fuoriListinoIgnorati: number;
  /** Sugli import precedenti contiene solo i compilati, senza testo del box. */
  boxFuoriListino: BoxFuoriListinoDTO[];
}

export interface FlyerInsightsDTO {
  guidIdKitRuntime: string;
  /** Assente sulle lavorazioni normali: la scheda resta identica a prima. */
  origineStorico?: OrigineStoricoDTO;
  totaleReferenze: number;
  totalePagine: number;
  riepilogoPagine: RiepilogoPaginaDTO[];
  riepilogoReparti: RiepilogoRepartoDTO[];
  riepilogoMeccaniche: RiepilogoMeccanicaDTO[];
  referenze: ReferenzaPosizioneDTO[];
}
