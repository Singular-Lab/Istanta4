import { describe, expect, it } from 'vitest';
import {
  chiaveProdotto,
  DESCRIZIONE_ASSENTE,
  descrizioneStampata,
  geometriaDi,
  leggiReferenza,
  maiuscoleSensate,
  numeroStampato,
  percentualeIngombro,
  type RigaReferenza,
  scontoDaiPrezzi,
  testoStampato,
} from './referenzaStampata';

// Una riga di referenze letta com'e' stampata: storico (sync del Plugin, DB1) e Istanta

const campo = (labelName: string, content: string, paragraphName = '') => ({
  labelName, paragraphName, content, label_name: labelName, paragraph_name: paragraphName,
});

const riga = (dati: Partial<RigaReferenza> = {}): RigaReferenza => ({
  id: 'r-1',
  compiled_fields: [],
  data_fields: {},
  foto: [],
  meccanica: '',
  codice_box: '407655',
  group_elements: [],
  pag: 2,
  x: 15,
  y: 20,
  w: 63.33,
  h: 61.75,
  w_page: 210,
  h_page: 287,
  perc_ingombro: 6.49,
  ...dati,
});

const STORICO = { storico: true };
const ISTANTA = { storico: false };

/** Box Fidelity dello storico, come lo manda il Plugin. */
const MOZZARELLA = [
  campo('campo_offerta_KgL_sconto', 'al kg da € 9,83 a € 5,63', 'PREZ_CampoOfferta_KgL'),
  campo('sconto_effettivo_grande', '-42,71%', 'Sconto_SIR_Grande'),
  campo('sy_euro', '€', '[Paragrafo base]'),
  campo('prezzo_offerta', '1,69', 'PREZ_FidelityR'),
  campo('campo_offerta', '€ 2,95', 'PREZ_CampoOfferta_barrato'),
  campo('descrizione', '<DES_descr_nome>Mozzarella <br>Alta Qualità</DES_descr_nome><DES_descr_marca><br>Granarolo</DES_descr_marca><DES_descr_gr><br>conf. 100 g x 3 pezzi</DES_descr_gr>', 'DES_Descrizione'),
];

/** Riga Istanta: data_fields FP con i prezzi come testo, meccanica = combinazione. */
const DATI_TONNO = {
  codice_referenza: '1757867',
  ean_referenza: '8004030345638',
  descrizione_uno: 'Tonno',
  descrizione_due: 'Rio Mare',
  descrizione_tre: "all'olio di oliva",
  descrizione_quattro: 'conf. 80 g x 12 pezzi',
  prezzo: '10,99',
  prezzo_anziche: '19,98',
  reparto: '01',
  sigla_reparto: 'DAL',
  descrizione_reparto: 'DROGHERIA ALIMENTARE',
  descrizione_settore: 'CONSERVE ANIMALI',
  ruolo: 'PRIMA PAGINA',
  tema: 'MGRFORMAMULTI',
  allEtichette: ['FOOD', 'TP_FID', 'PRIMA PAG'],
};
const TONNO_STAMPATO = [
  campo('campo_offerta_KgL_sconto', 'al kg da € 20,82 a € 11,45', 'PREZ_CampoOfferta_KgL'),
  campo('sconto_effettivo_grande', '-44,99%', 'Sconto_SIR_Grande'),
  campo('prezzo', '10,99', 'PREZ_FidelityR'),
  campo('campo_offerta', '€ 19,98', 'PREZ_CampoOfferta_barrato'),
  campo('descrizione', "<DES_descr_nome>Tonno\n</DES_descr_nome><DES_descr_marca>Rio Mare\n</DES_descr_marca><DES_descr_tipo>all'olio di oliva\n</DES_descr_tipo><DES_descr_gr>conf. 80 g x 12 pezzi</DES_descr_gr>"),
];

describe('testo e numeri stampati', () => {
  it('toglie tag e stili di carattere, <br> e a capo diventano spazi, decodifica le entita\'', () => {
    expect(testoStampato('<DES_descr_nome>Krapfen \nalla crema</DES_descr_nome>')).toBe('Krapfen alla crema');
    expect(testoStampato('pasticceria secca<br>&ldquo;Selezione Forno&rdquo;')).toBe('pasticceria secca “Selezione Forno”');
    expect(testoStampato('Pasta all&rsquo;uovo&nbsp;&amp; co&#46;  ')).toBe('Pasta all’uovo & co.');
    expect(testoStampato(null)).toBe('');
    expect(testoStampato({ a: 1 })).toBe('');
  });

  it.each([
    ['2,69', 2.69],
    ['€ 2,95', 2.95],
    ['-42,71%', 42.71],
    ['1.234,56', 1234.56],
    ['1.29', 1.29],
    ['40', 40],
    ['al kg da € 9,83 a € 5,63', 9.83],
    [1.29, 1.29],
    [-3, 3],
  ])('%j -> %d', (valore, atteso) => {
    expect(numeroStampato(valore)).toBe(atteso);
  });

  it.each([[''], ['€'], ['vari tipi'], [null], [undefined], [Number.NaN], [{}]])('%j non e\' un numero', (valore) => {
    expect(numeroStampato(valore)).toBeNull();
  });

  it('lo sconto dai prezzi solo se il barrato e\' piu\' alto', () => {
    expect(scontoDaiPrezzi(1.69, 2.95)).toBe(42.71);
    expect(scontoDaiPrezzi(2.95, 2.95)).toBeNull();
    expect(scontoDaiPrezzi(3, 2)).toBeNull();
    expect(scontoDaiPrezzi(null, 2)).toBeNull();
  });

  it('le marche tutte maiuscole prendono le iniziali maiuscole, le altre restano come sono', () => {
    expect(maiuscoleSensate('SAN BENEDETTO')).toBe('San Benedetto');
    expect(maiuscoleSensate("D'ALESSANDRO")).toBe("D'Alessandro");
    expect(maiuscoleSensate('CONAD Piacersi')).toBe('CONAD Piacersi');
    expect(maiuscoleSensate('Rio Mare')).toBe('Rio Mare');
    expect(maiuscoleSensate(null)).toBeNull();
  });
});

describe('descrizioneStampata', () => {
  it('nome, marca, tipo e formato dagli stili, anche con i suffissi _MC e _BFist e piu\' blocchi', () => {
    expect(descrizioneStampata(MOZZARELLA[5].content)).toEqual({
      nome: 'Mozzarella Alta Qualità', marca: 'Granarolo', tipo: null, formato: 'conf. 100 g x 3 pezzi',
    });
    expect(descrizioneStampata(
      '<DES_descr_nome_MC>Acqua</DES_descr_nome_MC><DES_descr_marca_MC><br>Lete</DES_descr_marca_MC>'
      + '<DES_descr_tipo_MC><br>minerale<br>effervescente naturale</DES_descr_tipo_MC><DES_descr_gr_MC><br>conf. 500 ml\nx 6 pezzi</DES_descr_gr_MC>',
    )).toEqual({ nome: 'Acqua', marca: 'Lete', tipo: 'minerale effervescente naturale', formato: 'conf. 500 ml x 6 pezzi' });
    expect(descrizioneStampata('<DES_descr_nome_BFist>Burger</DES_descr_nome_BFist><DES_descr_gr_BFist>150 g</DES_descr_gr_BFist>'))
      .toEqual({ nome: 'Burger', marca: null, tipo: null, formato: '150 g' });
    // Due blocchi di formato, il primo vuoto
    expect(descrizioneStampata('<DES_descr_nome>affettati\n</DES_descr_nome><DES_descr_gr><br></DES_descr_gr><DES_descr_tipo>vari tipi</DES_descr_tipo><DES_descr_gr>100 g</DES_descr_gr>'))
      .toEqual({ nome: 'affettati', marca: null, tipo: 'vari tipi', formato: '100 g' });
  });

  it('senza stili e\' tutta nome, tranne le ultime righe con una misura', () => {
    expect(descrizioneStampata('plumcake\nmulino bianco\nbarilla\nclassico\n330 g \nconf. da 10 pezzi')).toEqual({
      nome: 'plumcake mulino bianco barilla classico', marca: null, tipo: null, formato: '330 g conf. da 10 pezzi',
    });
    expect(descrizioneStampata('Olio extra vergine di oliva\nCarapelli\n1l')).toMatchObject({ nome: 'Olio extra vergine di oliva Carapelli', formato: '1l' });
    expect(descrizioneStampata('Ficus Benjamin')).toEqual({ nome: 'Ficus Benjamin', marca: null, tipo: null, formato: null });
  });
});

describe('leggiReferenza: storico', () => {
  it('box Fidelity: testo, prezzi, sconto stampato, prezzo al kg; senza dati DB1 si riconosce dal testo', () => {
    const referenza = leggiReferenza(riga({ compiled_fields: MOZZARELLA, foto: ['g-1', 'g-1', 'g-2'] }), STORICO);

    expect(referenza).toMatchObject({
      nome: 'Mozzarella Alta Qualità',
      marca: 'Granarolo',
      formato: 'conf. 100 g x 3 pezzi',
      prezzo: 1.69,
      barrato: 2.95,
      sconto: 42.71,
      prezzoAlKg: 'al kg da € 9,83 a € 5,63',
      meccanica: 'fidelity',
      sottocosto: false,
      codice: null,
      reparto: null,
      fonte: 'testo',
      foto: ['g-1', 'g-2'],
      codiceBox: '407655',
      pagina: 2,
    });
    expect(referenza.chiave).toMatch(/^d-[A-Za-z0-9_-]+$/);
    expect(referenza.prodotti).toHaveLength(1);
  });

  it('sconto normale: prezzo "EUR prima", barrato e percentuale stampata', () => {
    const referenza = leggiReferenza(riga({
      compiled_fields: [
        campo('prezzo_offerta_EURprima', '€ 1,85', 'PREZ_Sconto_EURprima_SDB'),
        campo('sy_%', '%', '[Nessuno stile paragrafo]'),
        campo('sconto_norm', '30', 'SCONTO_Normale_SDB'),
        campo('campo_offerta', '€ 2,65', 'PREZ_CampoOfferta_barrato_SDB'),
        campo('descrizione', '<DES_descr_nome>Burro</DES_descr_nome><DES_descr_marca><br>CONAD Piacersi</DES_descr_marca><DES_descr_gr><br>250 g</DES_descr_gr>', 'DES_Descrizione'),
      ],
    }), STORICO);

    expect(referenza).toMatchObject({ prezzo: 1.85, barrato: 2.65, sconto: 30, meccanica: 'sconto', marca: 'CONAD Piacersi' });
  });

  it('bollini della minicollezione: meccanica punti anche col prezzo Fidelity, e il testo dei punti', () => {
    const referenza = leggiReferenza(riga({
      compiled_fields: [
        campo('prezzo_offerta', '1,74', 'PREZ_Fidelity_MC'),
        campo('campo_offerta', '€ 1,98', 'PREZ_CampoOfferta_barrato_MC'),
        campo('range1', '2 conf.', 'Campo_range1_MC'),
        campo('tipo_punti1', 'bollini', 'Campo_punti1_MC'),
        campo('punti1', '3', 'Campo_punti1_MC'),
        campo('descrizione', '<DES_descr_nome_MC>Acqua Libera</DES_descr_nome_MC><DES_descr_marca_MC><br>San Benedetto</DES_descr_marca_MC>', 'DES_Descrizione_MC'),
      ],
    }), STORICO);

    expect(referenza).toMatchObject({ meccanica: 'punti', punti: '3 bollini con 2 conf.', prezzo: 1.74, barrato: 1.98, sconto: 12.12 });
  });

  it('solo bollini, senza prezzo: meccanica punti', () => {
    const referenza = leggiReferenza(riga({
      compiled_fields: [
        campo('punti1', '2', 'Campo_punti1_MC'),
        campo('tipo_punti1', 'bollini', 'Campo_punti1_MC'),
        campo('descrizione', '<DES_descr_nome_MC>Bon Roll</DES_descr_nome_MC>', 'DIC_Rep_29'),
      ],
    }), STORICO);

    expect(referenza).toMatchObject({ meccanica: 'punti', punti: '2 bollini', prezzo: null, reparto: 'Reparto 29' });
  });

  it('prezzo senza sconto con il reparto nello stile di paragrafo', () => {
    const referenza = leggiReferenza(riga({
      compiled_fields: [
        campo('prezzo_offerta', '8,90', 'PREZ_NoSconto'),
        campo('descrizione', '<DES_descr_nome>Primosale <br>Le Specialità</DES_descr_nome><DES_descr_marca><br>Fattorie Osella</DES_descr_marca><DES_descr_gr><br>al kg</DES_descr_gr>', 'DIC_Rep_25'),
      ],
    }), STORICO);

    expect(referenza).toMatchObject({ meccanica: 'prezzo', prezzo: 8.9, barrato: null, sconto: null, reparto: 'Reparto 25', formato: 'al kg' });
  });

  it('compilata a mano fuori listino: record DB1 con gli alias FP, sottocosto dalla meccanica DB1', () => {
    const referenza = leggiReferenza(riga({
      meccanica: 'SOTTOCOSTO',
      data_fields: {
        codice: '4969665', codice_referenza: '4969665', ean: '8002670012345', ean_referenza: '8002670012345',
        descrizione1: 'MOZZARELLA ALTA QUALITA', descrizione_uno: 'MOZZARELLA ALTA QUALITA', descrizione2: 'GRANAROLO', descrizione_due: 'GRANAROLO',
        descrizione4: '100 g x 3', descrizione_quattro: '100 g x 3',
        prezzo: 1.49, prezzo_offerta: 1.49, anziche: 2.95, prezzo_anziche: 2.95,
        reparto: 21, settore: 4, segmento: 'MOZZARELLE VACCINE', ruolo: 'VEDETTE', tema: 'QUALITA ITALIANA', meccanica: 'SOTTOCOSTO',
      },
    }), STORICO);

    expect(referenza).toMatchObject({
      chiave: 'c-4969665',
      codice: '4969665',
      ean: '8002670012345',
      nome: 'Mozzarella Alta Qualita',
      marca: 'Granarolo',
      prezzo: 1.49,
      barrato: 2.95,
      sconto: 49.49,
      meccanica: 'sottocosto',
      sottocosto: true,
      reparto: 'Reparto 21',
      segmento: 'Mozzarelle vaccine',
      ruolo: 'Vedette',
      tema: 'QUALITA ITALIANA',
      fonte: 'db1',
    });
  });

  it.each([
    ['2x1', {}],
    ['3X2', {}],
    ['', { N_MM: 3, M_MM: 2 }],
    ['', { N_fid: 2, M_fid: 1 }],
  ])('N×M dalla meccanica DB1 "%s" o dai campi N/M %j', (meccanica, campi) => {
    const referenza = leggiReferenza(riga({ meccanica, data_fields: { codice_referenza: '1', prezzo: 2, ...campi } }), STORICO);
    expect(referenza.meccanica).toBe('nxm');
  });

  it('sottocosto anche dal testo stampato, prima di ogni altra meccanica', () => {
    const referenza = leggiReferenza(riga({
      compiled_fields: [campo('prezzo_offerta', '0,99', 'PREZ_FidelityR'), campo('X_bollo', 'SOTTOCOSTO', 'BOLLO_Sottocosto')],
    }), STORICO);
    expect(referenza).toMatchObject({ meccanica: 'sottocosto', sottocosto: true });
  });

  it('senza nulla di stampato ne\' dati: niente meccanica, nome segnaposto e chiave a se\'', () => {
    const prima = leggiReferenza(riga({ id: 'a' }), STORICO);
    const seconda = leggiReferenza(riga({ id: 'b' }), STORICO);
    expect(prima).toMatchObject({ meccanica: null, nome: DESCRIZIONE_ASSENTE, fonte: 'testo' });
    expect(prima.chiave).not.toBe(seconda.chiave);
  });
});

describe('leggiReferenza: Istanta', () => {
  it('dati FP: codice, EAN, reparto dalla descrizione, settore e ruolo come frase, fonte istanta', () => {
    const referenza = leggiReferenza(riga({ compiled_fields: TONNO_STAMPATO, data_fields: DATI_TONNO, meccanica: 'TP_FID_KgL' }), ISTANTA);

    expect(referenza).toMatchObject({
      chiave: 'c-1757867',
      nome: 'Tonno',
      marca: 'Rio Mare',
      tipo: "all'olio di oliva",
      formato: 'conf. 80 g x 12 pezzi',
      prezzo: 10.99,
      barrato: 19.98,
      sconto: 44.99,
      meccanica: 'fidelity',
      reparto: 'Drogheria alimentare',
      settore: 'Conserve animali',
      ruolo: 'Prima pagina',
      tema: 'MGRFORMAMULTI',
      ean: '8004030345638',
      fonte: 'istanta',
    });
  });

  it('il gruppo del box: gli altri prodotti con i loro dati, la pilota una volta sola', () => {
    const referenza = leggiReferenza(riga({
      data_fields: { 'Referenza.Codice': '2717189', 'Descrizioni.Descrizione1': 'Banane', prezzo_offerta: '1,29', prezzo_anziche: '1,79', descrizione_reparto: 'ORTOFRUTTA' },
      meccanica: 'TP_MM_mercato',
      group_elements: [
        { 'Referenza.Codice': '2717189', 'Descrizioni.Descrizione1': 'Banane', prezzo_offerta: '1,29' },
        { 'Referenza.Codice': '3066324', 'Referenza.Ean': '2000000637556', 'Descrizioni.Descrizione1': 'Banane', 'Descrizioni.Descrizione2': 'CONAD \nPercorso Qualità', prezzo_offerta: 1.19, prezzo_anziche: 1.79, sigla_reparto: 'of' },
        { 'Referenza.Codice': '999', 'Descrizioni.Descrizione1': 'Banane bio' },
      ],
    }), ISTANTA);

    expect(referenza.prodotti.map(prodotto => prodotto.chiave)).toEqual(['c-2717189', 'c-3066324', 'c-999']);
    expect(referenza.prodotti[1]).toMatchObject({
      nome: 'Banane', marca: 'CONAD Percorso Qualità', ean: '2000000637556', prezzo: 1.19, barrato: 1.79, sconto: 33.52,
      meccanica: 'sconto', reparto: 'OF', fonte: 'istanta', foto: [],
    });
    // Senza prezzi propri, quelli del box; senza reparto, quello del box
    expect(referenza.prodotti[2]).toMatchObject({ prezzo: 1.29, barrato: 1.79, reparto: 'Ortofrutta' });
  });

  it.each([
    ['TP_MM_KgL', [campo('prezzo', '2,00', 'PREZ_NoSconto')], 'prezzo'],
    ['TP_MM', [campo('prezzo', '2,00', 'PREZ_NoSconto'), campo('campo_offerta', '€ 2,79', 'PREZ_CampoOfferta_barrato')], 'sconto'],
    ['PERCENTO_MM_ALL_KgL', [campo('prezzo', '5,94', 'PREZ_Sconto')], 'sconto'],
    ['PERCENTO_FID_ALL_KgL_mercato', [campo('prezzo', '2,57', 'PREZ_Fidelity')], 'fidelity'],
    ['NM_MIX_MM', [campo('prezzo', '2,57', 'PREZ_NoSconto')], 'nxm'],
    ['PUNTI_TP_minicoll', [campo('prezzo', '2,57', 'PREZ_NoSconto')], 'punti'],
  ])('combinazione %s -> %s', (meccanica, campi, attesa) => {
    expect(leggiReferenza(riga({ meccanica, compiled_fields: campi, data_fields: { codice_referenza: '1' } }), ISTANTA).meccanica).toBe(attesa);
  });

  it('solo dati, niente di stampato: prezzi dai data_fields come testo e sconto calcolato', () => {
    const referenza = leggiReferenza(riga({
      data_fields: { codice_referenza: '5503602', descrizione_uno: 'Formaggio fresco', prezzo: '2,00', prezzo_anziche: '2,79', prezzo_offerta_kgl: '6,67', prezzo_anziche_kgl: '9,30', descrizione_unita_misura: 'Kg' },
    }), ISTANTA);
    expect(referenza).toMatchObject({ prezzo: 2, barrato: 2.79, sconto: 28.32, meccanica: 'sconto', prezzoAlKg: 'al kg da € 9,30 a € 6,67' });
  });
});

describe('reparto', () => {
  const reparto = (dati: Record<string, unknown>, paragrafo = '') =>
    leggiReferenza(riga({ data_fields: dati, compiled_fields: [campo('descrizione', 'Pane', paragrafo)] }), ISTANTA).reparto;

  it('descrizione, poi sigla, poi numero DB1, poi lo stile DIC_Rep_NN, altrimenti null', () => {
    expect(reparto({ descrizione_reparto: 'ORTOFRUTTA', sigla_reparto: 'OF', reparto: 33 }, 'DIC_Rep_33')).toBe('Ortofrutta');
    expect(reparto({ sigla_reparto: 'of', reparto: 33 }, 'DIC_Rep_33')).toBe('OF');
    expect(reparto({ reparto: 3 }, 'DIC_Rep_33')).toBe('Reparto 03');
    expect(reparto({}, 'DIC_Rep_27')).toBe('Reparto 27');
    expect(reparto({})).toBeNull();
  });
});

describe('chiave del prodotto', () => {
  const chiave = (descrizione: string, dati: Record<string, unknown> = {}, id = 'r-1') =>
    leggiReferenza(riga({ id, compiled_fields: [campo('descrizione', descrizione)], data_fields: dati }), STORICO).chiave;

  it('col codice: codice_referenza, poi Referenza.Codice, poi codice', () => {
    expect(chiave('x', { codice_referenza: '123', 'Referenza.Codice': '456', codice: '789' })).toBe('c-123');
    expect(chiave('x', { 'Referenza.Codice': '456', codice: '789' })).toBe('c-456');
    expect(chiave('x', { codice: '00789' })).toBe('c-00789');
    expect(chiaveProdotto('A/B 1', null, null, null, 'r')).toMatch(/^c-[A-Za-z0-9_-]+$/);
  });

  it('senza codice: lo stesso prodotto stampato in modi diversi ha la stessa chiave', () => {
    const una = chiave('<DES_descr_nome>Mozzarella <br>Alta Qualità</DES_descr_nome><DES_descr_marca><br>Granarolo</DES_descr_marca><DES_descr_gr>conf. 100 g x 3 pezzi</DES_descr_gr>');
    const altra = chiave('<DES_descr_nome_MC>MOZZARELLA ALTA QUALITA</DES_descr_nome_MC><DES_descr_marca_MC>granarolo</DES_descr_marca_MC><DES_descr_gr_MC>100 g\nx 3 pezzi</DES_descr_gr_MC>', {}, 'r-2');
    const altroFormato = chiave('<DES_descr_nome>Mozzarella Alta Qualità</DES_descr_nome><DES_descr_marca>Granarolo</DES_descr_marca><DES_descr_gr>conf. 125 g</DES_descr_gr>');

    expect(una).toMatch(/^d-[A-Za-z0-9_-]+$/);
    expect(altra).toBe(una);
    expect(altroFormato).not.toBe(una);
  });
});

describe('geometria', () => {
  it('storico: x relativa alla pagina, spazio dalla superficie', () => {
    expect(geometriaDi(riga())).toEqual({ pagina: 2, x: 0.0714, y: 0.0697, w: 0.3016, h: 0.2152, spazio: 6.49, proporzione: 0.7317 });
  });

  it('Istanta: la pagina destra parte da w_page e si riporta alla pagina', () => {
    const geometria = geometriaDi(riga({ pag: 3, x: 296.5, y: 32, w: 65.3, h: 78.4, w_page: 290, h_page: 320, perc_ingombro: 0.0551 }));
    expect(geometria).toEqual({ pagina: 3, x: 0.0224, y: 0.1, w: 0.2252, h: 0.245, spazio: 5.52, proporzione: 0.9063 });
  });

  it('il box che esce dalla pagina si taglia ai bordi', () => {
    expect(geometriaDi(riga({ x: -10, w: 30 }))).toMatchObject({ x: 0, w: 0.0952 });
  });

  it('senza geometria completa, o con misure nulle, niente geometria', () => {
    expect(geometriaDi(riga({ x: null }))).toBeNull();
    expect(geometriaDi(riga({ pag: null }))).toBeNull();
    expect(geometriaDi(riga({ w: 0 }))).toBeNull();
    expect(geometriaDi(riga({ w_page: undefined }))).toBeNull();
  });

  it('ingombro in percentuale: dalla geometria; senza, perc_ingombro come frazione (Istanta) o percentuale (storico)', () => {
    expect(percentualeIngombro(riga())).toBeCloseTo(6.489, 2);
    expect(percentualeIngombro({ w: 65.3, h: 78.4, w_page: 290, h_page: 320, perc_ingombro: 0.0551 })).toBeCloseTo(5.517, 2);
    expect(percentualeIngombro({ w: null, h: null, w_page: null, h_page: null, perc_ingombro: 0.0551 })).toBeCloseTo(5.51, 5);
    expect(percentualeIngombro({ w: null, h: null, w_page: null, h_page: null, perc_ingombro: 6.49 })).toBe(6.49);
    expect(percentualeIngombro({ perc_ingombro: null })).toBe(0);
  });
});
