import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Lo schema all'avvio non si allinea piu' con l'ALTER di Sequelize: si applicano le migrazioni
 * versionate (db/migrazioni). Qui l'interruttore, i suoi alias e cio' che ferma l'avvio.
 */

const mocks = vi.hoisted(() => ({
  leggiMigrazioni: vi.fn(),
  hashModelli: vi.fn(),
  rimuovi: vi.fn(),
  prepara: vi.fn(),
  segnala: vi.fn(),
  allinea: vi.fn(),
  relazioni: vi.fn(),
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../migrazioni/fileMigrazioni', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../migrazioni/fileMigrazioni')>()),
  leggiMigrazioni: mocks.leggiMigrazioni,
}));
vi.mock('../migrazioni/schemaModelli', () => ({ hashSchemaModelli: mocks.hashModelli }));
vi.mock('../migrazioni/oggettiDerivati', () => ({ rimuoviOggettiDerivati: mocks.rimuovi, preparaOggettiDerivati: mocks.prepara }));
vi.mock('../migrazioni/verificaSchema', () => ({ segnalaDifferenzeSchema: mocks.segnala }));
vi.mock('../../models', () => ({ modelliManager: { allineamentoLegacyPerAdozione: mocks.allinea } }));
vi.mock('../../models/ruolo_gdo', () => ({ RuoloUtenteGDO: { findAll: vi.fn(async () => []), bulkCreate: vi.fn() } }));
vi.mock('../../models/relazioni', () => ({ configuraRelazioni: mocks.relazioni }));
vi.mock('../../logger', () => ({ log: mocks.log }));

import * as connettore from '../SequelizeConnector';
import { sequelize } from '../SequelizeConnector';
import { applicaMigrazioniAllAvvio, leggiImpostazioniAvvio } from '../migrazioni/applicaMigrazioni';
import { analizzaMigrazione } from '../migrazioni/fileMigrazioni';

const HASH = 'a'.repeat(64);
const BASELINE = analizzaMigrazione('0000_baseline.sql', `-- schema-dopo: ${HASH}\nSELECT 1;\n`);
const VARIABILI = ['MIGRAZIONI_APPLICA_ALL_AVVIO', 'DB_SYNC_ON_START', 'DB_AUTO_SYNC'];

let ordine: string[];

describe("migrazioni dello schema all'avvio del server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ordine = [];
    mocks.leggiMigrazioni.mockReturnValue([BASELINE]);
    mocks.hashModelli.mockReturnValue(HASH);
    mocks.prepara.mockResolvedValue({ ricreati: [] });
    mocks.segnala.mockImplementation(async () => { ordine.push('verifica'); });
    vi.spyOn(sequelize, 'authenticate').mockImplementation(async () => { ordine.push('authenticate'); });
    vi.spyOn(sequelize, 'transaction').mockImplementation((async (lavoro: (t: unknown) => unknown) => lavoro('tx')) as never);
    // Database gia' aggiornato: storico presente con la baseline
    vi.spyOn(sequelize, 'query').mockImplementation((async (sql: string) => {
      if (sql.includes('pg_advisory_xact_lock')) ordine.push('lock');
      if (sql.includes('to_regclass')) return [{ storico: true, gdo: true }];
      if (sql.includes('FROM migrazioni_schema')) return [{ nome: BASELINE.nome, checksum: BASELINE.checksum, modo: 'adottata' }];
      return [];
    }) as never);
  });

  afterEach(() => {
    for (const variabile of VARIABILI) delete process.env[variabile];
    vi.restoreAllMocks();
  });

  it('per default applica le migrazioni dopo aver verificato la connessione, poi controlla lo schema', async () => {
    await applicaMigrazioniAllAvvio();

    expect(ordine).toEqual(['authenticate', 'lock', 'verifica']);
    expect(mocks.log.info).toHaveBeenCalledWith(expect.stringContaining('nessuna migrazione da applicare'));
  });

  it('con MIGRAZIONI_APPLICA_ALL_AVVIO=false non tocca il database e lo scrive nel log', async () => {
    process.env.MIGRAZIONI_APPLICA_ALL_AVVIO = 'false';

    await expect(applicaMigrazioniAllAvvio()).resolves.toBeNull();

    expect(sequelize.authenticate).not.toHaveBeenCalled();
    expect(sequelize.query).not.toHaveBeenCalled();
    expect(mocks.log.warn).toHaveBeenCalledWith(expect.stringContaining('MIGRAZIONI_APPLICA_ALL_AVVIO=false'));
  });

  it('DB_SYNC_ON_START=false resta un alias, deprecato', async () => {
    process.env.DB_SYNC_ON_START = 'false';

    await applicaMigrazioniAllAvvio();

    expect(sequelize.query).not.toHaveBeenCalled();
    expect(mocks.log.warn).toHaveBeenCalledWith(expect.stringContaining('DB_SYNC_ON_START=false'));
    expect(mocks.log.warn).toHaveBeenCalledWith(expect.stringContaining('deprecata'));
  });

  it('MIGRAZIONI_APPLICA_ALL_AVVIO vince sull\'alias', () => {
    expect(leggiImpostazioniAvvio({ MIGRAZIONI_APPLICA_ALL_AVVIO: 'true', DB_SYNC_ON_START: 'false' }).applica).toBe(true);
    expect(leggiImpostazioniAvvio({ MIGRAZIONI_APPLICA_ALL_AVVIO: 'FALSE' }).applica).toBe(false);
    expect(leggiImpostazioniAvvio({}).applica).toBe(true);
  });

  it('DB_AUTO_SYNC non ha piu\' effetto: le migrazioni si applicano comunque, con un avviso', async () => {
    process.env.DB_AUTO_SYNC = 'false';

    await applicaMigrazioniAllAvvio();

    expect(ordine).toContain('lock');
    expect(mocks.log.warn).toHaveBeenCalledWith(expect.stringContaining('DB_AUTO_SYNC'));
  });

  it('se il database non risponde l\'avvio fallisce', async () => {
    vi.spyOn(sequelize, 'authenticate').mockRejectedValue(new Error('connection refused'));

    await expect(applicaMigrazioniAllAvvio()).rejects.toThrow('connection refused');
    expect(sequelize.query).not.toHaveBeenCalled();
  });

  it('una migrazione che fallisce ferma l\'avvio', async () => {
    const rotta = analizzaMigrazione('0001_rotta.sql', `-- schema-dopo: ${HASH}\nALTER TABLE inesistente ADD COLUMN x INT;\n`);
    mocks.leggiMigrazioni.mockReturnValue([BASELINE, rotta]);
    vi.spyOn(sequelize, 'query').mockImplementation((async (sql: string) => {
      if (sql.includes('to_regclass')) return [{ storico: true, gdo: true }];
      if (sql.includes('FROM migrazioni_schema')) return [{ nome: BASELINE.nome, checksum: BASELINE.checksum, modo: 'adottata' }];
      if (sql.includes('inesistente')) throw new Error('relation "inesistente" does not exist');
      return [];
    }) as never);

    await expect(applicaMigrazioniAllAvvio()).rejects.toThrow(/0001_rotta non applicata/);
    expect(mocks.segnala).not.toHaveBeenCalled();
  });

  it('un modello cambiato senza migrazione ferma l\'avvio', async () => {
    mocks.hashModelli.mockReturnValue('b'.repeat(64));

    await expect(applicaMigrazioniAllAvvio()).rejects.toThrow("il modello non corrisponde all'ultima migrazione");
  });
});

describe('initializeDatabase non modifica piu\' lo schema', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(sequelize, 'authenticate').mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete process.env.DB_AUTO_SYNC;
    vi.restoreAllMocks();
  });

  it('configura le relazioni e non allinea i modelli, neanche con DB_AUTO_SYNC=true o autoSync', async () => {
    process.env.DB_AUTO_SYNC = 'true';

    await connettore.initializeDatabase(true);

    expect(mocks.relazioni).toHaveBeenCalled();
    expect(mocks.allinea).not.toHaveBeenCalled();
    expect(mocks.log.warn).toHaveBeenCalledWith(expect.stringContaining('DB_AUTO_SYNC'));
  });

  it('la vecchia sincronizzazione all\'avvio non esiste piu\'', () => {
    expect('sincronizzaSchemaAllAvvio' in connettore).toBe(false);
  });
});
