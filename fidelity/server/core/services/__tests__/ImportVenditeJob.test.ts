import { afterEach, describe, expect, it, vi } from 'vitest';
import { VenditeRepositoryInMemoria } from '../../../__tests__/venditeRepositoryInMemoria';
import type { VenditaDaScrivere } from '../../vendite/preparaImportVendite';
import { eseguiImportVendite, type LavoroImportVendite } from '../ImportVenditeJob';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Spec proposta "Import delle vendite con il tracciato del cliente": scrittura in background a
// blocchi, avanzamento, annullamento da qualunque processo, errori

const GDO = 'gdo-1';
const PV = 'pv-1';

const vendita = (codice: number, pezzi = 1): VenditaDaScrivere => ({
  riga: codice + 1, codiceProdotto: String(codice), idPuntoVendita: PV, dal: '2026-01-05', al: '2026-01-11', pezzi, valore: null,
});

/** Un import gia' creato nel repository, con le sue vendite. */
async function preparaLavoro(repository: VenditeRepositoryInMemoria, vendite: VenditaDaScrivere[], scartate = 0): Promise<LavoroImportVendite> {
  const avvio = await repository.avviaImport({
    id: `imp-${repository.importazioni.length + 1}`, idGdo: GDO, nomeFile: 'vendite.xlsx', righe: vendite.length + scartate, scartate, avviatoDa: null,
  });
  if (!avvio.avviato) throw new Error('import non avviato');
  return { id: avvio.import.id, idGdo: GDO, vendite, scartate };
}

const nuovoRepository = () => new VenditeRepositoryInMemoria({ [GDO]: [{ id: PV, nome: 'Conad Lucca', meta: null }] });

afterEach(() => {
  vi.useRealTimers();
});

describe('eseguiImportVendite', () => {
  it('scrive a blocchi e chiude l\'import completato; le scartate contano gia\' come elaborate', async () => {
    const repository = nuovoRepository();
    const avanzamento = vi.spyOn(repository, 'avanzamento');
    const lavoro = await preparaLavoro(repository, [1, 2, 3, 4, 5].map(c => vendita(c)), 3);

    const esito = await eseguiImportVendite(repository, lavoro, { dimensioneBlocco: 2 });

    expect(esito).toEqual({ stato: 'completato', elaborate: 8, scritte: 5, errore: null });
    expect(repository.blocchi).toEqual([2, 2, 1]);
    expect(avanzamento.mock.calls.map(([, conteggi]) => conteggi)).toEqual([
      { elaborate: 3, scritte: 0 }, { elaborate: 5, scritte: 2 }, { elaborate: 7, scritte: 4 },
    ]);
    expect(await repository.ultimoImport(GDO)).toMatchObject({ stato: 'completato', righe: 8, elaborate: 8, scritte: 5, scartate: 3 });
  });

  it('le vendite di PV che non sono della GDO non contano fra le scritte', async () => {
    const repository = nuovoRepository();
    const lavoro = await preparaLavoro(repository, [vendita(1), { ...vendita(2), idPuntoVendita: 'pv-altra-gdo' }]);

    expect(await eseguiImportVendite(repository, lavoro)).toMatchObject({ stato: 'completato', elaborate: 2, scritte: 1 });
  });

  it('annullamento chiesto da un altro processo: si ferma al blocco successivo, le vendite scritte restano', async () => {
    const repository = nuovoRepository();
    const lavoro = await preparaLavoro(repository, [1, 2, 3, 4, 5].map(c => vendita(c)));
    repository.primaDiScrivere = async blocco => {
      if (blocco === 1) await repository.richiediAnnullamento(GDO);
    };

    const esito = await eseguiImportVendite(repository, lavoro, { dimensioneBlocco: 2 });

    expect(esito).toEqual({ stato: 'annullato', elaborate: 2, scritte: 2, errore: null });
    expect(repository.blocchi).toEqual([2]);
    expect(repository.venditeDellaGdo(GDO)).toHaveLength(2);
    expect(await repository.ultimoImport(GDO)).toMatchObject({ stato: 'annullato', elaborate: 2, scritte: 2 });
  });

  it('annullamento arrivato prima del primo blocco: non scrive nulla', async () => {
    const repository = nuovoRepository();
    const lavoro = await preparaLavoro(repository, [vendita(1)]);
    await repository.richiediAnnullamento(GDO);

    expect(await eseguiImportVendite(repository, lavoro)).toMatchObject({ stato: 'annullato', scritte: 0 });
    expect(repository.blocchi).toEqual([]);
  });

  it('un errore di scrittura ferma l\'import: fallito, con il motivo', async () => {
    const repository = nuovoRepository();
    const lavoro = await preparaLavoro(repository, [1, 2, 3].map(c => vendita(c)));
    repository.primaDiScrivere = blocco => {
      if (blocco === 2) throw new Error('connessione persa');
    };

    const esito = await eseguiImportVendite(repository, lavoro, { dimensioneBlocco: 1 });

    expect(esito).toEqual({ stato: 'fallito', elaborate: 1, scritte: 1, errore: 'Scrittura delle vendite non riuscita: connessione persa' });
    expect(await repository.ultimoImport(GDO)).toMatchObject({ stato: 'fallito', errore: 'Scrittura delle vendite non riuscita: connessione persa' });
  });

  it('import non piu\' in corso (dichiarato interrotto altrove): il lavoro si ferma senza toccarlo', async () => {
    const repository = nuovoRepository();
    const lavoro = await preparaLavoro(repository, [1, 2, 3].map(c => vendita(c)));
    repository.primaDiScrivere = () => {
      repository.importazioni[0].stato = 'interrotto';
    };

    const esito = await eseguiImportVendite(repository, lavoro, { dimensioneBlocco: 1 });

    expect(esito).toMatchObject({ stato: 'perso', scritte: 1 });
    expect(repository.blocchi).toEqual([1]);
    expect(repository.importazioni[0].stato).toBe('interrotto');
  });

  it('rinnova il battito durante un blocco lento e smette alla fine', async () => {
    vi.useFakeTimers();
    const repository = nuovoRepository();
    const lavoro = await preparaLavoro(repository, [vendita(1)]);
    let sblocca: () => void = () => undefined;
    repository.primaDiScrivere = () => new Promise<void>(resolve => { sblocca = resolve; });

    const fine = eseguiImportVendite(repository, lavoro, { intervalloBattitoMs: 1000 });
    await vi.advanceTimersByTimeAsync(3500);
    expect(repository.battiti).toBe(3);
    sblocca();
    await fine;
    await vi.advanceTimersByTimeAsync(5000);
    expect(repository.battiti).toBe(3);
  });

  it('se l\'esito non si salva non lancia: l\'import risultera\' interrotto', async () => {
    const repository = nuovoRepository();
    const lavoro = await preparaLavoro(repository, [vendita(1)]);
    repository.erroreConclusione = new Error('database giu\'');

    await expect(eseguiImportVendite(repository, lavoro)).resolves.toMatchObject({ stato: 'completato', scritte: 1 });
  });
});
