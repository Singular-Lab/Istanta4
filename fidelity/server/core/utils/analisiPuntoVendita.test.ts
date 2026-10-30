import { describe, expect, it } from 'vitest';
import { STATO_PROMO } from '../../../lib/enums';
import { MECCANICHE } from '../../../lib/puntiVendita/analisi';
import { AGGREGATI_VUOTI, type AggregatiKit, boxDelKit, type DescrizioneProdotto, type ProdottoNelKit } from './analisiKit';
import {
  calcolaAnalisiPuntoVendita,
  calcolaReteInsegne,
  chiaveDescrizione,
  coppieDaDescrivere,
  descrizioniRicorrenti,
  dettaglioReferenza,
  edizioneAttiva,
  type EdizionePuntoVendita,
  edizioniDelPuntoVendita,
  kitDaDescrivere,
  MASSIMO_FOTO_REFERENZA,
  MASSIMO_PAGINE,
  numeroPagine,
  pagineDelVolantino,
  presenzeDelProdotto,
  rigaDelPuntoVendita,
  type RigaListaVolantino,
  spazioPerMeccanica,
  STATISTICHE_VUOTE,
  type StatisticheProdotti,
} from './analisiPuntoVendita';
import { DESCRIZIONE_ASSENTE, leggiReferenza, type RigaReferenza } from './referenzaStampata';
import type { ApparizioneStoria } from './storiaPuntoVendita';

// Le pagine del PV sulla timeline dei volantini: scheda, volantino, referenza e rete per insegna

const NOMI: Record<string, string> = { SS: 'Conad Superstore', CC: 'Conad City', LI: 'Liguria' };

const piuGiorni = (data: string, giorni: number): string => {
  const giorno = new Date(`${data}T00:00:00Z`);
  giorno.setUTCDate(giorno.getUTCDate() + giorni);
  return giorno.toISOString().slice(0, 10);
};

const edizione = (idKit: string, data: string, canale = 'SS'): EdizionePuntoVendita => ({
  idKit,
  titoloKit: `VOL ${data}`,
  data,
  promo: { id: `p-${idKit}`, nome: `Promo ${data}`, stato: STATO_PROMO.ARCHIVIATA, validitaDal: data, validitaAl: piuGiorni(data, 13) },
  canale: { id: canale, nome: NOMI[canale] },
  area: { id: 'LI', nome: NOMI.LI },
});

const prodotto = (chiave: string, dati: Partial<ProdottoNelKit> = {}): ProdottoNelKit => ({
  chiave, prezzo: null, barrato: null, sottocosto: false, meccanica: 'prezzo', pagina: 1, spazio: 5, conFoto: false, ...dati,
});

const aggregati = (dati: Partial<AggregatiKit>): AggregatiKit => ({
  ...AGGREGATI_VUOTI,
  sconto: { somma: 0, referenze: 0 },
  copertura: { conCodice: 0, conReparto: 0, conPrezzo: 0, conMarca: 0 },
  ...dati,
});

const descrizione = (nome: string, dati: Partial<DescrizioneProdotto> = {}): DescrizioneProdotto => ({ nome, marca: null, formato: null, foto: null, ...dati });

const EDIZIONI = [
  edizione('k1', '2021-03-04'),
  edizione('k2', '2021-09-10'),
  edizione('k3', '2022-02-03', 'CC'),
  edizione('k4', '2022-10-20', 'CC'),
];

/** k4 non ha riepilogo: conta come un volantino senza referenze. */
const AGGREGATI = new Map<string, AggregatiKit>([
  ['k1', aggregati({
    referenze: 100,
    sconto: { somma: 300, referenze: 10 },
    meccaniche: [{ meccanica: 'sconto', referenze: 10, spazio: 50 }, { meccanica: 'prezzo', referenze: 90, spazio: 300 }],
    reparti: [{ reparto: 'Ortofrutta', spazio: 40 }, { reparto: 'Bevande', spazio: 10 }],
    copertura: { conCodice: 0, conReparto: 50, conPrezzo: 100, conMarca: 40 },
  })],
  ['k2', aggregati({
    referenze: 120,
    sconto: { somma: 100, referenze: 10 },
    meccaniche: [{ meccanica: 'fidelity', referenze: 60, spazio: 200 }, { meccanica: 'prezzo', referenze: 60, spazio: 200 }],
    copertura: { conCodice: 120, conReparto: 0, conPrezzo: 110, conMarca: 20 },
  })],
  ['k3', aggregati({
    referenze: 80,
    sconto: { somma: 150, referenze: 5 },
    meccaniche: [{ meccanica: 'punti', referenze: 20, spazio: 80 }, { meccanica: 'prezzo', referenze: 60, spazio: 240 }],
    reparti: [{ reparto: 'Bevande', spazio: 30 }],
    copertura: { conCodice: 30, conReparto: 10, conPrezzo: 80, conMarca: 30 },
  })],
]);

/** Prodotti e marche come li aggrega l'SQL: c-A in k1, k2 e k3 (con la foto in k2), c-C in k2, c-B in k1. */
const STATISTICHE: StatisticheProdotti = {
  prodotti: 3,
  frequenti: 0,
  ricorrenti: [
    { chiave: 'c-A', volantini: 3, perAnno: { 2021: 2, 2022: 1 }, prezzoMinimo: 1.2, prezzoMassimo: 1.9, ultimoKit: 'k3', ultimoKitConFoto: 'k2' },
    { chiave: 'c-C', volantini: 1, perAnno: { 2021: 1 }, prezzoMinimo: null, prezzoMassimo: null, ultimoKit: 'k2', ultimoKitConFoto: null },
    { chiave: 'c-B', volantini: 1, perAnno: { 2021: 1 }, prezzoMinimo: 0.99, prezzoMassimo: 0.99, ultimoKit: 'k1', ultimoKitConFoto: 'k1' },
  ],
  marche: [{ marca: 'CONAD', referenze: 50 }, { marca: 'Barilla', referenze: 40 }],
  referenzeConMarca: 90,
};

/** Le descrizioni lette per le coppie di coppieDaDescrivere: c-C non ne ha. */
const TROVATE = new Map<string, DescrizioneProdotto>([
  [chiaveDescrizione('k3', 'c-A'), descrizione('Pasta di semola', { marca: 'Barilla', formato: '500 g' })],
  [chiaveDescrizione('k2', 'c-A'), descrizione('Pasta', { marca: 'Barilla', foto: 'f-a' })],
  [chiaveDescrizione('k1', 'c-B'), descrizione('Biscotti', { foto: 'f-b' })],
]);

describe('edizioni del PV', () => {
  const apparizione = (idKit: string, data: string): ApparizioneStoria => ({
    ...edizione(idKit, data), rigaStampata: 'PRA - Via Murtola 12', localita: 'PRA', indirizzo: 'Via Murtola 12', telefono: null,
    chiaveIndirizzo: 'VIA MURTOLA 12', chiaveTelefono: null, abbinamento: 'indirizzo',
  });

  it('una per kit anche se il PV e\' stampato due volte nella stessa lista, dalla piu\' vecchia', () => {
    const edizioni = edizioniDelPuntoVendita([apparizione('k2', '2022-01-13'), apparizione('k1', '2022-01-06'), apparizione('k2', '2022-01-13')]);
    expect(edizioni.map(voce => voce.idKit)).toEqual(['k1', 'k2']);
    expect(Object.keys(edizioni[0]).sort()).toEqual(['area', 'canale', 'data', 'idKit', 'promo', 'titoloKit']);
  });

  it('attiva se la validita\' della promo comprende oggi (calendario di Roma)', () => {
    const voce = edizione('k', '2026-10-23');
    expect(edizioneAttiva(voce, '2026-10-23')).toBe(true);
    expect(edizioneAttiva(voce, '2026-11-05')).toBe(true);
    expect(edizioneAttiva(voce, '2026-11-06')).toBe(false);
    expect(edizioneAttiva(voce, '2026-10-22')).toBe(false);
    expect(edizioneAttiva({ ...voce, promo: { ...voce.promo, validitaAl: null } }, '2026-10-23')).toBe(true);
    expect(edizioneAttiva({ ...voce, promo: { ...voce.promo, validitaDal: null } }, '2026-10-23')).toBe(false);
  });
});

describe('descrizioni dei prodotti ricorrenti', () => {
  it('si leggono dall\'ultimo kit e, se diverso, dall\'ultimo con la foto', () => {
    expect(coppieDaDescrivere(STATISTICHE.ricorrenti)).toEqual([
      { idKit: 'k3', chiave: 'c-A' },
      { idKit: 'k2', chiave: 'c-A' },
      { idKit: 'k2', chiave: 'c-C' },
      { idKit: 'k1', chiave: 'c-B' },
    ]);
  });

  it('nome, marca e formato dall\'ultimo kit, la foto dall\'ultimo che ne ha una; senza descrizione un segnaposto', () => {
    const descrizioni = descrizioniRicorrenti(STATISTICHE.ricorrenti, TROVATE);

    expect(descrizioni.get('c-A')).toEqual({ nome: 'Pasta di semola', marca: 'Barilla', formato: '500 g', foto: 'f-a' });
    expect(descrizioni.get('c-B')).toEqual({ nome: 'Biscotti', marca: null, formato: null, foto: 'f-b' });
    expect(descrizioni.get('c-C')).toEqual({ nome: DESCRIZIONE_ASSENTE, marca: null, formato: null, foto: null });
  });
});

describe('calcolaAnalisiPuntoVendita', () => {
  const DESCRIZIONI = descrizioniRicorrenti(STATISTICHE.ricorrenti, TROVATE);
  const analisi = calcolaAnalisiPuntoVendita('pv-1', EDIZIONI, AGGREGATI, STATISTICHE, DESCRIZIONI, '2022-10-25');

  it('numeri: volantini, attivi, referenze, prodotti, sconto medio e del primo anno, insegne nel tempo', () => {
    expect(analisi.idPuntoVendita).toBe('pv-1');
    expect(analisi.numeri).toEqual({
      volantini: 4,
      volantiniAttivi: 1,
      referenze: 300,
      mediaReferenze: 75,
      prodotti: 3,
      prodottiFrequenti: 0,
      scontoMedio: 22,
      scontoMedioPrimoAnno: 20,
      insegne: [{ id: 'SS', nome: 'Conad Superstore' }, { id: 'CC', nome: 'Conad City' }],
    });
  });

  it('timeline dalla piu\' vecchia, con le referenze di ogni volantino', () => {
    expect(analisi.timeline.map(voce => [voce.idKit, voce.dal, voce.numeroReferenze, voce.attivo])).toEqual([
      ['k1', '2021-03-04', 100, false],
      ['k2', '2021-09-10', 120, false],
      ['k3', '2022-02-03', 80, false],
      ['k4', '2022-10-20', 0, true],
    ]);
    expect(analisi.timeline[3]).toMatchObject({ al: '2022-11-02', promo: { id: 'p-k4', nome: 'Promo 2022-10-20' }, canale: { id: 'CC' }, area: { id: 'LI' } });
    expect(analisi.anni).toEqual([2021, 2022]);
  });

  it('meccaniche: quota delle referenze anno per anno, tutte e sei nell\'ordine del contratto', () => {
    expect(analisi.meccaniche.map(voce => voce.meccanica)).toEqual([...MECCANICHE]);
    const quote = Object.fromEntries(analisi.meccaniche.map(voce => [voce.meccanica, voce.anni.map(anno => anno.quota)]));
    expect(quote).toEqual({
      sconto: [4.5, 0],
      fidelity: [27.3, 0],
      punti: [0, 25],
      sottocosto: [0, 0],
      nxm: [0, 0],
      prezzo: [68.2, 75],
    });
  });

  it('sconto per anno sulle referenze con uno sconto', () => {
    expect(analisi.scontoPerAnno).toEqual([{ anno: 2021, sconto: 20 }, { anno: 2022, sconto: 30 }]);
  });

  it('marche: quota sulle referenze con marca', () => {
    expect(analisi.marche).toEqual([{ marca: 'CONAD', quota: 55.6 }, { marca: 'Barilla', quota: 44.4 }]);
  });

  it('prodotti ricorrenti nell\'ordine dell\'SQL, con la descrizione e la presenza di ogni anno della scheda', () => {
    expect(analisi.prodottiRicorrenti.map(voce => voce.chiave)).toEqual(['c-A', 'c-C', 'c-B']);
    expect(analisi.prodottiRicorrenti[0]).toEqual({
      chiave: 'c-A',
      nome: 'Pasta di semola',
      marca: 'Barilla',
      formato: '500 g',
      foto: 'f-a',
      volantini: 3,
      perAnno: [{ anno: 2021, volantini: 2 }, { anno: 2022, volantini: 1 }],
      prezzoMinimo: 1.2,
      prezzoMassimo: 1.9,
    });
    expect(analisi.prodottiRicorrenti[1]).toMatchObject({
      nome: DESCRIZIONE_ASSENTE, prezzoMinimo: null, prezzoMassimo: null, perAnno: [{ anno: 2021, volantini: 1 }, { anno: 2022, volantini: 0 }],
    });
  });

  it('reparti: quota dello spazio dei box anno per anno; gli anni senza reparti noti non ci sono', () => {
    expect(analisi.reparti).toEqual([
      { anno: 2021, reparti: [{ reparto: 'Ortofrutta', quota: 80 }, { reparto: 'Bevande', quota: 20 }] },
      { anno: 2022, reparti: [{ reparto: 'Bevande', quota: 100 }] },
    ]);
    const senzaReparti = calcolaAnalisiPuntoVendita('pv-1', [EDIZIONI[1]], AGGREGATI, STATISTICHE_VUOTE, new Map(), '2022-10-25');
    expect(senzaReparti.reparti).toEqual([]);
  });

  it('copertura: percentuale delle referenze con codice, reparto, prezzo e marca', () => {
    expect(analisi.copertura).toEqual({ conCodice: 50, conReparto: 20, conPrezzo: 96.7, conMarca: 30 });
  });

  it('al massimo 8 marche e 10 prodotti ricorrenti, anche se le statistiche ne portano di piu\'', () => {
    const molte: StatisticheProdotti = {
      prodotti: 40,
      frequenti: 12,
      ricorrenti: Array.from({ length: 12 }, (_, indice) => ({
        chiave: `c-${indice}`, volantini: 20 - indice, perAnno: { 2021: 20 - indice }, prezzoMinimo: 1, prezzoMassimo: 2, ultimoKit: 'k1', ultimoKitConFoto: null,
      })),
      marche: Array.from({ length: 9 }, (_, indice) => ({ marca: `Marca ${indice}`, referenze: 9 - indice })),
      referenzeConMarca: 45,
    };

    const risultato = calcolaAnalisiPuntoVendita('pv-1', EDIZIONI, AGGREGATI, molte, new Map(), '2026-10-30');

    expect(risultato.numeri).toMatchObject({ prodotti: 40, prodottiFrequenti: 12 });
    expect(risultato.marche).toHaveLength(8);
    expect(risultato.marche[0]).toEqual({ marca: 'Marca 0', quota: 20 });
    expect(risultato.prodottiRicorrenti.map(voce => voce.chiave)).toEqual(Array.from({ length: 10 }, (_, indice) => `c-${indice}`));
  });

  it('un PV senza volantini: tutto vuoto, medie nulle', () => {
    const vuota = calcolaAnalisiPuntoVendita('pv-1', [], new Map(), STATISTICHE_VUOTE, new Map(), '2026-10-30');
    expect(vuota.numeri).toMatchObject({ volantini: 0, referenze: 0, prodotti: 0, mediaReferenze: null, scontoMedio: null, scontoMedioPrimoAnno: null, insegne: [] });
    expect(vuota.timeline).toEqual([]);
    expect(vuota.marche).toEqual([]);
    expect(vuota.prodottiRicorrenti).toEqual([]);
    expect(vuota.copertura).toEqual({ conCodice: 0, conReparto: 0, conPrezzo: 0, conMarca: 0 });
  });
});

// ─── Volantino ──────────────────────────────────────────────────────

const campo = (labelName: string, content: string, paragraphName = '') => ({ labelName, paragraphName, content });

const rigaBox = (id: string, dati: Partial<RigaReferenza>): RigaReferenza => ({
  id, compiled_fields: [], data_fields: {}, foto: [`foto-${id}`], meccanica: '', codice_box: id, group_elements: [],
  pag: 1, x: 10, y: 10, w: 100, h: 100, w_page: 210, h_page: 287, ...dati,
});

const BOX = boxDelKit([
  rigaBox('a', { compiled_fields: [campo('prezzo_offerta', '1,69', 'PREZ_FidelityR'), campo('campo_offerta', '€ 2,95', 'PREZ_CampoOfferta_barrato'), campo('descrizione', '<DES_descr_nome>Mozzarella</DES_descr_nome>')] }),
  rigaBox('b', { x: 110, w: 50, compiled_fields: [campo('prezzo_offerta', '0,99', 'PREZ_NoSconto'), campo('descrizione', 'Pane')] }),
  rigaBox('c', { pag: 3, w: 50, h: 50, compiled_fields: [campo('prezzo_offerta', '2,00', 'PREZ_NoSconto'), campo('descrizione', 'Latte')] }),
  rigaBox('d', { pag: 3, x: null, compiled_fields: [campo('descrizione', 'Senza posizione')] }),
].map(riga => leggiReferenza(riga, { storico: true })));

describe('volantino', () => {
  it('il numero delle pagine: quelle del PDF, mai meno della pagina piu\' alta con un box, con un tetto', () => {
    expect(numeroPagine(24, BOX)).toBe(24);
    expect(numeroPagine(null, BOX)).toBe(3);
    expect(numeroPagine(2, BOX)).toBe(3);
    expect(numeroPagine(10_000, BOX)).toBe(MASSIMO_PAGINE);
  });

  it('tutte le pagine, anche vuote, con i box al loro posto e le referenze in sintesi', () => {
    const pagine = pagineDelVolantino(BOX, 4);

    expect(pagine.map(pagina => [pagina.numero, pagina.boxes.map(singolo => singolo.id)])).toEqual([[1, ['a', 'b']], [2, []], [3, ['c']], [4, []]]);
    expect(pagine.every(pagina => pagina.proporzione === 0.7317)).toBe(true);
    expect(pagine[0].boxes[0]).toMatchObject({
      x: 0.0476, y: 0.0348, w: 0.4762, h: 0.3484, spazio: 16.59, meccanica: 'fidelity', reparto: null, sconto: 42.71,
      referenze: [{ nome: 'Mozzarella', marca: null, formato: null, prezzo: 1.69, barrato: 2.95, sconto: 42.71, foto: 'foto-a', chiave: expect.stringMatching(/^d-/) }],
    });
  });

  it('spazio per meccanica in percentuale della superficie dei box con posizione', () => {
    // Fidelity 16,59 e prezzo 8,30 + 4,15 punti di pagina; il box senza posizione non conta
    expect(spazioPerMeccanica(BOX)).toEqual([{ meccanica: 'fidelity', spazio: 57.1 }, { meccanica: 'prezzo', spazio: 42.9 }]);
  });

  it('la riga del PV con le tre righe prima e dopo della stessa provincia', () => {
    const lista: RigaListaVolantino[] = [
      ...Array.from({ length: 6 }, (_, indice) => ({ posizione: indice + 1, riga: `GE ${indice + 1}`, regione: 'LIGURIA', provincia: 'GENOVA', idPuntoVendita: null, abbinamento: null })),
      ...Array.from({ length: 9 }, (_, indice) => ({ posizione: indice + 7, riga: `IM ${indice + 1}`, regione: 'LIGURIA', provincia: 'IMPERIA', idPuntoVendita: indice === 1 ? 'pv-1' : null, abbinamento: indice === 1 ? 'telefono' as const : null })),
    ];

    expect(rigaDelPuntoVendita(lista, 'pv-1')).toEqual({
      riga: 'IM 2',
      abbinamento: 'telefono',
      regione: 'LIGURIA',
      provincia: 'IMPERIA',
      vicine: ['IM 1', 'IM 2', 'IM 3', 'IM 4', 'IM 5'].map(riga => ({ riga, questo: riga === 'IM 2' })),
    });
    expect(rigaDelPuntoVendita(lista, 'pv-2')).toBeNull();
  });
});

// ─── Referenza ──────────────────────────────────────────────────────

describe('referenza', () => {
  /** Il prodotto c-A nei kit che lo contengono, come lo legge l'SQL dai riepiloghi. */
  const NEI_KIT = new Map<string, ProdottoNelKit>([
    ['k1', prodotto('c-A', { prezzo: 1.49, sottocosto: true, pagina: 4, spazio: 9, conFoto: true })],
    ['k3', prodotto('c-A', { prezzo: 1.99, barrato: 2.89, conFoto: true })],
    ['k4', prodotto('c-A', { prezzo: 1.69, barrato: 2.95, meccanica: 'fidelity' })],
  ]);
  const PRESENZE = presenzeDelProdotto(EDIZIONI, NEI_KIT);
  const DESCRIZIONI = new Map<string, DescrizioneProdotto>([
    ['k4', descrizione('Mozzarella fior di latte', { marca: 'Granarolo', formato: '125 g' })],
    ['k3', descrizione('Mozzarella', { foto: 'f-3' })],
    ['k1', descrizione('Mozzarella', { foto: 'f-1' })],
  ]);

  it('presenze dalla piu\' recente, solo nei volantini del PV', () => {
    expect(PRESENZE.map(presenza => presenza.edizione.idKit)).toEqual(['k4', 'k3', 'k1']);
    expect(presenzeDelProdotto(EDIZIONI, new Map([['estraneo', prodotto('c-A')]]))).toEqual([]);
  });

  it('le varianti per area della stessa promo restano presenze distinte, ognuna con la sua area', () => {
    // Stessa promo, stesso giorno e stesso canale: due kit, uno per area
    const promo = edizione('k-em', '2026-10-26', 'CC').promo;
    const varianti: EdizionePuntoVendita[] = [
      { ...edizione('k-em', '2026-10-26', 'CC'), promo, area: { id: 'EM', nome: 'Emilia' } },
      { ...edizione('k-pi', '2026-10-26', 'CC'), promo, area: { id: 'PI', nome: 'Piemonte' } },
    ];
    const nelKit = new Map([['k-em', prodotto('c-A')], ['k-pi', prodotto('c-A')]]);

    const dettaglio = dettaglioReferenza('c-A', presenzeDelProdotto(varianti, nelKit), null);

    expect(dettaglio.presenze.map(presenza => [presenza.idKit, presenza.promo.nome, presenza.canale.nome, presenza.area.nome])).toEqual([
      ['k-pi', 'Promo 2026-10-26', 'Conad City', 'Piemonte'],
      ['k-em', 'Promo 2026-10-26', 'Conad City', 'Emilia'],
    ]);
  });

  it('le descrizioni da leggere: l\'ultimo volantino e i piu\' recenti con una foto, senza doppioni', () => {
    expect(kitDaDescrivere(PRESENZE)).toEqual(['k4', 'k3', 'k1']);
    expect(kitDaDescrivere([])).toEqual([]);
    const tante = presenzeDelProdotto(
      Array.from({ length: 20 }, (_, indice) => edizione(`f${indice}`, piuGiorni('2023-01-05', indice * 7))),
      new Map(Array.from({ length: 20 }, (_, indice) => [`f${indice}`, prodotto('c-A', { conFoto: true })] as const)),
    );
    expect(kitDaDescrivere(tante)).toHaveLength(MASSIMO_FOTO_REFERENZA);
  });

  it('numeri: volantini, primo, prezzo minimo con data e sottocosto, attuale, giorni fra le presenze', () => {
    const dettaglio = dettaglioReferenza('c-A', PRESENZE, null, DESCRIZIONI);

    expect(dettaglio.numeri).toEqual({
      volantini: 3,
      primoVolantino: '2021-03-04',
      prezzoMinimo: { prezzo: 1.49, dal: '2021-03-04', sottocosto: true },
      prezzoAttuale: 1.69,
      // Dal 4 marzo 2021 al 20 ottobre 2022: 595 giorni in due intervalli
      giorniFraPresenze: 298,
    });
    expect(dettaglio.presenze.map(presenza => [presenza.idKit, presenza.prezzo, presenza.barrato, presenza.sottocosto, presenza.pagina])).toEqual([
      ['k4', 1.69, 2.95, false, 1],
      ['k3', 1.99, 2.89, false, 1],
      ['k1', 1.49, null, true, 4],
    ]);
    expect(dettaglio.presenze[0]).toMatchObject({
      promo: { id: 'p-k4', stato: STATO_PROMO.ARCHIVIATA }, canale: { id: 'CC' }, area: { id: 'LI', nome: 'Liguria' }, dal: '2022-10-20', al: '2022-11-02', meccanica: 'fidelity',
    });
    // Senza i box dell'ultimo volantino: intestazione dalla sua descrizione e dal riepilogo, nessuna posizione
    expect(dettaglio).toMatchObject({
      nome: 'Mozzarella fior di latte', marca: 'Granarolo', formato: '125 g', prezzo: 1.69, barrato: 2.95, meccanica: 'fidelity', posizione: null, foto: ['f-3', 'f-1'],
    });
    expect(dettaglio.dati.fonte).toBe('testo');
    expect(dettaglioReferenza('c-A', PRESENZE, null).nome).toBe(DESCRIZIONE_ASSENTE);
  });

  it('intestazione, dati e posizione dai box dell\'ultimo volantino', () => {
    const box = boxDelKit([
      rigaBox('a', {
        pag: 2, foto: ['g-1', 'g-2'],
        compiled_fields: [campo('prezzo', '1,69', 'PREZ_FidelityR'), campo('campo_offerta', '€ 2,95', 'PREZ_CampoOfferta_barrato'), campo('campo_offerta_KgL_sconto', 'al kg da € 9,83 a € 5,63', 'PREZ_CampoOfferta_KgL')],
        data_fields: { codice_referenza: 'A', descrizione_uno: 'Mozzarella', descrizione_reparto: 'LATTICINI', ruolo: 'VEDETTE' },
        group_elements: [{ codice_referenza: 'A' }, { codice_referenza: 'A2', descrizione_uno: 'Mozzarella light' }],
      }),
      rigaBox('b', { pag: 2, x: 120, w: 50, data_fields: { codice_referenza: 'B' } }),
      rigaBox('c', { pag: 3, data_fields: { codice_referenza: 'C' } }),
    ].map(riga => leggiReferenza(riga, { storico: false })));

    const dettaglio = dettaglioReferenza('c-A', PRESENZE, { box, pagine: 24 }, DESCRIZIONI);

    expect(dettaglio).toMatchObject({
      nome: 'Mozzarella', marca: null, formato: null, prezzo: 1.69, barrato: 2.95, sconto: 42.71, prezzoAlKg: 'al kg da € 9,83 a € 5,63', meccanica: 'fidelity',
      foto: ['g-1', 'g-2', 'f-3', 'f-1'],
      dati: { codice: 'A', reparto: 'Latticini', ruolo: 'Vedette', fonte: 'istanta' },
    });
    expect(dettaglio.posizione).toEqual({
      idKit: 'k4', pagina: 2, pagine: 24,
      box: { x: 0.0476, y: 0.0348, w: 0.4762, h: 0.3484 },
      spazio: 16.59,
      referenzeNelBox: 2,
      altriBox: [{ x: 0.5714, y: 0.0348, w: 0.2381, h: 0.3484 }],
      proporzione: 0.7317,
    });
  });
});

// ─── Rete ───────────────────────────────────────────────────────────

describe('calcolaReteInsegne', () => {
  it('per canale i PV di oggi e quelli nelle liste anno per anno; i canali vuoti non ci sono', () => {
    const rete = calcolaReteInsegne(
      [
        { id: 'SS', nome: 'Conad Superstore', puntiVendita: 120 },
        { id: 'CC', nome: 'Conad City', puntiVendita: 300 },
        { id: 'XX', nome: 'Mai usato', puntiVendita: 0 },
      ],
      [
        { idCanale: 'SS', nomeCanale: 'Conad Superstore', anno: 2022, puntiVendita: 110 },
        { idCanale: 'SS', nomeCanale: 'Conad Superstore', anno: 2021, puntiVendita: 100 },
        { idCanale: 'CC', nomeCanale: 'Conad City', anno: 2022, puntiVendita: 280 },
        { idCanale: 'OLD', nomeCanale: 'Insegna chiusa', anno: 2021, puntiVendita: 12 },
      ],
    );

    expect(rete).toEqual({
      anni: [2021, 2022],
      insegne: [
        { canale: { id: 'CC', nome: 'Conad City' }, puntiVendita: 300, nelleListe: [{ anno: 2021, puntiVendita: 0 }, { anno: 2022, puntiVendita: 280 }] },
        { canale: { id: 'SS', nome: 'Conad Superstore' }, puntiVendita: 120, nelleListe: [{ anno: 2021, puntiVendita: 100 }, { anno: 2022, puntiVendita: 110 }] },
        { canale: { id: 'OLD', nome: 'Insegna chiusa' }, puntiVendita: 0, nelleListe: [{ anno: 2021, puntiVendita: 12 }, { anno: 2022, puntiVendita: 0 }] },
      ],
    });
  });
});
