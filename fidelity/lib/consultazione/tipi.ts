import type { FasciaSconto, QuotaSpazio } from '../insightVolantino/tipi';
import type { Riferimento } from '../materiali/tipi';
import type { MeccanicaReferenza } from '../puntiVendita/analisi';
import type { PeriodoConsultazione } from './periodi';
import type { CodiceRegione } from './regioni';

/**
 * Contratto delle API di consultazione (/api/consultazione), usate dalle pagine di Visualizzazione.
 *
 * Solo materiali pubblicati della GDO della sessione (Superadmin e Agenzia senza GDO: tutte), di
 * promo non eliminate. Nessun dato di lavorazione: niente stato dei kit, log e versioni dei file,
 * direttive, stato della promo. Nessuna chiamata a Istanta: tutto viene dal database di Fidelity.
 * I file si scaricano da /api/consultazione/file/:id con "materiali.scarica".
 */

export type { Riferimento };

/** Promozione di un materiale pubblicato. Le date sono giorni del calendario italiano (YYYY-MM-DD). */
export interface PromoConsultazione {
  id: string;
  nome: string;
  validitaDal: string | null;
  validitaAl: string | null;
}

/** File pubblicato di un kit. */
export interface FileConsultazione {
  /** Id del file (files_runtime): si scarica da percorsoFileConsultazione(id). */
  id: string;
  nome: string;
  /** Codice del tipo di export (VOL, WEB...), se noto. */
  tipoExport: string | null;
  mime: string | null;
  pagine: number | null;
  /** Miniatura servita dal proxy di Olimpo, se il file sta su Olimpo. */
  anteprima: string | null;
}

/* ---------- Volantini ---------- */

/** Kit volantino pubblicato, con la copertina (il PDF del volantino, se c'e'). */
export interface VolantinoConsultazione {
  id: string;
  titolo: string;
  promo: PromoConsultazione;
  area: Riferimento;
  canale: Riferimento;
  /** File del kit, senza quelli dell'export Correggo. */
  numeroFile: number;
  copertina: FileConsultazione | null;
}

export interface FiltriVolantiniConsultazione {
  periodo: PeriodoConsultazione;
  /** Nel titolo del kit o nel nome della promozione. */
  cerca?: string;
  idPromo?: string;
  idArea?: string;
  idCanale?: string;
  pagina?: number;
  dimensione?: number;
}

/** Kit dalla promo con la validita' piu' recente, poi per nome della promo e titolo. */
export interface PaginaVolantiniConsultazione {
  kit: VolantinoConsultazione[];
  totale: number;
  pagina: number;
  dimensione: number;
}

export const DIMENSIONE_PAGINA_VOLANTINI_CONSULTAZIONE = 24;
export const DIMENSIONE_MASSIMA_VOLANTINI_CONSULTAZIONE = 200;

/** Variante del volantino di una promozione: un kit pubblicato per canale e area. */
export interface VarianteConsultazione {
  id: string;
  titolo: string;
  area: Riferimento;
  canale: Riferimento;
  numeroFile: number;
  /** Punti vendita diversi della lista stampata nel volantino (chiavePuntoVenditaStampato). */
  numeroPuntiVendita: number;
  copertina: FileConsultazione | null;
}

export interface PromozioneVolantiniConsultazione {
  promo: PromoConsultazione;
  /** Copertina di un kit mostrato, altrimenti di un altro kit della promo. */
  copertina: FileConsultazione | null;
  /** Kit pubblicati della promo, anche quelli esclusi dai filtri. */
  numeroKit: number;
  /** Solo i kit che corrispondono ai filtri. */
  kit: VarianteConsultazione[];
  /**
   * Punti vendita diversi stampati nei kit mostrati: uno stampato in piu' kit conta una volta
   * (chiavePuntoVenditaStampato). 0 quando le liste non sono arrivate.
   */
  numeroPuntiVendita: number;
}

export interface FiltriPromozioniVolantiniConsultazione {
  periodo: PeriodoConsultazione;
  cerca?: string;
  idPromo?: string;
  idArea?: string;
  idCanale?: string;
  /** Anno dell'inizio di validita' della promo. */
  anno?: number;
  pagina?: number;
  /** 12, 24 o 48 promozioni. */
  dimensione?: number;
}

/**
 * Perche' una promozione e' in vetrina (spec volantini-pop, "Promozione in vetrina"):
 * - piu_punti_vendita: negli Attivi, la promo con piu' punti vendita diversi stampati nei volantini;
 * - prima_a_partire: nei Prossimi, la promo con l'inizio di validita' piu' vicino.
 */
export type MotivoVetrina = 'piu_punti_vendita' | 'prima_a_partire';

/** Lo Storico non ha la vetrina: tutte le promozioni concluse stanno fra le schede. */
export const MOTIVO_VETRINA_DEL_PERIODO: Readonly<Partial<Record<PeriodoConsultazione, MotivoVetrina>>> = {
  attivi: 'piu_punti_vendita',
  prossimi: 'prima_a_partire',
};

/** La promozione in vetrina, con tutti i suoi kit volantino pubblicati. */
export interface VetrinaVolantiniConsultazione {
  motivo: MotivoVetrina;
  promozione: PromozioneVolantiniConsultazione;
}

/**
 * Il periodo senza filtri: promozioni, kit volantino pubblicati e punti vendita diversi stampati nei
 * volantini; uno stampato in piu' kit o in piu' promozioni conta una volta.
 */
export interface RiepilogoPeriodoVolantiniConsultazione {
  promozioni: number;
  kit: number;
  puntiVendita: number;
}

export interface PaginaPromozioniVolantiniConsultazione {
  /** Senza la promozione in vetrina, quando c'e'. */
  promozioni: PromozioneVolantiniConsultazione[];
  /** Promozioni che corrispondono ai filtri, senza quella in vetrina: e' il totale della paginazione. */
  totale: number;
  totaleKit: number;
  /** Promozioni del periodo senza filtri, compresa quella in vetrina: 0 vuol dire periodo vuoto. */
  totaleSenzaFiltri: number;
  pagina: number;
  dimensione: number;
  /**
   * Solo negli Attivi e nei Prossimi senza filtri (ne' cerca, ne' promo, area, canale, anno); null
   * altrimenti, con il periodo vuoto e sempre nello Storico.
   */
  vetrina: VetrinaVolantiniConsultazione | null;
  /** Sempre senza filtri. */
  riepilogo: RiepilogoPeriodoVolantiniConsultazione;
  /**
   * Valori dei soli kit pubblicati del periodo, mai delle combinazioni canale/area senza kit.
   * Aree, canali e anni sono incrociati: ciascuno con la ricerca, la promo e gli altri filtri, non
   * con il proprio (le aree tengono conto del canale e dell'anno, non dell'area scelta).
   */
  opzioni: {
    promozioni: Riferimento[];
    aree: Riferimento[];
    canali: Riferimento[];
    anni: number[];
  };
}

/* ---------- Dettaglio di consultazione della promozione ---------- */

/**
 * GET /api/consultazione/volantini/promozioni/:idPromo con "materiali.visualizza".
 * Spec volantini-pop, "Dettaglio di consultazione della promozione": solo i kit volantino PUBBLICATI
 * della promo, della GDO della sessione (Superadmin e Agenzia: tutte). Una promo di un'altra GDO,
 * eliminata o senza kit volantino pubblicati risponde 404. Niente stato di lavorazione, file,
 * vendite, previsioni, calore o visibilita' stimata. Nessuna chiamata a Istanta.
 */

/** Un kit volantino pubblicato della promozione, con i numeri dei suoi insight. */
export interface KitPromozioneConsultazione extends VarianteConsultazione {
  /** Referenze stampate (sintesi degli insight del kit). */
  referenze: number;
  box: number;
  pagine: number;
  /** Media degli sconti dei box che ne hanno uno, in %. */
  scontoMedio: number | null;
  /** % dei box con meccanica fidelity. */
  quotaFidelity: number;
  /** Box in sottocosto. */
  sottocosto: number;
}

export interface NumeriPromozioneConsultazione {
  kit: number;
  /** Pagine sommate sui kit. */
  pagine: number;
  /** Punti vendita diversi stampati nei volantini: uno stampato in piu' kit conta una volta. */
  puntiVendita: number;
  /** Localita' diverse dei punti vendita, senza distinguere maiuscole e spazi. */
  localita: number;
  /** Regioni diverse dei punti vendita con la regione nota. */
  regioni: number;
  /** Prodotti diversi: chiavi dei prodotti pilota dei box, su tutti i kit. */
  prodotti: number;
  /** Referenze stampate sommate sui kit. */
  referenze: number;
  /** Media degli sconti di tutti i box che ne hanno uno, in %. */
  scontoMedio: number | null;
  /** Box in sottocosto sommati sui kit. */
  sottocosto: number;
}

/**
 * Un punto vendita stampato nelle liste dei volantini della promozione, una volta sola anche se lo
 * stampano piu' kit (chiavePuntoVenditaStampato, lib/consultazione/puntiVenditaStampati.ts). Testo,
 * localita' e indirizzo sono quelli della sua prima riga.
 */
export interface PuntoVenditaPromozioneConsultazione {
  /** Id della prima riga del punto vendita (punti_vendita_volantino.id). */
  id: string;
  /** I kit che lo stampano, nell'ordine dei kit del dettaglio. */
  idKit: string[];
  /** La riga come era stampata. */
  riga: string;
  localita: string | null;
  indirizzo: string | null;
  /** Regione normalizzata (lib/consultazione/regioni.ts); null quando non si ricava. */
  regione: CodiceRegione | null;
  /** Il punto vendita dell'anagrafica a cui e' abbinata la prima riga che ne ha uno, se c'e'. */
  puntoVendita: {
    id: string;
    nome: string;
    coordinate: { lat: number; lon: number } | null;
  } | null;
}

/** Prodotti diversi della promozione secondo in quanti kit compaiono. */
export interface ProdottiComuniLocali {
  /** In tutti i kit; 0 con un solo kit. */
  inTutti: number;
  /** In piu' di un kit ma non in tutti. */
  inAlcuni: number;
  /** In un solo kit (con un solo kit: tutti). */
  inUnoSolo: number;
}

export interface QuotaMeccanica {
  /** null: meccanica non riconosciuta. */
  meccanica: MeccanicaReferenza | null;
  etichetta: string;
  box: number;
  /** % dei box del canale. */
  quota: number;
}

export interface MeccanichePerCanale {
  canale: Riferimento;
  box: number;
  /** Nell'ordine di MECCANICHE, poi la meccanica non riconosciuta; solo quelle con box. */
  quote: QuotaMeccanica[];
}

export interface MarcaPromozione {
  nome: string;
  box: number;
  /** % dello spazio di tutti i box della promozione. */
  quotaSpazio: number;
  scontoMedio: number | null;
}

export interface AssortimentoPromozioneConsultazione {
  prodotti: ProdottiComuniLocali;
  /** Box di tutti i kit per fascia di sconto (FASCE_SCONTO). */
  fasceSconto: FasciaSconto[];
  /** Per reparto, su tutti i box dei kit; ordinati per spazio. */
  reparti: QuotaSpazio[];
  /** Nell'ordine dei canali dei kit. */
  meccanichePerCanale: MeccanichePerCanale[];
  /** Le marche con piu' spazio, al massimo MAX_MARCHE_PROMOZIONE, senza "marca non indicata". */
  marche: MarcaPromozione[];
}

export const MAX_MARCHE_PROMOZIONE = 8;

/**
 * Filtri del dettaglio della promozione (?idArea=&idCanale=): i kit di un'area e/o di un'insegna, che
 * e' il canale del kit. Numeri, punti vendita e assortimento si contano sui soli kit che corrispondono.
 */
export interface FiltriDettaglioPromozioneVolantini {
  idArea?: string;
  idCanale?: string;
}

/** Insegne (canali) e aree dei kit pubblicati della promozione, per nome. */
export interface OpzioniDettaglioPromozioneVolantini {
  /** Con il filtro sull'area, non con quello sull'insegna. */
  insegne: Riferimento[];
  /** Con il filtro sull'insegna, non con quello sull'area. */
  aree: Riferimento[];
}

export interface DettaglioPromozioneVolantiniConsultazione {
  promo: PromoConsultazione;
  /** Periodo in cui si consulta la promo, dal suo stato. */
  periodo: PeriodoConsultazione;
  /**
   * I kit che corrispondono ai filtri, ordinati per nome del canale, poi dell'area, poi titolo.
   * Vuoto quando insegna e area scelte insieme non hanno kit: la promo esiste comunque.
   */
  kit: KitPromozioneConsultazione[];
  /** Kit volantino pubblicati della promozione, anche quelli esclusi dai filtri. */
  numeroKitTotale: number;
  /** Tutte le insegne (canali) dei kit pubblicati della promozione, per nome: i colori non cambiano con i filtri. */
  insegne: Riferimento[];
  opzioni: OpzioniDettaglioPromozioneVolantini;
  /**
   * URL del logo di ogni insegna della promozione che ne ha uno, per id del canale: dai Loghi delle
   * insegne delle Impostazioni GDO, prima quello della sola insegna (senza area ne' punto vendita).
   */
  loghiInsegne: Record<string, string>;
  numeri: NumeriPromozioneConsultazione;
  /** Un elemento per punto vendita, nell'ordine in cui compare per primo: per kit (come `kit`) e posizione nella lista stampata. */
  puntiVendita: PuntoVenditaPromozioneConsultazione[];
  assortimento: AssortimentoPromozioneConsultazione;
}

/** Dettaglio di un kit pubblicato, con i suoi file (senza quelli dell'export Correggo). */
export interface DettaglioVolantinoConsultazione {
  id: string;
  titolo: string;
  promo: PromoConsultazione;
  area: Riferimento;
  canale: Riferimento;
  file: FileConsultazione[];
}

/* ---------- POP ---------- */

export interface PromoPopConsultazione extends PromoConsultazione {
  numeroFile: number;
  numeroFormati: number;
}

export interface ElencoPromozioniPopConsultazione {
  promozioni: PromoPopConsultazione[];
}

export interface KitPopConsultazione {
  id: string;
  titolo: string;
  area: Riferimento;
  canale: Riferimento;
  numeroFile: number;
}

export interface FormatoPopConsultazione {
  id: string;
  nome: string;
  numeroFile: number;
  kit: KitPopConsultazione[];
}

export interface RiepilogoPopConsultazione {
  promo: PromoConsultazione;
  totali: { file: number; formati: number };
  formati: FormatoPopConsultazione[];
}

export interface FilePopConsultazione extends FileConsultazione {
  kit: { id: string; titolo: string };
  area: Riferimento;
  canale: Riferimento;
  referenza: { codice: string | null; descrizione: string | null } | null;
  reparto: string | null;
}

/** Filtri dei file di un formato: senza stato, che e' un dato della lavorazione. */
export interface FiltriFilePopConsultazione {
  periodo: PeriodoConsultazione;
  idFormato: string;
  /** Nel nome del file, nel codice o nella descrizione della referenza. */
  cerca?: string;
  idArea?: string;
  idCanale?: string;
  reparto?: string;
  pagina?: number;
  /** 100, 250 o 500 righe. */
  dimensione?: number;
}

export interface PaginaFilePopConsultazione {
  file: FilePopConsultazione[];
  totale: number;
  pagina: number;
  dimensione: number;
}

export interface OpzioniFilePopConsultazione {
  aree: Riferimento[];
  canali: Riferimento[];
  reparti: string[];
}

export type FiltriZipPopConsultazione = Pick<FiltriFilePopConsultazione, 'cerca' | 'idArea' | 'idCanale' | 'reparto'>;

/** I file scelti (idFile) oppure tutti i file del formato che corrispondono ai filtri. */
export interface RichiestaZipPopConsultazione {
  periodo: PeriodoConsultazione;
  idFormato: string;
  idFile?: string[];
  filtri?: FiltriZipPopConsultazione;
}

export interface VerificaZipPopConsultazione {
  file: number;
  nomeFile: string;
}

/* ---------- Contenuti digitali ---------- */

/** File di un kit manuale pubblicato. */
export interface ContenutoDigitale extends FileConsultazione {
  kit: { id: string; titolo: string };
  promo: PromoConsultazione;
  area: Riferimento;
  canale: Riferimento;
  formato: Riferimento;
}

export interface FiltriContenutiDigitali {
  /** Nel nome del file, nel titolo del kit o nei campi dei file configurati per la ricerca. */
  cerca?: string;
  idPromo?: string;
  /** Id del tipo di export. */
  idTipoExport?: string;
  idFormato?: string;
  idArea?: string;
  idCanale?: string;
  pagina?: number;
  dimensione?: number;
}

/** File dalla promo con la validita' piu' recente, poi per kit e nome. */
export interface PaginaContenutiDigitali {
  file: ContenutoDigitale[];
  totale: number;
  pagina: number;
  dimensione: number;
}

export const DIMENSIONE_PAGINA_CONTENUTI_DIGITALI = 10;
export const DIMENSIONE_MASSIMA_CONTENUTI_DIGITALI = 100;

/** Valori dei filtri: solo quelli dei contenuti consultabili, per nome (le promo dalla piu' recente). */
export interface OpzioniContenutiDigitali {
  promozioni: Riferimento[];
  tipiExport: Riferimento[];
  formati: Riferimento[];
  aree: Riferimento[];
  canali: Riferimento[];
}
