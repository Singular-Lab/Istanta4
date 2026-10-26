
import cluster from 'cluster';
import os from 'os';
import { log } from './logger';

const parseWorkerCount = (cpuCount: number): number => {
  const configuredWorkers = Number.parseInt(process.env.HTTP_WORKERS ?? '', 10);
  if (Number.isFinite(configuredWorkers) && configuredWorkers > 0) {
    return Math.min(configuredWorkers, cpuCount);
  }

  // Default conservativo per non saturare il DB con troppi pool per processo.
  return Math.min(cpuCount, 2);
};

/** Attesa prima di riforkare un worker: raddoppia a ogni crash ravvicinato, fino a 30 s. */
export const ritardoRiavvioMs = (crashRavvicinati: number): number =>
  Math.min(1000 * 2 ** crashRavvicinati, 30_000);

// Un worker vissuto almeno questo tempo azzera il conteggio dei crash ravvicinati
const VITA_STABILE_MS = 60_000;
// I worker forzano la propria uscita dopo 10 s (server.ts): oltre, esce comunque il primary
const TIMEOUT_CHIUSURA_MS = 15_000;

// Avvia il cluster solo in produzione, ora come Promise
export function startClusterIfNeeded(startServer: () => Promise<void> | void): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (cluster.isPrimary) {
      const cpuCount = os.cpus().length;
      const workerCount = parseWorkerCount(cpuCount);

      log.info('Cluster HTTP workers configuration', {
        cpuCount,
        workerCount
      });

      // worker.id -> indice: chi muore torna con lo stesso WORKER_INDEX (il worker 1 ha cron e coda WhatsApp)
      const workerAttivi = new Map<number, { indice: number; avviatoIl: number }>();
      const crashRavvicinati = new Map<number, number>();
      let inChiusura = false;

      const avviaWorker = (indice: number) => {
        const worker = cluster.fork({
          ...process.env,
          HTTP_WORKERS: String(workerCount),
          WORKER_INDEX: String(indice)
        });
        workerAttivi.set(worker.id, { indice, avviatoIl: Date.now() });
      };

      for (let i = 1; i <= workerCount; i++) {
        avviaWorker(i);
      }

      cluster.on('exit', (worker, code, signal) => {
        const avviato = workerAttivi.get(worker.id);
        workerAttivi.delete(worker.id);

        if (inChiusura) {
          if (workerAttivi.size === 0) {
            log.info('Tutti i worker sono terminati, uscita del primary');
            process.exit(0);
          }
          return;
        }

        const indice = avviato?.indice ?? 1;
        const crash = avviato && Date.now() - avviato.avviatoIl >= VITA_STABILE_MS ? 0 : (crashRavvicinati.get(indice) ?? 0);
        crashRavvicinati.set(indice, crash + 1);
        const ritardo = ritardoRiavvioMs(crash);

        log.error(`Worker ${worker.process.pid} terminato, riavvio del worker ${indice} tra ${ritardo} ms`, { code, signal });
        setTimeout(() => {
          if (!inChiusura) avviaWorker(indice);
        }, ritardo);
      });

      // docker stop / PM2 segnalano il primary: niente re-fork, il segnale passa ai worker
      const chiudi = (segnale: NodeJS.Signals) => {
        if (inChiusura) return;
        inChiusura = true;
        log.info(`Primary: ricevuto ${segnale}, chiusura dei worker...`);

        if (workerAttivi.size === 0) process.exit(0);
        for (const worker of Object.values(cluster.workers ?? {})) {
          worker?.process.kill(segnale);
        }

        setTimeout(() => {
          log.error('Worker non terminati in tempo, uscita forzata del primary');
          process.exit(1);
        }, TIMEOUT_CHIUSURA_MS);
      };
      process.on('SIGTERM', () => chiudi('SIGTERM'));
      process.on('SIGINT', () => chiudi('SIGINT'));
      // Il master non deve risolvere la promise: la risolvono i worker
    } else {
      // Se startServer restituisce una Promise, aspetta che sia completata
      try {
        const result = startServer();
        if (result && typeof (result as Promise<void>).then === 'function') {
          (result as Promise<void>).then(resolve).catch(reject);
        } else {
          resolve();
        }
      } catch (err) {
        reject(err);
      }
    }
  });
}
