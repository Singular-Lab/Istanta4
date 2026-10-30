import { describe, expect, it } from 'vitest';
import { MECCANICHE } from '../../../lib/puntiVendita/analisi';
import {
  AGGREGATI_VUOTI,
  aggregatiDi,
  boxDelKit,
  descrizioneDaCompatta,
  prodottoDaCompatto,
  riassumiKit,
  VERSIONE_ANALISI_KIT,
} from './analisiKit';
import { leggiReferenza, type RigaReferenza } from './referenzaStampata';

// I box di un volantino e il riepilogo del kit che le pagine dei punti vendita combinano

const campo = (labelName: string, content: string, paragraphName = '') => ({ labelName, paragraphName, content });

const descrizione = (nome: string, marca?: string, formato?: string, paragrafo = 'DES_Descrizione') =>
  campo('descrizione', `<DES_descr_nome>${nome}</DES_descr_nome>${marca ? `<DES_descr_marca><br>${marca}</DES_descr_marca>` : ''}${formato ? `<DES_descr_gr>${formato}</DES_descr_gr>` : ''}`, paragrafo);

/** Un box dello storico: pagina 210×287, x relativa alla pagina. */
const box = (id: string, dati: Partial<RigaReferenza>): RigaReferenza => ({
  id,
  compiled_fields: [],
  data_fields: {},
  foto: [`foto-${id}`],
  meccanica: '',
  codice_box: id,
  group_elements: [],
  pag: 2,
  x: 15,
  y: 20,
  w: 63,
  h: 61.5,
  w_page: 210,
  h_page: 287,
  ...dati,
});

const leggi = (righe: RigaReferenza[], storico = true) => righe.map(riga => leggiReferenza(riga, { storico }));

/** Un volantino dello storico di tre pagine. */
const KIT_STORICO = [
  box('r1', {
    compiled_fields: [
      campo('prezzo_offerta', '1,69', 'PREZ_FidelityR'),
      campo('campo_offerta', '€ 2,95', 'PREZ_CampoOfferta_barrato'),
      campo('sconto_effettivo_grande', '-42,71%', 'Sconto_SIR_Grande'),
      descrizione('Mozzarella', 'Granarolo', '100 g'),
    ],
  }),
  box('r2', {
    x: 100,
    compiled_fields: [campo('prezzo_offerta', '0,99', 'PREZ_NoSconto'), descrizione('Crema di yogurt', 'MÜLLER', '125 g', 'DIC_Rep_25')],
  }),
  box('r3', {
    pag: 1, x: 5, y: 5, w: 200, h: 100,
    compiled_fields: [
      campo('prezzo_offerta_EURprima', '€ 1,85', 'PREZ_Sconto_EURprima'),
      campo('sconto_norm', '30', 'SCONTO_Normale'),
      campo('campo_offerta', '€ 2,65', 'PREZ_CampoOfferta_barrato'),
      descrizione('Yogurt greco', 'Muller', '150 g', 'DIC_Rep_25'),
    ],
  }),
  // Senza posizione: si conta, ma non si disegna
  box('r4', {
    pag: 3, x: null, y: null, w: null, h: null,
    compiled_fields: [campo('punti1', '2', 'Campo_punti1_MC'), descrizione('Bon Roll', 'Aia')],
  }),
];

describe('boxDelKit', () => {
  it('nello storico ogni referenza e\' un box: in ordine di pagina, dall\'alto e da sinistra, senza posizione in fondo', () => {
    const elenco = boxDelKit(leggi(KIT_STORICO));

    expect(elenco.map(singolo => singolo.id)).toEqual(['r3', 'r1', 'r2', 'r4']);
    expect(elenco[1]).toMatchObject({ pagina: 2, meccanica: 'fidelity', sconto: 42.71, reparto: null, geometria: { spazio: 6.43 } });
    expect(elenco[3]).toMatchObject({ pagina: 3, geometria: null, meccanica: 'punti' });
  });

  it('Istanta usa lo stesso codice per box diversi: conta la posizione; il gruppo entra nei prodotti del box', () => {
    const istanta = (id: string, x: number, gruppo: unknown[] = []): RigaReferenza => box(id, {
      codice_box: 'BOX1', pag: 3, x, y: 34, w: 65.3, h: 78.4, w_page: 290, h_page: 320, meccanica: 'TP_MM',
      data_fields: { codice_referenza: id, descrizione_uno: `Prodotto ${id}`, prezzo: '1,99' },
      group_elements: gruppo,
    });
    const elenco = boxDelKit(leggi([
      istanta('100', 296.5, [{ 'Referenza.Codice': '100' }, { 'Referenza.Codice': '200', 'Descrizioni.Descrizione1': 'Variante' }]),
      istanta('300', 363.6),
    ], false));

    expect(elenco).toHaveLength(2);
    expect(elenco[0].prodotti.map(prodotto => prodotto.chiave)).toEqual(['c-100', 'c-200']);
    expect(elenco[0].geometria).toMatchObject({ x: 0.0224 });
    expect(elenco[1].prodotti.map(prodotto => prodotto.chiave)).toEqual(['c-300']);
  });

  it('le compilate a mano senza posizione vanno nel box con lo stesso codice nella stessa pagina; la prima e\' la pilota', () => {
    const fantasma = (id: string, posizione: boolean, nome: string): RigaReferenza => box(id, {
      codice_box: 'G7', pag: 4,
      ...(posizione ? {} : { x: null, y: null, w: null, h: null, w_page: null, h_page: null }),
      data_fields: { codice_referenza: id, descrizione_uno: nome, prezzo: 2.5 },
    });
    const elenco = boxDelKit(leggi([
      fantasma('a', true, 'Pilota'),
      fantasma('b', false, 'Seconda'),
      fantasma('c', false, 'Terza'),
      // Stesso codice in un'altra pagina: un altro box
      box('d', { codice_box: 'G7', pag: 5, x: null, y: null, w: null, h: null, data_fields: { codice_referenza: 'd' } }),
    ]));

    expect(elenco.map(singolo => [singolo.id, singolo.referenze.map(referenza => referenza.id)])).toEqual([
      ['a', ['a', 'b', 'c']],
      ['d', ['d']],
    ]);
    expect(elenco[0].prodotti.map(prodotto => prodotto.nome)).toEqual(['Pilota', 'Seconda', 'Terza']);
  });

  it('senza posizione e senza un box con lo stesso codice, ogni referenza resta un box a se\'', () => {
    const senza = (id: string) => box(id, { codice_box: 'BOX1', pag: null, x: null, y: null, w: null, h: null, data_fields: { codice_referenza: id } });
    expect(boxDelKit(leggi([senza('1'), senza('2')], false))).toHaveLength(2);
  });

  it('due righe con lo stesso codice, la stessa pagina e la stessa posizione sono un box solo', () => {
    const elenco = boxDelKit(leggi([
      box('x1', { codice_box: 'G1', data_fields: { codice_referenza: 'x1' } }),
      box('x2', { codice_box: 'G1', data_fields: { codice_referenza: 'x2' } }),
    ]));
    expect(elenco).toHaveLength(1);
    expect(elenco[0].prodotti).toHaveLength(2);
  });
});

describe('riassumiKit', () => {
  it('aggregati: conteggi, sconti, meccaniche con spazio, reparti per spazio e copertura', () => {
    const { dati } = riassumiKit(leggi(KIT_STORICO));

    expect(aggregatiDi(dati)).toEqual({
      referenze: 4,
      pagine: 3,
      sconto: { somma: 72.71, referenze: 2 },
      fidelity: 1,
      meccaniche: [
        { meccanica: 'sconto', referenze: 1, spazio: 33.18 },
        { meccanica: 'fidelity', referenze: 1, spazio: 6.43 },
        { meccanica: 'punti', referenze: 1, spazio: 0 },
        { meccanica: 'prezzo', referenze: 1, spazio: 6.43 },
      ],
      reparti: [{ reparto: 'Reparto 25', spazio: 39.61 }],
      copertura: { conCodice: 0, conReparto: 2, conPrezzo: 3, conMarca: 4 },
    });
  });

  it('marche compatte e normalizzate: "MÜLLER" e "Muller" sono la stessa marca, col primo nome stampato', () => {
    expect(riassumiKit(leggi(KIT_STORICO)).dati.marche).toEqual([
      ['muller', 'Müller', 2],
      ['aia', 'Aia', 1],
      ['granarolo', 'Granarolo', 1],
    ]);
  });

  it('prodotti compatti senza testi oltre alla chiave; nome, marca, formato e foto nelle descrizioni', () => {
    const { dati, descrizioni } = riassumiKit(leggi(KIT_STORICO));
    const [yogurt, mozzarella, , bonRoll] = dati.prodotti;

    expect(dati.prodotti).toHaveLength(4);
    expect(mozzarella).toEqual([expect.stringMatching(/^d-/), 1.69, 2.95, 0, MECCANICHE.indexOf('fidelity'), 2, 6.43, 1]);
    expect(prodottoDaCompatto(mozzarella)).toEqual({
      chiave: mozzarella[0], prezzo: 1.69, barrato: 2.95, sottocosto: false, meccanica: 'fidelity', pagina: 2, spazio: 6.43, conFoto: true,
    });
    expect(prodottoDaCompatto(bonRoll)).toMatchObject({ prezzo: null, meccanica: 'punti', pagina: 3, spazio: null });
    expect(prodottoDaCompatto(yogurt)).toMatchObject({ meccanica: 'sconto', pagina: 1 });
    expect(dati.prodotti.flat().filter(valore => typeof valore === 'string')).toEqual(dati.prodotti.map(prodotto => prodotto[0]));

    expect(Object.keys(descrizioni)).toHaveLength(4);
    expect(descrizioni[mozzarella[0]]).toEqual(['Mozzarella', 'Granarolo', '100 g', 'foto-r1']);
    expect(descrizioneDaCompatta(descrizioni[bonRoll[0]])).toEqual({ nome: 'Bon Roll', marca: 'Aia', formato: null, foto: 'foto-r4' });
  });

  it('lo stesso prodotto in due box del volantino conta una volta, col primo box', () => {
    const stesso = (id: string, pag: number) => box(id, { pag, foto: [], data_fields: { codice_referenza: '42', descrizione_uno: 'Pasta', prezzo: 0.89 } });
    const { dati, descrizioni } = riassumiKit(leggi([stesso('p1', 5), stesso('p2', 2)]));

    expect(dati.referenze).toBe(2);
    expect(dati.prodotti.map(prodottoDaCompatto)).toEqual([{
      chiave: 'c-42', prezzo: 0.89, barrato: null, sottocosto: false, meccanica: 'prezzo', pagina: 2, spazio: 6.43, conFoto: false,
    }]);
    expect(descrizioni).toEqual({ 'c-42': ['Pasta', null, null, null] });
  });

  it('un kit senza referenze ha un riepilogo vuoto', () => {
    expect(riassumiKit([])).toEqual({
      dati: { ...AGGREGATI_VUOTI, marche: [], prodotti: [] },
      descrizioni: {},
    });
    expect(VERSIONE_ANALISI_KIT).toBeGreaterThanOrEqual(2);
  });
});
