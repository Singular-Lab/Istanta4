import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { BadRequestError } from '../../../../lib/errors';
import { MAX_SCARTATE_ANTEPRIMA } from '../../../../lib/vendite/tipi';
import type { ImportVenditeAgenzia } from '../../agenzia_lib/types';
import {
  anteprimaImportVendite,
  chiaviPuntoVendita,
  leggiFileVendite,
  preparaImportVendite,
  riconoscitorePuntoVendita,
  righeFileVendite,
  type PuntoVenditaGdo,
} from '../preparaImportVendite';
import { TRACCIATO_VENDITE_GENERICO } from '../tracciatoGenerico';

// Spec proposta "Import delle vendite con il tracciato del cliente": lettura del file, riconoscimento
// del punto vendita della GDO, righe ripetute, anteprima

const INTESTAZIONE = ['codice', 'punto_vendita', 'dal', 'al', 'pezzi', 'valore'];

function excel(fogli: Record<string, unknown[][]>): Buffer {
  const cartella = XLSX.utils.book_new();
  for (const [nome, righe] of Object.entries(fogli)) XLSX.utils.book_append_sheet(cartella, XLSX.utils.aoa_to_sheet(righe), nome);
  return XLSX.write(cartella, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

const PUNTI_VENDITA: PuntoVenditaGdo[] = [
  { id: 'pv-lucca', nome: 'Conad Lucca', meta: { anacan: '00123', muro: 'M1' } },
  { id: 'pv-pisa', nome: 'Conad Pisa', meta: { anacan: 456, muro: 'M2' } },
  { id: 'pv-pisa-2', nome: 'Conad  PISA', meta: { muro: 'M3' } },
  { id: 'pv-senza-meta', nome: 'Conad Prato', meta: null },
];

const perNome = riconoscitorePuntoVendita(PUNTI_VENDITA, {});

describe('leggiFileVendite', () => {
  it('xlsx: numeri e date di Excel grezzi, testo come testo, il numero di riga di Excel', () => {
    const [riga] = leggiFileVendite(excel({ Vendite: [INTESTAZIONE, ['000123', 'Conad Lucca', 46037, 46043, 12, 30.5]] })).Vendite;
    expect(riga).toEqual({ codice: '000123', punto_vendita: 'Conad Lucca', dal: 46037, al: 46043, pezzi: 12, valore: 30.5 });
    expect(riga.__rowNum__).toBe(1);
  });

  it('csv con ; e virgola decimale: tutto testo, niente date in formato americano', () => {
    const csv = Buffer.from('codice;punto_vendita;dal;al;pezzi;valore\n000123;Conad Lucca;05/01/2026;11/01/2026;12,5;30,50\n', 'utf8');
    const [riga] = Object.values(leggiFileVendite(csv))[0];
    expect(riga).toEqual({ codice: '000123', punto_vendita: 'Conad Lucca', dal: '05/01/2026', al: '11/01/2026', pezzi: '12,5', valore: '30,50' });
    expect(TRACCIATO_VENDITE_GENERICO.leggiRiga(riga)).toEqual({
      codiceProdotto: '123', puntoVendita: 'Conad Lucca', dal: '2026-01-05', al: '2026-01-11', pezzi: 12.5, valore: 30.5,
    });
  });

  it('csv salvato da Excel in Windows-1252, e in UTF-8 con BOM: gli accenti restano', () => {
    const testo = 'codice;punto_vendita;dal;al;pezzi\n1;Forlì Centro;2026-01-05;2026-01-11;3\n';
    const latin1 = Object.values(leggiFileVendite(Buffer.from(testo, 'latin1')))[0];
    const conBom = Object.values(leggiFileVendite(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(testo, 'utf8')])))[0];
    expect(latin1[0].punto_vendita).toBe('Forlì Centro');
    expect(conBom[0]).toMatchObject({ codice: '1', punto_vendita: 'Forlì Centro' });
  });

  it('un file che non e\' un foglio di calcolo: 400 con un messaggio chiaro', () => {
    // Firma di un xls con una versione che non esiste
    const rotto = Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.alloc(504)]);
    rotto[26] = 9;
    expect(() => leggiFileVendite(rotto)).toThrow(BadRequestError);
    expect(() => leggiFileVendite(rotto)).toThrow('File non leggibile: usa un file .xlsx, .xls o .csv');
  });
});

describe('righeFileVendite', () => {
  const file = excel({ Note: [['leggimi']], Vendite: [INTESTAZIONE, ['1', 'Conad Lucca', 46037, 46043, 1, '']] });

  it('senza leggiFile: le righe del primo foglio', () => {
    expect(righeFileVendite(file, TRACCIATO_VENDITE_GENERICO)).toEqual([]);
  });

  it('con leggiFile: le righe che la libreria agenzia ricava da tutti i fogli', () => {
    const tracciato: ImportVenditeAgenzia = { ...TRACCIATO_VENDITE_GENERICO, leggiFile: fogli => fogli.Vendite };
    expect(righeFileVendite(file, tracciato)).toHaveLength(1);
  });
});

describe('chiaviPuntoVendita', () => {
  const importPuntiVendita = { chiaveMeta: 'anacan', chiaveMetaRiserva: 'muro', leggiRiga: () => 'non usato' };

  it('vale la chiave del tracciato delle vendite, se dichiarata', () => {
    expect(chiaviPuntoVendita({ importVendite: { ...TRACCIATO_VENDITE_GENERICO, chiaveMetaPuntoVendita: 'cod_pv' }, importPuntiVendita }))
      .toEqual({ chiave: 'cod_pv' });
  });

  it('altrimenti la chiave del cliente dell\'import dei punti vendita, con quella di riserva', () => {
    expect(chiaviPuntoVendita({ importVendite: TRACCIATO_VENDITE_GENERICO, importPuntiVendita })).toEqual({ chiave: 'anacan', riserva: 'muro' });
  });

  it('senza chiavi dichiarate: nessuna (si riconosce dal nome)', () => {
    expect(chiaviPuntoVendita({})).toEqual({});
  });
});

describe('riconoscitorePuntoVendita', () => {
  const conChiavi = riconoscitorePuntoVendita(PUNTI_VENDITA, { chiave: 'anacan', riserva: 'muro' });

  it('dalla chiave del cliente nei meta, con o senza zeri iniziali', () => {
    expect(conChiavi('123')).toEqual({ idPuntoVendita: 'pv-lucca' });
    expect(conChiavi(' 0456 ')).toEqual({ idPuntoVendita: 'pv-pisa' });
  });

  it('poi dalla chiave di riserva', () => {
    expect(conChiavi('m3')).toEqual({ idPuntoVendita: 'pv-pisa-2' });
  });

  it('con le chiavi dichiarate il nome non basta: punto vendita non trovato', () => {
    expect(conChiavi('Conad Lucca')).toEqual({ motivo: 'Punto vendita non trovato: Conad Lucca' });
    expect(conChiavi('999')).toEqual({ motivo: 'Punto vendita non trovato: 999' });
  });

  it('senza chiavi: dal nome, senza maiuscole, accenti, punteggiatura e spazi doppi', () => {
    expect(perNome('CONAD lucca')).toEqual({ idPuntoVendita: 'pv-lucca' });
    expect(perNome('Conad Prato')).toEqual({ idPuntoVendita: 'pv-senza-meta' });
    expect(perNome('Conad Firenze')).toEqual({ motivo: 'Punto vendita non trovato: Conad Firenze' });
  });

  it('due punti vendita con lo stesso nome o la stessa chiave: ambiguo, si scarta', () => {
    expect(perNome('conad pisa')).toEqual({ motivo: 'Punto vendita ambiguo: 2 punti vendita della GDO hanno nome conad pisa' });
    const doppi = riconoscitorePuntoVendita(
      [{ id: 'a', nome: 'A', meta: { anacan: '7' } }, { id: 'b', nome: 'B', meta: { anacan: '007' } }],
      { chiave: 'anacan' },
    );
    expect(doppi('7')).toEqual({ motivo: 'Punto vendita ambiguo: 2 punti vendita della GDO hanno anacan 7' });
  });
});

describe('preparaImportVendite', () => {
  const vendita = (campi: Record<string, unknown> = {}) => ({
    codice: '1', punto_vendita: 'Conad Lucca', dal: '2026-01-05', al: '2026-01-11', pezzi: '10', valore: '', ...campi,
  });

  it('una riga per prodotto, punto vendita e periodo, con il PV riconosciuto', () => {
    const preparato = preparaImportVendite([vendita(), vendita({ codice: '2', valore: '4,5' })], TRACCIATO_VENDITE_GENERICO, perNome);
    expect(preparato).toEqual({
      totale: 2,
      scartate: [],
      vendite: [
        { riga: 2, codiceProdotto: '1', idPuntoVendita: 'pv-lucca', dal: '2026-01-05', al: '2026-01-11', pezzi: 10, valore: null },
        { riga: 3, codiceProdotto: '2', idPuntoVendita: 'pv-lucca', dal: '2026-01-05', al: '2026-01-11', pezzi: 10, valore: 4.5 },
      ],
    });
  });

  it('la stessa vendita ripetuta nel file: vale l\'ultima, la precedente risulta sostituita', () => {
    const preparato = preparaImportVendite(
      [vendita({ pezzi: '1' }), vendita({ codice: '2' }), vendita({ codice: '0001', pezzi: '7' })],
      TRACCIATO_VENDITE_GENERICO,
      perNome,
    );
    expect(preparato.vendite.map(v => [v.riga, v.codiceProdotto, v.pezzi])).toEqual([[3, '2', 10], [4, '1', 7]]);
    expect(preparato.scartate).toEqual([
      { riga: 2, motivo: "Sostituita dalla riga 4: stesso prodotto, punto vendita e periodo (vale l'ultima)" },
    ]);
  });

  it('periodi diversi dello stesso prodotto e PV sono vendite diverse', () => {
    const preparato = preparaImportVendite(
      [vendita(), vendita({ dal: '2026-01-12', al: '2026-01-18' })],
      TRACCIATO_VENDITE_GENERICO,
      perNome,
    );
    expect(preparato.vendite).toHaveLength(2);
  });

  it('scarta, in ordine di riga, le righe del tracciato, i PV non riconosciuti e gli errori della libreria', () => {
    let chiamate = 0;
    const tracciato: ImportVenditeAgenzia = {
      nome: 'Cliente',
      colonne: ['x'],
      leggiRiga: riga => {
        chiamate++;
        if (riga.x === 'errore') throw new Error('colonna x illeggibile');
        if (riga.x === 'scarta') return 'Riga di totale';
        if (riga.x === 'periodo') return { codiceProdotto: '1', puntoVendita: 'Conad Lucca', dal: '2026-02-01', al: '2026-01-01', pezzi: 1, valore: null };
        return { codiceProdotto: '1', puntoVendita: String(riga.x), dal: '2026-01-01', al: '2026-01-07', pezzi: 1, valore: null };
      },
    };
    const preparato = preparaImportVendite(
      [{ x: 'Conad Lucca' }, { x: 'errore' }, { x: 'scarta' }, { x: 'Conad Siena' }, { x: 'periodo' }],
      tracciato,
      perNome,
    );
    expect(chiamate).toBe(5);
    expect(preparato.vendite.map(v => v.riga)).toEqual([2]);
    expect(preparato.scartate).toEqual([
      { riga: 3, motivo: 'Riga non leggibile: colonna x illeggibile' },
      { riga: 4, motivo: 'Riga di totale' },
      { riga: 5, motivo: 'Punto vendita non trovato: Conad Siena' },
      { riga: 6, motivo: "Periodo non valido: l'inizio (2026-02-01) e' dopo la fine (2026-01-01)" },
    ]);
  });

  it('usa il numero di riga di Excel quando il foglio ha righe vuote', () => {
    const righe = leggiFileVendite(excel({ V: [INTESTAZIONE, [], ['1', 'Conad Firenze', 46037, 46043, 1, '']] })).V;
    expect(preparaImportVendite(righe, TRACCIATO_VENDITE_GENERICO, perNome).scartate).toEqual([
      { riga: 3, motivo: 'Punto vendita non trovato: Conad Firenze' },
    ]);
  });
});

describe('anteprimaImportVendite', () => {
  it('conteggi, periodo coperto, prodotti e punti vendita distinti', () => {
    const righe = [
      { codice: '1', punto_vendita: 'Conad Lucca', dal: '2026-01-05', al: '2026-01-11', pezzi: 1 },
      { codice: '2', punto_vendita: 'Conad Lucca', dal: '2026-01-12', al: '2026-01-18', pezzi: 1 },
      { codice: '1', punto_vendita: 'Conad Prato', dal: '2026-01-01', al: '2026-01-04', pezzi: 1 },
      { codice: '3', punto_vendita: 'Conad Siena', dal: '2025-12-01', al: '2026-02-01', pezzi: 1 },
    ];
    const preparato = preparaImportVendite(righe, TRACCIATO_VENDITE_GENERICO, perNome);
    expect(anteprimaImportVendite(preparato, TRACCIATO_VENDITE_GENERICO)).toEqual({
      tracciato: { nome: 'Tracciato generico', colonne: ['codice', 'punto_vendita', 'dal', 'al', 'pezzi', 'valore'] },
      righe: 4,
      importabili: 3,
      scartate: 1,
      dettaglioScartate: [{ riga: 5, motivo: 'Punto vendita non trovato: Conad Siena' }],
      periodo: { dal: '2026-01-01', al: '2026-01-18' },
      prodotti: 2,
      puntiVendita: 2,
    });
  });

  it(`al massimo ${MAX_SCARTATE_ANTEPRIMA} righe scartate nel dettaglio, il conteggio resta completo; senza vendite niente periodo`, () => {
    const righe = Array.from({ length: MAX_SCARTATE_ANTEPRIMA + 50 }, () => ({ codice: '' }));
    const anteprima = anteprimaImportVendite(preparaImportVendite(righe, TRACCIATO_VENDITE_GENERICO, perNome), TRACCIATO_VENDITE_GENERICO);
    expect(anteprima).toMatchObject({ righe: MAX_SCARTATE_ANTEPRIMA + 50, importabili: 0, scartate: MAX_SCARTATE_ANTEPRIMA + 50, periodo: null, prodotti: 0 });
    expect(anteprima.dettaglioScartate).toHaveLength(MAX_SCARTATE_ANTEPRIMA);
    expect(anteprima.dettaglioScartate[0]).toEqual({ riga: 2, motivo: 'Colonne mancanti nel file: punto_vendita, dal, al, pezzi' });
  });
});
