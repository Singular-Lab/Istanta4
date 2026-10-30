import { describe, expect, it } from 'vitest';
import { leggiListaPuntiVendita, MASSIMO_VOCI_LISTA, vociDaPvData, vociDelVolantino } from './listaPuntiVenditaVolantino';

// La lista come arriva da InDesign per un volantino CONAD (paragrafi separati da \r), con dati di prova
const LISTA_CONAD = [
  'LIGURIA',
  'Provincia di GENOVA',
  'PRA - Via Murtola 12/14 - tel. 010 6197180',
  'STRUPPA - Via Trossarelli 1/F - tel. 010 809010',
  'Provincia di IMPERIA',
  'BORDIGHERA - Via Pasteur 70/e - tel. 0184 251143',
  'SANREMO - C.so Nazario Sauro 44 - tel. 0184 591201',
].join('\r');

const essenziale = (testo: string) =>
  leggiListaPuntiVendita(testo).map(({ localita, indirizzo, telefono }) => ({ localita, indirizzo, telefono }));

describe('leggiListaPuntiVendita', () => {
  it('legge la lista CONAD: regione, provincia, citta, indirizzo e telefono di ogni voce, nell\'ordine', () => {
    const voci = leggiListaPuntiVendita(LISTA_CONAD);

    expect(voci).toEqual([
      {
        posizione: 1, riga: 'PRA - Via Murtola 12/14 - tel. 010 6197180', regione: 'LIGURIA', provincia: 'GENOVA', gruppo: null,
        localita: 'PRA', indirizzo: 'Via Murtola 12/14', telefono: '010 6197180',
      },
      {
        posizione: 2, riga: 'STRUPPA - Via Trossarelli 1/F - tel. 010 809010', regione: 'LIGURIA', provincia: 'GENOVA', gruppo: null,
        localita: 'STRUPPA', indirizzo: 'Via Trossarelli 1/F', telefono: '010 809010',
      },
      {
        posizione: 3, riga: 'BORDIGHERA - Via Pasteur 70/e - tel. 0184 251143', regione: 'LIGURIA', provincia: 'IMPERIA', gruppo: null,
        localita: 'BORDIGHERA', indirizzo: 'Via Pasteur 70/e', telefono: '0184 251143',
      },
      {
        posizione: 4, riga: 'SANREMO - C.so Nazario Sauro 44 - tel. 0184 591201', regione: 'LIGURIA', provincia: 'IMPERIA', gruppo: null,
        localita: 'SANREMO', indirizzo: 'C.so Nazario Sauro 44', telefono: '0184 591201',
      },
    ]);
  });

  it('accetta \\n, \\r\\n e i separatori di riga di InDesign come fine paragrafo', () => {
    const conAcapo = LISTA_CONAD.replace(/\r/g, '\n');
    const conSeparatori = LISTA_CONAD.split('\r').join('\u2029').replace('Provincia di IMPERIA', '\u2028Provincia di IMPERIA\r\n');

    expect(leggiListaPuntiVendita(conAcapo)).toEqual(leggiListaPuntiVendita(LISTA_CONAD));
    expect(leggiListaPuntiVendita(conSeparatori)).toEqual(leggiListaPuntiVendita(LISTA_CONAD));
  });

  it('citta in intestazione: le voci senza citta prendono la sua', () => {
    const voci = leggiListaPuntiVendita('BOLOGNA\rVia Emilia 5 - tel. 051 111111\rVia Saffi 9 - tel. 051 222222');

    expect(voci.map(({ gruppo, localita, indirizzo, telefono }) => ({ gruppo, localita, indirizzo, telefono }))).toEqual([
      { gruppo: 'BOLOGNA', localita: 'BOLOGNA', indirizzo: 'Via Emilia 5', telefono: '051 111111' },
      { gruppo: 'BOLOGNA', localita: 'BOLOGNA', indirizzo: 'Via Saffi 9', telefono: '051 222222' },
    ]);
  });

  it('voci senza telefono', () => {
    expect(essenziale('TOSCANA\rFIRENZE - Via Pisana 112\rLUCCA - P.zza Napoleone 1')).toEqual([
      { localita: 'FIRENZE', indirizzo: 'Via Pisana 112', telefono: null },
      { localita: 'LUCCA', indirizzo: 'P.zza Napoleone 1', telefono: null },
    ]);
  });

  it('trattino lungo, punti elenco, barre e tabulazioni come separatori; il trattino del civico no', () => {
    expect(essenziale([
      '• PRA – Via Murtola 12-14 – tel. 010 6197180',
      'STRUPPA | Via Trossarelli 1/F | 010 809010',
      'BORDIGHERA\tVia Pasteur 70/e\tTel: 0184/251143',
    ].join('\r'))).toEqual([
      { localita: 'PRA', indirizzo: 'Via Murtola 12-14', telefono: '010 6197180' },
      { localita: 'STRUPPA', indirizzo: 'Via Trossarelli 1/F', telefono: '010 809010' },
      { localita: 'BORDIGHERA', indirizzo: 'Via Pasteur 70/e', telefono: '0184/251143' },
    ]);
  });

  it('il telefono andato a capo e\' della voce sopra', () => {
    const voci = leggiListaPuntiVendita('SANREMO - C.so Nazario Sauro 44\rtel. 0184 591201\rBORDIGHERA - Via Pasteur 70/e\r0184 251143');

    expect(voci.map(({ riga, telefono }) => ({ riga, telefono }))).toEqual([
      { riga: 'SANREMO - C.so Nazario Sauro 44 tel. 0184 591201', telefono: '0184 591201' },
      { riga: 'BORDIGHERA - Via Pasteur 70/e 0184 251143', telefono: '0184 251143' },
    ]);
  });

  it('un secondo numero a capo non sostituisce il telefono della voce', () => {
    expect(essenziale('PRA - Via Murtola 12/14 - tel. 010 6197180\rtel. 010 9999999')).toEqual([
      { localita: 'PRA', indirizzo: 'Via Murtola 12/14', telefono: '010 6197180' },
    ]);
  });

  it('salta titoli, orari, fax e contatti', () => {
    const voci = leggiListaPuntiVendita([
      'PUNTI VENDITA ADERENTI',
      'Offerta valida dal 1 al 14 ottobre nei punti vendita aderenti',
      'BOLOGNA',
      'Via Emilia 5 - tel. 051 111111',
      'Orari: lun-sab 8.00-20.00',
      'Fax 051 999999',
      'www.esempio.it',
    ].join('\r'));

    expect(voci.map(({ localita, indirizzo, telefono }) => ({ localita, indirizzo, telefono }))).toEqual([
      { localita: 'BOLOGNA', indirizzo: 'Via Emilia 5', telefono: '051 111111' },
    ]);
  });

  it('l\'orario e il fax dentro la voce si tolgono, la voce resta', () => {
    expect(essenziale('PISA - Piazza dei Miracoli snc - 050 123456 - orario 8.00-20.00 - fax 050 654321')).toEqual([
      { localita: 'PISA', indirizzo: 'Piazza dei Miracoli snc', telefono: '050 123456' },
    ]);
  });

  it('l\'intestazione d\'insegna non diventa la localita\' delle voci', () => {
    const voci = leggiListaPuntiVendita('CONAD CITY\rVia Roma 12 - tel. 051 123456\rOrari: lun-sab 8.00-20.00');

    expect(voci).toHaveLength(1);
    expect(voci[0]).toMatchObject({ gruppo: 'CONAD CITY', localita: null, indirizzo: 'Via Roma 12', telefono: '051 123456' });
  });

  it('citta e insegna sulla stessa riga d\'intestazione: la localita\' e\' la citta', () => {
    const [voce] = leggiListaPuntiVendita('FIRENZE - CONAD CITY\rVia Roma 12');

    expect(voce).toMatchObject({ gruppo: 'FIRENZE - CONAD CITY', localita: 'FIRENZE', indirizzo: 'Via Roma 12' });
  });

  it('citta e indirizzo senza separatore, telefono senza "tel"', () => {
    expect(essenziale('SANREMO C.so Garibaldi 2 0184 123456\rBORDIGHERA Via Pasteur 70/e tel. 0184 251143')).toEqual([
      { localita: 'SANREMO', indirizzo: 'C.so Garibaldi 2', telefono: '0184 123456' },
      { localita: 'BORDIGHERA', indirizzo: 'Via Pasteur 70/e', telefono: '0184 251143' },
    ]);
  });

  it('la sigla della provincia dopo la citta va nella provincia', () => {
    const [voce] = leggiListaPuntiVendita('Provincia di GENOVA\rPRA (GE) - Via Murtola 12/14');

    expect(voce).toMatchObject({ localita: 'PRA', provincia: 'GE', indirizzo: 'Via Murtola 12/14' });
  });

  it('una nuova regione azzera provincia e citta; la nuova provincia azzera la citta', () => {
    const voci = leggiListaPuntiVendita([
      'LIGURIA', 'Provincia di GENOVA', 'GENOVA', 'Via Roma 1',
      'Provincia di IMPERIA', 'Via Aurelia 2',
      'TOSCANA', 'Via Pisana 3',
    ].join('\r'));

    expect(voci.map(({ regione, provincia, localita }) => ({ regione, provincia, localita }))).toEqual([
      { regione: 'LIGURIA', provincia: 'GENOVA', localita: 'GENOVA' },
      { regione: 'LIGURIA', provincia: 'IMPERIA', localita: null },
      { regione: 'TOSCANA', provincia: null, localita: null },
    ]);
  });

  it('colonne concatenate: la seconda colonna continua con le intestazioni della prima', () => {
    const colonne = `${LISTA_CONAD}\nPrata - Via Trossarelli 9\nTOSCANA\nLUCCA - Via Roma 1`;

    const voci = leggiListaPuntiVendita(colonne);

    expect(voci.slice(4).map(({ regione, provincia, localita }) => ({ regione, provincia, localita }))).toEqual([
      { regione: 'LIGURIA', provincia: 'IMPERIA', localita: 'Prata' },
      { regione: 'TOSCANA', provincia: null, localita: 'LUCCA' },
    ]);
  });

  it('la stessa lista ripetuta (due pagine) conta una volta', () => {
    const voci = leggiListaPuntiVendita(`${LISTA_CONAD}\n${LISTA_CONAD}`);

    expect(voci.map(voce => voce.posizione)).toEqual([1, 2, 3, 4]);
  });

  it('due intestazioni geografiche sulla stessa riga', () => {
    const [voce] = leggiListaPuntiVendita('TOSCANA - Provincia di FIRENZE\rFIRENZE - Via Pisana 112');

    expect(voce).toMatchObject({ regione: 'TOSCANA', provincia: 'FIRENZE', localita: 'FIRENZE' });
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['vuota', ''],
    ['solo spazi', '  \r\n '],
    ['un numero', 42],
    ['solo intestazioni', 'LIGURIA\rProvincia di GENOVA\rPUNTI VENDITA ADERENTI'],
  ])('lista %s: nessuna voce', (_nome, lista) => {
    expect(leggiListaPuntiVendita(lista)).toEqual([]);
  });

  it(`al massimo ${MASSIMO_VOCI_LISTA} voci`, () => {
    const lunga = Array.from({ length: MASSIMO_VOCI_LISTA + 10 }, (_v, indice) => `Via Roma ${indice + 1}`).join('\r');

    expect(leggiListaPuntiVendita(lunga)).toHaveLength(MASSIMO_VOCI_LISTA);
  });
});

describe('vociDaPvData', () => {
  it('usa i campi strutturati dei gruppi, con l\'intestazione del gruppo', () => {
    const voci = vociDaPvData({
      testo: '',
      paragrafi: [],
      gruppi: [
        {
          intestazione: 'Provincia di GENOVA',
          style: 'titolo',
          puntiVendita: [
            { testo: 'PRA - Via Murtola 12/14 - tel. 010 6197180', citta: 'PRA', indirizzo: 'Via Murtola 12/14', telefono: '010 6197180' },
            { testo: 'STRUPPA - Via Trossarelli 1/F' },
          ],
        },
        { intestazione: 'BOLOGNA', style: 'citta', puntiVendita: [{ testo: '', indirizzo: 'Via Emilia 5', regione: 'EMILIA ROMAGNA' }] },
      ],
    });

    expect(voci).toEqual([
      {
        posizione: 1, riga: 'PRA - Via Murtola 12/14 - tel. 010 6197180', regione: null, provincia: 'GENOVA', gruppo: null,
        localita: 'PRA', indirizzo: 'Via Murtola 12/14', telefono: '010 6197180',
      },
      {
        posizione: 2, riga: 'STRUPPA - Via Trossarelli 1/F', regione: null, provincia: 'GENOVA', gruppo: null,
        localita: 'STRUPPA', indirizzo: 'Via Trossarelli 1/F', telefono: null,
      },
      {
        posizione: 3, riga: 'Via Emilia 5', regione: 'EMILIA ROMAGNA', provincia: 'GENOVA', gruppo: 'BOLOGNA',
        localita: 'BOLOGNA', indirizzo: 'Via Emilia 5', telefono: null,
      },
    ]);
  });

  it.each([undefined, null, {}, { gruppi: 'no' }, { gruppi: [null, { puntiVendita: 'no' }] }])('pvData %j: nessuna voce', (pvData) => {
    expect(vociDaPvData(pvData)).toEqual([]);
  });
});

describe('vociDelVolantino', () => {
  it('i gruppi di pvData, se ci sono, valgono piu\' del testo', () => {
    const voci = vociDelVolantino({
      pv: LISTA_CONAD,
      pvData: { gruppi: [{ intestazione: 'BOLOGNA', puntiVendita: [{ indirizzo: 'Via Emilia 5' }] }] },
    });

    expect(voci.map(voce => voce.indirizzo)).toEqual(['Via Emilia 5']);
  });

  it('senza gruppi legge il testo pv, poi pvData.testo, poi i paragrafi', () => {
    expect(vociDelVolantino({ pv: LISTA_CONAD })).toHaveLength(4);
    expect(vociDelVolantino({ pv: '', pvData: { testo: LISTA_CONAD, gruppi: [] } })).toHaveLength(4);
    expect(vociDelVolantino({
      pvData: { paragrafi: LISTA_CONAD.split('\r').map(text => ({ style: 'p', text })) },
    })).toHaveLength(4);
  });

  it('senza lista: nessuna voce', () => {
    expect(vociDelVolantino({})).toEqual([]);
    expect(vociDelVolantino({ pv: undefined, pvData: undefined })).toEqual([]);
  });
});
