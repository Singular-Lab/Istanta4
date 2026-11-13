/**
 * Prova di avvio di Olimpo come nel container, senza Docker: `yarn build && yarn prova:avvio`.
 *
 * Su un PostgreSQL locale (OLIMPO_TEST_DB_URL, database *_test cancellato e ricreato) prepara la
 * tabella auth come sulle installazioni esistenti (tipo_utenti_finale a cinque valori) e le cartelle
 * di absolute_paths, che Olimpo legge all'avvio, su cartelle temporanee; avvia
 * `node dist/src/main.js` e controlla che:
 *   1. in produzione con OLIMPO_WORKERS=2 partano 2 processi, uno dopo l'altro, e nessuno termini;
 *   2. la migrazione 0001 venga applicata una volta sola, sul database di prova;
 *   3. PUT /olimpo/auth/getPassport rilasci il passaporto a un utente Marketing (era l'errore 22P02);
 *   4. con SIGTERM il primary chiuda i processi ed esca;
 *   5. senza la cartella VIDEO nessun processo accetti richieste, il log lo dica e le attese prima dei
 *      riavvii crescano (1 s, 2 s, 4 s).
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
/** Quanto si aspetta, al massimo, che un processo senza la cartella VIDEO arrivi all'attesa di 4 s. */
const OSSERVAZIONE_CARTELLA_MANCANTE_MS = 40_000;
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
  // Il primary aspetta i processi fino a 15 s prima di uscire comunque
  for (let i = 0; i < 200 && processo.exitCode === null && processo.signalCode === null; i++) await attendi(100);
  if (processo.exitCode === null && processo.signalCode === null) processo.kill('SIGKILL');
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
    const segreto = randomUUID();

    /** Avvia `node dist/src/main.js` come nel container; il log si accumula in `log`. */
    const avvia = async (ambiente: Record<string, string>) => {
      const porta = await portaLibera();
      log = '';
      // Le variabili passate qui vincono su quelle di olimpo/.env (ConfigModule non le sovrascrive)
      olimpo = spawn(process.execPath, [MAIN], {
        cwd: RADICE_OLIMPO,
        env: {
          ...process.env,
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
          ...ambiente,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      olimpo.stdout?.on('data', (d) => (log += String(d)));
      olimpo.stderr?.on('data', (d) => (log += String(d)));
      return `http://127.0.0.1:${porta}/olimpo`;
    };
    const risponde = (base: string) => fetch(`${base}/`).then(() => true, () => false);
    const conta = (testo: string) => log.split(testo).length - 1;

    // 1. In produzione con due processi, come nel container
    console.log('Avvio di dist/src/main.js in produzione con OLIMPO_WORKERS=2:');
    let base = await avvia({ NODE_ENV: 'production', OLIMPO_WORKERS: '2' });
    const inizio = Date.now();
    while (Date.now() - inizio < ATTESA_AVVIO_MS && conta(' pronto') < 2) {
      if (olimpo!.exitCode !== null) throw new Error(`Olimpo si e' fermato all'avvio (codice ${olimpo!.exitCode})`);
      await attendi(500);
    }
    controlla(await risponde(base), 'Olimpo risponde');
    controlla(log.includes('Olimpo in produzione: 2 processi'), 'il primary avvia 2 processi');
    controlla(conta(' pronto') === 2 && conta(') terminato') === 0, 'i 2 processi sono pronti, uno dopo l\'altro, e nessuno termina');
    controlla(conta(`Migrazioni del database applicate: ${MIGRAZIONE_ATTESA}`) === 1, `la migrazione ${MIGRAZIONE_ATTESA} e' applicata una volta sola`);

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

    await ferma(olimpo);
    controlla(olimpo!.exitCode !== null && log.includes('Tutti i processi sono terminati'), 'con SIGTERM il primary chiude i processi ed esce');

    // 2. Senza la cartella VIDEO: nessun processo accetta richieste, il log dice perche', i riavvii rallentano
    console.log('Avvio senza la cartella VIDEO in absolute_paths:');
    await conDatabase(prova, prova.database, (c) => c.query(`DELETE FROM absolute_paths WHERE tipo = 'VIDEO'`));
    base = await avvia({ NODE_ENV: 'production', OLIMPO_WORKERS: '2' });
    // Si aspetta la terza terminazione di un processo (attesa di 4 s): non dipende dalla velocita' della macchina
    const inizioMancante = Date.now();
    while (!log.includes('riavvio tra 4000 ms') && Date.now() - inizioMancante < OSSERVAZIONE_CARTELLA_MANCANTE_MS) {
      await attendi(250);
    }
    controlla(!(await risponde(base)), 'Olimpo non accetta richieste');
    controlla(log.includes('mancano le cartelle attive VIDEO'), 'il log dice che manca la cartella VIDEO');
    const attese = [...log.matchAll(/riavvio tra (\d+) ms/g)].map((m) => Number(m[1]));
    const primaDi = (ms: number) => attese.indexOf(ms);
    controlla(
      primaDi(1000) >= 0 && primaDi(1000) < primaDi(2000) && primaDi(2000) < primaDi(4000),
      `i riavvii aspettano sempre di piu': ${attese.map((ms) => `${ms / 1000} s`).join(', ')}`
    );
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
