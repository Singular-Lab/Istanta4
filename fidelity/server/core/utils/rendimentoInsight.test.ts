import { describe, expect, it } from 'vitest';
import type { BoxInsight } from '../../../lib/insightVolantino/tipi';
import { boxDelKit } from './analisiKit';
import { leggiReferenza, type RigaReferenza } from './referenzaStampata';
import {
  codiciDaCercare,
  codiciDeiBox,
  rendimentoVolantino,
  type VenditeDelPeriodo,
  venditeDeiBox,
} from './rendimentoInsight';

// Rendimento dei box dalle vendite (spec vendite-volantino): quota delle vendite accanto alla quota
// di spazio, indice di spazio, box sopra e sotto lo spazio, prodotti senza vendite.

/** Un box degli insight con geometria: 10% di pagina salvo indicazione. */
const box = (id: string, dati: Partial<BoxInsight> = {}): BoxInsight => ({
  id,
  codiceBox: id,
  pagina: 1,
  geometria: { x: 0, y: 0, w: 0.5, h: 0.2 },
  spazio: 10,
  proporzionePagina: 0.7,
  chiave: `c-${id}`,
  nome: id,
  marca: null,
  formato: null,
  prezzo: null,
  barrato: null,
  sconto: null,
  prezzoAlKg: null,
  punti: null,
  sottocosto: false,
  meccanica: null,
  meccanicaOriginale: null,
  reparto: null,
  foto: [],
  prodotti: 1,
  idReferenze: [id],
  visibilita: 0,
  ...dati,
});

const SENZA_GEOMETRIA: Partial<BoxInsight> = { pagina: null, geometria: null, spazio: 0 };

/** Vendite per codice: [pezzi, valore]. */
const vendite = (perCodice: Record<string, [number, number | null]>, dati: Partial<VenditeDelPeriodo> = {}): VenditeDelPeriodo => ({
  periodo: { dal: '2026-03-05', al: '2026-03-18' },
  puntiVendita: 12,
  perCodice: new Map(Object.entries(perCodice).map(([codice, [pezzi, valore]]) => [codice, { pezzi, valore }] as const)),
  conValore: true,
  ...dati,
});

const codici = (voci: Record<string, Array<string | null>>) => new Map(Object.entries(voci));

describe('codiciDeiBox: i codici dei prodotti dalla lettura generica delle referenze', () => {
  const riga = (id: string, dati: Partial<RigaReferenza>): RigaReferenza => ({
    id, compiled_fields: [], data_fields: {}, foto: [], meccanica: '', codice_box: id, group_elements: [],
    pag: 1, x: 0, y: 0, w: 10, h: 10, w_page: 100, h_page: 100, ...dati,
  });

  it('pilota ed elementi del gruppo, nella forma delle vendite; null per chi non ha codice', () => {
    const kit = boxDelKit([
      riga('r1', {
        data_fields: { codice_referenza: '000123', descrizione_uno: 'Mozzarella' },
        group_elements: [
          { codice_referenza: ' ab12 ', descrizione_uno: 'Burrata' },
          { descrizione_uno: 'Stracciatella' },
        ],
      }),
      riga('r2', { pag: 2, data_fields: { descrizione_uno: 'Olio' } }),
    ].map(voce => leggiReferenza(voce, { storico: false })));

    expect(codiciDeiBox(kit)).toEqual(new Map([
      ['r1', ['123', 'AB12', null]],
      ['r2', [null]],
    ]));
  });
});

describe('codiciDaCercare', () => {
  it('i codici dei soli box con geometria, una volta, in ordine', () => {
    const elenco = codiciDaCercare(
      [box('a'), box('b'), box('d', SENZA_GEOMETRIA)],
      codici({ a: ['B1', 'A1'], b: ['A1', null], d: ['D1'] }),
    );

    expect(elenco).toEqual(['A1', 'B1']);
  });
});

describe('rendimentoVolantino', () => {
  // A rende piu' dello spazio, B molto di piu', C non ha vendite (codice non nel file), E rende poco;
  // D non ha geometria e resta fuori anche se vende
  const BOX = [box('A', { spazio: 20 }), box('B'), box('C'), box('E', { spazio: 20 }), box('D', SENZA_GEOMETRIA)];
  const CODICI = codici({ A: ['A1'], B: ['B1', 'B2'], C: ['C1'], E: ['E1'], D: ['D1'] });
  const VENDITE = vendite({ A1: [100, 300], B1: [50, 100], B2: [50, 100], E1: [10, 20], D1: [999, 999] });

  it('quote sul valore accanto alle quote di spazio, indice di spazio e totali dei soli box con geometria', () => {
    const rendimento = rendimentoVolantino(BOX, CODICI, VENDITE);

    expect(rendimento).toMatchObject({
      periodo: { dal: '2026-03-05', al: '2026-03-18' },
      puntiVendita: 12,
      misura: 'valore',
      totalePezzi: 210,
      totaleValore: 520,
      prodotti: 5,
      prodottiSenzaVendite: 1,
    });
    expect(rendimento.perBox).toEqual([
      { idBox: 'A', pezzi: 100, valore: 300, quota: 57.7, quotaSpazio: 33.3, indiceSpazio: 1.73, prodotti: 1, prodottiSenzaVendite: 0 },
      { idBox: 'B', pezzi: 100, valore: 200, quota: 38.5, quotaSpazio: 16.7, indiceSpazio: 2.31, prodotti: 2, prodottiSenzaVendite: 0 },
      { idBox: 'C', pezzi: 0, valore: 0, quota: 0, quotaSpazio: 16.7, indiceSpazio: 0, prodotti: 1, prodottiSenzaVendite: 1 },
      { idBox: 'E', pezzi: 10, valore: 20, quota: 3.8, quotaSpazio: 33.3, indiceSpazio: 0.12, prodotti: 1, prodottiSenzaVendite: 0 },
    ]);
  });

  it('sopra lo spazio dal migliore; sotto dal peggiore, senza i box di cui non c\'e\' nessuna vendita', () => {
    const rendimento = rendimentoVolantino(BOX, CODICI, VENDITE);

    expect(rendimento.sopraSpazio).toEqual(['B', 'A']);
    // C ha indice 0 ma nessuna riga: puo' essere un codice che il file non riporta
    expect(rendimento.sottoSpazio).toEqual(['E']);
  });

  it('se anche una sola riga non ha il valore, la misura sono i pezzi e il valore non si mostra', () => {
    const rendimento = rendimentoVolantino(BOX, CODICI, vendite({ A1: [100, null], B1: [50, 100], B2: [50, 100], E1: [10, 20] }, { conValore: false }));

    expect(rendimento.misura).toBe('pezzi');
    expect(rendimento.totaleValore).toBeNull();
    expect(rendimento.perBox.map(voce => [voce.idBox, voce.valore, voce.quota])).toEqual([
      ['A', null, 47.6],
      ['B', null, 47.6],
      ['C', null, 0],
      ['E', null, 4.8],
    ]);
  });

  it('un codice in due box divide le vendite a meta\': il totale non lo conta due volte', () => {
    const rendimento = rendimentoVolantino(
      [box('P'), box('Q', { pagina: 2 })],
      codici({ P: ['X'], Q: ['X', 'Y'] }),
      vendite({ X: [90, 180], Y: [10, 20] }),
    );

    expect(rendimento.perBox.map(voce => [voce.idBox, voce.pezzi, voce.valore])).toEqual([['P', 45, 90], ['Q', 55, 110]]);
    expect(rendimento.totalePezzi).toBe(100);
    expect(rendimento.prodotti).toBe(2);
  });

  it('un prodotto senza codice e\' senza vendite; un box senza spazio non ha indice', () => {
    const rendimento = rendimentoVolantino(
      [box('S', { spazio: 0 }), box('T')],
      codici({ S: ['Z'], T: [null, 'W'] }),
      vendite({ Z: [5, 10], W: [5, 10] }),
    );

    expect(rendimento.perBox).toEqual([
      expect.objectContaining({ idBox: 'S', quotaSpazio: 0, indiceSpazio: null }),
      expect.objectContaining({ idBox: 'T', prodotti: 2, prodottiSenzaVendite: 1, quotaSpazio: 100, indiceSpazio: 0.5 }),
    ]);
    expect(rendimento).toMatchObject({ prodotti: 3, prodottiSenzaVendite: 1 });
  });
});

describe('venditeDeiBox', () => {
  it('solo i box con geometria, con pezzi, valore e prodotti senza vendite', () => {
    const perBox = venditeDeiBox(
      [box('A'), box('D', SENZA_GEOMETRIA)],
      codici({ A: ['A1', 'A2'], D: ['D1'] }),
      vendite({ A1: [3, 6], D1: [1, 1] }),
    );

    expect(perBox).toEqual(new Map([['A', { pezzi: 3, valore: 6, prodotti: 2, prodottiSenzaVendite: 1 }]]));
  });
});
