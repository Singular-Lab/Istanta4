
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

      for (let i = 0; i < workerCount; i++) {
        cluster.fork({
          ...process.env,
          HTTP_WORKERS: String(workerCount),
          WORKER_INDEX: String(i + 1)
        });
      }

      cluster.on('exit', (worker, code, signal) => {
        log.error(`Worker ${worker.process.pid} terminato`, { code, signal });
        cluster.fork({
          ...process.env,
          HTTP_WORKERS: String(workerCount),
          WORKER_INDEX: String(worker.id || 1)
        });
      });
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
