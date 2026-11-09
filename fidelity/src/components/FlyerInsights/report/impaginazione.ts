import type { GraficoSezione, SezioneReport } from "../../../../lib/insightVolantino/report";
import {
  ALTEZZA_INTESTAZIONE_SEGUE,
  ALTEZZA_INTESTAZIONE_SEZIONE,
  ALTEZZA_UTILE,
  CELLA,
  COLONNA_LEGENDA,
  CORPO,
  INTERLINEA,
  LARGHEZZA_UTILE,
  SPAZIO_COLONNE,
} from "./misure";

/**
 * Impaginazione del report PDF: quante righe di tabella per pagina, quali grafici stanno insieme,
 * quanto spazio prende un testo. @react-pdf va a capo da solo, ma non ripete l'intestazione di una
 * tabella: le pagine delle tabelle le decidiamo qui, con una stima prudente dell'altezza delle righe.
 * Funzioni pure.
 */

/** Larghezza media di un carattere di Noto Sans, in frazioni del corpo (prudente: un po' larga). */
const LARGHEZZA_CARATTERE = 0.55;

/** Righe che occupa un testo largo al massimo `larghezza` pt, andando a capo fra le parole. */
export function righeTesto(testo: string, larghezza: number, corpo: number): number {
  const perRiga = Math.max(1, Math.floor(larghezza / (corpo * LARGHEZZA_CARATTERE)));
  let righe = 0;
  for (const paragrafo of testo.split("\n")) {
    let occupati = 0;
    let righeParagrafo = 1;
    for (const parola of paragrafo.split(/\s+/).filter(Boolean)) {
      const lunghezza = parola.length;
      if (occupati === 0) {
        righeParagrafo += Math.floor(Math.max(0, lunghezza - 1) / perRiga);
        occupati = lunghezza % perRiga || perRiga;
      } else if (occupati + 1 + lunghezza <= perRiga) {
        occupati += 1 + lunghezza;
      } else {
        righeParagrafo += 1 + Math.floor(Math.max(0, lunghezza - 1) / perRiga);
        occupati = lunghezza % perRiga || perRiga;
      }
    }
    righe += righeParagrafo;
  }
  return Math.max(1, righe);
}

/** Altezza in pt di un testo di `corpo` e interlinea date, largo al massimo `larghezza`. */
export const altezzaTesto = (testo: string, larghezza: number, corpo: number, interlinea: number = INTERLINEA.normale): number =>
  righeTesto(testo, larghezza, corpo) * corpo * interlinea;

// ─── Tabelle ────────────────────────────────────────────────────────

export interface ColonnaTabella {
  titolo: string;
  allinea: "sinistra" | "destra";
}

/**
 * Larghezze delle colonne in pt, che sommano a `totale`: proporzionali al testo piu' lungo della
 * colonna (intestazione compresa), con un minimo per le colonne di numeri e un massimo per quelle
 * di testo, cosi' una descrizione lunga va a capo invece di schiacciare le altre.
 */
export function larghezzeColonne(colonne: readonly ColonnaTabella[], righe: readonly string[][], totale: number): number[] {
  if (colonne.length === 0) return [];
  const pesi = colonne.map((colonna, indice) => {
    let massimo = Math.ceil(colonna.titolo.length * 0.85);
    for (const riga of righe) massimo = Math.max(massimo, (riga[indice] ?? "").length);
    return colonna.allinea === "destra" ? Math.min(14, Math.max(6, massimo)) : Math.min(34, Math.max(8, massimo));
  });
  const somma = pesi.reduce((a, b) => a + b, 0);
  const larghezze = pesi.map((peso) => (peso / somma) * totale);
  // Arrotondate a 0,01 pt; l'ultima colonna prende lo scarto, cosi' la somma resta esatta
  const arrotondate = larghezze.map((larghezza) => Math.round(larghezza * 100) / 100);
  const scarto = totale - arrotondate.reduce((a, b) => a + b, 0);
  arrotondate[arrotondate.length - 1] = Math.round((arrotondate[arrotondate.length - 1] + scarto) * 100) / 100;
  return arrotondate;
}

/** Altezza stimata di una riga di tabella: la cella che va piu' a capo, piu' il padding. */
export function altezzaRigaTabella(celle: readonly string[], larghezze: readonly number[], corpo: number = CORPO.tabella): number {
  let righe = 1;
  celle.forEach((testo, indice) => {
    const utile = Math.max(10, (larghezze[indice] ?? 40) - 2 * CELLA.paddingOrizzontale);
    righe = Math.max(righe, righeTesto(testo ?? "", utile, corpo));
  });
  return righe * corpo * INTERLINEA.stretta + 2 * CELLA.paddingVerticale + 1;
}

/** Altezza dell'intestazione della tabella (etichette maiuscole su una o due righe). */
export function altezzaIntestazioneTabella(colonne: readonly ColonnaTabella[], larghezze: readonly number[]): number {
  return altezzaRigaTabella(
    colonne.map((colonna) => colonna.titolo.toUpperCase()),
    larghezze,
    CORPO.etichetta + 0.6
  );
}

export interface PaginaTabella {
  /** Indici delle righe [inizio, fine). */
  inizio: number;
  fine: number;
}

export interface SpazioTabella {
  /** Spazio per le righe nella prima pagina (dopo titolo, introduzione e intestazione). */
  primaPagina: number;
  /** Spazio per le righe nelle pagine successive (dopo l'intestazione ridotta e quella della tabella). */
  altrePagine: number;
}

/**
 * Pagine di una tabella: ogni pagina prende le righe che entrano nel suo spazio, almeno una (una
 * riga piu' alta della pagina sta da sola). Senza righe c'e' comunque una pagina, vuota.
 */
export function impaginaTabella(altezzeRighe: readonly number[], spazio: SpazioTabella): PaginaTabella[] {
  const pagine: PaginaTabella[] = [];
  let inizio = 0;
  while (inizio < altezzeRighe.length || pagine.length === 0) {
    const disponibile = pagine.length === 0 ? spazio.primaPagina : spazio.altrePagine;
    let fine = inizio;
    let occupato = 0;
    while (fine < altezzeRighe.length && (fine === inizio || occupato + altezzeRighe[fine] <= disponibile)) {
      occupato += altezzeRighe[fine];
      fine += 1;
    }
    pagine.push({ inizio, fine });
    if (fine >= altezzeRighe.length) break;
    inizio = fine;
  }
  return pagine;
}

/** Riga "Continua nella pagina seguente" sotto una pagina di tabella che prosegue. */
const RIGA_CONTINUA = CORPO.nota * INTERLINEA.normale + 6;

/**
 * Spazio per le righe: la pagina meno intestazione della sezione (con l'introduzione) o quella
 * ridotta, intestazione della tabella e piede (nota o rimando alla pagina seguente).
 */
export function spazioTabella(
  sezione: Extract<SezioneReport, { tipo: "tabella" }>,
  larghezze: readonly number[],
  larghezzaUtile: number,
  altezzaUtile: number = ALTEZZA_UTILE
): SpazioTabella {
  const intestazione = altezzaIntestazioneTabella(sezione.colonne, larghezze);
  const introduzione = sezione.introduzione ? altezzaTesto(sezione.introduzione, Math.min(larghezzaUtile, 400), CORPO.corpo) + 14 : 0;
  // Sotto l'ultima riga c'e' la nota, sotto le altre "Continua nella pagina seguente": lo spazio del
  // piu' alto dei due si toglie a tutte le pagine, per non doverli rincorrere
  const nota = sezione.nota ? altezzaTesto(sezione.nota, larghezzaUtile, CORPO.nota) + 10 : 0;
  const piede = Math.max(nota, RIGA_CONTINUA) + 2;
  return {
    primaPagina: altezzaUtile - ALTEZZA_INTESTAZIONE_SEZIONE - introduzione - intestazione - piede,
    altrePagine: altezzaUtile - ALTEZZA_INTESTAZIONE_SEGUE - intestazione - piede,
  };
}

// ─── Grafici ────────────────────────────────────────────────────────

/** Oltre queste voci un grafico a barre (o il confronto oltre la meta') prende una pagina intera. */
export const VOCI_MEZZA_PAGINA = 12;

/** Quante righe disegna un grafico. */
export function vociGrafico(grafico: GraficoSezione["grafico"]): number {
  if (grafico.forma === "confronto") return grafico.voci.length * 2;
  return grafico.voci.length;
}

/** Un grafico che non sta in mezza pagina. */
export const graficoGrande = (grafico: GraficoSezione): boolean =>
  grafico.grafico.forma !== "ciambella" && vociGrafico(grafico.grafico) > VOCI_MEZZA_PAGINA;

/**
 * Grafici di ogni pagina, nell'ordine ricevuto: al massimo due per pagina; un grafico grande sta da
 * solo.
 */
export function gruppiGrafici(grafici: readonly GraficoSezione[]): GraficoSezione[][] {
  const gruppi: GraficoSezione[][] = [];
  let corrente: GraficoSezione[] = [];
  for (const grafico of grafici) {
    if (graficoGrande(grafico)) {
      if (corrente.length > 0) gruppi.push(corrente);
      gruppi.push([grafico]);
      corrente = [];
      continue;
    }
    corrente.push(grafico);
    if (corrente.length === 2) {
      gruppi.push(corrente);
      corrente = [];
    }
  }
  if (corrente.length > 0) gruppi.push(corrente);
  return gruppi;
}

/** Riquadri degli indicatori per riga: tutti su una riga fino a quattro, poi tre o quattro. */
export function indicatoriPerRiga(quanti: number): number {
  if (quanti <= 1) return 1;
  if (quanti <= 4) return quanti;
  if (quanti <= 6) return 3;
  return 4;
}

// ─── Pagine del volantino ───────────────────────────────────────────

/** La pagina del volantino piu' grande che entra nel riquadro, con le sue proporzioni. */
export function misuraNelRiquadro(proporzione: number, larghezzaMassima: number, altezzaMassima: number): { larghezza: number; altezza: number } {
  const valida = Number.isFinite(proporzione) && proporzione > 0 ? proporzione : 210 / 297;
  let larghezza = larghezzaMassima;
  let altezza = larghezza / valida;
  if (altezza > altezzaMassima) {
    altezza = altezzaMassima;
    larghezza = altezza * valida;
  }
  return { larghezza: Math.round(larghezza * 100) / 100, altezza: Math.round(altezza * 100) / 100 };
}

/** Riga con il numero della pagina sopra il foglio e didascalia sotto. */
const RIGA_NUMERO_PAGINA = 30;
const DIDASCALIA_FOGLIO = 18;
/** Spazio sotto il foglio per legenda e box in evidenza quando la pagina e' orizzontale. */
export const SPAZIO_SOTTO_ORIZZONTALE = 230;

export interface RiquadroPagina {
  larghezza: number;
  altezza: number;
  /** Pagina piu' larga che alta: legenda ed elenco vanno sotto invece che a lato. */
  orizzontale: boolean;
}

/**
 * Misura della pagina del volantino in una pagina del report, dopo l'intestazione: verticale accanto
 * alla colonna della legenda, orizzontale a tutta larghezza con la legenda sotto.
 */
export function riquadroPaginaVolantino(proporzione: number, altezzaIntestazione: number): RiquadroPagina {
  const disponibile = ALTEZZA_UTILE - altezzaIntestazione - RIGA_NUMERO_PAGINA - DIDASCALIA_FOGLIO;
  const orizzontale = proporzione > 1.05;
  if (orizzontale) {
    return { ...misuraNelRiquadro(proporzione, LARGHEZZA_UTILE, disponibile - SPAZIO_SOTTO_ORIZZONTALE), orizzontale };
  }
  return { ...misuraNelRiquadro(proporzione, LARGHEZZA_UTILE - COLONNA_LEGENDA - SPAZIO_COLONNE, disponibile), orizzontale };
}

/** Riga dell'elenco dei box in evidenza (nome e dettaglio su una riga ciascuno). */
export const RIGA_EVIDENZA = 30;
/** Misura, descrizione, scala e titoli dell'elenco nella colonna accanto alla pagina. */
const INGOMBRO_MISURA = 196;

/**
 * Quanti box in evidenza entrano nell'elenco accanto (o sotto) alla pagina: lo stesso numero si
 * disegna sul foglio, cosi' i numeri restano uno per riga. Almeno tre.
 */
export function capienzaEvidenza(riquadro: RiquadroPagina): number {
  const spazio = riquadro.orizzontale ? SPAZIO_SOTTO_ORIZZONTALE - 46 : riquadro.altezza + DIDASCALIA_FOGLIO - INGOMBRO_MISURA;
  return Math.max(3, Math.floor(spazio / RIGA_EVIDENZA));
}
