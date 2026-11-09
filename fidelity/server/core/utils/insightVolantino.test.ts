import { describe, expect, it } from 'vitest';
import { GRIGLIA_CALORE, PESI_VISIBILITA, type BoxInsight, type RepartoInsight } from '../../../lib/insightVolantino/tipi';
import { boxDelKit } from './analisiKit';
import { boxInsight, chiaveMarca, sezioniInsight, type OpzioniInsight } from './insightVolantino';
import { leggiReferenza, type RigaReferenza } from './referenzaStampata';

// Le sezioni nuove degli insight del volantino (spec insight-volantino): uguali per ogni GDO e per
// i kit di Istanta e dello storico, perche' vengono dalla lettura generica delle referenze.

const campo = (labelName: string, content: string, paragraphName = '') => ({ labelName, paragraphName, content });

/** Una riga di referenze: pagina 100×100 salvo indicazione, x relativa alla pagina. */
const riga = (id: string, dati: Partial<RigaReferenza> = {}): RigaReferenza => ({
  id,
  compiled_fields: [],
  data_fields: {},
  foto: [],
  meccanica: '',
  codice_box: id,
  group_elements: [],
  pag: 1,
  x: 0,
  y: 0,
  w: 10,
  h: 100,
  w_page: 100,
  h_page: 100,
  ...dati,
});

const SENZA_GEOMETRIA = { x: null, y: null, w: null, h: null } as const;

const boxDi = (righe: RigaReferenza[], storico = false) => boxDelKit(righe.map(voce => leggiReferenza(voce, { storico })));

const opzioni = (altre: Partial<OpzioniInsight> = {}): OpzioniInsight => ({
  totalePagine: 0,
  anagraficaReparti: [],
  marcheDistributore: [],
  urlFoto: guid => `/foto/${guid}`,
  ...altre,
});

const perId = (box: readonly BoxInsight[]) => new Map(box.map(singolo => [singolo.id, singolo]));

/** Il reparto mappato dalla config, per id referenza. */
const repartiConfigurati = (reparti: Record<string, RepartoInsight>) => (idReferenza: string) => reparti[idReferenza] ?? null;

const ANAGRAFICA = [
  { codice: '01', descrizione: 'DROGHERIA ALIMENTARE' },
  { codice: '03', descrizione: 'BEVANDE' },
  { codice: '33', descrizione: 'ORTOFRUTTA' },
];

describe('sezioniInsight: sintesi per la Direzione', () => {
  it('sconto medio sui soli box con sconto, quota Fidelity, marche distinte e copertura dei dati', () => {
    // Kit di Istanta su pagine 200×300: prezzi nei data_fields, meccanica nella colonna
    const pagina = { w_page: 200, h_page: 300 };
    const box = boxDi([
      riga('r1', {
        ...pagina, pag: 1, w: 100, h: 150, meccanica: 'TP_FID_KgL',
        data_fields: { codice_referenza: 'A1', descrizione_uno: 'Mozzarella', descrizione_due: 'Mulino  Bianco', prezzo: '1,00', prezzo_anziche: '2,00', descrizione_reparto: 'DROGHERIA ALIMENTARE' },
      }),
      riga('r2', {
        ...pagina, pag: 2, w: 100, h: 100,
        data_fields: { codice_referenza: 'A2', descrizione_uno: 'Biscotti', descrizione_due: 'mulino bianco', prezzo: 3, prezzo_anziche: 4, reparto: '1' },
      }),
      riga('r3', { ...pagina, ...SENZA_GEOMETRIA, pag: 2, data_fields: { codice_referenza: 'A3', descrizione_uno: 'Acqua', prezzo: 0.5 } }),
    ]);

    const { sintesi } = sezioniInsight(box, opzioni({ totalePagine: 4 }));

    expect(sintesi).toEqual({
      referenze: 3,
      box: 3,
      pagine: 4,
      scontoMedio: 37.5,
      boxConSconto: 2,
      quotaFidelity: 33.3,
      sottocosto: 0,
      // "Mulino Bianco" e "mulino bianco" sono la stessa marca
      marche: 1,
      copertura: { prezzo: 100, marca: 66.7, reparto: 66.7, geometria: 66.7 },
    });
  });

  it('volantino senza referenze: sezioni vuote, nessuno sconto medio e quote a zero', () => {
    const sezioni = sezioniInsight([], opzioni({ totalePagine: 0, marcheDistributore: ['insegna'] }));

    expect(sezioni.box).toEqual([]);
    expect(sezioni.sintesi).toMatchObject({ referenze: 0, box: 0, pagine: 0, scontoMedio: null, quotaFidelity: 0, marche: 0 });
    expect(sezioni.sintesi.copertura).toEqual({ prezzo: 0, marca: 0, reparto: 0, geometria: 0 });
    expect(sezioni.prezziSconti.fasce.map(fascia => fascia.box)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(sezioni.marche).toEqual({ elenco: [], quotaDistributore: { quotaSpazio: 0, quotaBox: 0 } });
    expect(sezioni.zoneCalde).toEqual({ boxPiuVisibili: [], perReparto: [], perMarca: [], calore: [], pesi: PESI_VISIBILITA });
    expect(sezioni.spazio.perPagina).toEqual([]);
  });

  it('con le pagine del PDF ma senza box ogni pagina ha densita\' e calore a zero', () => {
    const sezioni = sezioniInsight([], opzioni({ totalePagine: 2 }));

    expect(sezioni.spazio.perPagina).toEqual([
      { pagina: 1, box: 0, spazioOccupato: 0 },
      { pagina: 2, box: 0, spazioOccupato: 0 },
    ]);
    expect(sezioni.zoneCalde.calore.map(pagina => pagina.pagina)).toEqual([1, 2]);
    expect(sezioni.zoneCalde.calore.flatMap(pagina => pagina.celle.flat()).every(valore => valore === 0)).toBe(true);
  });
});

describe('sezioniInsight: prezzi e sconti', () => {
  const sconti = [5, 10, 19.5, 35, 50, 70.5];
  const righe = [
    ...sconti.map((sconto, indice) => riga(`s${indice}`, { x: indice * 10, h: 10, data_fields: { descrizione_uno: `Prodotto ${indice}`, prezzo: 1, sconto_effettivo: sconto } })),
    riga('senzaSconto', { x: 60, h: 10, data_fields: { descrizione_uno: 'Pane', prezzo: 2, prezzo_offerta_kgl: '5,00' } }),
    riga('sottocosto', { x: 70, h: 10, data_fields: { descrizione_uno: 'Olio', prezzo: 0.99, sottocosto: true } }),
  ];

  it('fasce di sconto con il limite inferiore incluso e l\'ultima aperta', () => {
    const { prezziSconti } = sezioniInsight(boxDi(righe), opzioni());

    expect(prezziSconti.fasce).toEqual([
      { da: 0, a: 10, box: 1 },
      { da: 10, a: 20, box: 2 },
      { da: 20, a: 30, box: 0 },
      { da: 30, a: 40, box: 1 },
      { da: 40, a: 50, box: 0 },
      { da: 50, a: null, box: 2 },
    ]);
  });

  it('sconto medio per meccanica, sottocosto e prezzo al kg', () => {
    const { prezziSconti } = sezioniInsight(boxDi(righe), opzioni());

    expect(prezziSconti.perMeccanica).toEqual([
      { chiave: 'sconto', etichetta: 'Sconto in %', box: 6, scontoMedio: 31.7 },
      { chiave: 'prezzo', etichetta: 'Prezzo senza sconto', box: 1, scontoMedio: null },
      { chiave: 'sottocosto', etichetta: 'Sottocosto', box: 1, scontoMedio: null },
    ]);
    expect(prezziSconti.sottocosto).toEqual(['sottocosto']);
    expect(prezziSconti.conPrezzoAlKg).toBe(1);
    // Nessun reparto: un solo gruppo, quello dei box senza reparto
    expect(prezziSconti.perReparto).toEqual([{ chiave: '', etichetta: 'Reparto non indicato', box: 8, scontoMedio: 31.7 }]);
  });
});

describe('sezioniInsight: uso dello spazio', () => {
  // Pagine 100×100: un box alto quanto la pagina e largo w occupa w% della pagina
  const righe = [
    riga('s1', { pag: 1, x: 0, w: 30, meccanica: 'TP_FID', data_fields: { descrizione_uno: 'Pasta', descrizione_due: 'Alfa' } }),
    riga('s2', { pag: 1, x: 30, w: 20, data_fields: { descrizione_uno: 'Acqua', descrizione_due: 'Beta', prezzo: 1, prezzo_anziche: 2 } }),
    riga('s3', { pag: 3, x: 0, w: 10, data_fields: { descrizione_uno: 'Sugo', descrizione_due: 'Alfa', prezzo: 1 } }),
    riga('s4', { ...SENZA_GEOMETRIA, pag: 3, data_fields: { descrizione_uno: 'Sale', prezzo: 1 } }),
  ];
  const reparti = repartiConfigurati({
    s1: { codice: '01', descrizione: 'DROGHERIA ALIMENTARE' },
    s2: { codice: '03', descrizione: 'BEVANDE' },
    s3: { codice: '01', descrizione: 'DROGHERIA ALIMENTARE' },
  });

  it('quota di referenze accanto a quota di spazio per reparto, meccanica e marca', () => {
    const { spazio } = sezioniInsight(boxDi(righe), opzioni({ totalePagine: 3, repartoConfigurato: reparti }));

    expect(spazio.perReparto).toEqual([
      { chiave: '01', etichetta: 'DROGHERIA ALIMENTARE', referenze: 2, spazio: 40, quotaReferenze: 50, quotaSpazio: 66.7 },
      { chiave: '03', etichetta: 'BEVANDE', referenze: 1, spazio: 20, quotaReferenze: 25, quotaSpazio: 33.3 },
      { chiave: '', etichetta: 'Reparto non indicato', referenze: 1, spazio: 0, quotaReferenze: 25, quotaSpazio: 0 },
    ]);
    expect(spazio.perMeccanica).toEqual([
      { chiave: 'fidelity', etichetta: 'Prezzo Fidelity', referenze: 1, spazio: 30, quotaReferenze: 25, quotaSpazio: 50 },
      { chiave: 'sconto', etichetta: 'Sconto in %', referenze: 1, spazio: 20, quotaReferenze: 25, quotaSpazio: 33.3 },
      { chiave: 'prezzo', etichetta: 'Prezzo senza sconto', referenze: 2, spazio: 10, quotaReferenze: 50, quotaSpazio: 16.7 },
    ]);
    expect(spazio.perMarca).toEqual([
      { chiave: 'ALFA', etichetta: 'Alfa', referenze: 2, spazio: 40, quotaReferenze: 50, quotaSpazio: 66.7 },
      { chiave: 'BETA', etichetta: 'Beta', referenze: 1, spazio: 20, quotaReferenze: 25, quotaSpazio: 33.3 },
      { chiave: '', etichetta: 'Marca non indicata', referenze: 1, spazio: 0, quotaReferenze: 25, quotaSpazio: 0 },
    ]);
  });

  it('densita\' di ogni pagina, anche di quelle senza box; il box senza posizione conta ma non occupa spazio', () => {
    const { spazio } = sezioniInsight(boxDi(righe), opzioni({ totalePagine: 3, repartoConfigurato: reparti }));

    expect(spazio.perPagina).toEqual([
      { pagina: 1, box: 2, spazioOccupato: 50 },
      { pagina: 2, box: 0, spazioOccupato: 0 },
      { pagina: 3, box: 2, spazioOccupato: 10 },
    ]);
  });

  it('zone calde per reparto: quota di visibilita\' accanto a quota di spazio, senza i box che non hanno posizione', () => {
    const { zoneCalde } = sezioniInsight(boxDi(righe), opzioni({ totalePagine: 3, repartoConfigurato: reparti }));

    // s1 100, s2 66.7 (stessa pagina, piu' piccolo), s3 26.7 (ultima pagina): 01 = 126.7 / 193.4
    expect(zoneCalde.perReparto).toEqual([
      { chiave: '01', etichetta: 'DROGHERIA ALIMENTARE', quotaVisibilita: 65.5, quotaSpazio: 66.7 },
      { chiave: '03', etichetta: 'BEVANDE', quotaVisibilita: 34.5, quotaSpazio: 33.3 },
    ]);
    expect(zoneCalde.perMarca.map(voce => voce.chiave)).toEqual(['ALFA', 'BETA']);
    expect(zoneCalde.pesi).toEqual(PESI_VISIBILITA);
  });
});

describe('sezioniInsight: marche', () => {
  const righe = [
    riga('m1', { x: 0, w: 30, data_fields: { descrizione_uno: 'Latte', descrizione_due: 'Granarolo', prezzo: 1, sconto_effettivo: 20 } }),
    riga('m2', { x: 30, w: 10, data_fields: { descrizione_uno: 'Pasta', descrizione_due: 'Insegna', prezzo: 1, sconto_effettivo: 10 } }),
    // Tutto maiuscolo nei dati: la lettura lo riporta a "Insegna", la stessa marca
    riga('m3', { x: 40, w: 10, data_fields: { descrizione_uno: 'Riso', descrizione_due: 'INSEGNA', prezzo: 1 } }),
    riga('m4', { x: 50, w: 5, data_fields: { descrizione_uno: 'Mele', descrizione_due: 'Insegna Bio', prezzo: 1 } }),
    riga('m5', { x: 55, w: 10, data_fields: { descrizione_uno: 'Pane', prezzo: 1 } }),
  ];

  it('ordinate per spazio, con le marche del distributore riconosciute dal nome senza maiuscole', () => {
    const { marche, sintesi } = sezioniInsight(boxDi(righe), opzioni({ marcheDistributore: ['insegna'] }));

    expect(marche.elenco).toEqual([
      { chiave: 'GRANAROLO', nome: 'Granarolo', box: 1, referenze: 1, quotaSpazio: 46.2, scontoMedio: 20, distributore: false },
      { chiave: 'INSEGNA', nome: 'Insegna', box: 2, referenze: 2, quotaSpazio: 30.8, scontoMedio: 10, distributore: true },
      { chiave: 'INSEGNA BIO', nome: 'Insegna Bio', box: 1, referenze: 1, quotaSpazio: 7.7, scontoMedio: null, distributore: true },
    ]);
    // 25 su 65 di spazio, 3 box su 5 (anche quello senza marca conta nel totale)
    expect(marche.quotaDistributore).toEqual({ quotaSpazio: 38.5, quotaBox: 60 });
    expect(sintesi.marche).toBe(3);
  });

  it('senza marche del distributore nella config la quota non si calcola', () => {
    const conVuote = sezioniInsight(boxDi(righe), opzioni({ marcheDistributore: ['  ', ''] }));
    const senza = sezioniInsight(boxDi(righe), opzioni());

    expect(senza.marche.quotaDistributore).toBeNull();
    expect(conVuote.marche.quotaDistributore).toBeNull();
    expect(senza.marche.elenco.some(marca => marca.distributore)).toBe(false);
  });

  it('chiave della marca: maiuscole e spazi singoli', () => {
    expect(chiaveMarca('  Mulino   bianco ')).toBe('MULINO BIANCO');
  });
});

describe('boxInsight: visibilita\' e zone calde', () => {
  // Pagine 200×300 di un volantino di 8 pagine
  const pagina = { w_page: 200, h_page: 300 };
  const righe = [
    riga('copertina', { ...pagina, pag: 1, x: 0, y: 0, w: 100, h: 100 }),
    riga('interna', { ...pagina, pag: 5, x: 0, y: 0, w: 100, h: 100 }),
    riga('senzaPosizione', { ...pagina, ...SENZA_GEOMETRIA, pag: 2 }),
    riga('inCima', { ...pagina, pag: 4, x: 100, y: 0, w: 100, h: 30 }),
    riga('inFondo', { ...pagina, pag: 4, x: 100, y: 270, w: 100, h: 30 }),
  ];

  it('100 sul box piu\' visibile; la copertina pesa il doppio di una pagina interna; senza posizione 0', () => {
    const box = perId(boxInsight(boxDi(righe), opzioni({ totalePagine: 8 })));

    expect(box.get('copertina')?.visibilita).toBe(100);
    expect(box.get('interna')?.visibilita).toBe(50);
    expect(box.get('senzaPosizione')).toMatchObject({ visibilita: 0, spazio: 0, geometria: null, proporzionePagina: null });
    // In cima alla pagina si vede piu' che in fondo
    expect(box.get('inCima')!.visibilita).toBeGreaterThan(box.get('inFondo')!.visibilita);
  });

  it('i box piu\' visibili dal primo, senza quelli che non hanno posizione', () => {
    const { zoneCalde } = sezioniInsight(boxDi(righe), opzioni({ totalePagine: 8 }));

    expect(zoneCalde.boxPiuVisibili).toEqual(['copertina', 'interna', 'inCima', 'inFondo']);
  });

  it('mappa di calore di ogni pagina: la copertina e\' piu\' calda di una pagina interna con lo stesso box', () => {
    const { zoneCalde } = sezioniInsight(boxDi(righe), opzioni({ totalePagine: 8 }));
    const calore = new Map(zoneCalde.calore.map(voce => [voce.pagina, voce.celle]));

    expect([...calore.keys()]).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    for (const celle of calore.values()) {
      expect(celle).toHaveLength(GRIGLIA_CALORE.righe);
      for (const rigaCelle of celle) expect(rigaCelle).toHaveLength(GRIGLIA_CALORE.colonne);
    }
    expect(calore.get(1)![0][0]).toBe(1);
    expect(calore.get(5)![0][0]).toBe(0.5);
    // Il box copre solo la meta' sinistra del primo terzo della pagina
    expect(calore.get(1)![0][3]).toBe(0);
    expect(calore.get(1)![5][0]).toBe(0);
    // Il box senza posizione non scalda la sua pagina
    expect(calore.get(2)!.flat().every(valore => valore === 0)).toBe(true);
  });

  it('i dieci box piu\' visibili al massimo', () => {
    const molte = Array.from({ length: 12 }, (_, indice) => riga(`b${indice}`, { pag: 2, x: (indice % 10) * 10, y: indice < 10 ? 0 : 50, w: 10, h: 10 }));
    const { zoneCalde } = sezioniInsight(boxDi(molte), opzioni({ totalePagine: 4 }));

    expect(zoneCalde.boxPiuVisibili).toHaveLength(10);
    // A parita' di visibilita' resta l'ordine del volantino; i due piu' in basso restano fuori
    expect(zoneCalde.boxPiuVisibili).not.toContain('b10');
    expect(zoneCalde.boxPiuVisibili).not.toContain('b11');
  });
});

describe('boxInsight: il box come lo vede la scheda', () => {
  it('storico: pilota con prezzi stampati, riga compilata a mano nello stesso box, foto, meccanica originale e origine', () => {
    const righe = [
      riga('r1', {
        pag: 2, x: 15, y: 20, w: 63, h: 61.5, w_page: 210, h_page: 287, codice_box: 'B7', foto: ['g1'],
        compiled_fields: [
          campo('prezzo_offerta', '1,69', 'PREZ_FidelityR'),
          campo('campo_offerta', '€ 2,95', 'PREZ_CampoOfferta_barrato'),
          campo('sconto_effettivo_grande', '-42,71%', 'Sconto_SIR_Grande'),
          campo('descrizione', '<DES_descr_nome>Mozzarella</DES_descr_nome><DES_descr_marca>Granarolo</DES_descr_marca><DES_descr_gr>100 g</DES_descr_gr>', 'DES_Descrizione'),
        ],
      }),
      // Compilata a mano: senza posizione, va nel box con lo stesso codice nella stessa pagina
      riga('r1b', { ...SENZA_GEOMETRIA, pag: 2, codice_box: 'B7', foto: ['g2', 'g1'], data_fields: { descrizione_uno: 'Yogurt magro', descrizione_due: 'Alfa' } }),
    ];

    const [box] = boxInsight(boxDi(righe, true), opzioni({
      totalePagine: 4,
      meccanicaOriginale: idReferenza => (idReferenza === 'r1b' ? 'TP_FID_KgL' : null),
      origine: codiceBox => (codiceBox === 'B7' ? 'fuori_listino' : 'listino'),
    }));

    expect(box).toMatchObject({
      id: 'r1',
      codiceBox: 'B7',
      pagina: 2,
      nome: 'Mozzarella',
      marca: 'Granarolo',
      formato: '100 g',
      prezzo: 1.69,
      barrato: 2.95,
      sconto: 42.71,
      meccanica: 'fidelity',
      meccanicaOriginale: 'TP_FID_KgL',
      sottocosto: false,
      prodotti: 2,
      idReferenze: ['r1', 'r1b'],
      foto: ['/foto/g1', '/foto/g2'],
      origine: 'fuori_listino',
      visibilita: 100,
    });
    expect(box.chiave).toMatch(/^d-/);
    expect(box.proporzionePagina).toBeCloseTo(210 / 287, 3);
  });

  it('Istanta: la pagina destra della doppia pagina ha la stessa geometria dello storico; nessuna origine', () => {
    const misure = { y: 34, w: 65.3, h: 78.4, w_page: 290, h_page: 320 };
    const [istanta] = boxInsight(boxDi([riga('i1', { ...misure, pag: 3, x: 296.5, data_fields: { codice_referenza: 'B1', descrizione_uno: 'Caffe' } })]), opzioni());
    const [storico] = boxInsight(boxDi([riga('s1', { ...misure, pag: 3, x: 6.5, data_fields: { codice_referenza: 'B1', descrizione_uno: 'Caffe' } })], true), opzioni());

    expect(istanta.geometria).toEqual(storico.geometria);
    expect(istanta.spazio).toBe(storico.spazio);
    expect(istanta.geometria!.x).toBeLessThan(0.1);
    expect(istanta.chiave).toBe('c-B1');
    expect(istanta).not.toHaveProperty('origine');
  });

  it('reparto: quello della config prima della lettura generica, che si riconduce all\'anagrafica se puo\'', () => {
    const righe = [
      // La config dice 24: vale lei, anche se i dati scrivono un'altra descrizione
      riga('k1', { x: 0, data_fields: { descrizione_uno: 'Insalata', descrizione_reparto: 'Ortofrutta' } }),
      // Storico: numero del reparto senza descrizione
      riga('k2', { x: 10, data_fields: { descrizione_uno: 'Pasta', reparto: '1' } }),
      // Stile di paragrafo DIC_Rep_NN del testo stampato
      riga('k3', { x: 20, compiled_fields: [campo('descrizione', '<DES_descr_nome>Mele</DES_descr_nome>', 'DIC_Rep_33')] }),
      // Fuori anagrafica: com'e' stato letto
      riga('k4', { x: 30, data_fields: { descrizione_uno: 'Vino', descrizione_reparto: 'ENOTECA' } }),
      riga('k5', { x: 40, data_fields: { descrizione_uno: 'Varie' } }),
    ];

    const box = perId(boxInsight(boxDi(righe, true), opzioni({
      anagraficaReparti: ANAGRAFICA,
      repartoConfigurato: repartiConfigurati({ k1: { codice: '24', descrizione: 'DEPERIBILI LIBERO SERVIZIO' } }),
    })));

    expect(box.get('k1')?.reparto).toEqual({ codice: '24', descrizione: 'DEPERIBILI LIBERO SERVIZIO' });
    expect(box.get('k2')?.reparto).toEqual({ codice: '01', descrizione: 'DROGHERIA ALIMENTARE' });
    expect(box.get('k3')?.reparto).toEqual({ codice: '33', descrizione: 'ORTOFRUTTA' });
    expect(box.get('k4')?.reparto).toEqual({ codice: 'Enoteca', descrizione: 'Enoteca' });
    expect(box.get('k5')?.reparto).toBeNull();
  });
});
