import * as cluster from 'cluster';
import * as os from 'os';

/**
 * I processi di Olimpo in produzione (spec olimpo/processi-in-produzione).
 *
 * Prima Olimpo forkava un processo per ogni CPU di os.cpus() (in Docker quelle dell'host, decine su un
 * server grande), tutti nello stesso istante, e riforkava subito e all'infinito chi moriva: troppi pool
 * verso Postgres, synchronize e migrazioni in parallelo, processi che morivano all'avvio e altri che
 * restavano in piedi senza le cartelle di absolute_paths.
 *
 * Ora: al piu' OLIMPO_WORKERS processi (2 se manca, mai piu' delle CPU disponibili), avviati uno alla
 * volta (il successivo quando il precedente accetta richieste o termina), riavviati con un'attesa che
 * raddoppia a ogni terminazione ravvicinata, e nessun riavvio durante la chiusura.
 */

export const VARIABILE_WORKER = 'OLIMPO_WORKERS';
export const WORKER_PREDEFINITI = 2;
/** Un processo rimasto attivo almeno questo tempo azzera il conteggio delle terminazioni ravvicinate. */
export const VITA_STABILE_MS = 60_000;
/** Oltre questo tempo dalla richiesta di chiusura il primary esce comunque. */
export const TIMEOUT_CHIUSURA_MS = 15_000;

/** CPU che il processo puo' usare: availableParallelism dove c'e', altrimenti os.cpus(). */
export const cpuDisponibili = (): number =>
  Math.max(1, typeof os.availableParallelism === 'function' ? os.availableParallelism() : os.cpus().length);

/** Quanti processi avviare: OLIMPO_WORKERS se valido (mai piu' delle CPU), altrimenti 2. */
export const numeroWorker = (cpu: number, ambiente: Record<string, string | undefined> = process.env): number => {
  const configurati = Number.parseInt(ambiente[VARIABILE_WORKER] ?? '', 10);
  const richiesti = Number.isFinite(configurati) && configurati > 0 ? configurati : WORKER_PREDEFINITI;
  return Math.max(1, Math.min(richiesti, cpu));
};

/** Attesa prima di riavviare un processo: 1 s, raddoppia a ogni terminazione ravvicinata, fino a 30 s. */
export const ritardoRiavvioMs = (terminazioniRavvicinate: number): number => Math.min(1000 * 2 ** terminazioniRavvicinate, 30_000);

/** Il minimo del worker di Node che serve al primary. */
export interface WorkerOlimpo {
  id: number;
  process: { pid?: number; kill(segnale?: NodeJS.Signals): boolean | void };
  once(evento: 'listening', ascoltatore: () => void): unknown;
}

/** Cio' che il primary usa del modulo cluster, del processo e del tempo: sostituibile nei test. */
export interface AmbienteCluster {
  fork(env: Record<string, string>): WorkerOlimpo;
  suUscita(ascoltatore: (worker: WorkerOlimpo, codice: number | null, segnale: string | null) => void): void;
  suSegnale(segnale: NodeJS.Signals, ascoltatore: () => void): void;
  esci(codice: number): void;
  ora(): number;
  attendi(ms: number, azione: () => void): void;
  log(messaggio: string): void;
  errore(messaggio: string): void;
}

/**
 * Il primary: avvia `quanti` processi uno alla volta e li tiene in vita. Ogni processo ha un indice
 * (OLIMPO_WORKER_INDEX) che conserva quando viene riavviato.
 */
export const avviaPrimary = (amb: AmbienteCluster, quanti: number, ambiente: Record<string, string | undefined> = process.env): void => {
  const attivi = new Map<number, { indice: number; avviatoIl: number; worker: WorkerOlimpo }>();
  const ravvicinate = new Map<number, number>();
  const daAvviare: number[] = [];
  let inPartenza: number | null = null;
  let inChiusura = false;

  amb.log(`Olimpo in produzione: ${quanti} processi (${VARIABILE_WORKER}=${ambiente[VARIABILE_WORKER] ?? 'non impostata'})`);

  // Un processo alla volta: il successivo parte quando il precedente accetta richieste o termina
  const prossimo = () => {
    if (inChiusura || inPartenza !== null || daAvviare.length === 0) return;
    const indice = daAvviare.shift() as number;
    const worker = amb.fork({ OLIMPO_WORKER_INDEX: String(indice) });
    inPartenza = worker.id;
    attivi.set(worker.id, { indice, avviatoIl: amb.ora(), worker });
    worker.once('listening', () => {
      amb.log(`Processo ${indice} (pid ${worker.process.pid}) pronto`);
      if (inPartenza === worker.id) inPartenza = null;
      prossimo();
    });
  };

  const accoda = (indice: number) => {
    daAvviare.push(indice);
    prossimo();
  };

  amb.suUscita((worker, codice, segnale) => {
    const avviato = attivi.get(worker.id);
    attivi.delete(worker.id);
    if (inPartenza === worker.id) inPartenza = null;
    if (inChiusura) {
      if (attivi.size === 0) {
        amb.log('Tutti i processi sono terminati, uscita');
        amb.esci(0);
      }
      return;
    }
    if (!avviato) return;

    const stabile = amb.ora() - avviato.avviatoIl >= VITA_STABILE_MS;
    const precedenti = stabile ? 0 : (ravvicinate.get(avviato.indice) ?? 0);
    ravvicinate.set(avviato.indice, precedenti + 1);
    const ritardo = ritardoRiavvioMs(precedenti);
    amb.errore(
      `Processo ${avviato.indice} (pid ${worker.process.pid}) terminato (codice ${codice ?? '-'}, segnale ${segnale ?? '-'}): riavvio tra ${ritardo} ms`
    );
    amb.attendi(ritardo, () => {
      if (!inChiusura) accoda(avviato.indice);
    });
    prossimo();
  });

  const chiudi = (segnale: NodeJS.Signals) => {
    if (inChiusura) return;
    inChiusura = true;
    amb.log(`Ricevuto ${segnale}: chiusura dei processi`);
    if (attivi.size === 0) {
      amb.esci(0);
      return;
    }
    for (const { worker } of attivi.values()) worker.process.kill(segnale);
    amb.attendi(TIMEOUT_CHIUSURA_MS, () => {
      amb.errore('Processi non terminati in tempo: uscita forzata');
      amb.esci(1);
    });
  };
  amb.suSegnale('SIGTERM', () => chiudi('SIGTERM'));
  amb.suSegnale('SIGINT', () => chiudi('SIGINT'));

  for (let indice = 1; indice <= quanti; indice++) accoda(indice);
};

/** L'ambiente vero: modulo cluster di Node, segnali del processo, timer e console. */
const ambienteNode = (): AmbienteCluster => {
  const c = cluster as unknown as typeof import('cluster').default;
  return {
    fork: (env) => c.fork(env) as unknown as WorkerOlimpo,
    suUscita: (ascoltatore) => c.on('exit', (worker, codice, segnale) => ascoltatore(worker as unknown as WorkerOlimpo, codice, segnale)),
    suSegnale: (segnale, ascoltatore) => process.on(segnale, ascoltatore),
    esci: (codice) => process.exit(codice),
    ora: () => Date.now(),
    attendi: (ms, azione) => void setTimeout(azione, ms),
    log: (messaggio) => console.log(`[cluster] ${messaggio}`),
    errore: (messaggio) => console.error(`[cluster] ${messaggio}`),
  };
};

/**
 * In produzione: nel primary avvia i processi, in ogni processo esegue `avvia` (il bootstrap di Nest).
 * Un avvio che fallisce termina il processo con codice 1, e il primary lo riavvia con l'attesa crescente.
 */
export const avviaInCluster = (avvia: () => Promise<void>): void => {
  const c = cluster as unknown as typeof import('cluster').default;
  if (c.isPrimary) {
    const cpu = cpuDisponibili();
    console.log(`[cluster] CPU disponibili: ${cpu}`);
    avviaPrimary(ambienteNode(), numeroWorker(cpu));
    return;
  }
  avviaProcesso(avvia);
};

/** Esegue l'avvio di un processo: se fallisce lo scrive nel log ed esce con codice 1. */
export const avviaProcesso = (avvia: () => Promise<void>): void => {
  avvia().catch((errore) => {
    console.error(`Avvio di Olimpo non riuscito: ${(errore as Error)?.stack ?? errore}`);
    process.exit(1);
  });
};
