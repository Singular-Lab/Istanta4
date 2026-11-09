import {
  affidabilitaDaCasi,
  type CasoSimile,
  type PrevisioneBox,
  type PrevisioneVolantino,
  REGOLE_PREVISIONE_STANDARD,
  type RegolePrevisione,
  type RichiestaSimulazione,
  type SimulazioneProdotto,
  type TipoPrevisione,
} from '../../../lib/insightVolantino/rendimento';
import { type BoxInsight, FASCE_SCONTO, PESI_VISIBILITA, type PesiVisibilita, pesoPagina, pesoPosizione } from '../../../lib/insightVolantino/tipi';
import type { VenditeBox } from './rendimentoInsight';

/**
 * Previsione della mappa di calore e simulazione di un prodotto (contratto in
 * lib/insightVolantino/rendimento.ts, spec insight-volantino). Funzioni pure: lo storico arriva gia'
 * letto (InsightVenditeService), le regole e i pesi sono quelli della libreria agenzia del cliente.
 *
 * Il modello e' trasparente, fatto di quattro numeri che si possono spiegare a un category manager.
 *
 * Con le vendite delle edizioni precedenti (tipo 'vendite'), della stessa GDO, area e canale:
 * 1. posizione: per ogni tipo di pagina (copertina, prima doppia pagina, ultima, altre) e fascia
 *    verticale (alto, centro, basso) si confrontano le vendite dei box che ci sono stati con le
 *    vendite tipiche del loro prodotto: 1,8 vuol dire che li' i prodotti vendono l'80% piu' del solito;
 * 2. sconto: lo stesso confronto per fascia di sconto (FASCE_SCONTO), al netto della posizione;
 * 3. spazio: (spazio / spazio medio dello storico) ^ elasticitaSpazio (regole), rendimenti decrescenti;
 * 4. forza del prodotto: le sue vendite passate riportate a posizione, sconto e spazio medi, in media
 *    pesata (pesoProdotto) con quelle del suo reparto; senza storico del prodotto, il reparto; senza
 *    reparto, la media di tutti i box.
 * Previsto = forza × indice della posizione × effetto dello sconto × fattore dello spazio.
 * Con pochi casi gli indici restano vicini a 1: alla media si aggiungono casiMinimi casi "neutri".
 *
 * Senza vendite (tipo 'teorica'): un indice 0-100 da spazio × peso della pagina × peso della
 * posizione (i pesi della visibilita' del cliente) × l'effetto dichiarato dello sconto per fascia
 * (regole.effettoSconto); 100 = il box con l'indice piu' alto del volantino.
 *
 * Elasticita' dello spazio ed effetto dichiarato dello sconto sono nelle regole del cliente
 * (RegolePrevisione, standard in REGOLE_PREVISIONE_STANDARD).
 */

/** Casi simili mostrati nella simulazione. */
export const MAX_CASI_SIMILI = 5;

/** Spazio minimo nei rapporti, in % di pagina: un box minuscolo non fa esplodere il fattore. */
const SPAZIO_MINIMO = 0.1;

const NOTA_TEORICA = 'Stima teorica: nessuna vendita importata per le edizioni precedenti della stessa area e canale.';

const FORMULA = 'vendite tipiche del prodotto e del reparto × resa della posizione × effetto dello sconto × spazio.';

// ─── Numeri ─────────────────────────────────────────────────────────

const arrotonda = (valore: number, cifre = 1): number => {
  const fattore = 10 ** cifre;
  return Math.round(valore * fattore) / fattore;
};

const somma = (valori: readonly number[]): number => valori.reduce((totale, valore) => totale + valore, 0);

const media = (valori: readonly number[]): number | null => (valori.length > 0 ? somma(valori) / valori.length : null);

const massimo = (valori: readonly number[]): number => valori.reduce((max, valore) => Math.max(max, valore), 0);

const confrontaTesti = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

// ─── Regole ─────────────────────────────────────────────────────────

const numeroFinito = (valore: unknown): valore is number => typeof valore === 'number' && Number.isFinite(valore);

/** Elasticita' dello spazio valida: un numero da 0 (lo spazio non conta) a 1 (vendite proporzionali allo spazio). */
const elasticitaValida = (valore: unknown): valore is number => numeroFinito(valore) && valore >= 0 && valore <= 1;

/** Effetto dello sconto valido: un numero maggiore di 0 per ogni fascia di FASCE_SCONTO. */
const effettoScontoValido = (valore: unknown): valore is number[] =>
  Array.isArray(valore) && valore.length === FASCE_SCONTO.length && valore.every(effetto => numeroFinito(effetto) && effetto > 0);

/**
 * Le regole del cliente sopra quelle standard ({ ...REGOLE_PREVISIONE_STANDARD, ...previsione }),
 * scartando i valori che non sono numeri: edizioni intere da 0, casi da 0, peso del prodotto fra 0 e 1.
 * Un'elasticita' dello spazio fuori da 0-1, o un effetto dello sconto che non ha un numero maggiore di
 * 0 per ogni fascia di FASCE_SCONTO, non vale: resta quello standard.
 */
export function regoleDelCliente(personalizzate?: Partial<RegolePrevisione> | null): RegolePrevisione {
  const numero = (valore: unknown, standard: number): number => (numeroFinito(valore) ? valore : standard);
  const voce = personalizzate ?? {};
  return {
    edizioniStoriche: Math.max(0, Math.floor(numero(voce.edizioniStoriche, REGOLE_PREVISIONE_STANDARD.edizioniStoriche))),
    casiMinimi: Math.max(0, numero(voce.casiMinimi, REGOLE_PREVISIONE_STANDARD.casiMinimi)),
    pesoProdotto: Math.min(1, Math.max(0, numero(voce.pesoProdotto, REGOLE_PREVISIONE_STANDARD.pesoProdotto))),
    elasticitaSpazio: elasticitaValida(voce.elasticitaSpazio) ? voce.elasticitaSpazio : REGOLE_PREVISIONE_STANDARD.elasticitaSpazio,
    effettoSconto: [...(effettoScontoValido(voce.effettoSconto) ? voce.effettoSconto : REGOLE_PREVISIONE_STANDARD.effettoSconto)],
  };
}

// ─── Posizione ──────────────────────────────────────────────────────

export type TipoPagina = 'copertina' | 'primaDoppia' | 'ultima' | 'altre';
export type FasciaVerticale = 'alto' | 'centro' | 'basso';

const FASCE_VERTICALI: readonly FasciaVerticale[] = ['alto', 'centro', 'basso'];

/** Il tipo di pagina con le stesse regole del peso della pagina (pesoPagina). */
export function tipoPagina(pagina: number, totalePagine: number): TipoPagina {
  if (pagina === 1) return 'copertina';
  if (totalePagine > 1 && pagina === totalePagine) return 'ultima';
  if (pagina === 2 || pagina === 3) return 'primaDoppia';
  return 'altre';
}

/** 0 alto, 1 centro, 2 basso: la pagina in tre fasce uguali, dal centro verticale del box. */
const indiceFasciaVerticale = (centroY: number): number => Math.min(2, Math.max(0, Math.floor(centroY * 3)));

export const fasciaVerticale = (centroY: number): FasciaVerticale => FASCE_VERTICALI[indiceFasciaVerticale(centroY)];

/** La posizione di un box: tipo di pagina e fascia verticale, es. "copertina|alto". */
export const chiavePosizione = (pagina: number, totalePagine: number, centroY: number): string =>
  `${tipoPagina(pagina, totalePagine)}|${fasciaVerticale(centroY)}`;

/** L'indice della fascia di sconto in FASCE_SCONTO; senza sconto la prima. */
export function fasciaSconto(sconto: number | null): number {
  const valore = sconto ?? 0;
  let fascia = 0;
  FASCE_SCONTO.forEach((da, indice) => {
    if (valore >= da) fascia = indice;
  });
  return fascia;
}

// ─── Box ────────────────────────────────────────────────────────────

/** Un box messo in pagina: del volantino, dello storico o simulato. */
export interface BoxCollocato {
  id: string;
  /** Chiave del prodotto pilota (BoxInsight.chiave). */
  chiave: string;
  /** Codice del reparto; null se non si sa. */
  reparto: string | null;
  pagina: number;
  /** Centro verticale, da 0 (in cima) a 1 (in fondo). */
  centroY: number;
  /** Spazio in % della pagina. */
  spazio: number;
  sconto: number | null;
}

/** I box con pagina e geometria, messi in pagina. */
export function boxCollocati(box: readonly BoxInsight[]): BoxCollocato[] {
  return box.flatMap((singolo): BoxCollocato[] => {
    const { geometria, pagina } = singolo;
    if (!geometria || pagina === null) return [];
    return [{
      id: singolo.id,
      chiave: singolo.chiave,
      reparto: singolo.reparto?.codice.trim() || null,
      pagina,
      centroY: geometria.y + geometria.h / 2,
      spazio: singolo.spazio,
      sconto: singolo.sconto,
    }];
  });
}

/** Spazio × peso della pagina × peso della posizione, come la visibilita' degli insight. */
const visibilitaGrezza = (box: BoxCollocato, totalePagine: number, pesi: PesiVisibilita): number =>
  box.spazio * pesoPagina(box.pagina, totalePagine, pesi) * pesoPosizione(box.centroY, pesi);

/** L'indice teorico prima della normalizzazione: visibilita' × effetto dichiarato dello sconto (regole del cliente). */
const indiceTeoricoGrezzo = (box: BoxCollocato, totalePagine: number, pesi: PesiVisibilita, regole: RegolePrevisione): number =>
  visibilitaGrezza(box, totalePagine, pesi) * (regole.effettoSconto[fasciaSconto(box.sconto)] ?? 1);

// ─── Storico ────────────────────────────────────────────────────────

/** Un box di un'edizione precedente, con le sue vendite. */
export interface Osservazione extends BoxCollocato {
  idKit: string;
  titolo: string;
  /** Inizio validita' della promo dell'edizione, YYYY-MM-DD. */
  data: string;
  totalePagine: number;
  /** Pezzi venduti dai prodotti del box nel periodo della promo; null se nessuno ha vendite. */
  pezzi: number | null;
  /** Visibilita' 0-100 nel suo volantino (100 = il box piu' visibile), con i pesi del cliente. */
  visibilita: number;
}

export interface EdizioneStorica {
  idKit: string;
  titolo: string;
  /** Inizio validita' della promo, YYYY-MM-DD. */
  data: string;
  totalePagine: number;
}

/**
 * I box con geometria di un'edizione precedente come osservazioni dello storico. Le vendite sono
 * quelle dei box (venditeDeiBox) nel periodo della sua promo; null se l'edizione non ne ha.
 */
export function osservazioniDellEdizione(
  edizione: EdizioneStorica,
  box: readonly BoxInsight[],
  vendite: ReadonlyMap<string, VenditeBox> | null,
  pesi: PesiVisibilita = PESI_VISIBILITA,
): Osservazione[] {
  const collocati = boxCollocati(box);
  const grezze = collocati.map(singolo => visibilitaGrezza(singolo, edizione.totalePagine, pesi));
  const piuVisibile = massimo(grezze);
  return collocati.map((singolo, indice) => {
    const venduto = vendite?.get(singolo.id);
    const conVendite = venduto !== undefined && venduto.prodottiSenzaVendite < venduto.prodotti;
    return {
      ...singolo,
      idKit: edizione.idKit,
      titolo: edizione.titolo,
      data: edizione.data,
      totalePagine: edizione.totalePagine,
      pezzi: conVendite ? venduto.pezzi : null,
      visibilita: piuVisibile > 0 ? arrotonda((grezze[indice] / piuVisibile) * 100) : 0,
    };
  });
}

// ─── Modello dalle vendite ──────────────────────────────────────────

interface Somma {
  somma: number;
  casi: number;
}

interface Confronto {
  osservato: number;
  atteso: number;
  casi: number;
}

const mediaDi = (voce: Somma | undefined): number | null => (voce && voce.casi > 0 ? voce.somma / voce.casi : null);

function sommePer<T>(voci: readonly T[], chiave: (voce: T) => string | null, valore: (voce: T, indice: number) => number): Map<string, Somma> {
  const somme = new Map<string, Somma>();
  voci.forEach((voce, indice) => {
    const gruppo = chiave(voce);
    if (gruppo === null) return;
    const attuale = somme.get(gruppo) ?? { somma: 0, casi: 0 };
    attuale.somma += valore(voce, indice);
    attuale.casi += 1;
    somme.set(gruppo, attuale);
  });
  return somme;
}

/** Media pesata fra il prodotto e il suo riferimento (reparto o media generale); senza prodotto, il riferimento. */
const mescola = (prodotto: number | null, riferimento: number, pesoProdotto: number): number =>
  (prodotto === null ? riferimento : pesoProdotto * prodotto + (1 - pesoProdotto) * riferimento);

/**
 * Osservato su atteso, prudente: come se ai casi se ne aggiungessero `neutri` che rendono
 * esattamente l'atteso. Con pochi casi resta vicino a 1; senza casi e' 1.
 */
function indicePrudente(confronto: Confronto | undefined, neutri: number): number {
  if (!confronto || confronto.casi === 0 || confronto.atteso <= 0) return 1;
  const attesoMedio = confronto.atteso / confronto.casi;
  return (confronto.osservato + neutri * attesoMedio) / (confronto.atteso + neutri * attesoMedio);
}

function accumula(mappa: Map<string, Confronto>, chiave: string, osservato: number, atteso: number): void {
  const voce = mappa.get(chiave) ?? { osservato: 0, atteso: 0, casi: 0 };
  voce.osservato += osservato;
  voce.atteso += atteso;
  voce.casi += 1;
  mappa.set(chiave, voce);
}

/** Il modello stimato dallo storico con vendite. */
export interface ModelloVendite {
  regole: RegolePrevisione;
  /** Spazio medio dei box dello storico, % di pagina. */
  spazioRiferimento: number;
  /** Per chiavePosizione; una posizione mai vista vale 1. */
  indicePosizione: ReadonlyMap<string, number>;
  /** Per fascia di FASCE_SCONTO. */
  effettoSconto: readonly number[];
  /** Vendite riportate a posizione, sconto e spazio di riferimento: per prodotto, per reparto, di tutti. */
  forzaProdotto: ReadonlyMap<string, Somma>;
  forzaReparto: ReadonlyMap<string, Somma>;
  forzaGenerale: number;
  /** Box con vendite usati. */
  casi: number;
  /** Edizioni con almeno un box con vendite. */
  edizioni: number;
}

/** Rendimenti decrescenti dello spazio: (spazio / riferimento) ^ elasticitaSpazio delle regole del cliente. */
const fattoreSpazio = (spazio: number, riferimento: number, elasticita: number): number =>
  (Math.max(spazio, SPAZIO_MINIMO) / Math.max(riferimento, SPAZIO_MINIMO)) ** elasticita;

/** Il modello dalle osservazioni con vendite; null se lo storico non ne ha. */
export function modelloVendite(storico: readonly Osservazione[], regole: RegolePrevisione = REGOLE_PREVISIONE_STANDARD): ModelloVendite | null {
  const casi = storico.flatMap(voce => (voce.pezzi === null ? [] : [{ ...voce, pezzi: voce.pezzi }]));
  if (casi.length === 0) return null;
  const neutri = regole.casiMinimi;
  const spazioRiferimento = media(casi.map(voce => voce.spazio).filter(spazio => spazio > 0)) ?? 1;
  const fattore = (spazio: number): number => fattoreSpazio(spazio, spazioRiferimento, regole.elasticitaSpazio);
  const posizioneDi = (voce: Osservazione): string => chiavePosizione(voce.pagina, voce.totalePagine, voce.centroY);

  // 1. Le vendite tipiche di ogni caso: quelle del suo prodotto, pesate con il reparto (o con tutti),
  // a parita' di spazio (lo spazio si toglie prima della media e si rimette sul caso)
  const aParitaDiSpazio = casi.map(voce => voce.pezzi / fattore(voce.spazio));
  const generale = media(aParitaDiSpazio) ?? 0;
  const grezzePerProdotto = sommePer(casi, voce => voce.chiave, (_, indice) => aParitaDiSpazio[indice]);
  const grezzePerReparto = sommePer(casi, voce => voce.reparto, (_, indice) => aParitaDiSpazio[indice]);
  const attese = casi.map(voce => {
    const riferimento = mediaDi(voce.reparto === null ? undefined : grezzePerReparto.get(voce.reparto)) ?? generale;
    return mescola(mediaDi(grezzePerProdotto.get(voce.chiave)), riferimento, regole.pesoProdotto) * fattore(voce.spazio);
  });

  // 2. La resa di ogni posizione: vendite osservate su vendite tipiche dei box che ci sono stati
  const perPosizione = new Map<string, Confronto>();
  casi.forEach((voce, indice) => accumula(perPosizione, posizioneDi(voce), voce.pezzi, attese[indice]));
  const indicePosizione = new Map([...perPosizione].map(([posizione, confronto]) => [posizione, indicePrudente(confronto, neutri)] as const));
  const indiceDi = (voce: Osservazione): number => indicePosizione.get(posizioneDi(voce)) ?? 1;

  // 3. L'effetto dello sconto, al netto della posizione
  const perFascia = new Map<string, Confronto>();
  casi.forEach((voce, indice) => accumula(perFascia, String(fasciaSconto(voce.sconto)), voce.pezzi, attese[indice] * indiceDi(voce)));
  const effettoSconto = FASCE_SCONTO.map((_, fascia) => indicePrudente(perFascia.get(String(fascia)), neutri));

  // 4. La forza: le vendite di ogni caso riportate a posizione, sconto e spazio di riferimento
  const normalizzate = casi.map(voce => {
    const divisore = indiceDi(voce) * (effettoSconto[fasciaSconto(voce.sconto)] ?? 1) * fattore(voce.spazio);
    return divisore > 0 ? voce.pezzi / divisore : 0;
  });

  return {
    regole,
    spazioRiferimento,
    indicePosizione,
    effettoSconto,
    forzaProdotto: sommePer(casi, voce => voce.chiave, (_, indice) => normalizzate[indice]),
    forzaReparto: sommePer(casi, voce => voce.reparto, (_, indice) => normalizzate[indice]),
    forzaGenerale: media(normalizzate) ?? 0,
    casi: casi.length,
    edizioni: new Set(casi.map(voce => voce.idKit)).size,
  };
}

/** I casi con vendite del prodotto nello storico. */
export const casiDelProdotto = (modello: ModelloVendite, chiave: string): number => modello.forzaProdotto.get(chiave)?.casi ?? 0;

const riferimentoDi = (modello: ModelloVendite, reparto: string | null): number =>
  mediaDi(reparto === null ? undefined : modello.forzaReparto.get(reparto)) ?? modello.forzaGenerale;

/** La forza del prodotto: il suo storico pesato con quello del reparto (o di tutti). */
export const forzaDi = (modello: ModelloVendite, chiave: string, reparto: string | null): number =>
  mescola(mediaDi(modello.forzaProdotto.get(chiave)), riferimentoDi(modello, reparto), modello.regole.pesoProdotto);

const indicePosizioneDi = (modello: ModelloVendite, box: BoxCollocato, totalePagine: number): number =>
  modello.indicePosizione.get(chiavePosizione(box.pagina, totalePagine, box.centroY)) ?? 1;

/** Pezzi previsti: forza × indice della posizione × effetto dello sconto × fattore dello spazio. */
export function prevedi(modello: ModelloVendite, box: BoxCollocato, totalePagine: number): number {
  return forzaDi(modello, box.chiave, box.reparto)
    * indicePosizioneDi(modello, box, totalePagine)
    * (modello.effettoSconto[fasciaSconto(box.sconto)] ?? 1)
    * fattoreSpazio(box.spazio, modello.spazioRiferimento, modello.regole.elasticitaSpazio);
}

// ─── Previsione del volantino ───────────────────────────────────────

export interface DatiPrevisione {
  /** I box del volantino con geometria. */
  box: readonly BoxCollocato[];
  totalePagine: number;
  /** I box delle edizioni precedenti della stessa GDO, area e canale. */
  storico: readonly Osservazione[];
  /** Pezzi reali per box, quando il volantino ha gia' le vendite; null altrimenti. */
  reale: ReadonlyMap<string, number> | null;
  /** La promo e' gia' iniziata. */
  promoValida: boolean;
  regole: RegolePrevisione;
  pesi: PesiVisibilita;
}

/** Valori 0-100 rispetto al massimo; tutti 0 se il massimo e' 0. */
const inIndice = (valori: readonly number[]): number[] => {
  const piuAlto = massimo(valori);
  return valori.map(valore => (piuAlto > 0 ? (valore / piuAlto) * 100 : 0));
};

/**
 * Lo scarto medio fra previsto e reale, in %: la somma degli scarti assoluti sulla somma del reale
 * (i box piccoli non pesano quanto i grandi); null senza reale.
 */
function scartoMedio(perBox: readonly PrevisioneBox[]): number | null {
  const conReale = perBox.flatMap(voce => (voce.reale === null ? [] : [{ previsto: voce.valore, reale: voce.reale }]));
  const totaleReale = somma(conReale.map(voce => voce.reale));
  if (conReale.length === 0 || totaleReale <= 0) return null;
  return arrotonda((somma(conReale.map(voce => Math.abs(voce.previsto - voce.reale))) / totaleReale) * 100);
}

const edizioni = (quante: number): string => (quante === 1 ? '1 edizione precedente' : `${quante} edizioni precedenti`);

/** La previsione per ogni box con geometria; null se il volantino non ne ha. */
export function previsioneVolantino(dati: DatiPrevisione): PrevisioneVolantino | null {
  if (dati.box.length === 0) return null;
  const modello = modelloVendite(dati.storico, dati.regole);

  if (modello) {
    const perBox = dati.box.map((singolo): PrevisioneBox => {
      const casi = casiDelProdotto(modello, singolo.chiave);
      const reale = dati.reale?.get(singolo.id);
      return {
        idBox: singolo.id,
        valore: arrotonda(prevedi(modello, singolo, dati.totalePagine)),
        casiStorici: casi,
        affidabilita: affidabilitaDaCasi(casi, dati.regole),
        reale: reale === undefined ? null : arrotonda(reale),
      };
    });
    return {
      tipo: 'vendite',
      unita: 'pezzi',
      promoValida: dati.promoValida,
      edizioniStoriche: modello.edizioni,
      perBox,
      scartoMedio: scartoMedio(perBox),
      nota: `Previsione dalle vendite di ${edizioni(modello.edizioni)} della stessa area e canale (${modello.casi} box con vendite): ${FORMULA}`,
    };
  }

  // Senza vendite: indice teorico, e il reale (se c'e') nella stessa unita'
  const previsti = inIndice(dati.box.map(singolo => indiceTeoricoGrezzo(singolo, dati.totalePagine, dati.pesi, dati.regole)));
  const reali = dati.reale ? inIndice(dati.box.map(singolo => dati.reale?.get(singolo.id) ?? 0)) : null;
  const perBox = dati.box.map((singolo, indice): PrevisioneBox => ({
    idBox: singolo.id,
    valore: arrotonda(previsti[indice]),
    casiStorici: 0,
    affidabilita: 'bassa',
    reale: reali && dati.reale?.has(singolo.id) ? arrotonda(reali[indice]) : null,
  }));
  return {
    tipo: 'teorica',
    unita: 'indice',
    promoValida: dati.promoValida,
    edizioniStoriche: 0,
    perBox,
    scartoMedio: scartoMedio(perBox),
    nota: `${NOTA_TEORICA} Indice 0-100 da spazio, pagina, posizione e sconto (100 = il box più forte del volantino).`,
  };
}

// ─── Simulazione ────────────────────────────────────────────────────

const tra = (valore: unknown, minimo: number, massimoAmmesso: number): boolean =>
  typeof valore === 'number' && Number.isFinite(valore) && valore >= minimo && valore <= massimoAmmesso;

/** Il motivo per cui la richiesta di simulazione non e' valida; null se va bene. */
export function erroreSimulazione(richiesta: RichiestaSimulazione): string | null {
  if (typeof richiesta.chiave !== 'string' || richiesta.chiave.trim() === '') return 'Indica il prodotto da simulare';
  if (!Number.isInteger(richiesta.pagina) || richiesta.pagina < 1) return 'La pagina deve essere un numero intero da 1 in su';
  if (!tra(richiesta.x, 0, 1) || !tra(richiesta.y, 0, 1)) return 'La posizione deve essere fra 0 e 1';
  if (!Number.isFinite(richiesta.spazio) || richiesta.spazio <= 0 || richiesta.spazio > 100) {
    return 'Lo spazio deve essere maggiore di 0 e al massimo 100 (% della pagina)';
  }
  if (richiesta.sconto !== null && !tra(richiesta.sconto, 0, 100)) return 'Lo sconto deve essere fra 0 e 100';
  return null;
}

/**
 * Quanto un caso dello storico e' lontano dalla simulazione (piu' piccolo = piu' simile): tipo di
 * pagina diverso 1, ogni fascia verticale di distanza 0,5, ogni 20 punti di sconto 1, il doppio o la
 * meta' dello spazio circa 0,7.
 */
function distanza(caso: Osservazione, simulato: BoxCollocato, totalePagine: number): number {
  const pagina = tipoPagina(caso.pagina, caso.totalePagine) === tipoPagina(simulato.pagina, totalePagine) ? 0 : 1;
  const fascia = Math.abs(indiceFasciaVerticale(caso.centroY) - indiceFasciaVerticale(simulato.centroY)) / 2;
  const sconto = Math.abs((caso.sconto ?? 0) - (simulato.sconto ?? 0)) / 20;
  const spazio = Math.abs(Math.log(Math.max(caso.spazio, SPAZIO_MINIMO) / Math.max(simulato.spazio, SPAZIO_MINIMO)));
  return pagina + fascia + sconto + spazio;
}

/** I casi dello stesso prodotto nello storico, dal piu' simile; a parita', dal piu' recente. */
function casiSimili(simulato: BoxCollocato, dati: DatiPrevisione, tipo: TipoPrevisione): CasoSimile[] {
  return dati.storico
    .filter(caso => caso.chiave === simulato.chiave)
    .map(caso => ({ caso, distanza: distanza(caso, simulato, dati.totalePagine) }))
    .sort((a, b) => a.distanza - b.distanza || confrontaTesti(b.caso.data, a.caso.data))
    .slice(0, MAX_CASI_SIMILI)
    .map(({ caso }) => ({
      idKit: caso.idKit,
      titolo: caso.titolo,
      data: caso.data,
      pagina: caso.pagina,
      sconto: caso.sconto,
      spazio: arrotonda(caso.spazio, 2),
      valore: tipo === 'vendite' ? (caso.pezzi === null ? null : arrotonda(caso.pezzi)) : caso.visibilita,
    }));
}

/** Il reparto del prodotto: dal volantino, se c'e', o dal suo caso piu' recente nello storico. */
function repartoDellaChiave(chiave: string, dati: DatiPrevisione): string | null {
  const nelVolantino = dati.box.find(singolo => singolo.chiave === chiave && singolo.reparto !== null);
  if (nelVolantino) return nelVolantino.reparto;
  const nelloStorico = dati.storico
    .filter(caso => caso.chiave === chiave && caso.reparto !== null)
    .sort((a, b) => confrontaTesti(b.data, a.data))[0];
  return nelloStorico?.reparto ?? null;
}

/** La posizione scelta rispetto alla media delle posizioni dei box del volantino (1 = nella media). */
function relativaAlVolantino(scelta: number, delVolantino: readonly number[]): number {
  const mediaVolantino = media(delVolantino);
  return arrotonda(mediaVolantino !== null && mediaVolantino > 0 ? scelta / mediaVolantino : scelta, 2);
}

/**
 * Il prodotto nella posizione, nello spazio e con lo sconto scelti, nello stesso modello della
 * previsione del volantino. La richiesta deve essere gia' valida (erroreSimulazione).
 */
export function simulaProdotto(richiesta: RichiestaSimulazione, dati: DatiPrevisione): SimulazioneProdotto {
  const chiave = richiesta.chiave.trim();
  const simulato: BoxCollocato = {
    id: 'simulazione',
    chiave,
    reparto: repartoDellaChiave(chiave, dati),
    pagina: richiesta.pagina,
    centroY: richiesta.y,
    spazio: richiesta.spazio,
    sconto: richiesta.sconto,
  };
  const modello = modelloVendite(dati.storico, dati.regole);

  if (modello) {
    const casi = casiDelProdotto(modello, chiave);
    let nota: string;
    if (casi > 0) {
      nota = `Stima dalle vendite di ${edizioni(modello.edizioni)} della stessa area e canale: il prodotto ha ${casi} ${casi === 1 ? 'caso' : 'casi'} con vendite.`;
    } else if (simulato.reparto !== null && modello.forzaReparto.has(simulato.reparto)) {
      nota = 'Il prodotto non ha vendite nelle edizioni precedenti: stima dalle vendite del suo reparto.';
    } else {
      nota = 'Il prodotto non ha vendite nelle edizioni precedenti: stima dalla media dei box con vendite.';
    }
    return {
      tipo: 'vendite',
      unita: 'pezzi',
      valore: arrotonda(prevedi(modello, simulato, dati.totalePagine)),
      indicePosizione: relativaAlVolantino(
        indicePosizioneDi(modello, simulato, dati.totalePagine),
        dati.box.map(singolo => indicePosizioneDi(modello, singolo, dati.totalePagine)),
      ),
      casiStorici: casi,
      affidabilita: affidabilitaDaCasi(casi, dati.regole),
      casiSimili: casiSimili(simulato, dati, 'vendite'),
      nota,
    };
  }

  // Stima teorica: stesso indice 0-100 della previsione, rispetto al box piu' forte del volantino
  const pesoDellaPosizione = (box: BoxCollocato): number =>
    pesoPagina(box.pagina, dati.totalePagine, dati.pesi) * pesoPosizione(box.centroY, dati.pesi);
  const grezzo = indiceTeoricoGrezzo(simulato, dati.totalePagine, dati.pesi, dati.regole);
  const piuForte = massimo(dati.box.map(singolo => indiceTeoricoGrezzo(singolo, dati.totalePagine, dati.pesi, dati.regole)));
  const valore = piuForte > 0 ? Math.min(100, (grezzo / piuForte) * 100) : grezzo > 0 ? 100 : 0;
  return {
    tipo: 'teorica',
    unita: 'indice',
    valore: arrotonda(valore),
    indicePosizione: relativaAlVolantino(pesoDellaPosizione(simulato), dati.box.map(pesoDellaPosizione)),
    casiStorici: 0,
    affidabilita: 'bassa',
    casiSimili: casiSimili(simulato, dati, 'teorica'),
    nota: `${NOTA_TEORICA} Indice 0-100 rispetto al box più forte del volantino.`,
  };
}
