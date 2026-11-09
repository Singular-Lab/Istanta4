import * as XLSX from 'xlsx';
import { describe, expect, it, vi } from 'vitest';
import { BadRequestError } from '../../../../lib/errors';
import { VenditeRepositoryInMemoria } from '../../../__tests__/venditeRepositoryInMemoria';
import type { IAgenziaLib, ImportVenditeAgenzia } from '../../agenzia_lib/types';
import { ImportVenditeInCorso, type FileVendite } from '../../interfaces/IImportVenditeService';
import { MESSAGGIO_IMPORT_VENDITE_INTERROTTO } from '../../vendite/statoImport';
import { TRACCIATO_VENDITE_GENERICO } from '../../vendite/tracciatoGenerico';
import { eseguiImportVendite, type LavoroImportVendite } from '../ImportVenditeJob';
import { ImportVenditeService } from '../ImportVenditeService';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Spec proposta "Import delle vendite con il tracciato del cliente": anteprima senza scritture,
// import in background, reimport che sostituisce, un import per GDO, import interrotto

const GDO = '11111111-1111-4111-8111-111111111111';
const ALTRA_GDO = '22222222-2222-4222-8222-222222222222';
const UTENTE = '33333333-3333-4333-8333-333333333333';

const INTESTAZIONE = ['codice', 'punto_vendita', 'dal', 'al', 'pezzi', 'valore'];

function file(righe: unknown[][], nome = 'vendite.xlsx'): FileVendite {
  const cartella = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(cartella, XLSX.utils.aoa_to_sheet(righe), 'Vendite');
  return { contenuto: XLSX.write(cartella, { type: 'buffer', bookType: 'xlsx' }) as Buffer, nome };
}

const settimana = (codice: string, pv: string, pezzi: number, valore: number | '' = '') => [codice, pv, '2026-01-05', '2026-01-11', pezzi, valore];

function crea(agenziaLib: Pick<IAgenziaLib, 'importVendite' | 'importPuntiVendita'> = {}, repository = nuovoRepository()) {
  const lavori: Array<Promise<unknown>> = [];
  const service = new ImportVenditeService(repository, agenziaLib, {
    esegui: (lavoro: LavoroImportVendite) => {
      const fine = eseguiImportVendite(repository, lavoro);
      lavori.push(fine);
      return fine;
    },
  });
  /** Attende la fine degli import avviati in background. */
  const fineLavori = () => Promise.all(lavori);
  return { service, repository, fineLavori };
}

function nuovoRepository() {
  return new VenditeRepositoryInMemoria({
    [GDO]: [
      { id: 'pv-lucca', nome: 'Conad Lucca', meta: { anacan: '123' } },
      { id: 'pv-pisa', nome: 'Conad Pisa', meta: { anacan: '456' } },
    ],
    [ALTRA_GDO]: [{ id: 'pv-altra', nome: 'Conad Lucca', meta: null }],
  });
}

describe('ImportVenditeService.anteprima', () => {
  it('dice cosa importerebbe il file, senza scrivere nulla', async () => {
    const { service, repository } = crea();

    const anteprima = await service.anteprima(file([
      INTESTAZIONE, settimana('1', 'Conad Lucca', 10, 25), settimana('2', 'Conad Pisa', 3), settimana('3', 'Conad Siena', 1),
    ]), GDO);

    expect(anteprima).toMatchObject({
      tracciato: { nome: 'Tracciato generico' },
      righe: 3, importabili: 2, scartate: 1, prodotti: 2, puntiVendita: 2,
      periodo: { dal: '2026-01-05', al: '2026-01-11' },
      dettaglioScartate: [{ riga: 4, motivo: 'Punto vendita non trovato: Conad Siena' }],
    });
    expect(repository.importazioni).toEqual([]);
    expect(repository.vendite.size).toBe(0);
  });

  it('riconosce i punti vendita solo fra quelli della GDO indicata', async () => {
    const { service } = crea();

    const anteprima = await service.anteprima(file([INTESTAZIONE, settimana('1', 'Conad Pisa', 1)]), ALTRA_GDO);

    expect(anteprima).toMatchObject({ importabili: 0, dettaglioScartate: [{ motivo: 'Punto vendita non trovato: Conad Pisa' }] });
  });

  it('usa il tracciato e la chiave del punto vendita della libreria agenzia', async () => {
    const tracciato: ImportVenditeAgenzia = {
      nome: 'Sell-out del cliente',
      colonne: ['ARTICOLO', 'ANACAN', 'SETTIMANA', 'QTA'],
      chiaveMetaPuntoVendita: 'anacan',
      leggiRiga: riga => ({
        codiceProdotto: String(riga.ARTICOLO), puntoVendita: String(riga.ANACAN), dal: String(riga.SETTIMANA), al: String(riga.SETTIMANA),
        pezzi: Number(riga.QTA), valore: null,
      }),
    };
    const { service } = crea({ importVendite: tracciato });

    const anteprima = await service.anteprima(file([['ARTICOLO', 'ANACAN', 'SETTIMANA', 'QTA'], ['9', '0456', '2026-01-05', 2]]), GDO);

    expect(anteprima).toMatchObject({ tracciato: { nome: 'Sell-out del cliente', colonne: ['ARTICOLO', 'ANACAN', 'SETTIMANA', 'QTA'] }, importabili: 1 });
  });

  it('file senza righe, o non riconosciuto dalla libreria agenzia: 400 con il tracciato atteso', async () => {
    const { service } = crea();
    await expect(service.anteprima(file([INTESTAZIONE]), GDO)).rejects.toThrow(
      'Il file non contiene righe di vendita. Tracciato Tracciato generico: colonne codice, punto_vendita, dal, al, pezzi, valore'
    );

    const conLeggiFile = crea({ importVendite: { ...TRACCIATO_VENDITE_GENERICO, leggiFile: () => { throw new Error('manca il foglio SELL OUT'); } } });
    const errore = await conLeggiFile.service.anteprima(file([INTESTAZIONE, settimana('1', 'Conad Lucca', 1)]), GDO).catch(e => e);
    expect(errore).toBeInstanceOf(BadRequestError);
    expect(errore.message).toMatch(/^File non riconosciuto dal tracciato Tracciato generico: .*\(manca il foglio SELL OUT\)$/);
  });
});

describe('ImportVenditeService.avvia', () => {
  it('crea l\'import, risponde subito in corso e scrive le vendite in background', async () => {
    const { service, repository, fineLavori } = crea();

    const avviato = await service.avvia(file([
      INTESTAZIONE, settimana('1', 'Conad Lucca', 10, 25), settimana('2', 'Conad Pisa', 3), settimana('', 'Conad Pisa', 1),
    ], 'settimana 2.xlsx'), GDO, UTENTE);

    expect(avviato).toMatchObject({ stato: 'in_corso', nomeFile: 'settimana 2.xlsx', righe: 3, scartate: 1, elaborate: 1, scritte: 0, terminatoIl: null });
    expect(repository.importazioni[0].avviato_da).toBe(UTENTE);
    await fineLavori();
    expect(await service.stato(GDO)).toMatchObject({ id: avviato.id, stato: 'completato', righe: 3, elaborate: 3, scritte: 2, scartate: 1 });
    expect(repository.venditeDellaGdo(GDO).map(v => [v.codiceProdotto, v.idPuntoVendita, v.pezzi, v.valore])).toEqual([
      ['1', 'pv-lucca', 10, 25], ['2', 'pv-pisa', 3, null],
    ]);
  });

  it('reimportare la stessa vendita la sostituisce, non la somma', async () => {
    const { service, repository, fineLavori } = crea();
    await service.avvia(file([INTESTAZIONE, settimana('1', 'Conad Lucca', 10, 25), settimana('2', 'Conad Lucca', 4)]), GDO, UTENTE);
    await fineLavori();

    await service.avvia(file([INTESTAZIONE, settimana('0001', 'Conad Lucca', 7, 14)]), GDO, UTENTE);
    await fineLavori();

    expect(repository.venditeDellaGdo(GDO).map(v => [v.codiceProdotto, v.pezzi, v.valore])).toEqual([['1', 7, 14], ['2', 4, null]]);
    expect(await service.riepilogo(GDO)).toMatchObject({ righe: 2, prodotti: 2, puntiVendita: 1, dal: '2026-01-05', al: '2026-01-11' });
  });

  it('un solo import per GDO alla volta, anche fra processi diversi; le altre GDO importano', async () => {
    const repository = nuovoRepository();
    // Il primo processo non scrive: l'import resta in corso
    const primo = new ImportVenditeService(repository, {}, { esegui: () => new Promise(() => undefined) });
    const secondo = crea({}, repository);
    const primoImport = await primo.avvia(file([INTESTAZIONE, settimana('1', 'Conad Lucca', 1)]), GDO, UTENTE);

    const rifiuto = await secondo.service.avvia(file([INTESTAZIONE, settimana('2', 'Conad Lucca', 1)]), GDO, UTENTE).catch(e => e);

    expect(rifiuto).toBeInstanceOf(ImportVenditeInCorso);
    expect(rifiuto.importInCorso).toMatchObject({ id: primoImport.id, stato: 'in_corso' });
    expect(repository.importazioni).toHaveLength(1);
    await expect(secondo.service.avvia(file([INTESTAZIONE, settimana('1', 'Conad Lucca', 1)]), ALTRA_GDO, UTENTE)).resolves.toMatchObject({ stato: 'in_corso' });
  });

  it('un import rimasto in corso senza battito risulta interrotto e non blocca il successivo', async () => {
    const repository = nuovoRepository();
    const fermo = new ImportVenditeService(repository, {}, { esegui: () => new Promise(() => undefined) });
    const vecchio = await fermo.avvia(file([INTESTAZIONE, settimana('1', 'Conad Lucca', 1)]), GDO, UTENTE);
    repository.fermaBattito(vecchio.id);
    const { service, fineLavori } = crea({}, repository);

    expect(await service.stato(GDO)).toMatchObject({ id: vecchio.id, stato: 'interrotto', errore: MESSAGGIO_IMPORT_VENDITE_INTERROTTO });
    expect((await service.stato(GDO))?.terminatoIl).not.toBeNull();

    const nuovo = await service.avvia(file([INTESTAZIONE, settimana('1', 'Conad Lucca', 2)]), GDO, UTENTE);
    await fineLavori();

    expect(repository.importazioni.map(i => [i.id, i.stato])).toEqual([[vecchio.id, 'interrotto'], [nuovo.id, 'completato']]);
  });

  it('nessuna riga importabile: 400 con le prime righe scartate, nessun import creato', async () => {
    const { service, repository } = crea();

    const errore = await service.avvia(file([INTESTAZIONE, settimana('1', 'Conad Siena', 1)]), GDO, UTENTE).catch(e => e);

    expect(errore).toBeInstanceOf(BadRequestError);
    expect(errore.message).toMatch(/^Nessuna riga importabile: tutte le 1 righe sono scartate/);
    expect(errore.details).toMatchObject({ scartate: [{ riga: 2, motivo: 'Punto vendita non trovato: Conad Siena' }] });
    expect(repository.importazioni).toEqual([]);
  });

  it('chi avvia senza un utente UUID (chiamata di servizio) non finisce in avviato_da; il nome del file e\' tagliato a 255', async () => {
    const { service, repository, fineLavori } = crea();

    await service.avvia(file([INTESTAZIONE, settimana('1', 'Conad Lucca', 1)], `${'v'.repeat(300)}.xlsx`), GDO, 'servizio');
    await fineLavori();

    expect(repository.importazioni[0].avviato_da).toBeNull();
    expect(repository.importazioni[0].nome_file).toHaveLength(255);
  });
});

describe('ImportVenditeService: stato, annullamento, riepilogo', () => {
  it('senza import: stato e annullamento null, riepilogo vuoto', async () => {
    const { service } = crea();

    expect(await service.stato(GDO)).toBeNull();
    expect(await service.annulla(GDO)).toBeNull();
    expect(await service.riepilogo(GDO)).toEqual({
      gdo: { id: GDO, nome: 'GDO' }, righe: 0, prodotti: 0, puntiVendita: 0, dal: null, al: null, ultimoImport: null,
    });
  });

  it('l\'annullamento vale da qualunque processo: il lavoro si ferma, le vendite scritte restano', async () => {
    const repository = nuovoRepository();
    const lavori: Array<Promise<unknown>> = [];
    const esecutore = new ImportVenditeService(repository, {}, {
      esegui: lavoro => {
        const fine = eseguiImportVendite(repository, lavoro, { dimensioneBlocco: 1 });
        lavori.push(fine);
        return fine;
      },
    });
    const altroProcesso = new ImportVenditeService(repository, {});
    repository.primaDiScrivere = async blocco => {
      if (blocco === 1) expect(await altroProcesso.annulla(GDO)).toMatchObject({ stato: 'in_corso' });
    };

    await esecutore.avvia(file([INTESTAZIONE, settimana('1', 'Conad Lucca', 1), settimana('2', 'Conad Lucca', 1), settimana('3', 'Conad Lucca', 1)]), GDO, UTENTE);
    await Promise.all(lavori);

    expect(await altroProcesso.stato(GDO)).toMatchObject({ stato: 'annullato', scritte: 1, elaborate: 1 });
    expect(repository.venditeDellaGdo(GDO)).toHaveLength(1);
  });

  it('il riepilogo porta la GDO con il suo nome e l\'ultimo import', async () => {
    const { service, repository, fineLavori } = crea();
    repository.nomiGdo.set(GDO, 'CONAD CENTRALE');
    const avviato = await service.avvia(file([INTESTAZIONE, settimana('1', 'Conad Lucca', 1), settimana('1', 'Conad Pisa', 1)]), GDO, UTENTE);
    await fineLavori();

    expect(await service.riepilogo(GDO)).toMatchObject({
      gdo: { id: GDO, nome: 'CONAD CENTRALE' },
      righe: 2, prodotti: 1, puntiVendita: 2, ultimoImport: { id: avviato.id, stato: 'completato' },
    });
  });
});
