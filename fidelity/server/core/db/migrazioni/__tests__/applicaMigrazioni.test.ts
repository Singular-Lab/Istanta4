import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  transaction: vi.fn(),
  authenticate: vi.fn(),
  rimuovi: vi.fn(),
  prepara: vi.fn(),
  allinea: vi.fn(),
  findAll: vi.fn(),
  bulkCreate: vi.fn(),
  hashModelli: vi.fn(),
  segnala: vi.fn(),
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../SequelizeConnector', () => ({
  sequelize: { query: mocks.query, transaction: mocks.transaction, authenticate: mocks.authenticate },
}));
vi.mock('../oggettiDerivati', () => ({ rimuoviOggettiDerivati: mocks.rimuovi, preparaOggettiDerivati: mocks.prepara }));
vi.mock('../../../models', () => ({ modelliManager: { allineamentoLegacyPerAdozione: mocks.allinea } }));
vi.mock('../../../models/ruolo_gdo', () => ({ RuoloUtenteGDO: { findAll: mocks.findAll, bulkCreate: mocks.bulkCreate } }));
vi.mock('../schemaModelli', () => ({ hashSchemaModelli: mocks.hashModelli }));
vi.mock('../verificaSchema', () => ({ segnalaDifferenzeSchema: mocks.segnala }));
vi.mock('../../../logger', () => ({ log: mocks.log }));

import { RUOLO_UTENTE_GDO } from '../../../../../lib/enums';
import { applicaMigrazioni, RigaStorico } from '../applicaMigrazioni';
import { analizzaMigrazione, Migrazione } from '../fileMigrazioni';

const HASH_MODELLI = 'a'.repeat(64);
const ALTRO_HASH = 'b'.repeat(64);

const migrazione = (nome: string, corpo: string, opzioni: { hash?: string; senzaTransazione?: boolean } = {}): Migrazione =>
  analizzaMigrazione(
    `${nome}.sql`,
    `-- schema-dopo: ${opzioni.hash ?? HASH_MODELLI}\n${opzioni.senzaTransazione ? '-- senza-transazione\n' : ''}${corpo}\n`
  );

const BASELINE = migrazione('0000_baseline', "SELECT 'baseline';");
const UNO = migrazione('0001_uno', "SELECT 'uno';");
const DUE = migrazione('0002_due', "SELECT 'due';");
const tutte = () => [BASELINE, UNO, DUE];

const riga = (m: Migrazione, checksum = m.checksum): RigaStorico => ({
  nome: m.nome, checksum, modo: 'eseguita', applicata_il: new Date(0), durata_ms: 1, versione_app: null,
});

interface DatabaseFinto {
  storico: boolean;
  gdo: boolean;
  righe: RigaStorico[];
  /** Una migrazione il cui SQL contiene questo testo fallisce. */
  fallisce?: string;
}

let db: DatabaseFinto;
let eventi: string[];

/**
 * Database finto: risponde alle query del runner e annota cosa succede, in ordine. Le righe
 * dello storico scritte in una transazione diventano visibili solo al commit.
 */
const preparaDatabase = (iniziale: Partial<DatabaseFinto> = {}) => {
  db = { storico: false, gdo: false, righe: [], ...iniziale };
  eventi = [];
  let prossima = 0;
  const inAttesa = new Map<number, RigaStorico[]>();

  mocks.transaction.mockImplementation(async (lavoro: (t: { id: number }) => unknown) => {
    const t = { id: ++prossima };
    inAttesa.set(t.id, []);
    eventi.push(`inizio:${t.id}`);
    try {
      const risultato = await lavoro(t);
      db.righe.push(...inAttesa.get(t.id)!);
      eventi.push(`commit:${t.id}`);
      return risultato;
    } catch (errore) {
      eventi.push(`rollback:${t.id}`);
      throw errore;
    } finally {
      inAttesa.delete(t.id);
    }
  });

  mocks.query.mockImplementation(async (sql: string, opzioni: { transaction?: { id: number }; replacements?: any } = {}) => {
    const t = opzioni.transaction?.id;
    if (sql.includes('pg_advisory_xact_lock')) {
      eventi.push(`lock:${t}:${opzioni.replacements?.chiave}`);
      return [];
    }
    if (sql.includes('to_regclass')) return [{ storico: db.storico, gdo: db.gdo }];
    if (sql.includes('CREATE TABLE IF NOT EXISTS public.migrazioni_schema')) {
      db.storico = true;
      eventi.push('crea-storico');
      return [];
    }
    if (sql.includes('FROM migrazioni_schema')) return [...db.righe];
    if (sql.includes('SET LOCAL lock_timeout')) {
      eventi.push(`lock_timeout:${t}`);
      return [];
    }
    if (sql.includes('INSERT INTO migrazioni_schema')) {
      const { nome, checksum, durata, modo } = opzioni.replacements;
      const nuova: RigaStorico = { nome, checksum, modo, applicata_il: new Date(), durata_ms: durata, versione_app: null };
      if (t !== undefined) inAttesa.get(t)!.push(nuova);
      else db.righe.push(nuova);
      eventi.push(`registra:${nome}:${modo}`);
      return [];
    }
    if (db.fallisce && sql.includes(db.fallisce)) {
      eventi.push(`errore:${t}`);
      throw new Error('relation "inesistente" does not exist');
    }
    eventi.push(`sql:${t ?? 'senza'}:${sql.trim().split('\n').pop()}`);
    return [];
  });
};

const eseguite = () => eventi.filter(e => e.startsWith('sql:')).map(e => e.split(':').slice(2).join(':'));

beforeEach(() => {
  vi.clearAllMocks();
  preparaDatabase();
  mocks.hashModelli.mockReturnValue(HASH_MODELLI);
  mocks.rimuovi.mockImplementation(async () => { eventi.push('rimuovi-derivati'); });
  mocks.prepara.mockImplementation(async (_s: unknown, opzioni: { forza: boolean }) => {
    eventi.push(`prepara-derivati:${opzioni.forza}`);
    return { ricreati: [] };
  });
  mocks.allinea.mockImplementation(async (opzioni?: { soloModelli?: string[] }) => {
    eventi.push(`allinea:${opzioni?.soloModelli?.join(',') ?? 'tutti'}`);
    return [];
  });
  mocks.findAll.mockImplementation(async () => { eventi.push('seed'); return []; });
  mocks.bulkCreate.mockResolvedValue([]);
});

describe('applicaMigrazioni', () => {
  it('prende il lock prima di ogni altra query e lo tiene fino alla fine', async () => {
    await applicaMigrazioni({ migrazioni: tutte() });

    // Prima transazione: quella del lock, aperta per prima e chiusa per ultima
    expect(eventi[0]).toBe('inizio:1');
    expect(eventi[1]).toBe('lock:1:migrazioni_schema');
    expect(mocks.query.mock.calls[0][0]).toContain('pg_advisory_xact_lock(hashtext(:chiave))');
    expect(eventi.at(-1)).toBe('commit:1');
  });

  it('database vuoto: crea lo storico, esegue la baseline e poi le altre in ordine', async () => {
    const esito = await applicaMigrazioni({ migrazioni: tutte() });

    expect(eventi).toContain('crea-storico');
    expect(eseguite()).toEqual(["SELECT 'baseline';", "SELECT 'uno';", "SELECT 'due';"]);
    expect(db.righe.map(r => `${r.nome}:${r.modo}`)).toEqual(['0000_baseline:eseguita', '0001_uno:eseguita', '0002_due:eseguita']);
    expect(esito).toEqual({ applicate: ['0000_baseline', '0001_uno', '0002_due'], adozione: 'nessuna', oggettiRicreati: [] });
    expect(mocks.allinea).not.toHaveBeenCalled();
    expect(mocks.log.info).toHaveBeenCalledWith(expect.stringContaining('applico 3 migrazioni: 0000_baseline, 0001_uno, 0002_due'));
    expect(mocks.log.info).toHaveBeenCalledWith(expect.stringContaining('migrazioni applicate'));
  });

  it('ogni migrazione ha la sua transazione con lock_timeout, e lo storico si scrive nella stessa', async () => {
    await applicaMigrazioni({ migrazioni: [BASELINE] });

    // Transazione 2: quella della baseline, dentro il lock
    const inizio = eventi.indexOf('inizio:2');
    expect(eventi.slice(inizio, inizio + 5)).toEqual([
      'inizio:2', 'lock_timeout:2', "sql:2:SELECT 'baseline';", 'registra:0000_baseline:eseguita', 'commit:2',
    ]);
    expect(mocks.query).toHaveBeenCalledWith("SET LOCAL lock_timeout = '30s'", { transaction: { id: 2 } });
  });

  it('applica solo le migrazioni pendenti', async () => {
    preparaDatabase({ storico: true, gdo: true, righe: [riga(BASELINE), riga(UNO)] });

    const esito = await applicaMigrazioni({ migrazioni: tutte() });

    expect(eseguite()).toEqual(["SELECT 'due';"]);
    expect(esito.applicate).toEqual(['0002_due']);
    expect(eventi).not.toContain('crea-storico');
  });

  it('un secondo giro non applica nulla e non toglie le view', async () => {
    await applicaMigrazioni({ migrazioni: tutte() });
    const righeDopoIlPrimo = [...db.righe];
    mocks.rimuovi.mockClear();
    mocks.prepara.mockClear();
    eventi.length = 0;

    const esito = await applicaMigrazioni({ migrazioni: tutte() });

    expect(esito.applicate).toEqual([]);
    expect(eseguite()).toEqual([]);
    expect(db.righe).toEqual(righeDopoIlPrimo);
    expect(mocks.rimuovi).not.toHaveBeenCalled();
    expect(mocks.prepara).toHaveBeenCalledWith(expect.anything(), { forza: false });
    expect(mocks.log.info).toHaveBeenCalledWith(expect.stringContaining('nessuna migrazione da applicare'));
  });

  it('una migrazione che fallisce si annulla, ferma il giro e non finisce nello storico', async () => {
    preparaDatabase({ storico: true, gdo: true, righe: [riga(BASELINE)], fallisce: "'uno'" });

    await expect(applicaMigrazioni({ migrazioni: tutte() })).rejects.toThrow(/0001_uno non applicata \(annullata\): relation "inesistente"/);

    expect(eventi).toContain('rollback:2');
    expect(eseguite()).toEqual([]);
    expect(db.righe.map(r => r.nome)).toEqual(['0000_baseline']);
    // Anche la transazione del lock si chiude, rilasciandolo
    expect(eventi.at(-1)).toBe('rollback:1');
    expect(mocks.log.error).toHaveBeenCalledWith(expect.stringContaining('0001_uno non applicata'), expect.any(Error));
    // Lo schema e' quello di prima: le view tolte si ricreano, il seed no
    expect(mocks.prepara).toHaveBeenCalledWith(expect.anything(), { forza: true });
    expect(mocks.findAll).not.toHaveBeenCalled();
  });

  it('una migrazione senza-transazione gira fuori transazione e senza lock_timeout', async () => {
    const concorrente = migrazione('0001_indice', 'CREATE INDEX CONCURRENTLY IF NOT EXISTS i ON t (c);', { senzaTransazione: true });
    preparaDatabase({ storico: true, gdo: true, righe: [riga(BASELINE)] });

    await applicaMigrazioni({ migrazioni: [BASELINE, concorrente] });

    expect(eventi).toContain('sql:senza:CREATE INDEX CONCURRENTLY IF NOT EXISTS i ON t (c);');
    expect(eventi.filter(e => e.startsWith('lock_timeout'))).toEqual([]);
    expect(db.righe.map(r => r.nome)).toEqual(['0000_baseline', '0001_indice']);
  });

  it('un checksum cambiato ferma tutto prima di applicare', async () => {
    preparaDatabase({ storico: true, gdo: true, righe: [riga(BASELINE, 'f'.repeat(64))] });

    await expect(applicaMigrazioni({ migrazioni: tutte() })).rejects.toThrow(/0000_baseline e' cambiata dopo essere stata applicata/);

    expect(eseguite()).toEqual([]);
    expect(mocks.rimuovi).not.toHaveBeenCalled();
  });

  it('modelli diversi dall\'ultima migrazione: errore prima di toccare il database', async () => {
    mocks.hashModelli.mockReturnValue('c'.repeat(64));

    await expect(applicaMigrazioni({ migrazioni: tutte() }))
      .rejects.toThrow("il modello non corrisponde all'ultima migrazione: creare una migrazione con yarn migrazioni:nuova");

    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('migrazioni registrate che il codice non conosce: avviso, non errore', async () => {
    const futura = { ...riga(DUE), nome: '0003_futura' };
    preparaDatabase({ storico: true, gdo: true, righe: [riga(BASELINE), riga(UNO), riga(DUE), futura] });

    await expect(applicaMigrazioni({ migrazioni: tutte() })).resolves.toBeDefined();

    expect(mocks.log.warn).toHaveBeenCalledWith(expect.stringContaining('non conosce'), { migrazioni: ['0003_futura'] });
  });

  it('view e materialized view: tolte prima delle migrazioni, ricreate con forza dopo', async () => {
    await applicaMigrazioni({ migrazioni: tutte() });

    const rimozione = eventi.indexOf('rimuovi-derivati');
    const primaMigrazione = eventi.findIndex(e => e.startsWith('sql:'));
    const ultimaRegistrazione = eventi.lastIndexOf('registra:0002_due:eseguita');
    const preparazione = eventi.indexOf('prepara-derivati:true');
    expect(rimozione).toBeGreaterThan(-1);
    expect(rimozione).toBeLessThan(primaMigrazione);
    expect(preparazione).toBeGreaterThan(ultimaRegistrazione);
  });

  it('dopo le migrazioni aggiunge i ruoli GDO mancanti, e solo quelli', async () => {
    const [primo, ...altri] = Object.values(RUOLO_UTENTE_GDO);
    mocks.findAll.mockImplementation(async () => {
      eventi.push('seed');
      return [{ ruolo_ruolo_utente_gdo: primo }];
    });

    await applicaMigrazioni({ migrazioni: tutte() });

    expect(eventi.indexOf('seed')).toBeGreaterThan(eventi.indexOf('prepara-derivati:true'));
    const inseriti = mocks.bulkCreate.mock.calls[0][0].map((r: { ruolo_ruolo_utente_gdo: string }) => r.ruolo_ruolo_utente_gdo);
    expect(inseriti).toEqual(altri);
  });

  it('un errore del seed resta nel log e non ferma l\'avvio', async () => {
    mocks.findAll.mockRejectedValue(new Error('relation "ruolo_utente_gdo" does not exist'));

    await expect(applicaMigrazioni({ migrazioni: tutte() })).resolves.toBeDefined();
    expect(mocks.log.warn).toHaveBeenCalledWith('Seed dei ruoli GDO non riuscito', expect.anything());
  });
});

describe('applicaMigrazioni: adozione di un database esistente', () => {
  it('con i modelli della baseline: ultimo allineamento, baseline adottata senza eseguirla, poi le altre', async () => {
    preparaDatabase({ storico: false, gdo: true });

    const esito = await applicaMigrazioni({ migrazioni: tutte() });

    expect(esito.adozione).toBe('con-allineamento');
    expect(eseguite()).toEqual(["SELECT 'uno';", "SELECT 'due';"]);
    expect(db.righe.map(r => `${r.nome}:${r.modo}`)).toEqual(['0000_baseline:adottata', '0001_uno:eseguita', '0002_due:eseguita']);
    // L'allineamento dopo la rimozione delle view e prima di registrare la baseline
    expect(eventi.indexOf('rimuovi-derivati')).toBeLessThan(eventi.indexOf('allinea:tutti'));
    expect(eventi.indexOf('allinea:tutti')).toBeLessThan(eventi.indexOf('registra:0000_baseline:adottata'));
    expect(mocks.allinea).toHaveBeenCalledTimes(1);
  });

  // Aggiornamento "a salto" (da prima delle migrazioni a una versione con modelli piu' nuovi):
  // senza l'ultimo allineamento mancherebbero tabelle e colonne nate dopo l'ultimo avvio
  it('con modelli piu\' nuovi della baseline: ultimo allineamento comunque, poi baseline adottata e le altre', async () => {
    preparaDatabase({ storico: false, gdo: true });
    const vecchiaBaseline = migrazione('0000_baseline', "SELECT 'baseline';", { hash: ALTRO_HASH });

    const esito = await applicaMigrazioni({ migrazioni: [vecchiaBaseline, UNO, DUE] });

    expect(esito.adozione).toBe('con-allineamento');
    expect(mocks.allinea).toHaveBeenCalledTimes(1);
    expect(eventi.indexOf('allinea:tutti')).toBeLessThan(eventi.indexOf('registra:0000_baseline:adottata'));
    expect(eseguite()).toEqual(["SELECT 'uno';", "SELECT 'due';"]);
    expect(db.righe[0]).toMatchObject({ nome: '0000_baseline', modo: 'adottata' });
    expect(mocks.log.info).toHaveBeenCalledWith(expect.stringContaining('aggiornamento a salto'));
  });

  it('i modelli che l\'allineamento non riesce ad allineare ci riprovano dopo le migrazioni', async () => {
    preparaDatabase({ storico: false, gdo: true });
    mocks.allinea
      .mockImplementationOnce(async () => {
        eventi.push('allinea:tutti');
        return [
          { modello: 'GDO', tabella: 'gdo', successo: true, tempo_ms: 1 },
          { modello: 'Tracciati', tabella: 'tracciati', successo: false, tempo_ms: 1, errore: 'violates foreign key constraint' },
        ];
      })
      .mockImplementationOnce(async (opzioni?: { soloModelli?: string[] }) => {
        eventi.push(`allinea:${opzioni?.soloModelli?.join(',')}`);
        return [{ modello: 'Tracciati', tabella: 'tracciati', successo: true, tempo_ms: 1 }];
      });

    await applicaMigrazioni({ migrazioni: tutte() });

    expect(mocks.allinea).toHaveBeenLastCalledWith({ soloModelli: ['Tracciati'] });
    expect(eventi.indexOf('allinea:Tracciati')).toBeGreaterThan(eventi.indexOf('registra:0002_due:eseguita'));
    expect(eventi.indexOf('allinea:Tracciati')).toBeLessThan(eventi.indexOf('prepara-derivati:true'));
    expect(mocks.log.error).not.toHaveBeenCalled();
  });

  it('storico creato ma vuoto e tabelle presenti (giro precedente interrotto): si adotta di nuovo', async () => {
    preparaDatabase({ storico: true, gdo: true, righe: [] });

    const esito = await applicaMigrazioni({ migrazioni: tutte() });

    expect(esito.adozione).toBe('con-allineamento');
    expect(eseguite()).not.toContain("SELECT 'baseline';");
  });
});
