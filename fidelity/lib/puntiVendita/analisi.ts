import type { PromoStoria, RiferimentoStoria, TipoAbbinamento } from './storia';

/**
 * Contratto fra il server e le pagine del punto vendita costruite sulla timeline dei volantini:
 * scheda del PV (numeri, timeline, infografiche), volantino (pagine e box), referenza (prezzo nel
 * tempo), rete per insegna nell'elenco e qualità dei dati nella gestione.
 *
 * I dati vengono da: punti_vendita_volantino (in quali volantini compare il PV), runtime_kit e
 * promo (edizioni), referenze (box e prodotti; testo stampato in compiled_fields, dati DB1 o
 * Istanta in data_fields, posizione in pag/x/y/w/h). Il codice prodotto e il reparto ci sono
 * solo se DB1 o Istanta li mandano: altrimenti il prodotto si riconosce dal testo stampato
 * (nome, marca, formato) e il reparto può mancare. `copertura` dice quanto sono affidabili.
 *
 * Endpoint, tutti con "gdo.visualizza" salvo dove indicato; un PV o un kit fuori dalla GDO
 * dell'utente risponde 404:
 * - GET /api/punti-vendita/:id/analisi                         -> AnalisiPuntoVendita
 * - GET /api/punti-vendita/:id/volantini/:idKit                -> DettaglioVolantinoPv per la scheda inline della timeline
 * - GET /api/punti-vendita/:id/referenze/:chiave               -> DettaglioReferenzaPv (chiave di ProdottoRicorrente/ReferenzaSintesi)
 * - GET /api/punti-vendita/rete/insegne                        -> ReteInsegne
 * - GET /api/punti-vendita/gestione/qualita                    "gdo.gestisci_punti_vendita" -> QualitaPuntiVendita
 * - GET /api/punti-vendita/gestione/righe-non-abbinate         "gdo.gestisci_punti_vendita" pagina, dimensione -> PaginaRigheNonAbbinate
 * - GET /api/punti-vendita/gestione/righe-non-abbinate/volantini "gdo.gestisci_punti_vendita" chiave -> VolantiniRigaNonAbbinata
 *        (404 se la riga non e' piu' fra le non abbinate)
 * - POST /api/punti-vendita/gestione/righe-non-abbinate/collega "gdo.gestisci_punti_vendita" RichiestaCollegamento -> EsitoCollegamento
 *        (404 se il PV non e' della GDO, 409 se la riga non e' piu' fra le non abbinate,
 *        422 COMBINAZIONE_DIVERSA se il PV non ha la combinazione canale/area di nessuno dei volantini della riga)
 * - GET /api/punti-vendita/gestione/collegamenti-manuali        "gdo.gestisci_punti_vendita" pagina, dimensione -> PaginaCollegamentiManuali
 * - DELETE /api/punti-vendita/gestione/collegamenti-manuali/:id "gdo.gestisci_punti_vendita" -> EsitoScollegamento (404 se non c'e')
 * - GET /api/punti-vendita/gestione/verifica-collegamenti       "gdo.gestisci_punti_vendita" esito, tipo, pagina, dimensione
 *        -> PaginaVerificaCollegamenti
 * - PUT /api/punti-vendita/gestione/collegamenti/cambia         "gdo.gestisci_punti_vendita" RichiestaCambioCollegamento -> EsitoCollegamento
 *        (404 se un PV non e' della GDO, 409 se il gruppo non e' piu' collegato a quel PV, 422 COMBINAZIONE_DIVERSA)
 * - POST /api/punti-vendita/gestione/posizioni-righe            "gdo.gestisci_punti_vendita" RichiestaRicercaPosizioni
 *        -> 202 StatoRicercaPosizioni (409 con lo stato se ce n'e' gia' una attiva sulla GDO). L'avanzamento
 *        arriva via socket all'utente che l'ha avviata: posizioniRighe_<jobId>_progress e posizioniRighe_<jobId>_complete
 * - GET /api/punti-vendita/gestione/posizioni-righe/stato       "gdo.gestisci_punti_vendita" jobId? -> { stato: StatoRicercaPosizioni | null }
 * - POST /api/punti-vendita/gestione/posizioni-righe/:jobId/annulla "gdo.gestisci_punti_vendita" -> { stato } (404 se non c'e')
 * - PUT /api/punti-vendita/gestione/posizioni-righe             "gdo.gestisci_punti_vendita" CorrezionePosizione -> PosizioneRiga
 */

/** Meccanica promozionale di una referenza, ricavata dai campi del box e dalla meccanica DB1/Istanta. */
export type MeccanicaReferenza = 'sconto' | 'fidelity' | 'punti' | 'sottocosto' | 'nxm' | 'prezzo';

export const MECCANICHE: readonly MeccanicaReferenza[] = ['sconto', 'fidelity', 'punti', 'sottocosto', 'nxm', 'prezzo'];

export const ETICHETTA_MECCANICA: Readonly<Record<MeccanicaReferenza, string>> = {
  sconto: 'Sconto in %',
  fidelity: 'Prezzo Fidelity',
  punti: 'Bollini e punti',
  sottocosto: 'Sottocosto',
  nxm: '2×1 e N×M',
  prezzo: 'Prezzo senza sconto',
};

/** Percentuale 0–100 riferita a un anno di validità delle promo (calendario di Roma). */
export interface QuotaAnno {
  anno: number;
  quota: number;
}

/** Quanto i dati delle referenze sono completi, in percentuale delle referenze considerate. */
export interface CoperturaDati {
  conCodice: number;
  conReparto: number;
  conPrezzo: number;
  conMarca: number;
}

/* ---------- Scheda del PV ---------- */

export interface NumeriPuntoVendita {
  volantini: number;
  volantiniAttivi: number;
  referenze: number;
  mediaReferenze: number | null;
  prodotti: number;
  /** Prodotti presenti in più di 10 volantini del PV. */
  prodottiFrequenti: number;
  /** Sconto medio sulle referenze con prezzo barrato, 0–100. */
  scontoMedio: number | null;
  scontoMedioPrimoAnno: number | null;
  insegne: RiferimentoStoria[];
}

/** Un volantino in cui compare il PV, per la timeline. */
export interface EdizioneTimeline {
  idKit: string;
  /** Date ISO (YYYY-MM-DD) di validità della promo. */
  dal: string;
  al: string | null;
  promo: { id: string; nome: string };
  canale: RiferimentoStoria;
  area: RiferimentoStoria;
  numeroReferenze: number;
  attivo: boolean;
}

export interface ProdottoRicorrente {
  /** Chiave stabile del prodotto, da usare in /referenze/:chiave (già sicura per un URL). */
  chiave: string;
  nome: string;
  marca: string | null;
  formato: string | null;
  /** Guid Olimpo della foto più recente. */
  foto: string | null;
  volantini: number;
  perAnno: Array<{ anno: number; volantini: number }>;
  prezzoMinimo: number | null;
  prezzoMassimo: number | null;
}

export interface AnalisiPuntoVendita {
  idPuntoVendita: string;
  numeri: NumeriPuntoVendita;
  /** Dal più vecchio. */
  timeline: EdizioneTimeline[];
  anni: number[];
  meccaniche: Array<{ meccanica: MeccanicaReferenza; anni: QuotaAnno[] }>;
  scontoPerAnno: Array<{ anno: number; sconto: number | null }>;
  /** Le 8 marche con più referenze, quota sul totale delle referenze con marca. */
  marche: Array<{ marca: string; quota: number }>;
  /** I 10 prodotti più presenti. */
  prodottiRicorrenti: ProdottoRicorrente[];
  /** Spazio di pagina per reparto, anno per anno; vuoto se il reparto non è noto. */
  reparti: Array<{ anno: number; reparti: Array<{ reparto: string; quota: number }> }>;
  copertura: CoperturaDati;
}

/* ---------- Volantino ---------- */

export interface ReferenzaSintesi {
  chiave: string;
  nome: string;
  marca: string | null;
  formato: string | null;
  prezzo: number | null;
  barrato: number | null;
  /** 0–100. */
  sconto: number | null;
  foto: string | null;
}

/** Un box del volantino. Geometria relativa alla pagina, da 0 a 1, qualunque sia la fonte. */
export interface BoxVolantino {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Percentuale della superficie della pagina, 0–100. */
  spazio: number;
  meccanica: MeccanicaReferenza | null;
  reparto: string | null;
  sconto: number | null;
  /** La prima è la pilota del box. */
  referenze: ReferenzaSintesi[];
}

export interface PaginaVolantino {
  numero: number;
  /** Rapporto larghezza/altezza della pagina. */
  proporzione: number;
  boxes: BoxVolantino[];
}

export interface DettaglioVolantinoPv {
  kit: { id: string; titolo: string };
  promo: PromoStoria;
  canale: RiferimentoStoria;
  area: RiferimentoStoria;
  pdf: { idFile: string; idOlimpoCloud: string; nome: string; pagine: number | null } | null;
  numeri: {
    pagine: number;
    referenze: number;
    /** Dal listino del sistema di storico e compilate a mano dall'operatore, se il kit viene dallo storico. */
    daListino: number | null;
    manuali: number | null;
    scontoMedio: number | null;
    scontoMedioPrecedente: number | null;
    fidelity: number;
    puntiVenditaInLista: number;
    puntiVenditaAbbinati: number;
  };
  pagine: PaginaVolantino[];
  meccaniche: Array<{ meccanica: MeccanicaReferenza; spazio: number }>;
  /** Come il volantino stampa questo PV, con le righe vicine della stessa provincia. */
  rigaPuntoVendita: {
    riga: string;
    abbinamento: TipoAbbinamento;
    regione: string | null;
    provincia: string | null;
    vicine: Array<{ riga: string; questo: boolean }>;
  } | null;
  precedente: { idKit: string; dal: string } | null;
  successivo: { idKit: string; dal: string } | null;
  copertura: CoperturaDati;
}

/* ---------- Referenza ---------- */

export interface PresenzaReferenza {
  idKit: string;
  promo: { id: string; nome: string; stato: PromoStoria['stato'] };
  canale: RiferimentoStoria;
  /** L'area del kit: le varianti per area della stessa promo hanno nome e periodo uguali. */
  area: RiferimentoStoria;
  dal: string;
  al: string | null;
  pagina: number | null;
  spazio: number | null;
  meccanica: MeccanicaReferenza | null;
  prezzo: number | null;
  barrato: number | null;
  sottocosto: boolean;
}

export interface DettaglioReferenzaPv {
  chiave: string;
  nome: string;
  marca: string | null;
  formato: string | null;
  tipo: string | null;
  foto: string[];
  prezzo: number | null;
  barrato: number | null;
  sconto: number | null;
  /** Testo stampato, per esempio "al kg da € 9,83 a € 5,63". */
  prezzoAlKg: string | null;
  meccanica: MeccanicaReferenza | null;
  /** Testo stampato dei bollini/punti, per esempio "3 bollini con 2 pezzi". */
  punti: string | null;
  dati: {
    codice: string | null;
    ean: string | null;
    reparto: string | null;
    settore: string | null;
    segmento: string | null;
    ruolo: string | null;
    tema: string | null;
    /** Da dove vengono codice e dati: il listino DB1, Istanta, o solo il testo stampato. */
    fonte: 'db1' | 'istanta' | 'testo';
  };
  /** Nell'ultimo volantino del PV che la contiene. */
  posizione: {
    idKit: string;
    pagina: number;
    pagine: number;
    box: { x: number; y: number; w: number; h: number };
    spazio: number;
    referenzeNelBox: number;
    altriBox: Array<{ x: number; y: number; w: number; h: number }>;
    proporzione: number;
  } | null;
  numeri: {
    volantini: number;
    primoVolantino: string | null;
    prezzoMinimo: { prezzo: number; dal: string; sottocosto: boolean } | null;
    prezzoAttuale: number | null;
    giorniFraPresenze: number | null;
  };
  /** Dal più recente. */
  presenze: PresenzaReferenza[];
}

/* ---------- Elenco: rete per insegna ---------- */

export interface ReteInsegne {
  anni: number[];
  insegne: Array<{
    canale: RiferimentoStoria;
    /** Punti vendita dell'anagrafica con questo canale oggi. */
    puntiVendita: number;
    /** Punti vendita diversi stampati nei volantini di questo canale, anno per anno. */
    nelleListe: Array<{ anno: number; puntiVendita: number }>;
  }>;
}

/** Sintesi per riga dell'elenco: insegna dei volantini anno per anno e numero di volantini. */
export interface StoriaInElenco {
  volantini: number;
  insegnePerAnno: Array<{ anno: number; canale: RiferimentoStoria | null }>;
  cambioInsegna: boolean;
}

/* ---------- Gestione ---------- */

export interface QualitaPuntiVendita {
  totale: number;
  senzaCoordinate: number;
  senzaCodice: number;
  righeDaRevisionare: number;
  conStoria: number;
  dispositiviOffline: number;
}

export type SuggerimentoRiga =
  | { tipo: 'stesso_telefono'; puntoVendita: { id: string; nome: string } }
  | { tipo: 'forse_chiuso' }
  | { tipo: 'da_aggiungere' };

/**
 * Perché un punto vendita dell'anagrafica è suggerito per una riga non abbinata, dal motivo più
 * forte. 'vicino': entro RAGGIO_VICINI_M dalla posizione della riga (trovata almeno a livello di
 * via). 'nome_simile': il nome o la ragione sociale del PV contiene la località o la via stampate.
 */
export type MotivoCandidato = 'stesso_telefono' | 'stesso_indirizzo' | 'indirizzo_simile' | 'vicino' | 'nome_simile' | 'stessa_localita';

/* ---------- Posizione delle righe e confronto con l'anagrafica ---------- */

/**
 * Quanto è precisa la posizione di una riga stampata: il civico, la sola via (il civico non è in
 * OpenStreetMap), il solo comune, oppure non trovata.
 */
export type PrecisionePosizione = 'civico' | 'via' | 'comune' | 'non_trovata';

/** Da dove viene la posizione: Nominatim (OpenStreetMap) o una correzione a mano (Google Maps). */
export type FontePosizione = 'nominatim' | 'manuale';

/** La posizione di una riga stampata, conservata per località e indirizzo. */
export interface PosizioneRiga {
  /** Identifica la posizione: si rimanda a PUT .../posizioni-righe per correggerla. */
  chiave: string;
  lat: number | null;
  lon: number | null;
  precisione: PrecisionePosizione;
  fonte: FontePosizione;
  /** L'ultimo errore di Nominatim, se la ricerca non è riuscita: si cerca di nuovo solo su richiesta. */
  errore: string | null;
  /** Data e ora ISO dell'ultima ricerca o correzione. */
  aggiornataIl: string;
}

/** Correzione a mano: coordinate incollate da Google Maps, come "lat, lon" o come link che le contiene. */
export interface CorrezionePosizione {
  chiave: string;
  lat: number;
  lon: number;
}

/** Canale e area di un volantino o di un punto vendita. */
export interface CombinazioneRiga {
  canale: RiferimentoStoria | null;
  area: RiferimentoStoria | null;
}

/**
 * Come un dato stampato nei volantini si confronta con l'anagrafica del PV. 'assente': manca da una
 * delle due parti, o non si può confrontare (una provincia scritta per esteso e l'altra in sigla).
 */
export type ConfrontoDato = 'uguale' | 'simile' | 'diverso' | 'assente';

export interface ConfrontoConPuntoVendita {
  telefono: ConfrontoDato;
  indirizzo: ConfrontoDato;
  localita: ConfrontoDato;
  provincia: ConfrontoDato;
  /** La combinazione canale/area del PV è quella di almeno uno dei volantini della riga. */
  stessaCombinazione: boolean;
  /** Metri fra la posizione della riga e le coordinate del PV; null se una delle due manca. */
  distanzaMetri: number | null;
}

/** Un punto vendita dell'anagrafica come compare nel collegamento e nella verifica. */
export interface PuntoVenditaConfrontato {
  id: string;
  nome: string;
  ragioneSociale: string | null;
  indirizzo: string | null;
  citta: string | null;
  provincia: string | null;
  telefono: string | null;
  lat: number | null;
  lon: number | null;
  combinazione: CombinazioneRiga;
}

/** Sotto questa distanza la posizione della riga e il PV coincidono. */
export const DISTANZA_COERENTE_M = 300;
/** Oltre questa distanza, con la posizione della via o del civico, il collegamento è incongruente. */
export const DISTANZA_INCONGRUENTE_M = 2000;
/** Oltre questa distanza, con la sola posizione del comune, il collegamento è incongruente. */
export const DISTANZA_INCONGRUENTE_COMUNE_M = 10000;
/** Raggio dei PV suggeriti per vicinanza e dei PV più vicini nella verifica. */
export const RAGGIO_VICINI_M = 2000;

/** Un punto vendita dell'anagrafica a cui collegare una riga non abbinata. */
export interface CandidatoCollegamento {
  puntoVendita: PuntoVenditaConfrontato;
  motivo: MotivoCandidato;
  confronto: ConfrontoConPuntoVendita;
}

/** Al massimo tanti candidati e tante varianti stampate per riga non abbinata. */
export const MASSIMO_CANDIDATI = 8;
export const MASSIMO_VARIANTI = 5;

export interface RigaNonAbbinata {
  /**
   * Identifica il gruppo di righe (stesso telefono, stessa località e indirizzo, o stesso testo):
   * si rimanda a .../collega per collegarle tutte a un punto vendita.
   */
  chiave: string;
  /** Una riga com'era stampata, la più recente. */
  riga: string;
  /** Le righe stampate diverse del gruppo, dalla più recente: un centralino può unire più negozi. */
  varianti: string[];
  localita: string | null;
  indirizzo: string | null;
  telefono: string | null;
  /** La provincia stampata nelle intestazioni della lista, se c'è. */
  provincia: string | null;
  volantini: number;
  primoVolantino: string;
  ultimoVolantino: string;
  canale: RiferimentoStoria | null;
  /** Canale e area dei volantini in cui compare: si collega solo a PV di una di queste combinazioni. */
  combinazioni: CombinazioneRiga[];
  /** La posizione della riga più recente; null se non ha né località né indirizzo. */
  posizione: PosizioneRiga | null;
  suggerimento: SuggerimentoRiga;
  /** Punti vendita dell'anagrafica a cui collegarla, dal motivo più forte, solo delle sue combinazioni. */
  candidati: CandidatoCollegamento[];
}

export interface PaginaRigheNonAbbinate {
  righe: RigaNonAbbinata[];
  totale: number;
  pagina: number;
  dimensione: number;
}

/** Un volantino in cui compare una riga non abbinata, con la riga com'era stampata lì. */
export interface VolantinoDellaRiga {
  idKit: string;
  titoloKit: string;
  promo: { id: string; nome: string } | null;
  /** Giorno dell'edizione (YYYY-MM-DD). */
  data: string;
  canale: RiferimentoStoria | null;
  area: RiferimentoStoria | null;
  rigaStampata: string;
}

export interface VolantiniRigaNonAbbinata {
  chiave: string;
  /** Dal più recente, uno per kit: gli stessi contati in RigaNonAbbinata.volantini. */
  volantini: VolantinoDellaRiga[];
}

/** Collega le righe del gruppo `chiave` (RigaNonAbbinata.chiave) a un punto vendita della GDO. */
export interface RichiestaCollegamento {
  chiave: string;
  idPuntoVendita: string;
}

export interface EsitoCollegamento {
  /** Il collegamento salvato: vale anche per i volantini sincronizzati di nuovo o futuri. */
  idCollegamento: string;
  /** Righe dei volantini ora collegate a mano al punto vendita. */
  righe: number;
}

/** Un collegamento fatto a mano: una regola della GDO, non una modifica dell'anagrafica. */
export interface CollegamentoManuale {
  id: string;
  /** La riga com'era stampata quando è stata collegata. */
  riga: string;
  puntoVendita: { id: string; nome: string; indirizzo: string | null; citta: string | null };
  /** Righe dei volantini collegate oggi grazie a questo collegamento. */
  righe: number;
  /** Data e ora ISO. */
  creatoIl: string;
}

export interface PaginaCollegamentiManuali {
  collegamenti: CollegamentoManuale[];
  totale: number;
  pagina: number;
  dimensione: number;
}

export interface EsitoScollegamento {
  /** Righe tolte al punto vendita: tornano all'abbinamento automatico. */
  righe: number;
}

/* ---------- Verifica e cambio dei collegamenti ---------- */

export type EsitoVerifica = 'coerente' | 'da_verificare' | 'incongruente';

export const ESITI_VERIFICA: readonly EsitoVerifica[] = ['incongruente', 'da_verificare', 'coerente'];

/** Collegati a mano o abbinati automaticamente (telefono, indirizzo, probabile). */
export type TipoCollegamento = 'manuale' | 'automatico';

export type TipoMotivoVerifica =
  | 'combinazione_diversa'
  | 'distanza'
  | 'stesso_volantino'
  | 'localita_diversa'
  | 'piu_vicino'
  | 'probabile'
  | 'telefono_e_indirizzo_diversi'
  | 'posizione_mancante'
  | 'coordinate_pv_mancanti';

/** Perché un gruppo ha il suo esito; 'informazione' non lo cambia. */
export interface MotivoVerifica {
  tipo: TipoMotivoVerifica;
  livello: 'incongruente' | 'da_verificare' | 'informazione';
  testo: string;
  /** Il PV più vicino ('piu_vicino'). */
  puntoVendita?: { id: string; nome: string };
}

/** Un PV della stessa combinazione vicino alla posizione della riga. */
export interface PuntoVenditaVicino {
  puntoVendita: PuntoVenditaConfrontato;
  metri: number;
}

/** Un gruppo di righe dei volantini collegato a un punto vendita, con la verifica del collegamento. */
export interface GruppoCollegato {
  /** Una chiave del gruppo: si rimanda a PUT .../collegamenti/cambia per cambiare il PV. */
  chiave: string;
  riga: string;
  varianti: string[];
  localita: string | null;
  indirizzo: string | null;
  telefono: string | null;
  provincia: string | null;
  volantini: number;
  primoVolantino: string;
  ultimoVolantino: string;
  combinazioni: CombinazioneRiga[];
  /** Tipo del collegamento: 'manuale' se almeno una riga del gruppo è collegata a mano. */
  tipo: TipoCollegamento;
  /** Gli abbinamenti delle sue righe, per esempio ['telefono', 'probabile']. */
  abbinamenti: TipoAbbinamento[];
  /** Il collegamento fatto a mano che le collega, se c'è: si può annullare. */
  idCollegamento: string | null;
  posizione: PosizioneRiga | null;
  puntoVendita: PuntoVenditaConfrontato;
  confronto: ConfrontoConPuntoVendita;
  esito: EsitoVerifica;
  motivi: MotivoVerifica[];
  /** Fino a 3 PV della stessa combinazione entro RAGGIO_VICINI_M dalla posizione della riga, dal più vicino. */
  vicini: PuntoVenditaVicino[];
  /** I PV a cui cambiare il collegamento, come per una riga non abbinata, senza quello di oggi. */
  candidati: CandidatoCollegamento[];
}

export interface PaginaVerificaCollegamenti {
  gruppi: GruppoCollegato[];
  totale: number;
  pagina: number;
  dimensione: number;
  /** Gruppi per esito, con il filtro sul tipo ma senza quello sull'esito. */
  conteggi: Record<EsitoVerifica, number>;
  /** Posizioni delle righe (collegate e non abbinate) mai cercate: la ricerca le trova. */
  posizioniDaCercare: number;
  /** Posizioni non trovate o in errore: si cercano di nuovo solo su richiesta. */
  posizioniNonTrovate: number;
}

/** Cambia il PV del gruppo `chiave` (GruppoCollegato.chiave) oggi collegato a idPuntoVenditaAttuale. */
export interface RichiestaCambioCollegamento {
  chiave: string;
  idPuntoVenditaAttuale: string;
  idPuntoVendita: string;
}

/** Avvio della ricerca delle posizioni; con nonTrovate cerca di nuovo anche quelle non trovate o in errore. */
export interface RichiestaRicercaPosizioni {
  nonTrovate?: boolean;
}

export interface StatoRicercaPosizioni {
  jobId: string;
  stato: 'in_corso' | 'completato' | 'annullato' | 'errore';
  totale: number;
  esaminate: number;
  trovate: number;
  /** Trovate a livello di via o di comune: il civico non c'è in OpenStreetMap. */
  approssimate: number;
  nonTrovate: number;
  errori: number;
  ultimoErrore?: string;
  avviatoIl: string;
  terminatoIl?: string;
}
