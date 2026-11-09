import { describe, expect, it } from 'vitest';
import type { BoxInsight, QuotaSpazio, SintesiVolantino } from '../../../lib/insightVolantino/tipi';
import { type BoxKit, boxDelKit } from './analisiKit';
import {
  confrontoSintesi,
  confrontoSpazioPerReparto,
  differenzeFraVarianti,
  prodottiAssenti,
  TOLLERANZA_PREZZO,
  TOLLERANZA_SCONTO,
  variazione,
} from './diffVarianti';
import { leggiReferenza, type ProdottoStampato, type RigaReferenza } from './referenzaStampata';

// Due volantini a confronto: varianti area/canale della stessa promo (prodotto per prodotto, box per
// box) ed edizione precedente (numeri chiave, spazio per reparto, prodotti entrati e usciti).

const prodotto = (chiave: string, dati: Partial<ProdottoStampato> = {}): ProdottoStampato => ({
  chiave,
  nome: `Prodotto ${chiave}`,
  marca: null,
  formato: null,
  tipo: null,
  codice: null,
  ean: null,
  prezzo: 1.99,
  barrato: null,
  sconto: null,
  prezzoAlKg: null,
  punti: null,
  meccanica: null,
  sottocosto: false,
  reparto: null,
  settore: null,
  segmento: null,
  ruolo: null,
  tema: null,
  fonte: 'istanta',
  foto: [],
  ...dati,
});

/** Un box con i suoi prodotti (il primo e' il pilota), con o senza posizione sulla pagina. */
const box = (id: string, pagina: number | null, prodotti: ProdottoStampato[], spazio = 4): BoxKit => ({
  id,
  codiceBox: id,
  pagina,
  geometria: pagina === null ? null : { pagina, x: 0.1, y: 0.1, w: 0.2, h: 0.2, spazio, proporzione: 0.73 },
  meccanica: null,
  reparto: null,
  sconto: prodotti[0]?.sconto ?? null,
  referenze: [],
  prodotti,
});

/** Il box come lo descrivono gli insight: qui conta solo lo spazio. */
const insight = (singolo: BoxKit, spazio: number): BoxInsight => ({
  id: singolo.id,
  codiceBox: singolo.codiceBox,
  pagina: singolo.pagina,
  geometria: null,
  spazio,
  proporzionePagina: null,
  chiave: singolo.prodotti[0].chiave,
  nome: singolo.prodotti[0].nome,
  marca: null,
  formato: null,
  prezzo: singolo.prodotti[0].prezzo,
  barrato: null,
  sconto: singolo.sconto,
  prezzoAlKg: null,
  punti: null,
  sottocosto: false,
  meccanica: null,
  meccanicaOriginale: null,
  reparto: null,
  foto: [],
  prodotti: singolo.prodotti.length,
  idReferenze: [singolo.id],
});

const insightDi = (elenco: BoxKit[]): BoxInsight[] => elenco.map(singolo => insight(singolo, singolo.geometria?.spazio ?? 0));

describe('differenzeFraVarianti', () => {
  it('un prodotto solo in questa variante e uno solo nell\'altra: box colorati e presenza dove c\'e\'', () => {
    const qui = [box('q1', 1, [prodotto('c-A')]), box('q2', 2, [prodotto('c-B', { nome: 'Pane', marca: 'Forno' })], 6)];
    const altra = [box('a1', 1, [prodotto('c-A')]), box('a2', 3, [prodotto('c-C', { nome: 'Olio' })], 8)];

    const esito = differenzeFraVarianti(qui, altra, insightDi(qui), insightDi(altra));

    expect(esito.statoBoxQui).toEqual({ q1: 'uguale', q2: 'solo-qui' });
    expect(esito.statoBoxAltra).toEqual({ a1: 'uguale', a2: 'solo-altra' });
    expect(esito.conteggi).toEqual({ 'solo-qui': 1, 'solo-altra': 1, 'prezzo-diverso': 0, uguale: 1 });
    expect(esito.differenze).toEqual([
      { chiave: 'c-B', nome: 'Pane', marca: 'Forno', stato: 'solo-qui', qui: { idBox: 'q2', pagina: 2, prezzo: 1.99, sconto: null, spazio: 6 }, altra: null },
      { chiave: 'c-C', nome: 'Olio', marca: null, stato: 'solo-altra', qui: null, altra: { idBox: 'a2', pagina: 3, prezzo: 1.99, sconto: null, spazio: 8 } },
    ]);
  });

  it('un prezzo diverso oltre mezzo centesimo e\' una differenza; dentro la tolleranza no', () => {
    const qui = [box('q1', 1, [prodotto('c-A', { prezzo: 1.49 })]), box('q2', 1, [prodotto('c-B', { prezzo: 2 })])];
    const altra = [box('a1', 1, [prodotto('c-A', { prezzo: 1.59 })]), box('a2', 1, [prodotto('c-B', { prezzo: 2 + TOLLERANZA_PREZZO / 2 })])];

    const esito = differenzeFraVarianti(qui, altra, insightDi(qui), insightDi(altra));

    expect(esito.statoBoxQui).toEqual({ q1: 'prezzo-diverso', q2: 'uguale' });
    expect(esito.statoBoxAltra).toEqual({ a1: 'prezzo-diverso', a2: 'uguale' });
    expect(esito.differenze).toHaveLength(1);
    expect(esito.differenze[0]).toMatchObject({ chiave: 'c-A', stato: 'prezzo-diverso', qui: { prezzo: 1.49 }, altra: { prezzo: 1.59 } });
  });

  it('a parita\' di prezzo conta lo sconto: oltre mezzo punto e\' diverso', () => {
    const qui = [box('q1', 1, [prodotto('c-A', { sconto: 30 })]), box('q2', 1, [prodotto('c-B', { sconto: 20 })])];
    const altra = [box('a1', 1, [prodotto('c-A', { sconto: 31 })]), box('a2', 1, [prodotto('c-B', { sconto: 20 + TOLLERANZA_SCONTO - 0.1 })])];

    const esito = differenzeFraVarianti(qui, altra, insightDi(qui), insightDi(altra));

    expect(esito.differenze.map(differenza => [differenza.chiave, differenza.stato])).toEqual([['c-A', 'prezzo-diverso']]);
    expect(esito.differenze[0]).toMatchObject({ qui: { sconto: 30 }, altra: { sconto: 31 } });
  });

  it('un dato che c\'e\' in una sola variante e\' una differenza; se manca in tutte e due no', () => {
    const qui = [box('q1', 1, [prodotto('c-A', { prezzo: null })]), box('q2', 1, [prodotto('c-B', { prezzo: null })])];
    const altra = [box('a1', 1, [prodotto('c-A', { prezzo: 0.99 })]), box('a2', 1, [prodotto('c-B', { prezzo: null })])];

    const esito = differenzeFraVarianti(qui, altra, insightDi(qui), insightDi(altra));

    expect(esito.statoBoxQui).toEqual({ q1: 'prezzo-diverso', q2: 'uguale' });
  });

  it('un box con piu\' prodotti prende lo stato piu\' rilevante: solo qui, poi prezzo diverso, poi uguale', () => {
    // c-B e' pilota qui ed elemento del gruppo nell'altra: si confronta lo stesso
    const qui = [
      box('q1', 1, [prodotto('c-B', { prezzo: 3 }), prodotto('c-A'), prodotto('c-X')]),
      box('q2', 2, [prodotto('c-C'), prodotto('c-D', { prezzo: 5 })]),
      box('q3', 2, [prodotto('c-E')]),
    ];
    const altra = [
      box('a1', 1, [prodotto('c-A'), prodotto('c-B', { prezzo: 2.5 })]),
      box('a2', 2, [prodotto('c-C'), prodotto('c-D', { prezzo: 4.5 }), prodotto('c-E'), prodotto('c-Y')]),
    ];

    const esito = differenzeFraVarianti(qui, altra, insightDi(qui), insightDi(altra));

    expect(esito.statoBoxQui).toEqual({ q1: 'solo-qui', q2: 'prezzo-diverso', q3: 'uguale' });
    expect(esito.statoBoxAltra).toEqual({ a1: 'prezzo-diverso', a2: 'solo-altra' });
    expect(esito.conteggi).toEqual({ 'solo-qui': 1, 'solo-altra': 1, 'prezzo-diverso': 2, uguale: 3 });
    // Ogni differenza dice in quale box sta il prodotto in ciascuna variante
    expect(esito.differenze.find(differenza => differenza.chiave === 'c-B')).toMatchObject({ qui: { idBox: 'q1', prezzo: 3 }, altra: { idBox: 'a1', prezzo: 2.5 } });
    expect(esito.differenze.find(differenza => differenza.chiave === 'c-D')).toMatchObject({ qui: { idBox: 'q2' }, altra: { idBox: 'a2' } });
  });

  it('senza differenze l\'elenco e\' vuoto e tutti i box sono uguali', () => {
    const qui = [box('q1', 1, [prodotto('c-A', { sconto: 25 })]), box('q2', null, [prodotto('c-B')])];
    const altra = [box('a1', 4, [prodotto('c-A', { sconto: 25 })]), box('a2', 1, [prodotto('c-B')])];

    const esito = differenzeFraVarianti(qui, altra, insightDi(qui), insightDi(altra));

    expect(esito.differenze).toEqual([]);
    expect(esito.statoBoxQui).toEqual({ q1: 'uguale', q2: 'uguale' });
    expect(esito.statoBoxAltra).toEqual({ a1: 'uguale', a2: 'uguale' });
    expect(esito.conteggi).toEqual({ 'solo-qui': 0, 'solo-altra': 0, 'prezzo-diverso': 0, uguale: 2 });
  });

  it('due volantini vuoti non hanno differenze', () => {
    expect(differenzeFraVarianti([], [], [], [])).toEqual({
      statoBoxQui: {},
      statoBoxAltra: {},
      differenze: [],
      conteggi: { 'solo-qui': 0, 'solo-altra': 0, 'prezzo-diverso': 0, uguale: 0 },
    });
  });

  it('l\'elenco e\' ordinato per stato, poi per pagina; i box senza pagina in fondo al loro stato', () => {
    const qui = [
      box('q-senza', null, [prodotto('c-S1')]),
      box('q5', 5, [prodotto('c-S5')]),
      box('q2', 2, [prodotto('c-S2')]),
      box('q3', 3, [prodotto('c-P', { prezzo: 1 })]),
    ];
    const altra = [box('a1', 1, [prodotto('c-P', { prezzo: 2 })]), box('a4', 4, [prodotto('c-O4')])];

    const esito = differenzeFraVarianti(qui, altra, insightDi(qui), insightDi(altra));

    expect(esito.differenze.map(differenza => differenza.chiave)).toEqual(['c-S2', 'c-S5', 'c-S1', 'c-O4', 'c-P']);
  });

  it('lo spazio e\' quello del box negli insight; senza insight quello della geometria, o 0', () => {
    const qui = [box('q1', 1, [prodotto('c-A')], 12), box('q2', null, [prodotto('c-B')])];

    const conInsight = differenzeFraVarianti(qui, [], [insight(qui[0], 11.5)], []);
    expect(conInsight.differenze.map(differenza => differenza.qui?.spazio)).toEqual([11.5, 0]);

    const senzaInsight = differenzeFraVarianti(qui, [], [], []);
    expect(senzaInsight.differenze.map(differenza => differenza.qui?.spazio)).toEqual([12, 0]);
  });

  it('con le referenze vere: stesso prodotto per codice in due varianti, Istanta e storico', () => {
    const riga = (id: string, dati: Record<string, unknown>, pag = 1): RigaReferenza => ({
      id, compiled_fields: [], data_fields: dati, foto: [], meccanica: '', codice_box: id, group_elements: [],
      pag, x: 10, y: 10, w: 50, h: 50, w_page: 210, h_page: 287, perc_ingombro: null,
    });
    for (const storico of [false, true]) {
      const leggi = (righe: RigaReferenza[]) => boxDelKit(righe.map(r => leggiReferenza(r, { storico })));
      const qui = leggi([
        riga('q1', { codice_referenza: 'A', descrizione_uno: 'Mozzarella', prezzo: 1.2, prezzo_anziche: 2 }),
        riga('q2', { codice_referenza: 'B', descrizione_uno: 'Pane', prezzo: 3 }, 2),
      ]);
      const altra = leggi([riga('a1', { codice_referenza: 'A', descrizione_uno: 'Mozzarella', prezzo: 1.3, prezzo_anziche: 2 })]);

      const esito = differenzeFraVarianti(qui, altra, insightDi(qui), insightDi(altra));

      expect(esito.differenze.map(differenza => [differenza.chiave, differenza.stato]), storico ? 'storico' : 'Istanta').toEqual([
        ['c-B', 'solo-qui'],
        ['c-A', 'prezzo-diverso'],
      ]);
    }
  });
});

describe('edizione precedente', () => {
  const sintesi = (dati: Partial<SintesiVolantino>): SintesiVolantino => ({
    referenze: 0,
    box: 0,
    pagine: 0,
    scontoMedio: null,
    boxConSconto: 0,
    quotaFidelity: 0,
    sottocosto: 0,
    marche: 0,
    copertura: { prezzo: 0, marca: 0, reparto: 0, geometria: 0 },
    ...dati,
  });

  it('la variazione e\' la differenza arrotondata; senza uno dei due valori non c\'e\'', () => {
    expect(variazione(25.4, 22.1)).toEqual({ attuale: 25.4, precedente: 22.1, differenza: 3.3 });
    expect(variazione(10, 12)).toEqual({ attuale: 10, precedente: 12, differenza: -2 });
    expect(variazione(null, 12)).toEqual({ attuale: null, precedente: 12, differenza: null });
    expect(variazione(18, null)).toEqual({ attuale: 18, precedente: null, differenza: null });
  });

  it('i numeri chiave del volantino accanto a quelli dell\'edizione precedente', () => {
    const confronto = confrontoSintesi(
      sintesi({ referenze: 120, box: 90, pagine: 16, scontoMedio: 28.5, quotaFidelity: 40, sottocosto: 3, marche: 55 }),
      sintesi({ referenze: 100, box: 80, pagine: 12, scontoMedio: null, quotaFidelity: 35, sottocosto: 5, marche: 50 }),
    );

    expect(confronto).toEqual({
      referenze: { attuale: 120, precedente: 100, differenza: 20 },
      box: { attuale: 90, precedente: 80, differenza: 10 },
      pagine: { attuale: 16, precedente: 12, differenza: 4 },
      scontoMedio: { attuale: 28.5, precedente: null, differenza: null },
      quotaFidelity: { attuale: 40, precedente: 35, differenza: 5 },
      sottocosto: { attuale: 3, precedente: 5, differenza: -2 },
      marche: { attuale: 55, precedente: 50, differenza: 5 },
    });
  });

  it('lo spazio per reparto unisce i reparti dei due volantini: quello che manca vale 0', () => {
    const quota = (chiave: string, etichetta: string, quotaSpazio: number): QuotaSpazio => ({
      chiave, etichetta, referenze: 1, spazio: quotaSpazio, quotaReferenze: 0, quotaSpazio,
    });

    const confronto = confrontoSpazioPerReparto(
      [quota('01', 'Freschi', 40), quota('02', 'Bevande', 25), quota('', 'Reparto non indicato', 5)],
      [quota('02', 'Bevande', 30), quota('03', 'Casa', 20)],
    );

    expect(confronto).toEqual([
      { chiave: '01', etichetta: 'Freschi', attuale: 40, precedente: 0 },
      { chiave: '02', etichetta: 'Bevande', attuale: 25, precedente: 30 },
      { chiave: '', etichetta: 'Reparto non indicato', attuale: 5, precedente: 0 },
      { chiave: '03', etichetta: 'Casa', attuale: 0, precedente: 20 },
    ]);
    expect(confrontoSpazioPerReparto([], [])).toEqual([]);
  });

  it('prodotti entrati e usciti per chiave, su tutti i prodotti dei box, nell\'ordine del volantino', () => {
    const attuale = [
      box('n1', 1, [prodotto('c-A'), prodotto('c-N2', { nome: 'Novita\' nel gruppo', marca: 'Marca', sconto: 20 })]),
      box('n2', 2, [prodotto('c-N1', { prezzo: 0.89 })]),
    ];
    const precedente = [box('p1', 1, [prodotto('c-U1')]), box('p2', 3, [prodotto('c-X'), prodotto('c-A')])];

    expect(prodottiAssenti(attuale, precedente)).toEqual([
      { chiave: 'c-N2', nome: 'Novita\' nel gruppo', marca: 'Marca', prezzo: 1.99, sconto: 20 },
      { chiave: 'c-N1', nome: 'Prodotto c-N1', marca: null, prezzo: 0.89, sconto: null },
    ]);
    expect(prodottiAssenti(precedente, attuale).map(voce => voce.chiave)).toEqual(['c-U1', 'c-X']);
    expect(prodottiAssenti(attuale, attuale)).toEqual([]);
  });
});
