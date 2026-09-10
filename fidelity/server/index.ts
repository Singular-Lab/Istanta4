// entry-point.ts
// reflect-metadata is required for Inversify dependency injection
import 'reflect-metadata';
import '../lib/extension.js';
import cluster from 'cluster';
import { startClusterIfNeeded } from './core/cluster';
import config from './core/config';
import { log } from './core/logger';
import { createActualServer } from './core/server';
import { startWSServer } from './ws-server';

async function main() {
  try {
    if (config.NODE_ENV === 'production' || config.NODE_ENV === 'test') {
      cluster.schedulingPolicy = cluster.SCHED_RR;

      if (cluster.isPrimary) {
        log.info('Master process: avvio WebSocket server...');
        await startWSServer();
        log.info('Master process: WebSocket server pronto, fork dei worker HTTP...');
        await startClusterIfNeeded(createActualServer);

      } else {
        log.info(`Worker ${process.pid}: avvio server HTTP...`);
        await startWSServer();
        await createActualServer();
        log.info(`Worker ${process.pid}: server HTTP pronto`);
      }

    } else {
      log.info('Modalità development: avvio single-process...');
      await startWSServer();
      await createActualServer();
    }

    log.info('Applicazione avviata correttamente', { env: config.NODE_ENV });

  } catch (error: any) {
    log.error('Errore fatale durante l\'avvio del server', error instanceof Error ? error : null, {
      env: config.NODE_ENV,
    });
    process.exit(1);
  }
}

main();
