import {
  type AnalisiPuntoVendita,
  type BoxVolantino,
  type CoperturaDati,
  type DettaglioReferenzaPv,
  type DettaglioVolantinoPv,
  type EdizioneTimeline,
  MECCANICHE,
  type MeccanicaReferenza,
  type PaginaVolantino,
  type PresenzaReferenza,
  type ProdottoRicorrente,
  type ReferenzaSintesi,
  type ReteInsegne,
} from '../../../lib/puntiVendita/analisi';
import type { PromoStoria, RiferimentoStoria, TipoAbbinamento } from '../../../lib/puntiVendita/storia';
import { AGGREGATI_VUOTI, type AggregatiKit, type BoxKit, type DescrizioneProdotto, type ProdottoNelKit } from './analisiKit';
import { DESCRIZIONE_ASSENTE, type ProdottoStampato } from './referenzaStampata';
import { type ApparizioneStoria, ordinaApparizioni } from './storiaPuntoVendita';

/**
 * Le pagine del punto vendita costruite sulla timeline dei suoi volantini (contratto in
 * lib/puntiVendita/analisi.ts): scheda del PV, volantino, referenza e rete per insegna, dai
 * riepiloghi dei kit (analisiKit.ts) e dalle apparizioni del PV nelle liste. Funzioni pure.
 *
 * Un anno è quello del giorno dell'edizione (inizio della promo, calendario di Roma). Le quote
 * sono percentuali con un decimale; gli sconti hanno due decimali.
 */

/** Un prodotto è frequente se compare in più di tanti volantini del PV. */
export const SOGLIA_PRODOTTO_FREQUENTE = 10;
export const MARCHE_IN_EVIDENZA = 8;
export const NUMERO_PRODOTTI_RICORRENTI = 10;
/** Righe della stessa provincia mostrate prima e dopo quella del PV nella lista del volantino. */
export const RIGHE_VICINE = 3;
/** Oltre, le pagine vuote non si elencano: un numero di pagine così è un dato sbagliato. */
export const MASSIMO_PAGINE = 400;

/** Un volantino della storia del PV, una volta per kit. */
export interface EdizionePuntoVendita {
  idKit: string;
  titoloKit: string;
  /** Giorno dell'edizione (YYYY-MM-DD). */
  data: string;
  promo: PromoStoria;
  canale: RiferimentoStoria;
  area: RiferimentoStoria;
}

const arrotonda = (valore: number, cifre = 1): number => {
  const fattore = 10 ** cifre;
  return Math.round(valore * fattore) / fattore;
};

const quota = (parte: number, totale: number): number => (totale > 0 ? arrotonda((parte / totale) * 100) : 0);

const annoDi = (data: string): number => Number(data.slice(0, 4));

const confronta = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Le edizioni del PV dalle sue apparizioni, dalla più vecchia, una per kit. */
export function edizioniDelPuntoVendita(apparizioni: readonly ApparizioneStoria[]): EdizionePuntoVendita[] {
  const visti = new Set<string>();
  return ordinaApparizioni(apparizioni)
    .filter((apparizione) => {
      if (visti.has(apparizione.idKit)) return false;
      visti.add(apparizione.idKit);
      return true;
    })
    .map(({ idKit, titoloKit, data, promo, canale, area }) => ({ idKit, titoloKit, data, promo, canale, area }));
}

/** Attivo oggi: la validità della promo comprende il giorno indicato (YYYY-MM-DD, calendario di Roma). */
export function edizioneAttiva(edizione: EdizionePuntoVendita, oggi: string): boolean {
  const dal = edizione.promo.validitaDal;
  if (!dal) return false;
  return dal <= oggi && oggi <= (edizione.promo.validitaAl ?? dal);
}

const aggregatiDelKit = (aggregati: ReadonlyMap<string, AggregatiKit>, idKit: string): AggregatiKit =>
  aggregati.get(idKit) ?? AGGREGATI_VUOTI;

export function coperturaDi(conteggi: AggregatiKit['copertura'], referenze: number): CoperturaDati {
  return {
    conCodice: quota(conteggi.conCodice, referenze),
    conReparto: quota(conteggi.conReparto, referenze),
    conPrezzo: quota(conteggi.conPrezzo, referenze),
    conMarca: quota(conteggi.conMarca, referenze),
  };
}

/** Lo sconto medio delle referenze che ne hanno uno, con due decimali. */
export const scontoMedio = (sconto: AggregatiKit['sconto']): number | null =>
  sconto.referenze > 0 ? arrotonda(sconto.somma / sconto.referenze, 2) : null;

// ─── Scheda del PV ──────────────────────────────────────────────────

/** Un prodotto fra i più presenti nei volantini del PV, come lo calcola l'SQL sui riepiloghi dei kit. */
export interface ProdottoFrequente {
  chiave: string;
  volantini: number;
  /** Volantini per anno; gli anni senza presenze mancano. */
  perAnno: Record<string, number>;
  prezzoMinimo: number | null;
  prezzoMassimo: number | null;
  /** Il kit piu' recente che lo contiene, e il piu' recente in cui ha una foto. */
  ultimoKit: string;
  ultimoKitConFoto: string | null;
}

/**
 * Prodotti e marche di tutti i volantini del PV, aggregati in SQL sulle forme compatte dei
 * riepiloghi (i prodotti di centinaia di volantini non escono dal database).
 */
export interface StatisticheProdotti {
  /** Prodotti diversi. */
  prodotti: number;
  /** Prodotti in piu' di SOGLIA_PRODOTTO_FREQUENTE volantini. */
  frequenti: number;
  /** I NUMERO_PRODOTTI_RICORRENTI piu' presenti: per volantini, poi i piu' recenti, poi per chiave. */
  ricorrenti: ProdottoFrequente[];
  /** Le MARCHE_IN_EVIDENZA marche con piu' referenze, col nome stampato piu' spesso. */
  marche: Array<{ marca: string; referenze: number }>;
  /** Referenze con una marca, in tutti i volantini. */
  referenzeConMarca: number;
}

export const STATISTICHE_VUOTE: StatisticheProdotti = Object.freeze({
  prodotti: 0, frequenti: 0, ricorrenti: [], marche: [], referenzeConMarca: 0,
}) as StatisticheProdotti;

/** Le coppie kit-prodotto da cui leggere le descrizioni dei prodotti ricorrenti: l'ultimo kit e, se diverso, l'ultimo con la foto. */
export function coppieDaDescrivere(ricorrenti: readonly ProdottoFrequente[]): Array<{ idKit: string; chiave: string }> {
  return ricorrenti.flatMap(prodotto => [
    { idKit: prodotto.ultimoKit, chiave: prodotto.chiave },
    ...(prodotto.ultimoKitConFoto && prodotto.ultimoKitConFoto !== prodotto.ultimoKit
      ? [{ idKit: prodotto.ultimoKitConFoto, chiave: prodotto.chiave }]
      : []),
  ]);
}

export const chiaveDescrizione = (idKit: string, chiave: string): string => `${idKit}|${chiave}`;

/** Nome, marca e formato dall'ultimo kit; la foto dall'ultimo che ne ha una. */
export function descrizioniRicorrenti(
  ricorrenti: readonly ProdottoFrequente[],
  trovate: ReadonlyMap<string, DescrizioneProdotto>,
): Map<string, DescrizioneProdotto> {
  const descrizioni = new Map<string, DescrizioneProdotto>();
  for (const prodotto of ricorrenti) {
    const ultima = trovate.get(chiaveDescrizione(prodotto.ultimoKit, prodotto.chiave));
    const conFoto = prodotto.ultimoKitConFoto ? trovate.get(chiaveDescrizione(prodotto.ultimoKitConFoto, prodotto.chiave)) : undefined;
    descrizioni.set(prodotto.chiave, {
      nome: ultima?.nome ?? conFoto?.nome ?? DESCRIZIONE_ASSENTE,
      marca: ultima ? ultima.marca : conFoto?.marca ?? null,
      formato: ultima ? ultima.formato : conFoto?.formato ?? null,
      foto: ultima?.foto ?? conFoto?.foto ?? null,
    });
  }
  return descrizioni;
}

/**
 * La scheda del PV: aggregati di ogni kit anno per anno, statistiche dei prodotti e delle marche
 * (dall'SQL) e descrizioni dei prodotti ricorrenti.
 */
export function calcolaAnalisiPuntoVendita(
  idPuntoVendita: string,
  edizioni: readonly EdizionePuntoVendita[],
  aggregati: ReadonlyMap<string, AggregatiKit>,
  statistiche: StatisticheProdotti,
  descrizioni: ReadonlyMap<string, DescrizioneProdotto>,
  oggi: string,
): AnalisiPuntoVendita {
  const anni = [...new Set(edizioni.map(edizione => annoDi(edizione.data)))].sort((a, b) => a - b);
  const meccanichePerAnno = new Map<number, Map<MeccanicaReferenza, number>>();
  const scontoPerAnno = new Map<number, { somma: number; referenze: number }>();
  const repartiPerAnno = new Map<number, Map<string, number>>();
  const insegne = new Map<string, RiferimentoStoria>();
  const copertura = { conCodice: 0, conReparto: 0, conPrezzo: 0, conMarca: 0 };
  const sconto = { somma: 0, referenze: 0 };
  let referenze = 0;

  const timeline: EdizioneTimeline[] = edizioni.map((edizione) => {
    const riepilogo = aggregatiDelKit(aggregati, edizione.idKit);
    const anno = annoDi(edizione.data);
    referenze += riepilogo.referenze;
    if (!insegne.has(edizione.canale.id)) insegne.set(edizione.canale.id, edizione.canale);
    for (const chiave of ['conCodice', 'conReparto', 'conPrezzo', 'conMarca'] as const) copertura[chiave] += riepilogo.copertura[chiave];
    sconto.somma += riepilogo.sconto.somma;
    sconto.referenze += riepilogo.sconto.referenze;

    const scontoAnno = scontoPerAnno.get(anno) ?? { somma: 0, referenze: 0 };
    scontoAnno.somma += riepilogo.sconto.somma;
    scontoAnno.referenze += riepilogo.sconto.referenze;
    scontoPerAnno.set(anno, scontoAnno);

    const meccanicheAnno = meccanichePerAnno.get(anno) ?? new Map<MeccanicaReferenza, number>();
    for (const voce of riepilogo.meccaniche) meccanicheAnno.set(voce.meccanica, (meccanicheAnno.get(voce.meccanica) ?? 0) + voce.referenze);
    meccanichePerAnno.set(anno, meccanicheAnno);

    const repartiAnno = repartiPerAnno.get(anno) ?? new Map<string, number>();
    for (const voce of riepilogo.reparti) repartiAnno.set(voce.reparto, (repartiAnno.get(voce.reparto) ?? 0) + voce.spazio);
    repartiPerAnno.set(anno, repartiAnno);

    return {
      idKit: edizione.idKit,
      dal: edizione.promo.validitaDal ?? edizione.data,
      al: edizione.promo.validitaAl,
      promo: { id: edizione.promo.id, nome: edizione.promo.nome },
      canale: edizione.canale,
      area: edizione.area,
      numeroReferenze: riepilogo.referenze,
      attivo: edizioneAttiva(edizione, oggi),
    };
  });

  const scontoAnni = anni.map(anno => ({ anno, sconto: scontoMedio(scontoPerAnno.get(anno) ?? { somma: 0, referenze: 0 }) }));

  const ricorrenti: ProdottoRicorrente[] = statistiche.ricorrenti.slice(0, NUMERO_PRODOTTI_RICORRENTI).map((prodotto) => {
    const descrizione = descrizioni.get(prodotto.chiave);
    return {
      chiave: prodotto.chiave,
      nome: descrizione?.nome ?? DESCRIZIONE_ASSENTE,
      marca: descrizione?.marca ?? null,
      formato: descrizione?.formato ?? null,
      foto: descrizione?.foto ?? null,
      volantini: prodotto.volantini,
      perAnno: anni.map(anno => ({ anno, volantini: prodotto.perAnno[String(anno)] ?? 0 })),
      prezzoMinimo: prodotto.prezzoMinimo,
      prezzoMassimo: prodotto.prezzoMassimo,
    };
  });

  return {
    idPuntoVendita,
    numeri: {
      volantini: edizioni.length,
      volantiniAttivi: timeline.filter(edizione => edizione.attivo).length,
      referenze,
      mediaReferenze: edizioni.length > 0 ? arrotonda(referenze / edizioni.length) : null,
      prodotti: statistiche.prodotti,
      prodottiFrequenti: statistiche.frequenti,
      scontoMedio: scontoMedio(sconto),
      // Il primo anno con un dato: un anno senza prezzi barrati non fa da confronto
      scontoMedioPrimoAnno: scontoAnni.find(voce => voce.sconto !== null)?.sconto ?? null,
      insegne: [...insegne.values()],
    },
    timeline,
    anni,
    meccaniche: MECCANICHE.map(meccanica => ({
      meccanica,
      anni: anni.map((anno) => {
        const perMeccanica = meccanichePerAnno.get(anno) ?? new Map<MeccanicaReferenza, number>();
        const totale = [...perMeccanica.values()].reduce((somma, valore) => somma + valore, 0);
        return { anno, quota: quota(perMeccanica.get(meccanica) ?? 0, totale) };
      }),
    })),
    scontoPerAnno: scontoAnni,
    marche: statistiche.marche
      .slice(0, MARCHE_IN_EVIDENZA)
      .map(marca => ({ marca: marca.marca, quota: quota(marca.referenze, statistiche.referenzeConMarca) })),
    prodottiRicorrenti: ricorrenti,
    reparti: anni.flatMap((anno) => {
      const perReparto = repartiPerAnno.get(anno);
      const totale = perReparto ? [...perReparto.values()].reduce((somma, valore) => somma + valore, 0) : 0;
      if (!perReparto || totale <= 0) return [];
      return [{
        anno,
        reparti: [...perReparto.entries()]
          .map(([reparto, spazio]) => ({ reparto, quota: quota(spazio, totale) }))
          .sort((a, b) => b.quota - a.quota || confronta(a.reparto, b.reparto)),
      }];
    }),
    copertura: coperturaDi(copertura, referenze),
  };
}

// ─── Volantino ──────────────────────────────────────────────────────

export function sintesiProdotto(prodotto: ProdottoStampato): ReferenzaSintesi {
  return {
    chiave: prodotto.chiave,
    nome: prodotto.nome,
    marca: prodotto.marca,
    formato: prodotto.formato,
    prezzo: prodotto.prezzo,
    barrato: prodotto.barrato,
    sconto: prodotto.sconto,
    foto: prodotto.foto[0] ?? null,
  };
}

/** Il box per la pagina del volantino; null senza posizione, che non si può disegnare. */
export function boxVolantino(box: BoxKit): BoxVolantino | null {
  if (!box.geometria) return null;
  const { x, y, w, h, spazio } = box.geometria;
  return {
    id: box.id,
    x,
    y,
    w,
    h,
    spazio,
    meccanica: box.meccanica,
    reparto: box.reparto,
    sconto: box.sconto,
    referenze: box.prodotti.map(sintesiProdotto),
  };
}

/** Le pagine del volantino: il numero del PDF se c'è, mai meno della pagina più alta con un box. */
export function numeroPagine(paginePdf: number | null, box: readonly BoxKit[]): number {
  const piuAlta = box.reduce((massimo, singolo) => Math.max(massimo, singolo.pagina ?? 0), 0);
  return Math.min(MASSIMO_PAGINE, Math.max(paginePdf ?? 0, piuAlta));
}

/** La proporzione più frequente fra i box (210×297 se non ce ne sono). */
function proporzioneDelKit(box: readonly BoxKit[]): number {
  const conteggi = new Map<number, number>();
  for (const singolo of box) {
    if (singolo.geometria) conteggi.set(singolo.geometria.proporzione, (conteggi.get(singolo.geometria.proporzione) ?? 0) + 1);
  }
  const [piuFrequente] = [...conteggi.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  return piuFrequente?.[0] ?? arrotonda(210 / 297, 4);
}

/** Tutte le pagine, anche quelle senza box, ognuna con i suoi box al loro posto. */
export function pagineDelVolantino(box: readonly BoxKit[], pagine: number): PaginaVolantino[] {
  const proporzione = proporzioneDelKit(box);
  return Array.from({ length: pagine }, (_, indice) => {
    const numero = indice + 1;
    const dellaPagina = box.filter(singolo => singolo.pagina === numero);
    return {
      numero,
      proporzione: dellaPagina.find(singolo => singolo.geometria)?.geometria?.proporzione ?? proporzione,
      boxes: dellaPagina.map(boxVolantino).filter((singolo): singolo is BoxVolantino => singolo !== null),
    };
  });
}

/** Quanta superficie dei box (con posizione e meccanica) va a ogni meccanica, in percentuale. */
export function spazioPerMeccanica(box: readonly BoxKit[]): Array<{ meccanica: MeccanicaReferenza; spazio: number }> {
  const perMeccanica = new Map<MeccanicaReferenza, number>();
  for (const singolo of box) {
    if (singolo.geometria && singolo.meccanica) {
      perMeccanica.set(singolo.meccanica, (perMeccanica.get(singolo.meccanica) ?? 0) + singolo.geometria.spazio);
    }
  }
  const totale = [...perMeccanica.values()].reduce((somma, valore) => somma + valore, 0);
  return MECCANICHE
    .filter(meccanica => perMeccanica.has(meccanica))
    .map(meccanica => ({ meccanica, spazio: quota(perMeccanica.get(meccanica) ?? 0, totale) }))
    .sort((a, b) => b.spazio - a.spazio);
}

/** Una riga della lista dei PV stampata nel volantino. */
export interface RigaListaVolantino {
  posizione: number;
  riga: string;
  regione: string | null;
  provincia: string | null;
  idPuntoVendita: string | null;
  abbinamento: TipoAbbinamento | null;
}

/** Come il volantino stampa il PV, con le righe vicine della stessa provincia; null se non c'è. */
export function rigaDelPuntoVendita(lista: readonly RigaListaVolantino[], idPuntoVendita: string): DettaglioVolantinoPv['rigaPuntoVendita'] {
  const ordinate = [...lista].sort((a, b) => a.posizione - b.posizione);
  const questa = ordinate.find(riga => riga.idPuntoVendita === idPuntoVendita);
  if (!questa) return null;
  const stessaProvincia = ordinate.filter(riga => (riga.provincia ?? '') === (questa.provincia ?? ''));
  const indice = stessaProvincia.indexOf(questa);
  return {
    riga: questa.riga,
    abbinamento: questa.abbinamento ?? 'probabile',
    regione: questa.regione,
    provincia: questa.provincia,
    vicine: stessaProvincia
      .slice(Math.max(0, indice - RIGHE_VICINE), indice + RIGHE_VICINE + 1)
      .map(riga => ({ riga: riga.riga, questo: riga === questa })),
  };
}

// ─── Referenza ──────────────────────────────────────────────────────

export interface PresenzaProdotto {
  edizione: EdizionePuntoVendita;
  prodotto: ProdottoNelKit;
}

/** Le edizioni del PV in cui compare il prodotto (dai kit che lo contengono), dalla più recente. */
export function presenzeDelProdotto(
  edizioni: readonly EdizionePuntoVendita[],
  perKit: ReadonlyMap<string, ProdottoNelKit>,
): PresenzaProdotto[] {
  const presenze: PresenzaProdotto[] = [];
  for (const edizione of edizioni) {
    const prodotto = perKit.get(edizione.idKit);
    if (prodotto) presenze.push({ edizione, prodotto });
  }
  return presenze.reverse();
}

/** Massimo di foto dalle presenze precedenti mostrate nel dettaglio della referenza. */
export const MASSIMO_FOTO_REFERENZA = 12;

/** I kit da cui leggere la descrizione della referenza: l'ultimo, e i piu' recenti con una foto. */
export function kitDaDescrivere(presenze: readonly PresenzaProdotto[]): string[] {
  const conFoto = presenze.filter(presenza => presenza.prodotto.conFoto).slice(0, MASSIMO_FOTO_REFERENZA).map(presenza => presenza.edizione.idKit);
  return [...new Set([...(presenze[0] ? [presenze[0].edizione.idKit] : []), ...conFoto])];
}

const giorni = (da: string, a: string): number => (Date.parse(`${a}T00:00:00Z`) - Date.parse(`${da}T00:00:00Z`)) / 86_400_000;

/** Il prodotto nei box di un kit, con il suo box. */
export function trovaNeiBox(chiave: string, box: readonly BoxKit[]): { box: BoxKit; prodotto: ProdottoStampato } | null {
  for (const singolo of box) {
    const prodotto = singolo.prodotti.find(voce => voce.chiave === chiave);
    if (prodotto) return { box: singolo, prodotto };
  }
  return null;
}

/**
 * Il dettaglio della referenza: intestazione e posizione dall'ultimo volantino del PV che la
 * contiene (i suoi box, se letti), numeri e presenze da tutti. Le presenze vanno dalla più recente;
 * le descrizioni (per kit) danno le foto delle presenze e, se i box non la trovano, l'intestazione.
 */
export function dettaglioReferenza(
  chiave: string,
  presenze: readonly PresenzaProdotto[],
  ultimoKit: { box: readonly BoxKit[]; pagine: number } | null,
  descrizioni: ReadonlyMap<string, DescrizioneProdotto> = new Map(),
): DettaglioReferenzaPv {
  const [ultima] = presenze;
  const trovato = ultimoKit ? trovaNeiBox(chiave, ultimoKit.box) : null;
  const prodotto = trovato?.prodotto ?? null;
  const box = trovato?.box ?? null;
  const descrizione = ultima ? descrizioni.get(ultima.edizione.idKit) ?? null : null;

  const conPrezzo = presenze.filter(presenza => presenza.prodotto.prezzo !== null);
  // A parità di prezzo vale la presenza più recente
  const minima = conPrezzo.reduce<PresenzaProdotto | null>(
    (migliore, presenza) => (migliore === null || (presenza.prodotto.prezzo as number) < (migliore.prodotto.prezzo as number) ? presenza : migliore),
    null,
  );
  const date = [...new Set(presenze.map(presenza => presenza.edizione.data))].sort();
  const foto = [...new Set([
    ...(prodotto?.foto ?? []),
    ...presenze.map(presenza => descrizioni.get(presenza.edizione.idKit)?.foto).filter((voce): voce is string => Boolean(voce)),
  ])];

  const elencoPresenze: PresenzaReferenza[] = presenze.map(({ edizione, prodotto: nelKit }) => ({
    idKit: edizione.idKit,
    promo: { id: edizione.promo.id, nome: edizione.promo.nome, stato: edizione.promo.stato },
    canale: edizione.canale,
    area: edizione.area,
    dal: edizione.promo.validitaDal ?? edizione.data,
    al: edizione.promo.validitaAl,
    pagina: nelKit.pagina,
    spazio: nelKit.spazio,
    meccanica: nelKit.meccanica,
    prezzo: nelKit.prezzo,
    barrato: nelKit.barrato,
    sottocosto: nelKit.sottocosto,
  }));

  const sintesi = ultima?.prodotto ?? null;
  return {
    chiave,
    nome: prodotto?.nome ?? descrizione?.nome ?? DESCRIZIONE_ASSENTE,
    marca: prodotto ? prodotto.marca : descrizione?.marca ?? null,
    formato: prodotto ? prodotto.formato : descrizione?.formato ?? null,
    tipo: prodotto?.tipo ?? null,
    foto,
    prezzo: prodotto?.prezzo ?? sintesi?.prezzo ?? null,
    barrato: prodotto?.barrato ?? sintesi?.barrato ?? null,
    sconto: prodotto?.sconto ?? null,
    prezzoAlKg: prodotto?.prezzoAlKg ?? null,
    meccanica: prodotto?.meccanica ?? sintesi?.meccanica ?? null,
    punti: prodotto?.punti ?? null,
    dati: {
      codice: prodotto?.codice ?? null,
      ean: prodotto?.ean ?? null,
      reparto: prodotto?.reparto ?? box?.reparto ?? null,
      settore: prodotto?.settore ?? null,
      segmento: prodotto?.segmento ?? null,
      ruolo: prodotto?.ruolo ?? null,
      tema: prodotto?.tema ?? null,
      fonte: prodotto?.fonte ?? 'testo',
    },
    posizione: ultimoKit && box?.geometria && box.pagina !== null ? {
      idKit: ultima.edizione.idKit,
      pagina: box.pagina,
      pagine: Math.max(ultimoKit.pagine, box.pagina),
      box: { x: box.geometria.x, y: box.geometria.y, w: box.geometria.w, h: box.geometria.h },
      spazio: box.geometria.spazio,
      referenzeNelBox: box.prodotti.length,
      altriBox: ultimoKit.box
        .filter(altro => altro !== box && altro.pagina === box.pagina && altro.geometria)
        .map(altro => {
          const { x, y, w, h } = altro.geometria as NonNullable<BoxKit['geometria']>;
          return { x, y, w, h };
        }),
      proporzione: box.geometria.proporzione,
    } : null,
    numeri: {
      volantini: presenze.length,
      primoVolantino: date[0] ?? null,
      prezzoMinimo: minima
        ? { prezzo: minima.prodotto.prezzo as number, dal: minima.edizione.promo.validitaDal ?? minima.edizione.data, sottocosto: minima.prodotto.sottocosto }
        : null,
      prezzoAttuale: ultima?.prodotto.prezzo ?? null,
      giorniFraPresenze: date.length >= 2 ? Math.round(giorni(date[0], date[date.length - 1]) / (date.length - 1)) : null,
    },
    presenze: elencoPresenze,
  };
}

// ─── Rete per insegna ───────────────────────────────────────────────

export interface CanaleInAnagrafica {
  id: string;
  nome: string;
  puntiVendita: number;
}

export interface CanaleNelleListe {
  idCanale: string;
  nomeCanale: string;
  anno: number;
  puntiVendita: number;
}

/** Per canale: i PV dell'anagrafica oggi e quelli diversi stampati nelle sue liste, anno per anno. */
export function calcolaReteInsegne(canali: readonly CanaleInAnagrafica[], liste: readonly CanaleNelleListe[]): ReteInsegne {
  const anni = [...new Set(liste.map(voce => voce.anno))].sort((a, b) => a - b);
  const perCanale = new Map<string, { canale: RiferimentoStoria; puntiVendita: number; perAnno: Map<number, number> }>();
  for (const canale of canali) {
    perCanale.set(canale.id, { canale: { id: canale.id, nome: canale.nome }, puntiVendita: canale.puntiVendita, perAnno: new Map() });
  }
  for (const voce of liste) {
    const canale = perCanale.get(voce.idCanale) ?? { canale: { id: voce.idCanale, nome: voce.nomeCanale }, puntiVendita: 0, perAnno: new Map<number, number>() };
    canale.perAnno.set(voce.anno, (canale.perAnno.get(voce.anno) ?? 0) + voce.puntiVendita);
    perCanale.set(voce.idCanale, canale);
  }
  return {
    anni,
    insegne: [...perCanale.values()]
      .filter(voce => voce.puntiVendita > 0 || voce.perAnno.size > 0)
      .sort((a, b) => b.puntiVendita - a.puntiVendita || confronta(a.canale.nome, b.canale.nome))
      .map(voce => ({
        canale: voce.canale,
        puntiVendita: voce.puntiVendita,
        nelleListe: anni.map(anno => ({ anno, puntiVendita: voce.perAnno.get(anno) ?? 0 })),
      })),
  };
}
