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
 * - PUT    /api/impostazioni-gdo/menabo                        RegoleMenaboDaSalvare -> ImpostazioniGdo
 * - GET    /api/impostazioni-gdo/menabo/volantini              -> VolantinoProvaMenabo[] (gli ultimi della GDO, per la prova)
 * - POST   /api/impostazioni-gdo/menabo/prova                  { idKit, regole } -> EsitoProvaMenabo (non salva niente)
 * - GET    /api/impostazioni-gdo/menabo/suggerimenti           -> SuggerimentiCampiMenabo (campi reali e campo del menabò)
 * - GET    /api/impostazioni-gdo/menabo/suggerimenti?campo=x   -> SuggerimentiValoriMenabo (valori reali del campo)
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
  menabo: `${PERCORSO_IMPOSTAZIONI_GDO}/menabo`,
  volantiniMenabo: `${PERCORSO_IMPOSTAZIONI_GDO}/menabo/volantini`,
  provaMenabo: `${PERCORSO_IMPOSTAZIONI_GDO}/menabo/prova`,
  suggerimentiMenabo: `${PERCORSO_IMPOSTAZIONI_GDO}/menabo/suggerimenti`,
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

/** Come una condizione confronta il campo della referenza (o la pagina) con il valore. */
export const OPERATORI_REGOLA_MENABO = [
  'uguale', 'diverso', 'contiene', 'non_contiene', 'inizia', 'finisce', 'uno_di',
  'vuoto', 'non_vuoto', 'regex', 'maggiore', 'minore', 'tra',
] as const;
export type OperatoreRegolaMenabo = (typeof OPERATORI_REGOLA_MENABO)[number];

/** Le trasformazioni di un campo in un modello di nome: `{mastro|senza-sigla|spazi|titolo}`. */
export const TRASFORMAZIONI_NOME_MENABO = [
  'parte-1', 'parte-2', 'parte-3', 'senza-sigla', 'spazi', 'minuscolo', 'maiuscolo', 'titolo', 'taglia', 'leggibile',
] as const;
export type TrasformazioneNomeMenabo = (typeof TRASFORMAZIONI_NOME_MENABO)[number];

/**
 * I campi che non stanno nei dati della referenza ma si ricavano dal box: `@pagina`, `@prima_pagina`,
 * `@ultima_pagina` e `@reparto_nome` (il nome del reparto come nelle Impostazioni GDO, uguale in ogni volantino).
 */
export const CAMPI_DERIVATI_MENABO = [
  '@pagina', '@prima_pagina', '@ultima_pagina', '@reparto_nome',
  '@mastro_prevalente', '@reparto_prevalente', '@quota_reparto_prevalente', '@sezione_precedente',
] as const;

/**
 * I campi che si calcolano su tutta la pagina e valgono solo nelle regole di livello pagina: il dato di sezione
 * (per Conad CNO la mastro) e il reparto con più referenze, la quota di quel reparto (0-100) e la sezione
 * della pagina prima.
 */
export const CAMPI_DI_PAGINA_MENABO = ['@mastro_prevalente', '@reparto_prevalente', '@quota_reparto_prevalente', '@sezione_precedente'] as const;

/**
 * Una condizione semplice su un campo della referenza (es. mastro, tema, reparto) o su un campo derivato.
 * `valore` per la maggior parte degli operatori; `valori` per `uno_di` (alternative) e per `tra` (minimo e massimo).
 * `vuoto` e `non_vuoto` non usano il valore.
 */
export interface CondizioneRegolaMenabo {
  tipo: 'condizione';
  campo: string;
  operatore: OperatoreRegolaMenabo;
  valore: string;
  valori: string[];
}

/** Un gruppo di nodi: vale se valgono tutti i nodi, almeno uno, o nessuno. I gruppi si annidano. */
export interface GruppoRegolaMenabo {
  tipo: 'gruppo';
  logica: 'tutte' | 'una' | 'nessuna';
  figli: NodoRegolaMenabo[];
}

export type NodoRegolaMenabo = CondizioneRegolaMenabo | GruppoRegolaMenabo;

/**
 * Una regola delle sezioni del menabò degli insight (spec impostazioni-gdo, "Regole delle sezioni del
 * menabò del volantino"). Livello `box`: vale per il box con una referenza che soddisfa la condizione.
 * Livello `pagina`: vale per la pagina se la condizione è soddisfatta da almeno un suo box, e decide la
 * sezione di tutta la pagina. `sezione` è un testo o un modello (`{mastro|senza-sigla|titolo}`); null:
 * non è una sezione. Si applica la prima regola che vale, nell'ordine scelto.
 */
export interface RegolaMenabo {
  id: string;
  /** Un nome per riconoscerla (compare nel motivo delle pagine); facoltativo. */
  titolo: string | null;
  livello: 'box' | 'pagina';
  sezione: string | null;
  /** Colore esadecimale (#rrggbb) della sezione; null: automatico. */
  colore: string | null;
  condizione: GruppoRegolaMenabo;
  /**
   * Solo per le regole di livello box: la regola vale per una pagina soltanto se almeno questa percentuale
   * (1-100) dei suoi box la soddisfa; sotto, i box tornano alla sezione di prima. Assente o null: sempre.
   */
  quotaMinima?: number | null;
}

/** Un campo che compare nelle referenze dei volantini della GDO, con quante referenze lo hanno. */
export interface CampoSuggerito {
  campo: string;
  referenze: number;
}

/** I campi reali delle referenze e il campo da cui la libreria agenzia ricava la sezione (per Conad CNO «mastro»). */
export interface SuggerimentiCampiMenabo {
  campoMenabo: string | null;
  campi: CampoSuggerito[];
}

/** Un valore reale di un campo; per il campo del menabò, il nome leggibile che ne ricava la libreria agenzia. */
export interface ValoreSuggerito {
  valore: string;
  referenze: number;
  /** Il nome leggibile della sezione; null se il valore non è una sezione; assente per gli altri campi. */
  nomeLeggibile?: string | null;
}

export interface SuggerimentiValoriMenabo {
  campo: string;
  valori: ValoreSuggerito[];
}

/** La prova delle regole su un volantino reale (POST /menabo/prova). */
export interface PaginaProvaMenabo {
  pagina: number;
  /** Il reparto con più box nella pagina (nome come nelle Impostazioni GDO); null se non si legge. */
  reparto?: string | null;
  prima: string | null;
  dopo: string | null;
  cambia: boolean;
  /** La regola che ha deciso la pagina; null se nessuna. */
  regola: string | null;
}

export interface VolantinoProvaMenabo {
  idKit: string;
  titolo: string;
  nomePromo: string;
}

export interface EsitoProvaMenabo {
  volantino: VolantinoProvaMenabo;
  pagine: PaginaProvaMenabo[];
  /** Quante pagine cambiano sezione con le regole. */
  cambiate: number;
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
  /** Le regole delle sezioni del menabò della GDO; vuoto: la sezione è quella ricavata dalla libreria agenzia. */
  regoleMenabo: RegolaMenabo[];
}

export interface RegoleMenaboDaSalvare {
  regole: RegolaMenabo[];
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
