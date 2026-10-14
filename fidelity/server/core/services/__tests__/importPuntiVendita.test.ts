import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import type { ImportPuntiVenditaAgenzia } from '../../agenzia_lib/types';
import {
  cella,
  type ContestoImportPuntiVendita,
  importPuntiVenditaGenerico,
  leggiFoglio,
  preparaImportPuntiVendita,
} from '../importPuntiVendita';

// Spec import-punti-vendita (proposte in change task-c89f3697)

const contesto = (esistenti: ContestoImportPuntiVendita['esistenti'] = []): ContestoImportPuntiVendita => ({
  canali: [{ id: 'c1', codice: 'CC', nome: 'Conad City' }],
  aree: [{ id: 'a1', codice: 'TO', nome: 'Toscana' }],
  combinazioni: [{ id: 'comb1', idCanale: 'c1', idArea: 'a1', sigla: 'CC_TO' }],
  esistenti,
});

const riga = (campi: Record<string, unknown> = {}) => ({
  nome: 'Conad Lucca', indirizzo: 'Via Roma 1', citta: 'Lucca', cap: '55100', canaleArea: 'CC_TO', ...campi,
});

const prepara = (righe: Record<string, unknown>[], esistenti?: ContestoImportPuntiVendita['esistenti'], importer = importPuntiVenditaGenerico) =>
  preparaImportPuntiVendita(righe, importer, contesto(esistenti), 'g1');

/** Libreria con dicitura della GDO e chiave del cliente, come quella di CONAD CNO. */
const conChiave: ImportPuntiVenditaAgenzia = {
  chiaveMeta: 'id_anacan',
  leggiRiga: r => ({
    nome: cella(r, 'nome'), indirizzo: cella(r, 'indirizzo'), citta: cella(r, 'citta'), cap: cella(r, 'cap'),
    canale: cella(r, 'canale'), area: cella(r, 'area'), meta: { id_anacan: cella(r, 'anacan') },
  }),
};
const rigaConChiave = (campi: Record<string, unknown> = {}) => ({
  nome: 'Conad Lucca', indirizzo: 'Via Roma 1', citta: 'Lucca', cap: '55100', canale: 'Conad City', area: 'Toscana', anacan: '1234', ...campi,
});

function excel(righe: unknown[][]): Buffer {
  const cartella = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(cartella, XLSX.utils.aoa_to_sheet(righe), 'PV');
  return XLSX.write(cartella, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

describe('tracciato generico', () => {
  it('una riga valida crea un PV nella combinazione indicata dalla sigla', () => {
    const [esito] = prepara([riga({ 'Ragione Sociale': 'Lucca Srl', provincia: 'LU' })]);

    expect(esito).toMatchObject({
      riga: 2,
      azione: 'crea',
      dati: { nome: 'Conad Lucca', cap: '55100', id_combinazione_canale_area: 'comb1', id_gdo: 'g1', ragionesociale: 'Lucca Srl', provincia: 'LU' },
    });
  });

  it('le intestazioni si riconoscono senza maiuscole, accenti e spazi', () => {
    const [esito] = prepara([{ NOME: 'Conad Lucca', ' Indirizzo ': 'Via Roma 1', Città: 'Lucca', CAP: '55100', CanaleArea: 'cc_to' }]);

    expect(esito.azione).toBe('crea');
  });
});

describe('righe scartate', () => {
  it.each([
    ['campo mancante', riga({ indirizzo: '' }), 'Campi mancanti: indirizzo'],
    ['CAP non numerico', riga({ cap: '50A10' }), 'CAP non valido: 50A10'],
    ['combinazione di un\'altra GDO', riga({ canaleArea: 'XX_YY' }), 'Canale/area non valido: XX_YY'],
    ['telefono che il modello rifiuterebbe', riga({ telefono: '12' }), 'Telefono non valido: 12'],
  ])('%s', (_caso, r, errore) => {
    expect(prepara([r])[0]).toMatchObject({ azione: 'scarta', errore });
  });

  it('le altre righe del file proseguono', () => {
    const esiti = prepara([riga(), riga({ cap: '50A10' }), riga({ nome: 'Conad Pisa' })]);

    expect(esiti.map(e => e.azione)).toEqual(['crea', 'scarta', 'crea']);
  });

  it('senza chiave del cliente un PV gia presente con stesso nome, indirizzo e CAP si scarta', () => {
    const esiti = prepara([riga({ nome: 'CONAD  LUCCA' })], [{ id: 'pv1', nome: 'Conad Lucca', indirizzo: 'via Roma, 1', cap: '55100' }]);

    expect(esiti[0]).toMatchObject({ azione: 'scarta', errore: 'Punto vendita già presente' });
  });

  it('senza chiave del cliente la stessa riga ripetuta nel file si scarta', () => {
    expect(prepara([riga(), riga()]).map(e => e.azione)).toEqual(['crea', 'scarta']);
  });
});

describe('normalizzazione di canale e area', () => {
  it('la dicitura della GDO si riconduce al canale per nome, ignorando la forma', () => {
    const [esito] = prepara([rigaConChiave({ canale: 'CONAD  CITY', area: 'toscana' })], [], conChiave);

    expect(esito).toMatchObject({ azione: 'crea', dati: { id_combinazione_canale_area: 'comb1' } });
  });

  it('la dicitura si riconduce anche al codice', () => {
    expect(prepara([rigaConChiave({ canale: 'cc', area: 'TO' })], [], conChiave)[0].azione).toBe('crea');
  });

  it('una dicitura non riconosciuta scarta la riga indicando il valore', () => {
    expect(prepara([rigaConChiave({ canale: 'Spazio Conad' })], [], conChiave)[0])
      .toMatchObject({ azione: 'scarta', errore: 'Canale non riconosciuto: Spazio Conad' });
  });
});

describe('riconoscimento tramite chiave del cliente', () => {
  it('primo import: crea il PV con la chiave nei meta', () => {
    expect(prepara([rigaConChiave()], [], conChiave)[0]).toMatchObject({ azione: 'crea', dati: { meta: { id_anacan: '1234' } } });
  });

  it('reimport: aggiorna il PV con la stessa chiave, anche se e cambiato l\'indirizzo', () => {
    const esistente = { id: 'pv1', nome: 'Conad Lucca', indirizzo: 'Via Vecchia 3', cap: '55100', meta: { id_anacan: '1234', altro: 'x' } };

    const [esito] = prepara([rigaConChiave()], [esistente], conChiave);

    expect(esito).toMatchObject({
      azione: 'aggiorna',
      id: 'pv1',
      dati: { indirizzo: 'Via Roma 1', meta: { id_anacan: '1234', altro: 'x' } },
    });
  });

  it('un PV gia presente senza chiave, con stesso nome, indirizzo e CAP, si aggiorna prendendo la chiave', () => {
    const [esito] = prepara([rigaConChiave()], [{ id: 'pv1', nome: 'Conad Lucca', indirizzo: 'Via Roma 1', cap: '55100' }], conChiave);

    expect(esito).toMatchObject({ azione: 'aggiorna', id: 'pv1', dati: { meta: { id_anacan: '1234' } } });
  });

  it('chiave mancante o ripetuta nel file: la riga si scarta', () => {
    const esiti = prepara([rigaConChiave({ anacan: '' }), rigaConChiave(), rigaConChiave({ nome: 'Altro' })], [], conChiave);

    expect(esiti.map(e => (e.azione === 'scarta' ? e.errore : e.azione))).toEqual([
      'id_anacan mancante', 'crea', 'id_anacan 1234 ripetuto nel file',
    ]);
  });
});

describe('lettura del file', () => {
  it('legge il primo foglio, numera le righe come Excel e ripristina gli zeri del CAP', () => {
    const righe = leggiFoglio(excel([
      ['nome', 'indirizzo', 'citta', 'cap', 'canaleArea'],
      ['Conad Roma', 'Via Appia 10', 'Roma', 100, 'CC_TO'],
      [],
      ['Conad Lucca', 'Via Roma 1', 'Lucca', 55100, 'CC_TO'],
    ]));

    const esiti = prepara(righe);

    expect(esiti.map(e => e.riga)).toEqual([2, 4]);
    expect(esiti[0]).toMatchObject({ azione: 'crea', dati: { cap: '00100' } });
  });
});
