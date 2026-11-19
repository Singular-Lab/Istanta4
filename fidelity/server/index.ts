// entry-point.ts
// reflect-metadata is required for Inversify dependency injection
import 'reflect-metadata';
import '../lib/extension.js';
import cluster from 'cluster';
import { proteggiProcessoPrimario, startClusterIfNeeded } from './core/cluster';
import config from './core/config';
import { log } from './core/logger';
import { applicaMigrazioniAllAvvio } from './core/db/migrazioni/applicaMigrazioni';
import { preparaAccessiAllAvvio } from './core/accessi/migrazioneAccessi';
import { preparaConfigAllAvvio } from './core/inizializzazione/migrazioneConfig';
import { createActualServer } from './core/server';
import { ascoltaAvvisiFraWorker, inoltraAvvisiFraWorker } from './core/utils/avvisiFraWorker';
import { chiudiCanalePlugin, startWSServer } from './ws-server';

async function main() {
  try {
    if (config.NODE_ENV === 'production' || config.NODE_ENV === 'test') {
      cluster.schedulingPolicy = cluster.SCHED_RR;

      if (cluster.isPrimary) {
        // Un errore sfuggito a un gestore non deve chiudere il primary, e con lui tutti i worker
        proteggiProcessoPrimario();
        // Migrazioni dello schema una volta sola e prima dei worker: i worker partono con lo schema aggiornato
        await applicaMigrazioniAllAvvio();
        // Catalogo permessi e migrazione degli accessi: una volta sola, prima dei worker
        await preparaAccessiAllAvvio();
        // Configurazione collegata alla GDO del cliente e funzionalita' iniziali, prima dei worker
        await preparaConfigAllAvvio();
        log.info('Master process: avvio WebSocket server...');
        await startWSServer();
        log.info('Master process: WebSocket server pronto, fork dei worker HTTP...');
        // Le invalidazioni delle cache di un worker arrivano agli altri passando da qui
        inoltraAvvisiFraWorker();
        // Allo spegnimento si salvano gli eventi del plugin ancora in memoria
        await startClusterIfNeeded(createActualServer, { primaDiUscire: chiudiCanalePlugin });

      } else {
        log.info(`Worker ${process.pid}: avvio server HTTP...`);
        ascoltaAvvisiFraWorker();
        await startWSServer();
        await createActualServer();
        log.info(`Worker ${process.pid}: server HTTP pronto`);
      }

    } else {
      log.info('Modalità development: avvio single-process...');
      await applicaMigrazioniAllAvvio();
      await preparaAccessiAllAvvio();
      // Anche in sviluppo: senza, la configurazione non si collega alla GDO e le funzionalita' restano spente
      await preparaConfigAllAvvio();
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

// main intercetta da se' ogni errore e chiude il processo
void main();
