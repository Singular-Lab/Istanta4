import { describe, expect, it } from 'vitest';
import { REGOLE_PREVISIONE_STANDARD, type RegolePrevisione, type RichiestaSimulazione } from '../../../lib/insightVolantino/rendimento';
import { type BoxInsight, PESI_VISIBILITA, type PesiVisibilita } from '../../../lib/insightVolantino/tipi';
import {
  type BoxCollocato,
  boxCollocati,
  chiavePosizione,
  type DatiPrevisione,
  erroreSimulazione,
  fasciaSconto,
  fasciaVerticale,
  MAX_CASI_SIMILI,
  modelloVendite,
  type Osservazione,
  osservazioniDellEdizione,
  previsioneVolantino,
  regoleDelCliente,
  simulaProdotto,
  tipoPagina,
} from './previsioneInsight';

// Previsione della mappa di calore e simulazione di un prodotto (spec insight-volantino): dalle
// vendite delle edizioni precedenti della stessa area e canale, o teorica senza vendite.

/** Nei conti a mano: nessun caso "neutro", gli indici sono i rapporti puri. */
const REGOLE_ESATTE: RegolePrevisione = { ...REGOLE_PREVISIONE_STANDARD, edizioniStoriche: 26, casiMinimi: 0, pesoProdotto: 0.7 };

/** Pagine di un volantino di 8: 1 copertina, 5 "altre". Centro verticale 0.1 alto, 0.5 centro, 0.9 basso. */
const COPERTINA_ALTO = { pagina: 1, centroY: 0.1 } as const;
const ALTRE_BASSO = { pagina: 5, centroY: 0.9 } as const;
const ALTRE_CENTRO = { pagina: 5, centroY: 0.5 } as const;

const collocato = (id: string, dati: Partial<BoxCollocato> = {}): BoxCollocato => ({
  id,
  chiave: 'c-A',
  reparto: null,
  ...ALTRE_CENTRO,
  spazio: 10,
  sconto: null,
  ...dati,
});

let progressivo = 0;
const osservazione = (idKit: string, dati: Partial<Osservazione> = {}): Osservazione => ({
  id: `box-${++progressivo}`,
  chiave: 'c-A',
  reparto: null,
  ...ALTRE_CENTRO,
  spazio: 10,
  sconto: null,
  idKit,
  titolo: `Volantino ${idKit}`,
  data: '2026-01-01',
  totalePagine: 8,
  pezzi: 100,
  visibilita: 50,
  ...dati,
});

const dati = (altri: Partial<DatiPrevisione> = {}): DatiPrevisione => ({
  box: [],
  totalePagine: 8,
  storico: [],
  reale: null,
  promoValida: false,
  regole: REGOLE_ESATTE,
  pesi: PESI_VISIBILITA,
  ...altri,
});

const valori = (previsione: ReturnType<typeof previsioneVolantino>) => previsione?.perBox.map(voce => voce.valore);

/** Il prodotto A due volte: in copertina in alto vende 200, in fondo a una pagina interna 100. */
const STORICO_A = [
  osservazione('k1', { ...COPERTINA_ALTO, pezzi: 200 }),
  osservazione('k2', { ...ALTRE_BASSO, pezzi: 100 }),
];

describe('posizione, fasce e regole', () => {
  it('tipo di pagina con le regole del peso della pagina; tre fasce verticali; fasce di sconto', () => {
    expect([tipoPagina(1, 8), tipoPagina(2, 8), tipoPagina(3, 8), tipoPagina(5, 8), tipoPagina(8, 8), tipoPagina(3, 3)])
      .toEqual(['copertina', 'primaDoppia', 'primaDoppia', 'altre', 'ultima', 'ultima']);
    expect([0, 0.33, 0.34, 0.66, 0.67, 1].map(fasciaVerticale)).toEqual(['alto', 'alto', 'centro', 'centro', 'basso', 'basso']);
    expect(chiavePosizione(1, 8, 0.1)).toBe('copertina|alto');
    expect([null, 0, 9.99, 10, 35, 50, 80].map(fasciaSconto)).toEqual([0, 0, 0, 1, 3, 5, 5]);
  });

  it('le regole del cliente sopra le standard, scartando i valori che non sono numeri', () => {
    expect(regoleDelCliente(undefined)).toEqual(REGOLE_PREVISIONE_STANDARD);
    expect(regoleDelCliente({ edizioniStoriche: 4.7, casiMinimi: Number.NaN, pesoProdotto: 2 })).toEqual({
      ...REGOLE_PREVISIONE_STANDARD,
      edizioniStoriche: 4,
      casiMinimi: REGOLE_PREVISIONE_STANDARD.casiMinimi,
      pesoProdotto: 1,
    });
    expect(regoleDelCliente({ edizioniStoriche: -3, pesoProdotto: -1 })).toMatchObject({ edizioniStoriche: 0, pesoProdotto: 0 });
  });

  it('elasticita\' dello spazio ed effetto dello sconto del cliente; i valori non validi restano gli standard', () => {
    expect(regoleDelCliente({ elasticitaSpazio: 0.8, effettoSconto: [1, 1, 1.2, 1.4, 1.6, 1.8] })).toMatchObject({
      elasticitaSpazio: 0.8,
      effettoSconto: [1, 1, 1.2, 1.4, 1.6, 1.8],
    });
    expect(regoleDelCliente({ elasticitaSpazio: 0 })).toMatchObject({ elasticitaSpazio: 0 });
    for (const elasticitaSpazio of [-0.1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(regoleDelCliente({ elasticitaSpazio }).elasticitaSpazio).toBe(REGOLE_PREVISIONE_STANDARD.elasticitaSpazio);
    }
    for (const effettoSconto of [[1, 1.2], [1, 1.1, 1.2, 1.3, 1.4, 0], [1, 1.1, 1.2, 1.3, 1.4, Number.NaN], []]) {
      expect(regoleDelCliente({ effettoSconto }).effettoSconto).toEqual(REGOLE_PREVISIONE_STANDARD.effettoSconto);
    }
    // Una copia: cambiarla non tocca le regole standard
    const regole = regoleDelCliente(undefined);
    regole.effettoSconto[0] = 9;
    expect(REGOLE_PREVISIONE_STANDARD.effettoSconto[0]).toBe(1);
  });
});

describe('box collocati e osservazioni dello storico', () => {
  const boxInsight = (id: string, dati: Partial<BoxInsight>): BoxInsight => ({
    id, codiceBox: id, pagina: 1, geometria: { x: 0, y: 0, w: 0.5, h: 0.2 }, spazio: 10, proporzionePagina: 0.7,
    chiave: `c-${id}`, nome: id, marca: null, formato: null, prezzo: null, barrato: null, sconto: null, prezzoAlKg: null,
    punti: null, sottocosto: false, meccanica: null, meccanicaOriginale: null, reparto: null, foto: [], prodotti: 1,
    idReferenze: [id], visibilita: 0, ...dati,
  });
  const BOX = [
    boxInsight('a', { reparto: { codice: '01', descrizione: 'Freschi' }, sconto: 30, geometria: { x: 0, y: 0, w: 0.5, h: 0.2 }, spazio: 10 }),
    boxInsight('b', { pagina: 4, geometria: { x: 0, y: 0.8, w: 0.5, h: 0.2 }, spazio: 10 }),
    boxInsight('c', { pagina: null, geometria: null, spazio: 0 }),
  ];

  it('solo i box con pagina e geometria, con il centro verticale e il codice del reparto', () => {
    expect(boxCollocati(BOX)).toEqual([
      { id: 'a', chiave: 'c-a', reparto: '01', pagina: 1, centroY: 0.1, spazio: 10, sconto: 30 },
      { id: 'b', chiave: 'c-b', reparto: null, pagina: 4, centroY: 0.9, spazio: 10, sconto: null },
    ]);
  });

  it('pezzi del box se almeno un prodotto ha vendite, null altrimenti; visibilita\' con i pesi del cliente', () => {
    const vendite = new Map([
      ['a', { pezzi: 40, valore: null, prodotti: 1, prodottiSenzaVendite: 0 }],
      ['b', { pezzi: 0, valore: null, prodotti: 1, prodottiSenzaVendite: 1 }],
    ]);
    const edizione = { idKit: 'k9', titolo: 'Volantino di gennaio', data: '2026-01-08', totalePagine: 8 };

    const osservazioni = osservazioniDellEdizione(edizione, BOX, vendite);
    expect(osservazioni.map(voce => [voce.id, voce.pezzi, voce.visibilita, voce.idKit, voce.data, voce.totalePagine])).toEqual([
      // a: 10 × 1 × 0.96 = 9.6; b: 10 × 0.5 × 0.64 = 3.2
      ['a', 40, 100, 'k9', '2026-01-08', 8],
      ['b', null, 33.3, 'k9', '2026-01-08', 8],
    ]);

    const tuttiUguali: PesiVisibilita = { copertina: 1, ultima: 1, primaDoppia: 1, altre: 1, alto: 1, basso: 1 };
    expect(osservazioniDellEdizione(edizione, BOX, null, tuttiUguali).map(voce => [voce.pezzi, voce.visibilita])).toEqual([[null, 100], [null, 100]]);
  });
});

describe('previsioneVolantino dalle vendite', () => {
  it('stesso prodotto: la resa della posizione riporta le vendite osservate', () => {
    const previsione = previsioneVolantino(dati({
      box: [collocato('cop', COPERTINA_ALTO), collocato('int', ALTRE_BASSO)],
      storico: STORICO_A,
    }));

    expect(previsione).toMatchObject({ tipo: 'vendite', unita: 'pezzi', edizioniStoriche: 2, scartoMedio: null });
    expect(valori(previsione)).toEqual([200, 100]);
    expect(previsione?.perBox.map(voce => voce.casiStorici)).toEqual([2, 2]);
    expect(previsione?.nota).toMatch(/2 edizioni precedenti della stessa area e canale \(2 box con vendite\)/);
  });

  it('la resa della posizione vale per gli altri prodotti; senza storico si parte dal reparto, poi dalla media', () => {
    // A (reparto R1) in copertina 200 e dentro 100; B (R2) dentro 40. Conti nel commento del modello:
    // copertina|alto 4/3, altre|basso 140/190; forza A 142,86, reparto R2 54,29, tutti 113,33
    const storico = [
      osservazione('k1', { ...COPERTINA_ALTO, reparto: 'R1', pezzi: 200 }),
      osservazione('k2', { ...ALTRE_BASSO, reparto: 'R1', pezzi: 100 }),
      osservazione('k2', { ...ALTRE_BASSO, chiave: 'c-B', reparto: 'R2', pezzi: 40 }),
    ];

    const previsione = previsioneVolantino(dati({
      box: [
        collocato('A', { ...COPERTINA_ALTO, reparto: 'R1' }),
        collocato('nuovo-R2', { ...COPERTINA_ALTO, chiave: 'c-N', reparto: 'R2' }),
        collocato('nuovo', { ...ALTRE_BASSO, chiave: 'c-N' }),
      ],
      storico,
    }));

    expect(valori(previsione)).toEqual([190.5, 72.4, 83.5]);
    expect(previsione?.perBox.map(voce => [voce.casiStorici, voce.affidabilita])).toEqual([[2, 'alta'], [0, 'bassa'], [0, 'bassa']]);
    expect(previsione?.edizioniStoriche).toBe(2);
  });

  it('l\'effetto dello sconto per fascia, al netto della posizione; una fascia mai vista vale 1', () => {
    const storico = [osservazione('k1', { pezzi: 100 }), osservazione('k2', { sconto: 30, pezzi: 200 })];

    const previsione = previsioneVolantino(dati({
      box: [collocato('s35', { sconto: 35 }), collocato('s5', { sconto: 5 }), collocato('s15', { sconto: 15 })],
      storico,
    }));

    expect(valori(previsione)).toEqual([200, 100, 150]);
  });

  it('lo spazio conta con rendimenti decrescenti: quattro volte lo spazio vale il doppio', () => {
    const storico = [osservazione('k1', { spazio: 10, pezzi: 100 }), osservazione('k2', { spazio: 40, pezzi: 200 })];

    const previsione = previsioneVolantino(dati({
      box: [collocato('piccolo', { spazio: 10 }), collocato('grande', { spazio: 40 }), collocato('pagina', { spazio: 100 })],
      storico,
    }));

    // Spazio di riferimento 25: forza 158,11; × √(10/25), √(40/25), √(100/25)
    expect(valori(previsione)).toEqual([100, 200, 316.2]);
  });

  it('con l\'elasticita\' dello spazio del cliente: a 1 le vendite crescono quanto lo spazio', () => {
    const storico = [osservazione('k1', { spazio: 10, pezzi: 100 }), osservazione('k2', { spazio: 40, pezzi: 400 })];

    const previsione = previsioneVolantino(dati({
      box: [collocato('piccolo', { spazio: 10 }), collocato('grande', { spazio: 40 })],
      storico,
      regole: { ...REGOLE_ESATTE, elasticitaSpazio: 1 },
    }));

    expect(valori(previsione)).toEqual([100, 400]);
  });

  it('con pochi casi la resa della posizione resta vicina a 1 (casiMinimi casi neutri)', () => {
    const box = [collocato('cop', COPERTINA_ALTO)];

    const esatta = previsioneVolantino(dati({ box, storico: STORICO_A, regole: REGOLE_ESATTE }));
    const prudente = previsioneVolantino(dati({ box, storico: STORICO_A, regole: { ...REGOLE_ESATTE, casiMinimi: 3 } }));

    expect(valori(esatta)).toEqual([200]);
    // copertina|alto (200 + 3×150) / (150 + 3×150) = 1,083; forza 146,85
    expect(valori(prudente)).toEqual([159.1]);
    // 2 casi del prodotto, sotto i 3 minimi
    expect(prudente?.perBox[0].affidabilita).toBe('bassa');
  });

  it('affidabilita\' dai casi del prodotto con le soglie del cliente', () => {
    const storico = Array.from({ length: 9 }, (_, indice) => osservazione(`k${indice}`, { pezzi: 100 }));
    const box = [collocato('A')];

    const conSoglia = (casiMinimi: number) =>
      previsioneVolantino(dati({ box, storico, regole: { ...REGOLE_ESATTE, casiMinimi } }))?.perBox[0].affidabilita;

    expect([conSoglia(3), conSoglia(4), conSoglia(10)]).toEqual(['alta', 'media', 'bassa']);
  });

  it('con le vendite reali del volantino: reale per box e scarto medio sul totale del reale', () => {
    const previsione = previsioneVolantino(dati({
      box: [collocato('cop', COPERTINA_ALTO), collocato('int', ALTRE_BASSO), collocato('senza', ALTRE_CENTRO)],
      storico: STORICO_A,
      reale: new Map([['cop', 250], ['int', 50]]),
      promoValida: true,
    }));

    expect(previsione?.perBox.map(voce => [voce.idBox, voce.valore, voce.reale])).toEqual([
      ['cop', 200, 250],
      ['int', 100, 50],
      ['senza', 150, null],
    ]);
    // (|200 - 250| + |100 - 50|) / (250 + 50)
    expect(previsione?.scartoMedio).toBe(33.3);
    expect(previsione?.promoValida).toBe(true);
  });

  it('le edizioni senza vendite non contano', () => {
    const previsione = previsioneVolantino(dati({
      box: [collocato('cop', COPERTINA_ALTO)],
      storico: [...STORICO_A, osservazione('k3', { ...COPERTINA_ALTO, pezzi: null })],
    }));

    expect(previsione?.edizioniStoriche).toBe(2);
    expect(valori(previsione)).toEqual([200]);
  });
});

describe('previsioneVolantino teorica', () => {
  // 1: copertina, centro a 0.1, 20% → 20 × 1 × 0.96 = 19.2; 2: pagina 4 di 8 in fondo, sconto 35% → 20 × 0.5 × 0.64 × 1.5 = 9.6
  const BOX = [collocato('uno', { ...COPERTINA_ALTO, spazio: 20 }), collocato('due', { pagina: 4, centroY: 0.9, spazio: 20, sconto: 35 })];

  it('senza vendite nello storico: indice 0-100 da spazio, pagina, posizione e sconto dichiarato', () => {
    const previsione = previsioneVolantino(dati({ box: BOX, storico: [osservazione('k1', { pezzi: null })] }));

    expect(previsione).toMatchObject({ tipo: 'teorica', unita: 'indice', edizioniStoriche: 0, scartoMedio: null });
    expect(previsione?.nota).toMatch(/^Stima teorica: nessuna vendita importata/);
    expect(previsione?.perBox).toEqual([
      { idBox: 'uno', valore: 100, casiStorici: 0, affidabilita: 'bassa', reale: null },
      { idBox: 'due', valore: 50, casiStorici: 0, affidabilita: 'bassa', reale: null },
    ]);
  });

  it('con i pesi della visibilita\' del cliente', () => {
    const tuttiUguali: PesiVisibilita = { copertina: 1, ultima: 1, primaDoppia: 1, altre: 1, alto: 1, basso: 1 };

    const previsione = previsioneVolantino(dati({ box: BOX, pesi: tuttiUguali }));

    // 20 contro 20 × 1.5: conta solo lo sconto
    expect(valori(previsione)).toEqual([66.7, 100]);
  });

  it('con l\'effetto dello sconto dichiarato dal cliente', () => {
    const senzaEffetto = previsioneVolantino(dati({ box: BOX, regole: { ...REGOLE_ESATTE, effettoSconto: [1, 1, 1, 1, 1, 1] } }));

    // 19.2 contro 20 × 0.5 × 0.64 = 6.4: conta solo la posizione
    expect(valori(senzaEffetto)).toEqual([100, 33.3]);
  });

  it('il reale, se il volantino ha gia\' vendite, nella stessa unita\' (100 = il box che ha venduto di piu\')', () => {
    const previsione = previsioneVolantino(dati({ box: BOX, reale: new Map([['uno', 30], ['due', 60]]) }));

    expect(previsione?.perBox.map(voce => voce.reale)).toEqual([50, 100]);
    // (|100 - 50| + |50 - 100|) / 150
    expect(previsione?.scartoMedio).toBe(66.7);
  });

  it('senza box con geometria non c\'e\' previsione', () => {
    expect(previsioneVolantino(dati({ storico: STORICO_A }))).toBeNull();
  });
});

describe('modelloVendite', () => {
  it('null senza osservazioni con vendite', () => {
    expect(modelloVendite([], REGOLE_ESATTE)).toBeNull();
    expect(modelloVendite([osservazione('k1', { pezzi: null })], REGOLE_ESATTE)).toBeNull();
  });
});

describe('simulaProdotto', () => {
  const richiesta = (dati: Partial<RichiestaSimulazione> = {}): RichiestaSimulazione => ({
    chiave: 'c-A', pagina: 1, x: 0.5, y: 0.1, spazio: 10, sconto: null, ...dati,
  });

  it('dalle vendite: valore previsto, posizione rispetto alla media del volantino, casi simili dal piu\' simile', () => {
    const simulazione = simulaProdotto(richiesta(), dati({
      box: [collocato('cop', COPERTINA_ALTO), collocato('int', ALTRE_BASSO)],
      storico: STORICO_A,
    }));

    expect(simulazione).toMatchObject({ tipo: 'vendite', unita: 'pezzi', valore: 200, casiStorici: 2 });
    // copertina|alto 4/3 sulla media (4/3 + 2/3) / 2 del volantino
    expect(simulazione.indicePosizione).toBe(1.33);
    expect(simulazione.casiSimili).toEqual([
      { idKit: 'k1', titolo: 'Volantino k1', data: '2026-01-01', pagina: 1, sconto: null, spazio: 10, valore: 200 },
      { idKit: 'k2', titolo: 'Volantino k2', data: '2026-01-01', pagina: 5, sconto: null, spazio: 10, valore: 100 },
    ]);
    expect(simulazione.nota).toMatch(/il prodotto ha 2 casi con vendite/);
  });

  it('un prodotto mai visto prende il reparto del volantino; la nota lo dice', () => {
    const storico = [...STORICO_A, osservazione('k2', { ...ALTRE_BASSO, chiave: 'c-B', reparto: 'R2', pezzi: 40 })];

    const simulazione = simulaProdotto(richiesta({ chiave: 'c-N' }), dati({
      box: [collocato('N', { ...ALTRE_BASSO, chiave: 'c-N', reparto: 'R2' })],
      storico,
    }));

    expect(simulazione).toMatchObject({ casiStorici: 0, affidabilita: 'bassa', casiSimili: [] });
    expect(simulazione.nota).toMatch(/dalle vendite del suo reparto/);
  });

  it('al massimo cinque casi simili; a parita\' di somiglianza il piu\' recente', () => {
    const storico = Array.from({ length: 7 }, (_, indice) => osservazione(`k${indice}`, { ...COPERTINA_ALTO, data: `2026-01-0${indice + 1}` }));

    const simulazione = simulaProdotto(richiesta(), dati({ box: [collocato('cop', COPERTINA_ALTO)], storico }));

    expect(simulazione.casiSimili).toHaveLength(MAX_CASI_SIMILI);
    expect(simulazione.casiSimili.map(caso => caso.idKit)).toEqual(['k6', 'k5', 'k4', 'k3', 'k2']);
  });

  it('teorica: indice rispetto al box piu\' forte del volantino, al massimo 100; casi simili con la visibilita\'', () => {
    const box = [collocato('uno', { ...COPERTINA_ALTO, spazio: 20 }), collocato('due', { pagina: 4, centroY: 0.9, spazio: 20, sconto: 35 })];
    const storico = [osservazione('k1', { pezzi: null, visibilita: 72 })];

    const grande = simulaProdotto(richiesta({ spazio: 40 }), dati({ box, storico }));
    const come2 = simulaProdotto(richiesta({ pagina: 4, y: 0.9, spazio: 20, sconto: 35 }), dati({ box, storico }));

    expect(grande).toMatchObject({ tipo: 'teorica', unita: 'indice', valore: 100, casiStorici: 0, affidabilita: 'bassa' });
    expect(grande.nota).toMatch(/^Stima teorica: nessuna vendita importata/);
    expect(grande.casiSimili.map(caso => caso.valore)).toEqual([72]);
    expect(come2.valore).toBe(50);
    // 0.5 × 0.64 sulla media di 0.96 e 0.32
    expect(come2.indicePosizione).toBe(0.5);
  });
});

describe('erroreSimulazione', () => {
  const valida: RichiestaSimulazione = { chiave: 'c-123', pagina: 2, x: 0.5, y: 0.5, spazio: 12, sconto: 20 };

  it('una richiesta valida, anche ai limiti e senza sconto', () => {
    expect(erroreSimulazione(valida)).toBeNull();
    expect(erroreSimulazione({ ...valida, x: 0, y: 1, spazio: 100, sconto: null })).toBeNull();
    expect(erroreSimulazione({ ...valida, sconto: 0 })).toBeNull();
  });

  it.each([
    ['chiave vuota', { chiave: '  ' }],
    ['pagina 0', { pagina: 0 }],
    ['pagina non intera', { pagina: 1.5 }],
    ['pagina mancante', { pagina: Number.NaN }],
    ['x sotto 0', { x: -0.1 }],
    ['y oltre 1', { y: 1.1 }],
    ['x mancante', { x: Number.NaN }],
    ['spazio 0', { spazio: 0 }],
    ['spazio oltre 100', { spazio: 101 }],
    ['sconto negativo', { sconto: -1 }],
    ['sconto oltre 100', { sconto: 101 }],
    ['sconto non numerico', { sconto: Number.NaN }],
  ])('%s non e\' valida', (_, errata) => {
    expect(erroreSimulazione({ ...valida, ...errata })).toEqual(expect.any(String));
  });
});
