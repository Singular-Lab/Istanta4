import { EventEmitter } from 'node:events';
import os from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const log = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }));

vi.mock('../logger', () => ({ log }));

/** Un cluster di Node finto: i worker sono EventEmitter, uscita e 'listening' li decide il test. */
vi.mock('cluster', async () => {
  const { EventEmitter: Emettitore } = await import('node:events');

  class FintoWorker extends Emettitore {
    process: { pid: number; kill: (segnale?: string) => void };
    constructor(public id: number, public env: Record<string, string | undefined>) {
      super();
      this.process = { pid: 1000 + id, kill: () => undefined };
    }
  }

  class FintoCluster extends Emettitore {
    isPrimary = true;
    workers: Record<string, FintoWorker> = {};
    forks: FintoWorker[] = [];
    forkDaFallire = 0;
    private prossimoId = 1;

    fork(env: Record<string, string | undefined>) {
      if (this.forkDaFallire > 0) {
        this.forkDaFallire--;
        throw new Error('spawn ENOMEM');
      }
      const worker = new FintoWorker(this.prossimoId++, env);
      this.workers[worker.id] = worker;
      this.forks.push(worker);
      return worker;
    }

    azzera() {
      this.removeAllListeners();
      this.workers = {};
      this.forks = [];
      this.forkDaFallire = 0;
      this.prossimoId = 1;
    }
  }

  return { default: new FintoCluster() };
});

import cluster from 'cluster';
import { proteggiProcessoPrimario, startClusterIfNeeded } from '../cluster';

type Worker = EventEmitter & { id: number; env: Record<string, string | undefined>; process: { pid: number; kill: (s?: string) => void } };
const finto = cluster as unknown as EventEmitter & { forks: Worker[]; workers: Record<string, Worker>; forkDaFallire: number; azzera: () => void };

/** Il processo che riceve i segnali: i gestori restano qui invece che sul processo dei test. */
function processoFinto() {
  const gestori: Record<string, () => void> = {};
  return {
    gestori,
    on: vi.fn((evento: string, gestore: () => void) => { gestori[evento] = gestore; }),
    exit: vi.fn(),
  };
}

const indici = () => finto.forks.map(w => w.env.WORKER_INDEX);

/** Il worker termina: prima l'evento del worker, poi quello del cluster, come in Node. */
function termina(worker: Worker, codice = 1) {
  delete finto.workers[worker.id];
  worker.emit('exit', codice, null);
  finto.emit('exit', worker, codice, null);
}

beforeEach(() => {
  vi.clearAllMocks();
  finto.azzera();
  vi.useFakeTimers();
  vi.spyOn(os, 'availableParallelism').mockReturnValue(8);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

const avvia = (processo = processoFinto(), primaDiUscire?: () => Promise<void>) => {
  void startClusterIfNeeded(() => undefined, { processo: processo as never, primaDiUscire });
  return processo;
};

// Spec processi-in-produzione, "Processi limitati e avviati uno alla volta"
describe('avvio dei worker', () => {
  it('parte un worker alla volta: il successivo quando il precedente accetta richieste', () => {
    vi.stubEnv('HTTP_WORKERS', '3');
    avvia();

    expect(indici()).toEqual(['1']);
    finto.forks[0].emit('listening');
    expect(indici()).toEqual(['1', '2']);
    finto.forks[1].emit('listening');
    expect(indici()).toEqual(['1', '2', '3']);
    finto.forks[2].emit('listening');
    expect(indici()).toEqual(['1', '2', '3']);
  });

  it('senza HTTP_WORKERS su un server con molte CPU partono 2 worker e il log lo dice', () => {
    vi.stubEnv('HTTP_WORKERS', '');
    vi.spyOn(os, 'availableParallelism').mockReturnValue(32);
    avvia();
    finto.forks[0].emit('listening');
    finto.forks[1].emit('listening');

    expect(indici()).toEqual(['1', '2']);
    expect(log.info).toHaveBeenCalledWith('Cluster HTTP workers configuration', { cpuCount: 32, workerCount: 2 });
  });

  it('un worker che termina prima di accettare richieste fa partire il successivo e si riavvia dopo 1 s', () => {
    vi.stubEnv('HTTP_WORKERS', '2');
    avvia();

    termina(finto.forks[0]);
    expect(indici()).toEqual(['1', '2']);

    vi.advanceTimersByTime(999);
    expect(indici()).toEqual(['1', '2']);
    vi.advanceTimersByTime(1);
    expect(indici()).toEqual(['1', '2', '1']);
  });

  it('un worker che termina subito tre volte si riavvia dopo 1, 2 e 4 secondi', () => {
    vi.stubEnv('HTTP_WORKERS', '1');
    avvia();
    const attese: number[] = [];

    for (let volta = 0; volta < 3; volta++) {
      const prima = finto.forks.length;
      termina(finto.forks[finto.forks.length - 1]);
      let attesa = 0;
      while (finto.forks.length === prima) {
        vi.advanceTimersByTime(1000);
        attesa += 1000;
      }
      attese.push(attesa);
    }

    expect(attese).toEqual([1000, 2000, 4000]);
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining('riavvio del worker 1 tra 4000 ms'), undefined, { code: 1, signal: null });
  });

  it('un fork non riuscito non ferma il primary: si riprova e gli altri worker partono', () => {
    vi.stubEnv('HTTP_WORKERS', '2');
    finto.forkDaFallire = 1;

    expect(() => avvia()).not.toThrow();
    expect(indici()).toEqual(['2']);
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining('Fork del worker 1 non riuscito'), expect.any(Error));

    vi.advanceTimersByTime(1000);
    expect(indici()).toEqual(['2', '1']);
  });
});

describe('chiusura del primary', () => {
  it('con SIGTERM i worker ricevono il segnale, non si riavviano e il primary esce dopo il proprio lavoro', async () => {
    vi.stubEnv('HTTP_WORKERS', '2');
    let finito = false;
    const processo = avvia(processoFinto(), async () => { finito = true; });
    finto.forks[0].emit('listening');
    const kill = finto.forks.map(w => vi.spyOn(w.process, 'kill'));

    processo.gestori.SIGTERM();
    expect(kill.every(k => k.mock.calls[0]?.[0] === 'SIGTERM')).toBe(true);

    for (const worker of [...finto.forks]) termina(worker, 0);
    await vi.advanceTimersByTimeAsync(5000);

    expect(finto.forks).toHaveLength(2);
    expect(finito).toBe(true);
    expect(processo.exit).toHaveBeenCalledTimes(1);
    expect(processo.exit).toHaveBeenCalledWith(0);
  });
});

// Spec processi-in-produzione, "Richieste e messaggi malformati non fermano Fidelity"
describe('primary protetto dagli errori non gestiti', () => {
  it('un\'eccezione o una promise rifiutata finiscono nel log e il processo resta attivo', () => {
    const processo = new EventEmitter();
    const esci = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    proteggiProcessoPrimario(processo);

    processo.emit('uncaughtException', new TypeError('Invalid URL'));
    processo.emit('unhandledRejection', new Error('connessione chiusa'));

    expect(log.error).toHaveBeenCalledWith(expect.stringContaining('eccezione non gestita'), expect.any(TypeError));
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining('promise rifiutata'), expect.any(Error));
    expect(esci).not.toHaveBeenCalled();
  });
});
