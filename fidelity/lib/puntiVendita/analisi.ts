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
 * - GET /api/punti-vendita/:id/volantini/:idKit                -> DettaglioVolantinoPv (il kit deve essere nella storia del PV)
 * - GET /api/punti-vendita/:id/referenze/:chiave               -> DettaglioReferenzaPv (chiave di ProdottoRicorrente/ReferenzaSintesi)
 * - GET /api/punti-vendita/rete/insegne                        -> ReteInsegne
 * - GET /api/punti-vendita/gestione/qualita                    "gdo.gestisci_punti_vendita" -> QualitaPuntiVendita
 * - GET /api/punti-vendita/gestione/righe-non-abbinate         "gdo.gestisci_punti_vendita" pagina, dimensione -> PaginaRigheNonAbbinate
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

export interface RigaNonAbbinata {
  /** Una riga com'era stampata, la più recente. */
  riga: string;
  localita: string | null;
  indirizzo: string | null;
  telefono: string | null;
  volantini: number;
  primoVolantino: string;
  ultimoVolantino: string;
  canale: RiferimentoStoria | null;
  suggerimento: SuggerimentoRiga;
}

export interface PaginaRigheNonAbbinate {
  righe: RigaNonAbbinata[];
  totale: number;
  pagina: number;
  dimensione: number;
}
