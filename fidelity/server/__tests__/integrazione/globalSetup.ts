import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';
import pg from 'pg';
import type { TestProject } from 'vitest/node';
import { TEST_ENV } from '../ambienteTest';

/**
 * Database dei test d'integrazione (file *.integrazione.test.ts), preparato una volta per esecuzione:
 * 1. FIDELITY_TEST_DB_URL (ambiente o fidelity/.env): un database il cui nome finisce in _test,
 *    cancellato e ricreato all'inizio e cancellato alla fine. In locale e' il PostgreSQL dello
 *    sviluppatore;
 * 2. altrimenti, se c'e' Docker, un container PostGIS avviato da testcontainers (la CI);
 * 3. altrimenti in CI e' un errore, in locale i test d'integrazione si saltano con un avviso.
 * Lo schema nasce da zero con le migrazioni, come in una installazione nuova.
 */

export interface DatabaseIntegrazione {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

declare module 'vitest' {
  export interface ProvidedContext {
    databaseIntegrazione: DatabaseIntegrazione | null;
  }
}

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
/** Stessa major di PostgreSQL delle installazioni, con PostGIS (la baseline lo richiede). */
const IMMAGINE_POSTGIS = 'postgis/postgis:17-3.5';

const scrivi = (messaggio: string) => process.stderr.write(`[test d'integrazione] ${messaggio}\n`);

/**
 * Database indicato da FIDELITY_TEST_DB_URL. Viene cancellato a ogni esecuzione, quindi il nome
 * deve finire in _test e non puo' essere quello di sviluppo (DB_POSTGRESQL_NAME di .env).
 */
export function databaseDaUrl(url: string, nomeDatabaseSviluppo?: string): DatabaseIntegrazione {
  const indirizzo = new URL(url);
  const database = decodeURIComponent(indirizzo.pathname.replace(/^\//, ''));
  if (!database.endsWith('_test')) {
    throw new Error(`FIDELITY_TEST_DB_URL deve indicare un database il cui nome finisce in _test, ora "${database}": viene cancellato e ricreato a ogni esecuzione`);
  }
  if (nomeDatabaseSviluppo && database === nomeDatabaseSviluppo) {
    throw new Error(`FIDELITY_TEST_DB_URL indica "${database}", lo stesso database di DB_POSTGRESQL_NAME: i test lo cancellerebbero`);
  }
  return {
    host: indirizzo.hostname,
    port: Number(indirizzo.port || 5432),
    user: decodeURIComponent(indirizzo.username),
    password: decodeURIComponent(indirizzo.password),
    database,
  };
}

/** Di .env si leggono solo le due chiavi che servono: il resto non deve arrivare ai test. */
function leggiEnvLocale(): { url?: string; nomeSviluppo?: string } {
  const file = path.join(RADICE, '.env');
  const valori = existsSync(file) ? parse(readFileSync(file)) : {};
  return {
    url: process.env.FIDELITY_TEST_DB_URL || valori.FIDELITY_TEST_DB_URL,
    nomeSviluppo: process.env.DB_POSTGRESQL_NAME || valori.DB_POSTGRESQL_NAME,
  };
}

async function suDatabasePostgres(db: DatabaseIntegrazione, sql: (client: pg.Client) => string[]): Promise<void> {
  const client = new pg.Client({ ...db, database: 'postgres' });
  await client.connect();
  try {
    for (const istruzione of sql(client)) await client.query(istruzione);
  } finally {
    await client.end();
  }
}

const ricreaDatabase = (db: DatabaseIntegrazione) => suDatabasePostgres(db, client => [
  `DROP DATABASE IF EXISTS ${client.escapeIdentifier(db.database)} WITH (FORCE)`,
  `CREATE DATABASE ${client.escapeIdentifier(db.database)}`,
]);

const cancellaDatabase = (db: DatabaseIntegrazione) => suDatabasePostgres(db, client => [
  `DROP DATABASE IF EXISTS ${client.escapeIdentifier(db.database)} WITH (FORCE)`,
]);

async function avviaContainer(): Promise<{ db: DatabaseIntegrazione; ferma: () => Promise<void> } | null> {
  const { getContainerRuntimeClient } = await import('testcontainers');
  try {
    await getContainerRuntimeClient();
  } catch {
    return null;
  }
  const { PostgreSqlContainer } = await import('@testcontainers/postgresql');
  const container = await new PostgreSqlContainer(IMMAGINE_POSTGIS)
    .withDatabase('fidelity_test')
    .withUsername('fidelity')
    .withPassword('fidelity')
    .start();
  return {
    db: {
      host: container.getHost(),
      port: container.getPort(),
      user: container.getUsername(),
      password: container.getPassword(),
      database: container.getDatabase(),
    },
    ferma: async () => {
      await container.stop();
    },
  };
}

/** Ambiente dei processi che usano il database di test: variabili finte, DB di test esplicito. */
export function ambienteDatabase(db: DatabaseIntegrazione): NodeJS.ProcessEnv {
  return {
    ...TEST_ENV,
    ...process.env,
    NODE_ENV: 'test',
    DB_POSTGRESQL_HOST: db.host,
    DB_POSTGRESQL_PORT: String(db.port),
    DB_POSTGRESQL_USER: db.user,
    DB_POSTGRESQL_PASSWORD: db.password,
    DB_POSTGRESQL_NAME: db.database,
  };
}

/** Le stesse migrazioni dell'avvio, in un processo a parte: il singleton di Sequelize resta ai test. */
function applicaMigrazioni(db: DatabaseIntegrazione): void {
  const esecuzione = spawnSync(process.execPath, ['--import', 'tsx', 'server/core/db/migrazioni/cli.ts', 'applica'], {
    cwd: RADICE,
    env: ambienteDatabase(db),
    encoding: 'utf8',
  });
  if (esecuzione.status !== 0) {
    throw new Error(`Migrazioni non applicate al database di test:\n${esecuzione.stdout}\n${esecuzione.stderr}`);
  }
}

export default async function preparaDatabaseIntegrazione(project: TestProject): Promise<(() => Promise<void>) | void> {
  const locale = leggiEnvLocale();
  let db: DatabaseIntegrazione;
  let chiudi: () => Promise<void>;

  if (locale.url) {
    db = databaseDaUrl(locale.url, locale.nomeSviluppo);
    await ricreaDatabase(db);
    chiudi = () => cancellaDatabase(db);
    scrivi(`database ${db.database} su ${db.host}:${db.port}`);
  } else {
    const container = await avviaContainer();
    if (!container) {
      if (process.env.CI) {
        throw new Error('In CI servono Docker o FIDELITY_TEST_DB_URL: i test d\'integrazione non si saltano');
      }
      scrivi('saltati: imposta FIDELITY_TEST_DB_URL (database che finisce in _test) o avvia Docker');
      project.provide('databaseIntegrazione', null);
      return;
    }
    db = container.db;
    chiudi = container.ferma;
    scrivi(`container ${IMMAGINE_POSTGIS}`);
  }

  try {
    applicaMigrazioni(db);
  } catch (errore) {
    await chiudi();
    throw errore;
  }
  project.provide('databaseIntegrazione', db);
  return chiudi;
}
