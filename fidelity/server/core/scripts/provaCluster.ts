/**
 * Prova del cluster di produzione (spec processi-in-produzione): `yarn prova:cluster`.
 *
 * Avvia Fidelity come in produzione (node --import tsx server/index.ts, cluster con 2 worker) su un
 * database usa e getta e controlla che:
 *  1. i worker partano uno alla volta;
 *  2. un upgrade WebSocket con intestazione Host o indirizzo non validi, o chiuso dal client a meta',
 *     non fermi il primary;
 *  3. la chiusura da parte di PostgreSQL delle connessioni inattive (pg_terminate_backend, come in un
 *     riavvio del database) non fermi nessun processo;
 *  4. con SIGTERM il primary chiuda i worker ed esca con codice 0.
 *
 * Database: quello di FIDELITY_TEST_DB_URL (ambiente o .env) con il suffisso _test sostituito da
 * _cluster_test, creato all'inizio e cancellato alla fine. Il database di sviluppo non si tocca.
 * Redis spento (REDIS_URL vuota). Uscita 0 se tutti i controlli passano, 1 altrimenti.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';
import pg from 'pg';
import { TEST_ENV } from '../../__tests__/ambienteTest';

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const TIMEOUT_AVVIO_MS = 240_000;

const righe: string[] = [];
const esiti: Array<{ controllo: string; ok: boolean; dettaglio?: string }> = [];

const scrivi = (messaggio: string) => process.stdout.write(`[prova:cluster] ${messaggio}\n`);
const aspetta = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function registra(controllo: string, ok: boolean, dettaglio?: string): void {
  esiti.push({ controllo, ok, dettaglio });
  scrivi(`${ok ? 'OK ' : 'NO '} ${controllo}${dettaglio ? ` (${dettaglio})` : ''}`);
}

interface Database { host: string; port: number; user: string; password: string; database: string }

function databaseDiProva(): Database {
  const file = path.join(RADICE, '.env');
  const locale = existsSync(file) ? parse(readFileSync(file)) : {};
  const url = process.env.FIDELITY_TEST_DB_URL || locale.FIDELITY_TEST_DB_URL;
  if (!url) throw new Error('FIDELITY_TEST_DB_URL non impostata (ambiente o .env): serve un PostgreSQL con PostGIS');
  const indirizzo = new URL(url);
  const nome = decodeURIComponent(indirizzo.pathname.replace(/^\//, ''));
  if (!nome.endsWith('_test')) throw new Error(`FIDELITY_TEST_DB_URL deve indicare un database che finisce in _test, ora "${nome}"`);
  return {
    host: indirizzo.hostname,
    port: Number(indirizzo.port || 5432),
    user: decodeURIComponent(indirizzo.username),
    password: decodeURIComponent(indirizzo.password),
    database: nome.replace(/_test$/, '_cluster_test'),
  };
}

async function suPostgres(db: Database, istruzioni: (client: pg.Client) => string[]): Promise<void> {
  const client = new pg.Client({ ...db, database: 'postgres' });
  await client.connect();
  try {
    for (const sql of istruzioni(client)) await client.query(sql);
  } finally {
    await client.end();
  }
}

async function portaLibera(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as net.AddressInfo;
      server.close(() => resolve(port));
    });
  });
}

async function salute(porta: number): Promise<number | null> {
  try {
    const risposta = await fetch(`http://127.0.0.1:${porta}/health`, { signal: AbortSignal.timeout(5000) });
    return risposta.status;
  } catch {
    return null;
  }
}

/** Manda una richiesta grezza sulla porta e restituisce la prima riga della risposta (o null). */
function richiestaGrezza(porta: number, testo: string, opzioni: { resetSubito?: boolean; attesaMs?: number } = {}): Promise<string | null> {
  return new Promise(resolve => {
    const socket = net.connect(porta, '127.0.0.1', () => {
      socket.write(testo);
      if (opzioni.resetSubito) {
        socket.resetAndDestroy();
        resolve(null);
      }
    });
    let ricevuto = '';
    socket.on('data', dati => { ricevuto += dati.toString('latin1'); });
    socket.on('error', () => resolve(ricevuto.split('\r\n')[0] || null));
    socket.on('close', () => resolve(ricevuto.split('\r\n')[0] || null));
    socket.setTimeout(opzioni.attesaMs ?? 3000, () => socket.destroy());
  });
}

const upgrade = (percorso: string, host: string, extra = '') =>
  `GET ${percorso} HTTP/1.1\r\nHost: ${host}\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n` +
  `Sec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n${extra}\r\n`;

/** Cookie di sessione firmato come express-session: la sessione non esiste, ma il pool la cerca. */
function cookieSessione(segreto: string): string {
  const id = 'prova-cluster-sessione';
  const firma = createHmac('sha256', segreto).update(id).digest('base64').replace(/=+$/, '');
  return `sid_fidelity_promo=${encodeURIComponent(`s:${id}.${firma}`)}`;
}

const vivo = (figlio: ChildProcess) => figlio.exitCode === null && figlio.signalCode === null;

async function main(): Promise<void> {
  const db = databaseDiProva();
  const portaHttp = await portaLibera();
  const portaWs = await portaLibera();

  scrivi(`database ${db.database} su ${db.host}:${db.port}, HTTP ${portaHttp}, WebSocket ${portaWs}`);
  await suPostgres(db, client => [
    `DROP DATABASE IF EXISTS ${client.escapeIdentifier(db.database)} WITH (FORCE)`,
    `CREATE DATABASE ${client.escapeIdentifier(db.database)}`,
  ]);

  const ambiente: NodeJS.ProcessEnv = {
    ...TEST_ENV,
    ...process.env,
    NODE_ENV: 'test',
    HTTP_WORKERS: '2',
    NODE_PORT: String(portaHttp),
    WS_PORT: String(portaWs),
    REDIS_URL: '',
    DB_POSTGRESQL_HOST: db.host,
    DB_POSTGRESQL_PORT: String(db.port),
    DB_POSTGRESQL_USER: db.user,
    DB_POSTGRESQL_PASSWORD: db.password,
    DB_POSTGRESQL_NAME: db.database,
  };

  const figlio = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], { cwd: RADICE, env: ambiente, stdio: ['ignore', 'pipe', 'pipe'] });
  const leggi = (flusso: NodeJS.ReadableStream) => {
    let resto = '';
    flusso.on('data', (dati: Buffer) => {
      const testo = resto + dati.toString('utf8');
      const parti = testo.split('\n');
      resto = parti.pop() ?? '';
      righe.push(...parti);
    });
  };
  leggi(figlio.stdout!);
  leggi(figlio.stderr!);

  try {
    // 1. Avvio: migrazioni sul database vuoto, poi due worker uno dopo l'altro
    const inizio = Date.now();
    let stato: number | null = null;
    let worker = 0;
    while (Date.now() - inizio < TIMEOUT_AVVIO_MS && vivo(figlio)) {
      stato = await salute(portaHttp);
      worker = righe.filter(r => r.includes('Server started')).length;
      if (stato === 200 && worker >= 2) break;
      await aspetta(1000);
    }
    registra('Fidelity parte in cluster e risponde a /health', stato === 200, `stato ${stato}`);
    registra('partono 2 worker', worker === 2, `${worker} worker in ascolto`);

    const avvii = righe.map((r, i) => (r.includes('avvio server HTTP') ? i : -1)).filter(i => i >= 0);
    const primoInAscolto = righe.findIndex(r => r.includes('Server started'));
    registra('il secondo worker parte dopo che il primo accetta richieste', avvii.length === 2 && avvii[1] > primoInAscolto);

    // 2. Upgrade malformati sul canale in tempo reale (gestiti dal primary)
    const hostNonValido = await richiestaGrezza(portaWs, upgrade('/ws/plugin-events?token=a&browserHash=b', 'x:99999'), { attesaMs: 15_000 });
    const indirizzoNonValido = await richiestaGrezza(portaWs, upgrade('//[', 'fidelity.test'));
    await richiestaGrezza(portaWs, upgrade('/ws/plugin-events?token=a&browserHash=b', 'fidelity.test'), { resetSubito: true });
    await aspetta(2000);
    registra('Host non valido: il primary resta attivo', vivo(figlio));
    registra('Host non valido: il token falso viene rifiutato con 401', (hostNonValido ?? '').includes('401'), hostNonValido ?? 'nessuna risposta');
    registra('indirizzo non valido rifiutato con 400', (indirizzoNonValido ?? '').includes('400'), indirizzoNonValido ?? 'nessuna risposta');
    registra('connessione chiusa dal client durante l\'upgrade: il primary resta attivo', vivo(figlio));
    registra('dopo gli upgrade malformati /health risponde', (await salute(portaHttp)) === 200);

    // 3. PostgreSQL chiude le connessioni inattive, anche quelle del pool delle sessioni
    const cookie = cookieSessione(String(ambiente.SESSION_SECRET));
    for (let i = 0; i < 4; i++) {
      await fetch(`http://127.0.0.1:${portaHttp}/health`, { headers: { cookie } }).catch(() => undefined);
    }
    await richiestaGrezza(portaWs, upgrade('/socket.io/?EIO=4&transport=websocket', 'fidelity.test', `Cookie: ${cookie}\r\n`));
    const prima = righe.length;
    const client = new pg.Client({ ...db });
    await client.connect();
    const chiuse = await client.query('SELECT count(*) FILTER (WHERE pg_terminate_backend(pid)) AS chiuse FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid()');
    await client.end();
    await aspetta(3000);
    const erroriPool = righe.slice(prima).filter(r => r.includes('connessione inattiva al database chiusa')).length;
    registra('connessioni inattive chiuse da PostgreSQL', Number(chiuse.rows[0].chiuse) > 0, `${chiuse.rows[0].chiuse} connessioni, ${erroriPool} errori del pool delle sessioni gestiti`);
    registra('dopo la chiusura delle connessioni nessun processo e\' terminato', vivo(figlio) && !righe.slice(prima).some(r => r.includes('terminato, riavvio del worker')));
    registra('dopo la chiusura delle connessioni /health risponde', (await salute(portaHttp)) === 200);

    // 4. Spegnimento
    figlio.kill('SIGTERM');
    const uscita = await Promise.race([
      new Promise<number | null>(resolve => figlio.once('exit', codice => resolve(codice))),
      aspetta(20_000).then(() => 'timeout' as const),
    ]);
    registra('con SIGTERM il primary chiude i worker ed esce con codice 0', uscita === 0, `uscita ${uscita}`);
  } finally {
    if (vivo(figlio)) figlio.kill('SIGKILL');
    await suPostgres(db, client => [`DROP DATABASE IF EXISTS ${client.escapeIdentifier(db.database)} WITH (FORCE)`]).catch(() => undefined);
  }
}

main()
  .catch(errore => registra('esecuzione della prova', false, errore instanceof Error ? errore.message : String(errore)))
  .finally(() => {
    const falliti = esiti.filter(e => !e.ok);
    if (falliti.length > 0) {
      scrivi('ultime righe del server:');
      for (const riga of righe.slice(-60)) process.stdout.write(`  ${riga}\n`);
    }
    scrivi(falliti.length === 0 ? `tutti i ${esiti.length} controlli passati` : `${falliti.length} controlli su ${esiti.length} non passati`);
    process.exit(falliti.length === 0 ? 0 : 1);
  });
