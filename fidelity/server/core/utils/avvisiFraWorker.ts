import cluster from 'cluster';
import { log } from '../logger';

/**
 * Avvisi fra i worker del cluster (spec processi-in-produzione, "Modifiche valide in tutti i
 * processi"). Alcune cache stanno nella memoria del processo (passaporti Olimpo, stato delle
 * importazioni): quando un worker scarta una voce perche' il dato e' cambiato, lo stesso deve
 * succedere negli altri, altrimenti le richieste che arrivano li' usano il dato vecchio fino alla
 * scadenza della cache.
 *
 * Il worker manda l'avviso al primary via IPC; il primary lo inoltra a tutti gli altri worker, che
 * chiamano il gestore registrato per quel tipo. Senza cluster (sviluppo) non succede nulla: il
 * processo e' uno solo e la voce l'ha gia' scartata chi avvisa. Non serve Redis.
 */

const TIPO_MESSAGGIO = 'fp_avviso_worker';

interface MessaggioAvviso {
  type: typeof TIPO_MESSAGGIO;
  tipo: string;
  dati: unknown;
}

type Gestore = (dati: unknown) => void;

const gestori = new Map<string, Gestore>();

const eAvviso = (messaggio: unknown): messaggio is MessaggioAvviso =>
  typeof messaggio === 'object' && messaggio !== null
  && (messaggio as { type?: unknown }).type === TIPO_MESSAGGIO
  && typeof (messaggio as { tipo?: unknown }).tipo === 'string';

/** Registra cosa fare quando un altro worker manda un avviso di questo tipo. */
export function suAvvisoFraWorker(tipo: string, gestore: Gestore): void {
  gestori.set(tipo, gestore);
}

/** Il canale IPC verso il primary, come lo espone un processo worker. */
export interface CanaleWorker {
  connected?: boolean;
  send?: (messaggio: unknown, callback: (errore: Error | null) => void) => boolean;
}

/** Manda l'avviso agli altri worker. Non lancia mai: un avviso perso vale come la cache che scade. */
export function avvisaGliAltriWorker(
  tipo: string,
  dati: unknown,
  canale: CanaleWorker = process as unknown as CanaleWorker,
  eWorker: boolean = cluster.isWorker,
): void {
  if (!eWorker || typeof canale.send !== 'function' || !canale.connected) return;
  const messaggio: MessaggioAvviso = { type: TIPO_MESSAGGIO, tipo, dati };
  try {
    // Con la callback un canale chiuso non diventa un evento 'error' del processo
    canale.send(messaggio, (errore) => {
      if (errore) log.warn(`Avviso "${tipo}" agli altri worker non inviato`, { errore: errore.message });
    });
  } catch (errore) {
    log.warn(`Avviso "${tipo}" agli altri worker non inviato`, { errore: errore instanceof Error ? errore.message : String(errore) });
  }
}

/** Nel worker: esegue i gestori per gli avvisi che arrivano dal primary. */
export function ascoltaAvvisiFraWorker(processo: NodeJS.EventEmitter = process): void {
  processo.on('message', (messaggio: unknown) => {
    if (!eAvviso(messaggio)) return;
    const gestore = gestori.get(messaggio.tipo);
    if (!gestore) return;
    try {
      gestore(messaggio.dati);
    } catch (errore) {
      log.warn(`Avviso "${messaggio.tipo}" da un altro worker non applicato`, {
        errore: errore instanceof Error ? errore.message : String(errore),
      });
    }
  });
}

/** Il worker come lo vede il primary: quanto serve per inoltrare un avviso. */
export interface WorkerDestinatario {
  id: number;
  isConnected: () => boolean;
  send: (messaggio: unknown, callback: (errore: Error | null) => void) => boolean;
}

/** Il cluster come lo vede il primary: i worker attivi e i loro messaggi. */
export interface ClusterPrimary {
  workers?: Record<string, WorkerDestinatario | undefined> | NodeJS.Dict<WorkerDestinatario>;
  on: (evento: 'message', ascoltatore: (worker: { id: number }, messaggio: unknown) => void) => unknown;
}

/** Nel primary: inoltra ogni avviso a tutti i worker tranne chi l'ha mandato. */
export function inoltraAvvisiFraWorker(cl: ClusterPrimary = cluster as unknown as ClusterPrimary): void {
  cl.on('message', (mittente, messaggio) => {
    if (!eAvviso(messaggio)) return;
    for (const worker of Object.values(cl.workers ?? {})) {
      if (!worker || worker.id === mittente.id || !worker.isConnected()) continue;
      try {
        worker.send(messaggio, (errore) => {
          if (errore) log.warn(`Avviso "${messaggio.tipo}" non inoltrato al worker ${worker.id}`, { errore: errore.message });
        });
      } catch (errore) {
        log.warn(`Avviso "${messaggio.tipo}" non inoltrato al worker ${worker.id}`, {
          errore: errore instanceof Error ? errore.message : String(errore),
        });
      }
    }
  });
}
