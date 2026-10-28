import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Sequelize } from 'sequelize';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../logger', () => ({ log: mocks.log }));

import {
  analizzaOggettoDerivato,
  preparaOggettiDerivati,
  rimuoviOggettiDerivati,
} from '../oggettiDerivati';

// Due oggetti derivati di prova: la view non dipende da nulla, la
// materialized view ha una funzione di refresh.
const VISTA = 'CREATE OR REPLACE VIEW public.v_prova AS SELECT 1 AS uno;\n';
const MATERIALIZZATA = [
  'DROP MATERIALIZED VIEW IF EXISTS public.mv_prova CASCADE;',
  'CREATE MATERIALIZED VIEW public.mv_prova AS SELECT 1 AS uno;',
  'CREATE OR REPLACE FUNCTION public.refresh_mv_prova()',
  'RETURNS void AS $$ BEGIN REFRESH MATERIALIZED VIEW public.mv_prova; END; $$ LANGUAGE plpgsql;',
  '',
].join('\n');

const sha256 = (testo: string) => createHash('sha256').update(testo, 'utf8').digest('hex');

interface StatoDatabase {
  /** Impronte registrate in oggetti_derivati_schema, per nome di file. */
  impronte: Map<string, string>;
  /** Oggetti (view o funzioni) assenti nel database. */
  mancanti: Set<string>;
  /** Un file che contiene questo testo fallisce. */
  fallisce?: string;
}

type Opzioni = { replacements?: Record<string, unknown>; transaction?: unknown };

/** Database finto: risponde alle query del modulo e registra i file eseguiti. */
const databaseFinto = (stato: StatoDatabase) => {
  const eseguiti: { sql: string; transaction: unknown }[] = [];
  const query = vi.fn(async (sql: string, opzioni: Opzioni = {}) => {
    const valori = opzioni.replacements ?? {};
    if (sql.includes('pg_advisory_xact_lock') || sql.includes('CREATE TABLE IF NOT EXISTS oggetti_derivati_schema')) return [];
    if (sql.includes('SELECT impronta FROM oggetti_derivati_schema')) {
      const impronta = stato.impronte.get(valori.nome as string);
      return impronta ? [{ impronta }] : [];
    }
    if (sql.includes('FROM unnest(')) {
      return [...(valori.relazioni as string[]), ...(valori.funzioni as string[])]
        .filter(nome => stato.mancanti.has(nome))
        .map(nome => ({ nome }));
    }
    if (sql.includes('INSERT INTO oggetti_derivati_schema')) {
      stato.impronte.set(valori.nome as string, valori.impronta as string);
      return [];
    }
    if (stato.fallisce && sql.includes(stato.fallisce)) throw new Error('errore di sintassi');
    eseguiti.push({ sql, transaction: opzioni.transaction });
    return [];
  });
  const transaction = vi.fn(async (lavoro: (t: unknown) => Promise<unknown>) => lavoro({ transazione: true }));
  return { sequelize: { query, transaction } as unknown as Sequelize, eseguiti, query, transaction };
};

describe('oggetti derivati', () => {
  let cartella: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    cartella = await mkdtemp(path.join(tmpdir(), 'oggetti-derivati-'));
    // Scritti in ordine inverso: conta il nome, non l'ordine di creazione.
    await writeFile(path.join(cartella, '020_materializzata.sql'), MATERIALIZZATA);
    await writeFile(path.join(cartella, '010_vista.sql'), VISTA);
    await writeFile(path.join(cartella, 'LEGGIMI.txt'), 'non e\' SQL');
  });

  afterEach(async () => {
    await rm(cartella, { recursive: true, force: true });
  });

  const impronteAttuali = () => new Map([
    ['010_vista.sql', sha256(VISTA)],
    ['020_materializzata.sql', sha256(MATERIALIZZATA)],
  ]);

  it('al primo avvio crea tutti i file in ordine di nome e ne registra l\'impronta', async () => {
    const stato: StatoDatabase = { impronte: new Map(), mancanti: new Set() };
    const db = databaseFinto(stato);

    const esito = await preparaOggettiDerivati(db.sequelize, { forza: false, cartella });

    expect(esito.ricreati).toEqual(['010_vista.sql', '020_materializzata.sql']);
    expect(db.eseguiti.map(e => e.sql)).toEqual([VISTA, MATERIALIZZATA]);
    expect(stato.impronte).toEqual(impronteAttuali());
  });

  it('con le impronte uguali e gli oggetti presenti non ricrea nulla', async () => {
    const stato: StatoDatabase = { impronte: impronteAttuali(), mancanti: new Set() };
    const db = databaseFinto(stato);

    const esito = await preparaOggettiDerivati(db.sequelize, { forza: false, cartella });

    expect(esito.ricreati).toEqual([]);
    expect(db.eseguiti).toEqual([]);
    expect(db.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO oggetti_derivati_schema'))).toBe(false);
    expect(mocks.log.info).toHaveBeenCalledWith('Oggetti derivati invariati');
  });

  it('se il file e\' cambiato lo ricrea e ne aggiorna l\'impronta', async () => {
    const impronte = impronteAttuali();
    impronte.set('010_vista.sql', sha256('versione precedente'));
    const stato: StatoDatabase = { impronte, mancanti: new Set() };
    const db = databaseFinto(stato);

    const esito = await preparaOggettiDerivati(db.sequelize, { forza: false, cartella });

    expect(esito.ricreati).toEqual(['010_vista.sql']);
    expect(db.eseguiti.map(e => e.sql)).toEqual([VISTA]);
    expect(stato.impronte.get('010_vista.sql')).toBe(sha256(VISTA));
    expect(mocks.log.info).toHaveBeenCalledWith(expect.stringContaining('010_vista.sql'));
  });

  it('se manca un oggetto del file lo ricrea anche con l\'impronta uguale', async () => {
    // Per esempio dopo rimuoviOggettiDerivati, o se qualcuno l'ha eliminato a mano.
    const stato: StatoDatabase = { impronte: impronteAttuali(), mancanti: new Set(['refresh_mv_prova']) };
    const db = databaseFinto(stato);

    const esito = await preparaOggettiDerivati(db.sequelize, { forza: false, cartella });

    expect(esito.ricreati).toEqual(['020_materializzata.sql']);
    expect(db.eseguiti.map(e => e.sql)).toEqual([MATERIALIZZATA]);
    expect(stato.impronte.get('020_materializzata.sql')).toBe(sha256(MATERIALIZZATA));
  });

  it('cerca nel database le view e le funzioni create dal file', async () => {
    const db = databaseFinto({ impronte: impronteAttuali(), mancanti: new Set() });

    await preparaOggettiDerivati(db.sequelize, { forza: false, cartella });

    const controlli = db.query.mock.calls
      .filter(([sql]) => String(sql).includes('FROM unnest('))
      .map(([, opzioni]) => (opzioni as Opzioni).replacements);
    expect(controlli).toEqual([
      { relazioni: ['v_prova'], funzioni: [] },
      { relazioni: ['mv_prova'], funzioni: ['refresh_mv_prova'] },
    ]);
  });

  it('con forza ricrea tutto, anche con le impronte uguali', async () => {
    const stato: StatoDatabase = { impronte: impronteAttuali(), mancanti: new Set() };
    const db = databaseFinto(stato);

    const esito = await preparaOggettiDerivati(db.sequelize, { forza: true, cartella });

    expect(esito.ricreati).toEqual(['010_vista.sql', '020_materializzata.sql']);
    expect(db.eseguiti.map(e => e.sql)).toEqual([VISTA, MATERIALIZZATA]);
    expect(db.query.mock.calls.some(([sql]) => String(sql).includes('SELECT impronta'))).toBe(false);
  });

  it('ogni file gira nella sua transazione, dopo il lock', async () => {
    const db = databaseFinto({ impronte: new Map(), mancanti: new Set() });

    await preparaOggettiDerivati(db.sequelize, { forza: false, cartella });

    // Una per la tabella delle impronte, una per file.
    expect(db.transaction).toHaveBeenCalledTimes(3);
    for (const { transaction } of db.eseguiti) expect(transaction).toEqual({ transazione: true });
    const testi = db.query.mock.calls.map(([sql]) => String(sql));
    const primoFile = testi.indexOf(VISTA);
    expect(testi.slice(0, primoFile).filter(sql => sql.includes('pg_advisory_xact_lock'))).toHaveLength(2);
  });

  it('se un file fallisce si ferma con il nome del file e non ne registra l\'impronta', async () => {
    const stato: StatoDatabase = { impronte: new Map(), mancanti: new Set(), fallisce: 'v_prova' };
    const db = databaseFinto(stato);

    const errore = await preparaOggettiDerivati(db.sequelize, { forza: false, cartella }).catch((e: unknown) => e);

    expect(errore).toBeInstanceOf(Error);
    expect((errore as Error).message).toContain('010_vista.sql');
    expect((errore as Error).message).toContain('errore di sintassi');
    expect((errore as Error).cause).toBeInstanceOf(Error);
    // L'avvio si ferma: il file successivo non gira.
    expect(db.eseguiti).toEqual([]);
    expect(stato.impronte.size).toBe(0);
  });

  it('ricava gli oggetti dal testo, ignorando i commenti', () => {
    const oggetto = analizzaOggettoDerivato('prova.sql', [
      '-- CREATE VIEW public.v_nel_commento AS SELECT 1;',
      'DROP FUNCTION IF EXISTS public.vecchia_funzione(UUID, TEXT) CASCADE;',
      MATERIALIZZATA,
      VISTA,
    ].join('\n'));

    expect(oggetto.viste).toEqual(['v_prova']);
    expect(oggetto.materializzate).toEqual(['mv_prova']);
    expect(oggetto.funzioni).toEqual(['refresh_mv_prova']);
    expect(oggetto.funzioniGestite.sort()).toEqual(['refresh_mv_prova', 'vecchia_funzione']);
  });

  it('l\'impronta non cambia con i fine riga Windows', () => {
    expect(analizzaOggettoDerivato('a.sql', 'SELECT 1;\r\nSELECT 2;\r\n').impronta)
      .toBe(analizzaOggettoDerivato('a.sql', 'SELECT 1;\nSELECT 2;\n').impronta);
  });

  it('la rimozione toglie tutto, dall\'ultimo file al primo, in una transazione', async () => {
    const db = databaseFinto({ impronte: new Map(), mancanti: new Set() });

    await rimuoviOggettiDerivati(db.sequelize, cartella);

    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(db.eseguiti).toHaveLength(1);
    const [{ sql, transaction }] = db.eseguiti;
    expect(transaction).toEqual({ transazione: true });

    const materializzata = sql.indexOf('DROP MATERIALIZED VIEW IF EXISTS public.mv_prova CASCADE;');
    const vista = sql.indexOf('DROP VIEW IF EXISTS public.v_prova CASCADE;');
    expect(materializzata).toBeGreaterThanOrEqual(0);
    expect(vista).toBeGreaterThan(materializzata);
    // Funzioni per nome, con tutti gli overload.
    expect(sql).toMatch(/p\.proname IN \([^)]*'refresh_mv_prova'/);
    expect(sql).toContain("EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', funzione)");
  });

  it('la rimozione toglie anche gli oggetti delle versioni precedenti', async () => {
    const db = databaseFinto({ impronte: new Map(), mancanti: new Set() });

    await rimuoviOggettiDerivati(db.sequelize, cartella);

    const [{ sql }] = db.eseguiti;
    for (const voce of [
      'MATERIALIZED VIEW IF EXISTS public.mv_aree_canali_combinazioni',
      'VIEW IF EXISTS public.v_utenti_completi_filtered',
      'VIEW IF EXISTS public.v_tracciati_completi',
      'VIEW IF EXISTS public.v_webhook_statistiche',
    ]) {
      expect(sql).toContain(`DROP ${voce} CASCADE;`);
    }
    expect(sql).toContain("'sp_report_promozione'");
  });

  describe('con i file del repository', () => {
    it('crea gli oggetti nell\'ordine dei prefissi', async () => {
      const db = databaseFinto({ impronte: new Map(), mancanti: new Set() });

      const esito = await preparaOggettiDerivati(db.sequelize, { forza: true });

      expect(esito.ricreati).toEqual(['010_v_attivita.sql', '020_materialized_views.sql', '030_mv_utenti_completi.sql']);
    });

    it('la rimozione comprende ogni view e materialized view che i file creano', async () => {
      const db = databaseFinto({ impronte: new Map(), mancanti: new Set() });

      await rimuoviOggettiDerivati(db.sequelize);

      const [{ sql }] = db.eseguiti;
      for (const voce of [
        'MATERIALIZED VIEW IF EXISTS public.mv_utenti_completi',
        'MATERIALIZED VIEW IF EXISTS public.mv_aree_ottimizzata',
        'MATERIALIZED VIEW IF EXISTS public.mv_canali_ottimizzata',
        'MATERIALIZED VIEW IF EXISTS public.mv_combinazioni_ottimizzata',
        'VIEW IF EXISTS public.v_attivita',
      ]) {
        expect(sql).toContain(`DROP ${voce} CASCADE;`);
      }
      for (const funzione of ['get_attivita_for_user', 'refresh_mv_aree', 'get_utenti_completi_filtered', 'trigger_refresh_mv_utenti_completi']) {
        expect(sql).toContain(`'${funzione}'`);
      }
    });
  });
});
