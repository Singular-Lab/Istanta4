/**
 * Prova di avvio di Olimpo come nel container, senza Docker: `yarn build && yarn prova:avvio`.
 *
 * Su un PostgreSQL locale (OLIMPO_TEST_DB_URL, database *_test cancellato e ricreato) prepara la
 * tabella auth come sulle installazioni esistenti (tipo_utenti_finale a cinque valori) e le cartelle
 * di absolute_paths, che Olimpo legge all'avvio, su cartelle temporanee; avvia
 * `node dist/src/main.js` e controlla che:
 *   1. all'avvio la migrazione 0001 venga applicata, sul database di prova;
 *   2. Olimpo risponda;
 *   3. PUT /olimpo/auth/getPassport rilasci il passaporto a un utente Marketing (era l'errore 22P02).
 * Alla fine ferma Olimpo, elimina il database e le cartelle temporanee. Esce con 0 se tutto va bene.
 */
import { spawn, type ChildProcess } from 'child_process';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'fs';
import { createServer } from 'net';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { Client } from 'pg';
import { databaseDiProva, sqlCartelleAssolute, SQL_AUTH_STORICA, VARIABILE_DB_DI_PROVA, type DatabaseDiProva } from '../test/database-di-prova';

const RADICE_OLIMPO = resolve(__dirname, '..');
const MAIN = join(RADICE_OLIMPO, 'dist', 'src', 'main.js');
const ATTESA_AVVIO_MS = 120_000;
const MIGRAZIONE_ATTESA = '0001_tipi_utente_fidelity';

const client = (prova: DatabaseDiProva, database: string) =>
  new Client({ host: prova.host, port: prova.port, user: prova.utente, password: prova.password, database });

const conDatabase = async <T>(prova: DatabaseDiProva, database: string, lavoro: (c: Client) => Promise<T>): Promise<T> => {
  const c = client(prova, database);
  await c.connect();
  try {
    return await lavoro(c);
  } finally {
    await c.end();
  }
};

const portaLibera = (): Promise<number> =>
  new Promise((risolvi, rifiuta) => {
    const server = createServer();
    server.once('error', rifiuta);
    server.listen(0, '127.0.0.1', () => {
      const indirizzo = server.address();
      const porta = typeof indirizzo === 'object' && indirizzo ? indirizzo.port : 0;
      server.close(() => risolvi(porta));
    });
  });

const attendi = (ms: number) => new Promise((r) => setTimeout(r, ms));

const ferma = async (processo: ChildProcess | undefined) => {
  if (!processo || processo.exitCode !== null) return;
  processo.kill('SIGTERM');
  for (let i = 0; i < 50 && processo.exitCode === null; i++) await attendi(100);
  if (processo.exitCode === null) processo.kill('SIGKILL');
};

const controlla = (condizione: boolean, messaggio: string) => {
  if (!condizione) throw new Error(messaggio);
  console.log(`  ok  ${messaggio}`);
};

async function main(): Promise<void> {
  const prova = databaseDiProva();
  if (!prova) throw new Error(`Imposta ${VARIABILE_DB_DI_PROVA}, per esempio postgres://utente:password@localhost:5433/olimpo_test`);
  if (!existsSync(MAIN)) throw new Error(`Manca ${MAIN}: esegui prima yarn build`);

  const radice = mkdtempSync(join(tmpdir(), 'olimpo-prova-avvio-'));
  let olimpo: ChildProcess | undefined;
  let log = '';
  try {
    console.log(`Database di prova ${prova.database} su ${prova.host}:${prova.port}`);
    await conDatabase(prova, 'postgres', async (c) => {
      await c.query(`DROP DATABASE IF EXISTS "${prova.database}" WITH (FORCE)`);
      await c.query(`CREATE DATABASE "${prova.database}"`);
    });
    const cartelle = Object.fromEntries(
      ['estrazione', 'archivio', 'ftp', 'web', 'video', 'materiali'].map((nome) => [nome, join(radice, nome)])
    );
    Object.values(cartelle).forEach((cartella) => mkdirSync(cartella));
    await conDatabase(prova, prova.database, async (c) => {
      await c.query(SQL_AUTH_STORICA);
      await c.query(sqlCartelleAssolute(cartelle as { web: string; archivio: string; video: string; materiali: string }));
    });
    const porta = await portaLibera();
    const segreto = randomUUID();

    // Le variabili passate qui vincono su quelle di olimpo/.env (ConfigModule non le sovrascrive)
    olimpo = spawn(process.execPath, [MAIN], {
      cwd: RADICE_OLIMPO,
      env: {
        ...process.env,
        NODE_ENV: 'development',
        PORT: String(porta),
        DB_HOST: prova.host,
        DB_PORT: String(prova.port),
        DB_USER: prova.utente,
        DB_PASSWORD: prova.password,
        DB_NAME: prova.database,
        FICO_SECRET: segreto,
        PRIVATE_DASHBOARD_SECRET: randomUUID(),
        EXTRACTION_PATH: cartelle.estrazione,
        ARCHIVE_PATH: cartelle.archivio,
        FTP_ROOT: cartelle.ftp,
        OLIMPO_MIGRAZIONI_ALL_AVVIO: 'true',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    olimpo.stdout?.on('data', (d) => (log += String(d)));
    olimpo.stderr?.on('data', (d) => (log += String(d)));

    const base = `http://127.0.0.1:${porta}/olimpo`;
    const inizio = Date.now();
    let pronto = false;
    while (!pronto && Date.now() - inizio < ATTESA_AVVIO_MS) {
      if (olimpo.exitCode !== null) throw new Error(`Olimpo si e' fermato all'avvio (codice ${olimpo.exitCode})`);
      pronto = await fetch(`${base}/`).then(() => true, () => false);
      if (!pronto) await attendi(500);
    }
    console.log('Avvio di dist/src/main.js:');
    controlla(pronto, `Olimpo risponde sulla porta ${porta}`);
    controlla(log.includes(`Migrazioni del database applicate: ${MIGRAZIONE_ATTESA}`), `il log riporta la migrazione ${MIGRAZIONE_ATTESA} applicata`);

    const registrate = await conDatabase(prova, prova.database, (c) => c.query('SELECT nome FROM migrazioni_schema'));
    controlla(registrate.rows.some((r) => r.nome === MIGRAZIONE_ATTESA), `la migrazione e' registrata nel database di prova ${prova.database}`);

    const risposta = await fetch(`${base}/auth/getPassport`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'fico-secret': segreto },
      body: JSON.stringify({
        username: 'marketing@prova.test',
        tipoUtente: 'Marketing',
        origin: 'FP',
        campi_aggiuntivi: {
          nome: 'Marketing', cognome: 'Prova', email: 'marketing@prova.test', stato: 'ATTIVO',
          residenza: '', dataDiNascita: '2000-01-01', tipo: 'Marketing',
        },
        ruoli: [],
      }),
    });
    const passaporto = (await risposta.json()) as { esito: boolean; error: string; publicKey: string | null };
    controlla(passaporto.esito === true && !!passaporto.publicKey, `getPassport rilascia il passaporto a un utente Marketing${passaporto.error ? ` (${passaporto.error})` : ''}`);

    const utente = await conDatabase(prova, prova.database, (c) =>
      c.query(`SELECT tipo_utente FROM auth WHERE email = 'marketing@prova.test'`)
    );
    controlla(utente.rows[0]?.tipo_utente === 'Marketing', 'l\'utente e\' registrato in auth con il tipo Marketing');
    console.log('Prova di avvio riuscita');
  } catch (errore) {
    console.error(`Prova di avvio NON riuscita: ${(errore as Error).message}`);
    console.error('--- ultime righe del log di Olimpo ---');
    console.error(log.split('\n').slice(-40).join('\n'));
    process.exitCode = 1;
  } finally {
    await ferma(olimpo);
    await conDatabase(prova, 'postgres', (c) => c.query(`DROP DATABASE IF EXISTS "${prova.database}" WITH (FORCE)`)).catch((e) =>
      console.error(`Database di prova non eliminato: ${(e as Error).message}`)
    );
    rmSync(radice, { recursive: true, force: true });
  }
}

main().catch((errore) => {
  console.error((errore as Error).message);
  process.exitCode = 1;
});
