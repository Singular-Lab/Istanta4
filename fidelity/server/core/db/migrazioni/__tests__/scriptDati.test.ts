import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  transaction: vi.fn(),
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../SequelizeConnector', () => ({
  sequelize: { query: mocks.query, transaction: mocks.transaction },
}));
vi.mock('../../../logger', () => ({ log: mocks.log }));

import { CARTELLA_SQL, leggiIntestazione } from '../fileMigrazioni';
import { eseguiScriptDati, EsecuzioneScriptDati, SCRIPT_DATI, TABELLA_SCRIPT_DATI } from '../scriptDati';

// Come il controllo di fileMigrazioni: la transazione la apre il runner
const CONTROLLO_TRANSAZIONE = /^\s*(?:(?:BEGIN|COMMIT|ROLLBACK)(?:\s+(?:TRANSACTION|WORK))?\s*;|START\s+TRANSACTION\b)/im;

interface RegistroFinto {
  /** La tabella script_dati_eseguiti esiste (migrazione 0010 applicata). */
  tabella: boolean;
  /** Il lock dello script e' libero. */
  lockLibero: boolean;
  righe: Map<string, EsecuzioneScriptDati>;
}

let db: RegistroFinto;
let transazioni: Array<{ commit: ReturnType<typeof vi.fn>; rollback: ReturnType<typeof vi.fn> }>;

/**
 * Database finto: risponde alle query del registro. La riga scritta nella transazione diventa
 * visibile solo al commit, come in PostgreSQL; un rollback la scarta.
 */
const preparaDatabase = (iniziale: Partial<RegistroFinto> = {}) => {
  db = { tabella: true, lockLibero: true, righe: new Map(), ...iniziale };
  transazioni = [];
  const inAttesa = new Map<object, EsecuzioneScriptDati>();

  mocks.transaction.mockImplementation(async () => {
    const t = {
      commit: vi.fn(async () => {
        const riga = inAttesa.get(t);
        if (riga) db.righe.set(riga.nome, riga);
      }),
      rollback: vi.fn(async () => {
        inAttesa.delete(t);
      }),
    };
    transazioni.push(t);
    return t;
  });

  mocks.query.mockImplementation(async (sql: string, opzioni: { replacements?: Record<string, unknown>; transaction?: object } = {}) => {
    const valori = opzioni.replacements ?? {};
    if (sql.includes('to_regclass')) return [{ presente: db.tabella }];
    if (sql.includes('pg_try_advisory_xact_lock')) return [{ preso: db.lockLibero }];
    if (sql.startsWith('SELECT') && sql.includes('WHERE nome = :nome')) {
      const riga = db.righe.get(String(valori.nome));
      return riga ? [riga] : [];
    }
    if (sql.startsWith('INSERT INTO')) {
      const precedente = db.righe.get(String(valori.nome));
      inAttesa.set(opzioni.transaction!, {
        nome: String(valori.nome),
        ripetibile: Boolean(valori.ripetibile),
        ultima_esecuzione: new Date(),
        esecuzioni: (precedente?.esecuzioni ?? 0) + 1,
        durata_ms: Number(valori.durata),
        esito: valori.esito === null ? null : JSON.parse(String(valori.esito)),
        versione_app: (valori.versione as string | null) ?? null,
      });
      return [];
    }
    throw new Error(`query inattesa: ${sql}`);
  });
};

const giaEseguito = (nome: string, esecuzioni = 1): EsecuzioneScriptDati => ({
  nome,
  ripetibile: false,
  ultima_esecuzione: new Date('2026-10-01T08:30:00Z'),
  esecuzioni,
  durata_ms: 10,
  esito: null,
  versione_app: '2.18.002',
});

// Script di prova: il registro non dipende da quali script esistono
const NON_RIPETIBILE = { nome: 'prova-non-ripetibile', ripetibile: false, comando: 'yarn prova:non-ripetibile' };
const RIPETIBILE = { nome: 'prova-ripetibile', ripetibile: true, comando: 'yarn prova:ripetibile' };

describe('eseguiScriptDati', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    preparaDatabase();
  });

  it('esegue uno script non ripetibile la prima volta e lo registra col suo esito', async () => {
    const esegui = vi.fn(async () => ({ eliminati: 3 }));

    const risultato = await eseguiScriptDati({ ...NON_RIPETIBILE }, esegui);

    expect(risultato).toEqual({ eliminati: 3 });
    expect(esegui).toHaveBeenCalledTimes(1);
    // Lo script riceve la transazione del registro: le sue scritture si confermano con la registrazione
    expect(esegui).toHaveBeenCalledWith(transazioni[0]);
    expect(transazioni[0].commit).toHaveBeenCalledTimes(1);
    expect(db.righe.get(NON_RIPETIBILE.nome)).toMatchObject({ ripetibile: false, esecuzioni: 1, esito: { eliminati: 3 } });
  });

  it('rifiuta la seconda esecuzione di uno script non ripetibile, senza eseguirlo ne\' registrarlo', async () => {
    db.righe.set(NON_RIPETIBILE.nome, giaEseguito(NON_RIPETIBILE.nome));
    const esegui = vi.fn(async () => ({ eliminati: 3 }));

    const risultato = await eseguiScriptDati({ ...NON_RIPETIBILE }, esegui);

    expect(risultato).toBeUndefined();
    expect(esegui).not.toHaveBeenCalled();
    expect(transazioni[0].rollback).toHaveBeenCalledTimes(1);
    expect(transazioni[0].commit).not.toHaveBeenCalled();
    expect(db.righe.get(NON_RIPETIBILE.nome)?.esecuzioni).toBe(1);
    // Il messaggio dice quando e' stato eseguito e come forzarlo
    const avviso = String(mocks.log.warn.mock.calls[0][0]);
    expect(avviso).toContain('2026-10-01 08:30:00 UTC');
    expect(avviso).toContain('yarn prova:non-ripetibile --forza');
  });

  it('con forza riesegue lo script non ripetibile e conta l\'esecuzione', async () => {
    db.righe.set(NON_RIPETIBILE.nome, giaEseguito(NON_RIPETIBILE.nome));
    const esegui = vi.fn(async () => ({ eliminati: 0 }));

    const risultato = await eseguiScriptDati({ ...NON_RIPETIBILE, forza: true }, esegui);

    expect(risultato).toEqual({ eliminati: 0 });
    expect(esegui).toHaveBeenCalledTimes(1);
    expect(db.righe.get(NON_RIPETIBILE.nome)).toMatchObject({ esecuzioni: 2, esito: { eliminati: 0 } });
  });

  it('il dry-run esegue lo script ma non lo registra e annulla la transazione', async () => {
    const esegui = vi.fn(async () => ({ eliminati: 3 }));

    const risultato = await eseguiScriptDati({ ...NON_RIPETIBILE, dryRun: true }, esegui);

    expect(risultato).toEqual({ eliminati: 3 });
    expect(esegui).toHaveBeenCalledTimes(1);
    expect(transazioni[0].rollback).toHaveBeenCalledTimes(1);
    expect(transazioni[0].commit).not.toHaveBeenCalled();
    expect(db.righe.size).toBe(0);
    expect(mocks.query.mock.calls.some(([sql]) => String(sql).startsWith('INSERT'))).toBe(false);
  });

  it('il dry-run di uno script non ripetibile gia\' eseguito mostra cosa farebbe e avvisa del rifiuto', async () => {
    db.righe.set(NON_RIPETIBILE.nome, giaEseguito(NON_RIPETIBILE.nome));
    const esegui = vi.fn(async () => ({ eliminati: 0 }));

    await eseguiScriptDati({ ...NON_RIPETIBILE, dryRun: true }, esegui);

    expect(esegui).toHaveBeenCalledTimes(1);
    expect(String(mocks.log.warn.mock.calls[0][0])).toMatch(/verrebbe rifiutata senza --forza/);
    expect(db.righe.get(NON_RIPETIBILE.nome)?.esecuzioni).toBe(1);
  });

  it('uno script fallito non si registra, la transazione si annulla e l\'errore arriva al chiamante', async () => {
    const esegui = vi.fn(async () => {
      throw new Error('tabella bloccata');
    });

    await expect(eseguiScriptDati({ ...NON_RIPETIBILE }, esegui)).rejects.toThrow('tabella bloccata');

    expect(transazioni[0].rollback).toHaveBeenCalledTimes(1);
    expect(transazioni[0].commit).not.toHaveBeenCalled();
    expect(db.righe.size).toBe(0);
    // Fallito, quindi la volta dopo si puo' rilanciare senza forza
    const riprova = vi.fn(async () => ({ eliminati: 1 }));
    await expect(eseguiScriptDati({ ...NON_RIPETIBILE }, riprova)).resolves.toEqual({ eliminati: 1 });
    expect(riprova).toHaveBeenCalledTimes(1);
  });

  it('senza la tabella del registro si ferma con un errore chiaro e non esegue nulla', async () => {
    preparaDatabase({ tabella: false });
    const esegui = vi.fn(async () => ({}));

    await expect(eseguiScriptDati({ ...RIPETIBILE }, esegui)).rejects.toThrow(/yarn migrazioni:applica/);
    await expect(eseguiScriptDati({ ...RIPETIBILE, dryRun: true }, esegui)).rejects.toThrow(new RegExp(TABELLA_SCRIPT_DATI));

    expect(esegui).not.toHaveBeenCalled();
    expect(transazioni.every(t => t.rollback.mock.calls.length === 1)).toBe(true);
  });

  it('uno script ripetibile si esegue e si registra ogni volta', async () => {
    const esegui = vi.fn(async () => ({ righe: 2 }));

    await eseguiScriptDati({ ...RIPETIBILE }, esegui);
    await eseguiScriptDati({ ...RIPETIBILE }, esegui);
    await eseguiScriptDati({ ...RIPETIBILE }, esegui);

    expect(esegui).toHaveBeenCalledTimes(3);
    expect(db.righe.get(RIPETIBILE.nome)).toMatchObject({ ripetibile: true, esecuzioni: 3, esito: { righe: 2 } });
    expect(mocks.log.warn).not.toHaveBeenCalled();
  });

  it('rifiuta l\'esecuzione se lo stesso script sta gia\' girando in un altro processo', async () => {
    preparaDatabase({ lockLibero: false });
    const esegui = vi.fn(async () => ({}));

    await expect(eseguiScriptDati({ ...NON_RIPETIBILE }, esegui)).rejects.toThrow(/gia' in esecuzione/);

    expect(esegui).not.toHaveBeenCalled();
    expect(db.righe.size).toBe(0);
  });
});

describe('SCRIPT_DATI', () => {
  it('l\'assegnazione degli utenti alla GDO non si ripete, le migrazioni idempotenti si', () => {
    // Rilanciato, migrate:utenti-gdo assegnerebbe alla GDO scelta anche gli utenti creati da allora
    expect(SCRIPT_DATI.utentiGdo.ripetibile).toBe(false);
    expect(SCRIPT_DATI.urlOlimpo.ripetibile).toBe(true);
    expect(SCRIPT_DATI.accessi.ripetibile).toBe(true);
    expect(SCRIPT_DATI.segretiProvider.ripetibile).toBe(true);
  });

  it('ha nomi unici nel registro', () => {
    const nomi = Object.values(SCRIPT_DATI).map(s => s.nome);
    expect(new Set(nomi).size).toBe(nomi.length);
  });
});

describe('migrazione del registro (0010)', () => {
  const file = readdirSync(CARTELLA_SQL).find(f => /^\d{4}_script_dati\.sql$/.test(f));
  const sql = file ? readFileSync(path.join(CARTELLA_SQL, file), 'utf8') : '';

  it('esiste e ha in testa l\'intestazione schema-dopo', () => {
    expect(file).toBeDefined();
    expect(sql.split('\n')[0]).toMatch(/^-- schema-dopo: \S+$/);
  });

  it('crea la tabella usata da scriptDati.ts solo se manca, con tutte le colonne', () => {
    expect(sql).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${TABELLA_SCRIPT_DATI} \\(`));
    for (const colonna of ['nome', 'ripetibile', 'ultima_esecuzione', 'esecuzioni', 'durata_ms', 'esito', 'versione_app']) {
      expect(sql, colonna).toMatch(new RegExp(`^\\s+${colonna}\\s`, 'm'));
    }
    expect(sql).toMatch(/nome VARCHAR\(\d+\) PRIMARY KEY/);
  });

  it('e\' rieseguibile e non tocca dati ne\' altre tabelle', () => {
    const istruzioni = sql.replace(/--[^\n]*/g, '');
    // Ogni CREATE e' protetto da IF NOT EXISTS
    expect(istruzioni.match(/\bCREATE\b/gi)).toHaveLength((istruzioni.match(/\bCREATE\s+\w+\s+IF NOT EXISTS\b/gi) ?? []).length);
    expect(istruzioni).not.toMatch(/\b(?:DROP|DELETE|TRUNCATE|UPDATE|ALTER|INSERT)\b/i);
    expect(sql).not.toMatch(CONTROLLO_TRANSAZIONE);
    expect(leggiIntestazione(sql).some(r => /senza-transazione/i.test(r))).toBe(false);
  });

  it('non cambia i modelli: schema-dopo e\' quello della migrazione precedente', () => {
    const numero = Number(file?.slice(0, 4));
    const precedente = readdirSync(CARTELLA_SQL).find(f => f.startsWith(`${String(numero - 1).padStart(4, '0')}_`));
    expect(precedente).toBeDefined();
    const intestazione = (testo: string) => testo.split('\n')[0];
    expect(intestazione(sql)).toBe(intestazione(readFileSync(path.join(CARTELLA_SQL, precedente!), 'utf8')));
  });
});
