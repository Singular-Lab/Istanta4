import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  applicaMigrazioni,
  CARTELLA_SQL,
  CHIAVE_LOCK,
  improntaSql,
  leggiMigrazioni,
  migraAllAvvio,
  TABELLA_STORICO,
  type Collegamento,
  type Esecutore,
  type MigrazioneRegistrata,
} from './migrazioni';

/*
 * Migrazioni del database di Olimpo applicate all'avvio (spec olimpo/schema-database-all-avvio).
 * Nessun database vero: un esecutore finto tiene lo storico in memoria e registra le query.
 */

/** Database finto: lo storico delle migrazioni e le query eseguite; `rifiuta` fa fallire una query. */
const databaseFinto = (registrate: MigrazioneRegistrata[] = [], rifiuta?: (sql: string) => boolean) => {
  const query: Array<{ sql: string; parametri?: unknown[] }> = [];
  const storico = [...registrate];
  const esegui: Esecutore = {
    query: async <T>(sql: string, parametri?: unknown[]) => {
      query.push({ sql, parametri });
      if (rifiuta?.(sql)) throw new Error('errore del database');
      if (sql.startsWith(`SELECT nome, impronta FROM ${TABELLA_STORICO}`)) return storico.map((r) => ({ ...r })) as T[];
      if (sql.startsWith(`INSERT INTO ${TABELLA_STORICO}`)) storico.push({ nome: String(parametri![0]), impronta: String(parametri![1]) });
      return [] as T[];
    },
  };
  return { esegui, query, storico };
};

/** Una transazione finta: se il lavoro fallisce, lo storico torna com'era. */
const collegamentoFinto = (db: ReturnType<typeof databaseFinto>): Collegamento => ({
  inTransazione: async (lavoro) => {
    const prima = [...db.storico];
    try {
      return await lavoro(db.esegui);
    } catch (errore) {
      db.storico.splice(0, db.storico.length, ...prima);
      throw errore;
    }
  },
});

const registroFinto = () => {
  const righe: string[] = [];
  return { righe, log: (m: string) => righe.push(`log: ${m}`), warn: (m: string) => righe.push(`warn: ${m}`) };
};

describe('migrazioni del database di Olimpo', () => {
  let cartella: string;

  const scrivi = (file: string, sql: string) => fs.writeFileSync(path.join(cartella, file), sql);

  beforeEach(async () => {
    cartella = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'olimpo-migrazioni-test-'));
  });

  afterEach(async () => {
    await fs.promises.rm(cartella, { recursive: true, force: true });
    expect(fs.existsSync(cartella)).toBe(false);
  });

  describe('leggiMigrazioni', () => {
    it('legge i file NNNN_nome.sql in ordine, con nome e impronta, e ignora gli altri file', () => {
      scrivi('0002_seconda.sql', 'SELECT 2;');
      scrivi('0001_prima.sql', 'SELECT 1;');
      scrivi('LEGGIMI.md', 'non una migrazione');

      const migrazioni = leggiMigrazioni(cartella);

      expect(migrazioni.map((m) => [m.numero, m.nome])).toEqual([
        [1, '0001_prima'],
        [2, '0002_seconda'],
      ]);
      expect(migrazioni[0].impronta).toBe(improntaSql('SELECT 1;'));
    });

    it('l\'impronta non dipende dai fine riga', () => {
      expect(improntaSql('SELECT 1;\r\nSELECT 2;')).toBe(improntaSql('SELECT 1;\nSELECT 2;'));
    });

    it('rifiuta un buco nella numerazione, un nome fuori formato e un file vuoto', () => {
      scrivi('0001_prima.sql', 'SELECT 1;');
      scrivi('0003_terza.sql', 'SELECT 3;');
      expect(() => leggiMigrazioni(cartella)).toThrow('manca la numero 0002 prima di 0003_terza');

      fs.rmSync(path.join(cartella, '0003_terza.sql'));
      scrivi('0002-Seconda.sql', 'SELECT 2;');
      expect(() => leggiMigrazioni(cartella)).toThrow('il nome deve essere NNNN_nome.sql');

      fs.rmSync(path.join(cartella, '0002-Seconda.sql'));
      scrivi('0002_vuota.sql', '  \n');
      expect(() => leggiMigrazioni(cartella)).toThrow('vuoto');
    });
  });

  describe('applicaMigrazioni', () => {
    it('prende il lock, crea lo storico e applica e registra le migrazioni nell\'ordine', async () => {
      scrivi('0001_prima.sql', 'SELECT 1;');
      scrivi('0002_seconda.sql', 'SELECT 2;');
      const db = databaseFinto();

      const esito = await applicaMigrazioni(db.esegui, leggiMigrazioni(cartella));

      expect(esito).toEqual({ applicate: ['0001_prima', '0002_seconda'], sconosciute: [] });
      expect(db.query[0]).toEqual({ sql: 'SELECT pg_advisory_xact_lock($1)', parametri: [CHIAVE_LOCK] });
      expect(db.query[1].sql).toContain(`CREATE TABLE IF NOT EXISTS ${TABELLA_STORICO}`);
      expect(db.query.map((q) => q.sql)).toContain('SELECT 1;');
      expect(db.storico.map((r) => r.nome)).toEqual(['0001_prima', '0002_seconda']);
    });

    it('applica solo le migrazioni non ancora registrate', async () => {
      scrivi('0001_prima.sql', 'SELECT 1;');
      scrivi('0002_seconda.sql', 'SELECT 2;');
      const db = databaseFinto([{ nome: '0001_prima', impronta: improntaSql('SELECT 1;') }]);

      const esito = await applicaMigrazioni(db.esegui, leggiMigrazioni(cartella));

      expect(esito.applicate).toEqual(['0002_seconda']);
      expect(db.query.map((q) => q.sql)).not.toContain('SELECT 1;');
    });

    it('si ferma se una migrazione registrata è stata modificata, senza applicare nulla', async () => {
      scrivi('0001_prima.sql', 'SELECT 1; -- cambiata');
      scrivi('0002_seconda.sql', 'SELECT 2;');
      const db = databaseFinto([{ nome: '0001_prima', impronta: improntaSql('SELECT 1;') }]);

      await expect(applicaMigrazioni(db.esegui, leggiMigrazioni(cartella))).rejects.toThrow(
        "La migrazione 0001_prima e' stata modificata dopo essere stata applicata"
      );
      expect(db.query.map((q) => q.sql)).not.toContain('SELECT 2;');
    });

    it('una migrazione registrata senza file torna fra le sconosciute e non ferma l\'avvio', async () => {
      scrivi('0001_prima.sql', 'SELECT 1;');
      const db = databaseFinto([
        { nome: '0001_prima', impronta: improntaSql('SELECT 1;') },
        { nome: '0002_futura', impronta: 'x'.repeat(64) },
      ]);

      expect(await applicaMigrazioni(db.esegui, leggiMigrazioni(cartella))).toEqual({ applicate: [], sconosciute: ['0002_futura'] });
    });
  });

  describe('migraAllAvvio', () => {
    it('scrive nel log le migrazioni applicate, o che non c\'è nulla da applicare', async () => {
      scrivi('0001_prima.sql', 'SELECT 1;');
      const db = databaseFinto();
      const registro = registroFinto();

      await migraAllAvvio(collegamentoFinto(db), registro, {}, cartella);
      await migraAllAvvio(collegamentoFinto(db), registro, {}, cartella);

      expect(registro.righe).toEqual([
        'log: Migrazioni del database applicate: 0001_prima',
        'log: Migrazioni del database: nulla da applicare',
      ]);
    });

    it('una migrazione che fallisce ferma l\'avvio e nessuna migrazione di quell\'avvio resta registrata', async () => {
      scrivi('0001_prima.sql', 'SELECT 1;');
      scrivi('0002_rotta.sql', 'SELECT rotta;');
      const db = databaseFinto([], (sql) => sql === 'SELECT rotta;');

      await expect(migraAllAvvio(collegamentoFinto(db), registroFinto(), {}, cartella)).rejects.toThrow(
        'Migrazione 0002_rotta non riuscita: errore del database'
      );
      expect(db.storico).toEqual([]);
    });

    it('con OLIMPO_MIGRAZIONI_ALL_AVVIO=false non tocca il database e lo segnala', async () => {
      scrivi('0001_prima.sql', 'SELECT 1;');
      const db = databaseFinto();
      const registro = registroFinto();

      expect(await migraAllAvvio(collegamentoFinto(db), registro, { OLIMPO_MIGRAZIONI_ALL_AVVIO: 'false' }, cartella)).toBeNull();

      expect(db.query).toEqual([]);
      expect(registro.righe).toEqual(['warn: Migrazioni del database NON applicate: OLIMPO_MIGRAZIONI_ALL_AVVIO=false']);
    });
  });

  describe('migrazioni del repository', () => {
    it('sono numerate di seguito e la 0001 aggiunge Category, Marketing e IT al tipo di auth.tipo_utente', () => {
      const migrazioni = leggiMigrazioni(CARTELLA_SQL);
      expect(migrazioni[0].nome).toBe('0001_tipi_utente_fidelity');
      const sql = migrazioni[0].sql;
      expect(sql).toContain("to_regclass('public.auth')");
      expect(sql).toContain("ARRAY['Category', 'Marketing', 'IT']");
      expect(sql).toContain('ADD VALUE IF NOT EXISTS');
    });
  });
});
