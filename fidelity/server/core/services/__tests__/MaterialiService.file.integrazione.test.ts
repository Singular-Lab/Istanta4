import { PassThrough } from 'node:stream';
import unzipper from 'unzipper';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { NotFoundError } from '../../../../lib/errors';
import { describeConDatabase, svuotaTabelle, usaDatabase } from '../../../__tests__/integrazione/database';
import { creaFile, creaKitRuntime, creaLogFile, creaTipoExport, type KitDiProva } from '../../../__tests__/integrazione/dati';
import { scaricaMaterialePdf } from '../../http/olimpo';
import { MaterialiRepository } from '../../repositories/MaterialiRepository';
import { FileManagementService } from '../FileManagementService';
import { MaterialiService } from '../MaterialiService';

// Olimpo finto: il contenuto del PDF e' il suo id
vi.mock('../../http/olimpo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../http/olimpo')>()),
  scaricaMaterialePdf: vi.fn(),
}));

/** Dipendenza che questi test non usano. */
const nonUsato = <T>(): T => ({}) as T;

// File POP di un formato su PostgreSQL: pagina, ricerca nei metadati e stato dall'ultimo log
// stanno nella query, non in memoria. 130 file in un kit POP pubblicato di una promo valida.
describeConDatabase('MaterialiService: file POP di un formato', () => {
  usaDatabase();
  const scarica = vi.mocked(scaricaMaterialePdf);
  const service = new MaterialiService(
    new MaterialiRepository(),
    { getAllKitPerGestioneLavorazione: vi.fn() },
    new FileManagementService(nonUsato(), nonUsato(), nonUsato(), nonUsato(), nonUsato(), nonUsato(), nonUsato())
  );
  const nome = (indice: number) => `pop-${String(indice).padStart(3, '0')}.pdf`;
  const idFile = new Map<string, string>();
  let kit: KitDiProva;
  let idFileAltraPromo: string;
  let idFileCorreggo: string;

  beforeAll(async () => {
    await svuotaTabelle('gdo', 'promo', 'formati', 'tipi_export');
    kit = await creaKitRuntime({ tipoLavorazione: 2, nomeFormato: 'Espositori', nomePromo: 'Promo ottobre', titolo: 'Banco frigo' });
    for (let indice = 0; indice < 130; indice++) {
      idFile.set(nome(indice), await creaFile({
        nome: nome(indice),
        idRuntime: kit.idRuntime,
        idOlimpoCloud: `olimpo-${indice}`,
        mime: 'application/pdf',
        meta: {
          codice_referenza: `REF-${String(indice).padStart(4, '0')}`,
          descrizione_uno: `Prodotto ${indice}`,
          reparto: indice % 2 === 0 ? 'Macelleria' : 'Ortofrutta',
        },
      }));
    }
    // I file dell'export CORREGGO non si contano, che il tipo sia salvato come id o come codice
    const correggo = await creaTipoExport('CORREGGO');
    idFileCorreggo = await creaFile({ nome: 'correggo-1.pdf', idRuntime: kit.idRuntime, tipoExport: correggo, idOlimpoCloud: 'olimpo-c1' });
    await creaFile({ nome: 'correggo-2.pdf', idRuntime: kit.idRuntime, tipoExportCodice: 'CORREGGO', idOlimpoCloud: 'olimpo-c2' });

    // Log in ordine sparso: conta la versione piu' alta
    await creaLogFile({ idKitRuntime: kit.idRuntime, nomeFile: nome(1), versione: 2, stato: 'ERRORE' });
    await creaLogFile({ idKitRuntime: kit.idRuntime, nomeFile: nome(1), versione: 1, stato: 'PUBBLICATO' });
    await creaLogFile({ idKitRuntime: kit.idRuntime, nomeFile: nome(2), versione: 1, stato: 'ERRORE' });
    await creaLogFile({ idKitRuntime: kit.idRuntime, nomeFile: nome(2), versione: 3, stato: 'PUBBLICATO' });
    await creaLogFile({ idKitRuntime: kit.idRuntime, nomeFile: nome(2), versione: 2, stato: 'IN_REVISIONE' });

    // Un'altra promo valida con un suo kit POP
    const altro = await creaKitRuntime({ tipoLavorazione: 2, nomeFormato: 'Espositori' });
    idFileAltraPromo = await creaFile({ nome: 'estraneo.pdf', idRuntime: altro.idRuntime, idOlimpoCloud: 'olimpo-estraneo' });
  });

  afterEach(() => {
    scarica.mockReset();
  });

  it('seconda pagina di un formato con piu\' di 100 file, ordinati per nome e senza i file di Correggo', async () => {
    const pagina = await service.getFilePop(kit.idPromo, { periodo: 'attivi', idFormato: kit.idFormato, pagina: 2, dimensione: 100 });

    expect(pagina).toMatchObject({ totale: 130, pagina: 2, dimensione: 100 });
    expect(pagina.file).toHaveLength(30);
    expect(pagina.file[0].nome).toBe(nome(100));
    expect(pagina.file[29].nome).toBe(nome(129));
    expect(pagina.file.map(f => f.nome).filter(n => n.startsWith('correggo'))).toEqual([]);
    expect(pagina.file[0]).toMatchObject({
      idOlimpoCloud: 'olimpo-100',
      kit: { id: kit.idRuntime, titolo: 'Banco frigo', stato: 'PUBBLICATO' },
      area: { id: kit.idArea, nome: 'Toscana' },
      referenza: { codice: 'REF-0100', descrizione: 'Prodotto 100' },
      reparto: 'Macelleria',
      stato: null,
      versione: null,
    });
  });

  it('tendine del formato: aree, canali e reparti di tutti i suoi file, senza quelli di Correggo', async () => {
    const opzioni = await service.getOpzioniFilePop(kit.idPromo, { periodo: 'attivi', idFormato: kit.idFormato });

    expect(opzioni.reparti).toEqual(['Macelleria', 'Ortofrutta']);
    expect(opzioni.aree).toEqual([{ id: kit.idArea, nome: 'Toscana' }]);
    expect(opzioni.canali).toEqual([{ id: kit.idCanale, nome: 'Superstore' }]);
  });

  it('verifica dello ZIP: conta i file scelti della promo e del formato, quelli di altre promo e di Correggo no', async () => {
    const selezionato = idFile.get(nome(5)) ?? '';

    const verifica = await service.verificaZipPop(kit.idPromo, {
      periodo: 'attivi',
      idFormato: kit.idFormato,
      idFile: [selezionato, idFileAltraPromo, idFileCorreggo],
    });
    const perReparto = await service.verificaZipPop(kit.idPromo, { periodo: 'attivi', idFormato: kit.idFormato, filtri: { reparto: 'Ortofrutta' } });

    expect(verifica).toEqual({ file: 1, nomeFile: 'Promo ottobre - Espositori.zip' });
    expect(perReparto.file).toBe(65);
    await expect(service.verificaZipPop(kit.idPromo, { periodo: 'attivi', idFormato: kit.idFormato, idFile: [idFileAltraPromo] }))
      .rejects.toBeInstanceOf(NotFoundError);
    expect(scarica).not.toHaveBeenCalled();
  });

  it('cerca il codice della referenza nei metadati, senza distinguere maiuscole', async () => {
    const pagina = await service.getFilePop(kit.idPromo, { periodo: 'attivi', idFormato: kit.idFormato, cerca: 'ref-0042' });

    expect(pagina.totale).toBe(1);
    expect(pagina.file.map(f => f.nome)).toEqual([nome(42)]);
    expect(pagina.file[0].referenza).toEqual({ codice: 'REF-0042', descrizione: 'Prodotto 42' });
  });

  it('nella ricerca % e _ valgono come caratteri', async () => {
    const percento = await service.getFilePop(kit.idPromo, { periodo: 'attivi', idFormato: kit.idFormato, cerca: '%' });
    const trattino = await service.getFilePop(kit.idPromo, { periodo: 'attivi', idFormato: kit.idFormato, cerca: 'pop_00' });

    expect(percento.totale).toBe(0);
    expect(trattino.totale).toBe(0);
  });

  it('filtra per stato dell\'ultimo log del file, non di uno precedente', async () => {
    const conErrore = await service.getFilePop(kit.idPromo, { periodo: 'attivi', idFormato: kit.idFormato, stato: 'ERRORE' as never });
    const pubblicati = await service.getFilePop(kit.idPromo, { periodo: 'attivi', idFormato: kit.idFormato, stato: 'PUBBLICATO' as never });

    expect(conErrore.totale).toBe(1);
    expect(conErrore.file.map(f => [f.nome, f.stato, f.versione])).toEqual([[nome(1), 'ERRORE', 2]]);
    expect(pubblicati.totale).toBe(1);
    expect(pubblicati.file.map(f => [f.nome, f.stato, f.versione])).toEqual([[nome(2), 'PUBBLICATO', 3]]);
  });

  it('filtra per reparto dei metadati', async () => {
    const pagina = await service.getFilePop(kit.idPromo, { periodo: 'attivi', idFormato: kit.idFormato, reparto: 'Ortofrutta', dimensione: 500 });

    expect(pagina.totale).toBe(65);
    expect(pagina.file.every(f => f.reparto === 'Ortofrutta')).toBe(true);
  });

  it('una promo fuori dal periodo: 404', async () => {
    await expect(service.getFilePop(kit.idPromo, { periodo: 'storico', idFormato: kit.idFormato })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('ZIP con idFile: i file di un\'altra promo e quelli di Correggo restano fuori dall\'archivio', async () => {
    scarica.mockImplementation(async (id: string) => Buffer.from(`pdf ${id}`));
    const selezionato = idFile.get(nome(5)) ?? '';

    const zip = await service.preparaZipPop(kit.idPromo, {
      periodo: 'attivi',
      idFormato: kit.idFormato,
      idFile: [selezionato, idFileAltraPromo, idFileCorreggo],
    });
    const destinazione = new PassThrough();
    const parti: Buffer[] = [];
    destinazione.on('data', (parte: Buffer) => parti.push(parte));
    const letto = new Promise<void>(resolve => destinazione.on('end', () => resolve()));
    await service.scriviZipPop(zip, destinazione);
    await letto;

    const archivio = await unzipper.Open.buffer(Buffer.concat(parti));
    expect(zip.nomeFile).toBe('Promo ottobre - Espositori.zip');
    expect(archivio.files.map(voce => voce.path)).toEqual([`Banco frigo/${nome(5)}`]);
    expect((await archivio.files[0].buffer()).toString()).toBe('pdf olimpo-5');
    expect(scarica).toHaveBeenCalledTimes(1);
  });

  it('ZIP con soli file di altre promo: 404', async () => {
    await expect(service.preparaZipPop(kit.idPromo, { periodo: 'attivi', idFormato: kit.idFormato, idFile: [idFileAltraPromo] }))
      .rejects.toBeInstanceOf(NotFoundError);
    expect(scarica).not.toHaveBeenCalled();
  });
});
