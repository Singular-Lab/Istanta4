/**
 * Esporta il database locale in docker/data/fidelity-dump.dump
 * usando il container postgres:16-alpine (non richiede pg_dump installato sul host).
 *
 * Uso: npm run db:export
 */
import { spawnSync } from 'child_process';
import dotenv from 'dotenv';
import { mkdirSync } from 'fs';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const host = process.env.DB_POSTGRESQL_HOST ?? 'localhost';
const port = process.env.DB_POSTGRESQL_PORT ?? '5432';
const user = process.env.DB_POSTGRESQL_USER ?? 'fidelity';
const password = process.env.DB_POSTGRESQL_PASSWORD ?? '';
const dbname = process.env.DB_POSTGRESQL_NAME ?? 'FIDELITY_PROMOTION';

const dataDir = path.resolve(process.cwd(), 'docker', 'data');
const dumpFile = 'fidelity-dump.dump';

mkdirSync(dataDir, { recursive: true });

// Converte il percorso Windows in formato compatibile con Docker
// Es: C:\Users\... → /c/Users/... (Docker Desktop su Windows lo accetta)
const dockerDataDir = process.platform === 'win32'
  ? dataDir.replace(/\\/g, '/').replace(/^([A-Z]):/, (_, l) => `/${l.toLowerCase()}`)
  : dataDir;

const isLocalhost = host === 'localhost' || host === '127.0.0.1' || host === '::1';

// Docker Desktop su Linux usa una VM: --network=host condivide la rete della VM,
// non quella dell'host reale. Rileviamo il contesto Docker per distinguere.
const dockerContextResult = spawnSync('docker', ['context', 'show'], { encoding: 'utf8' });
const isDockerDesktop = dockerContextResult.stdout.trim() === 'desktop-linux';

// --network=host funziona solo con Docker Engine nativo su Linux (non Docker Desktop).
const useHostNetwork = process.platform === 'linux' && isLocalhost && !isDockerDesktop;

// Docker Desktop (macOS, Windows, Linux) espone host.docker.internal automaticamente.
// Docker Engine nativo su Linux richiede --add-host per abilitarlo.
const dockerHost = isLocalhost
  ? (useHostNetwork ? '127.0.0.1' : 'host.docker.internal')
  : host;

const shouldAddHostGateway = process.platform === 'linux' && !isDockerDesktop && dockerHost === 'host.docker.internal';

console.log(`\n[db:export] Sorgente:  ${dbname}@${host}:${port}`);
console.log(`[db:export] Output:    docker/data/${dumpFile}`);
console.log(`[db:export] Metodo:    docker run postgis/postgis:17-3.4-alpine pg_dump\n`);
console.log(`[db:export] Target:    ${dockerHost}:${port}${useHostNetwork ? ' (network=host)' : ''}\n`);

const args = ['run', '--rm'];

if (useHostNetwork) {
  args.push('--network=host');
}

if (shouldAddHostGateway) {
  args.push('--add-host=host.docker.internal:host-gateway');
}

args.push(
  '-e', `PGPASSWORD=${password}`,
  '-v', `${dockerDataDir}:/dump`,
  'postgis/postgis:17-3.4-alpine',
  'pg_dump',
  '-h', dockerHost,
  '-p', port,
  '-U', user,
  '-d', dbname,
  '--no-owner',
  '--no-privileges',
  '--format=custom',
  '-f', `/dump/${dumpFile}`,
);

const result = spawnSync('docker', args, { stdio: 'inherit' });

if (result.error) {
  console.error('[db:export] ❌ Errore di avvio Docker:', result.error.message);
  console.error('Assicurati che Docker Desktop sia avviato.');
  process.exit(1);
}

if (result.status !== 0) {
  console.error(`[db:export] ❌ pg_dump fallito (exit ${result.status}).`);
  console.error('Verifica che le credenziali in .env siano corrette e che il DB sia raggiungibile.');
  process.exit(1);
}

console.log(`\n[db:export] ✅ Dump salvato in docker/data/${dumpFile}`);
console.log('[db:export] Ora avvia Docker con:\n\n    npm run dev:docker\n');
console.log('[db:export] Il dump verrà ripristinato automaticamente al primo avvio di postgres.\n');
