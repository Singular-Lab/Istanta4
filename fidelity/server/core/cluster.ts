
import cluster, { type Worker } from 'cluster';
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

/** CPU che il processo puo' usare (os.cpus() conta anche quelle fuori dai limiti del container). */
const cpuDisponibili = (): number => Math.max(1, os.availableParallelism());

/**
 * Processi HTTP che servono l'app: in produzione e test il primary forka parseWorkerCount
 * worker (server/index.ts), in sviluppo gira un processo solo. Serve a chi divide un limite
 * di tutto il server fra i processi, come la coda di Nominatim.
 */
export const numeroWorkerHttp = (ambiente: string | undefined = process.env.NODE_ENV): number =>
  ambiente === 'production' || ambiente === 'test' ? parseWorkerCount(cpuDisponibili()) : 1;

/** Attesa prima di riforkare un worker: raddoppia a ogni crash ravvicinato, fino a 30 s. */
export const ritardoRiavvioMs = (crashRavvicinati: number): number =>
  Math.min(1000 * 2 ** crashRavvicinati, 30_000);

// Un worker vissuto almeno questo tempo azzera il conteggio dei crash ravvicinati
const VITA_STABILE_MS = 60_000;
// I worker forzano la propria uscita dopo 10 s (server.ts): oltre, esce comunque il primary
const TIMEOUT_CHIUSURA_MS = 15_000;

/**
 * Il primary tiene in vita i worker e ospita il canale in tempo reale (ws-server.ts): se cade, cadono
 * tutti i worker e il container riparte. Un errore che sfugge a un gestore (un messaggio malformato,
 * una connessione chiusa male) si scrive nel log e il primary resta attivo (spec processi-in-produzione,
 * "Richieste e messaggi malformati non fermano Fidelity"). I worker invece, su un errore non gestito,
 * si chiudono in modo controllato (server.ts) e il primary li riavvia.
 */
export function proteggiProcessoPrimario(processo: NodeJS.EventEmitter = process): void {
  processo.on('uncaughtException', (errore: unknown) => {
    log.error('Primary: eccezione non gestita, il processo resta attivo', errore);
  });
  processo.on('unhandledRejection', (motivo: unknown) => {
    log.error('Primary: promise rifiutata non gestita, il processo resta attivo', motivo);
  });
}

export interface OpzioniCluster {
  /** Lavoro del primary da finire prima di uscire, dopo la chiusura dei worker (es. il canale in tempo reale). */
  primaDiUscire?: () => Promise<void>;
  /** Solo per i test: il processo che riceve i segnali ed esce. */
  processo?: Pick<NodeJS.Process, 'on' | 'exit'>;
}

/**
 * Avvia il cluster solo in produzione, ora come Promise (spec processi-in-produzione, "Processi
 * limitati e avviati uno alla volta"): HTTP_WORKERS worker (2 di default, mai piu' delle CPU), uno
 * alla volta, ciascuno quando il precedente accetta richieste o e' terminato.
 */
export function startClusterIfNeeded(startServer: () => Promise<void> | void, opzioni: OpzioniCluster = {}): Promise<void> {
  const processo = opzioni.processo ?? process;
  return new Promise<void>((resolve, reject) => {
    if (cluster.isPrimary) {
      const cpuCount = cpuDisponibili();
      const workerCount = parseWorkerCount(cpuCount);

      log.info('Cluster HTTP workers configuration', {
        cpuCount,
        workerCount
      });

      // worker.id -> indice: chi muore torna con lo stesso WORKER_INDEX (il worker 1 ha cron e coda WhatsApp)
      const workerAttivi = new Map<number, { indice: number; avviatoIl: number }>();
      const crashRavvicinati = new Map<number, number>();
      let inChiusura = false;

      /** Riavvia il worker `indice` dopo l'attesa dovuta ai crash ravvicinati; restituisce l'attesa. */
      const programmaRiavvio = (indice: number, avviatoIl: number | undefined): number => {
        const crash = avviatoIl !== undefined && Date.now() - avviatoIl >= VITA_STABILE_MS ? 0 : (crashRavvicinati.get(indice) ?? 0);
        crashRavvicinati.set(indice, crash + 1);
        const ritardo = ritardoRiavvioMs(crash);
        setTimeout(() => {
          if (!inChiusura) avviaWorker(indice);
        }, ritardo);
        return ritardo;
      };

      /** Forka il worker `indice`; `pronto` si chiama una volta, quando accetta richieste o termina. */
      function avviaWorker(indice: number, pronto?: () => void): void {
        let worker: Worker;
        try {
          worker = cluster.fork({
            ...process.env,
            HTTP_WORKERS: String(workerCount),
            WORKER_INDEX: String(indice)
          });
        } catch (errore) {
          // Es. memoria esaurita: si riprova come per un worker terminato
          const ritardo = programmaRiavvio(indice, undefined);
          log.error(`Fork del worker ${indice} non riuscito, nuovo tentativo tra ${ritardo} ms`, errore);
          pronto?.();
          return;
        }
        workerAttivi.set(worker.id, { indice, avviatoIl: Date.now() });
        // Canale IPC chiuso o processo non creato: solo log, l'uscita la gestisce 'exit'
        worker.on('error', (errore) => {
          log.warn(`Worker ${indice}: errore del processo`, { errore: errore.message });
        });
        if (pronto) {
          let chiamato = false;
          const prosegui = () => {
            if (chiamato) return;
            chiamato = true;
            pronto();
          };
          worker.once('listening', prosegui);
          worker.once('exit', prosegui);
        }
      }

      const avviaDa = (indice: number) => {
        if (indice > workerCount || inChiusura) return;
        avviaWorker(indice, () => avviaDa(indice + 1));
      };
      avviaDa(1);

      cluster.on('exit', (worker, code, signal) => {
        const avviato = workerAttivi.get(worker.id);
        workerAttivi.delete(worker.id);

        if (inChiusura) {
          if (workerAttivi.size === 0) {
            log.info('Tutti i worker sono terminati, uscita del primary');
            esci(0);
          }
          return;
        }

        const indice = avviato?.indice ?? 1;
        const ritardo = programmaRiavvio(indice, avviato?.avviatoIl);
        log.error(`Worker ${worker.process.pid} terminato, riavvio del worker ${indice} tra ${ritardo} ms`, undefined, { code, signal });
      });

      // Lavoro del primary da finire prima di uscire: non blocca la chiusura oltre TIMEOUT_CHIUSURA_MS
      let finePrimary: Promise<void> = Promise.resolve();
      const esci = (codice: number) => {
        void finePrimary.finally(() => processo.exit(codice));
      };

      // docker stop / PM2 segnalano il primary: niente re-fork, il segnale passa ai worker
      const chiudi = (segnale: NodeJS.Signals) => {
        if (inChiusura) return;
        inChiusura = true;
        log.info(`Primary: ricevuto ${segnale}, chiusura dei worker...`);

        finePrimary = Promise.resolve()
          .then(() => opzioni.primaDiUscire?.())
          .catch((errore) => log.error('Primary: chiusura non completata', errore));

        if (workerAttivi.size === 0) {
          esci(0);
          return;
        }
        for (const worker of Object.values(cluster.workers ?? {})) {
          worker?.process.kill(segnale);
        }

        setTimeout(() => {
          log.error('Worker non terminati in tempo, uscita forzata del primary');
          processo.exit(1);
        }, TIMEOUT_CHIUSURA_MS);
      };
      processo.on('SIGTERM', () => chiudi('SIGTERM'));
      processo.on('SIGINT', () => chiudi('SIGINT'));
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
