import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const log = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }));
vi.mock('../logger', () => ({ log }));

beforeEach(() => {
  vi.clearAllMocks();
});

import {
  ascoltaAvvisiFraWorker,
  avvisaGliAltriWorker,
  inoltraAvvisiFraWorker,
  suAvvisoFraWorker,
  type CanaleWorker,
  type WorkerDestinatario,
} from './avvisiFraWorker';

/**
 * Spec processi-in-produzione, "Modifiche valide in tutti i processi": un worker che scarta una voce
 * di cache la fa scartare anche agli altri, passando dal primary.
 */

/** Un cluster con N worker: ogni worker e' un processo finto collegato al primary finto. */
function clusterFinto(numeroWorker: number) {
  const primary = new EventEmitter() as EventEmitter & { workers: Record<string, WorkerDestinatario> };
  primary.workers = {};
  const processi: Array<EventEmitter & CanaleWorker> = [];

  for (let id = 1; id <= numeroWorker; id++) {
    const processo = new EventEmitter() as EventEmitter & CanaleWorker;
    processo.connected = true;
    // Dal worker al primary
    processo.send = (messaggio, callback) => {
      primary.emit('message', { id }, messaggio);
      callback(null);
      return true;
    };
    processi.push(processo);
    // Dal primary al worker
    primary.workers[id] = {
      id,
      isConnected: () => processo.connected === true,
      send: (messaggio, callback) => {
        processo.emit('message', messaggio);
        callback(null);
        return true;
      },
    };
  }
  inoltraAvvisiFraWorker(primary);
  return { primary, processi };
}

describe('avvisi fra i worker', () => {
  it('l\'avviso di un worker arriva a tutti gli altri, non a chi l\'ha mandato', () => {
    const { processi } = clusterFinto(3);
    const ricevuti: Array<[number, unknown]> = [];
    processi.forEach((processo, indice) => {
      processo.on('message', (messaggio) => ricevuti.push([indice + 1, messaggio]));
    });

    avvisaGliAltriWorker('prova-inoltro', 'u-1', processi[0], true);

    expect(ricevuti.map(([worker]) => worker)).toEqual([2, 3]);
  });

  it('il worker che riceve l\'avviso esegue il gestore registrato per quel tipo', () => {
    const { processi } = clusterFinto(2);
    const scartati: unknown[] = [];
    suAvvisoFraWorker('prova-gestore', (dati) => scartati.push(dati));
    ascoltaAvvisiFraWorker(processi[1]);

    avvisaGliAltriWorker('prova-gestore', 'utente-7', processi[0], true);

    expect(scartati).toEqual(['utente-7']);
  });

  it('un gestore che lancia finisce nel log e non ferma il worker', () => {
    const { processi } = clusterFinto(2);
    suAvvisoFraWorker('prova-errore', () => { throw new Error('rotto'); });
    ascoltaAvvisiFraWorker(processi[1]);

    expect(() => avvisaGliAltriWorker('prova-errore', 1, processi[0], true)).not.toThrow();
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('prova-errore'), { errore: 'rotto' });
  });

  it('i messaggi che non sono avvisi (per esempio gli eventi del socket) si ignorano', () => {
    const { primary, processi } = clusterFinto(2);
    const ricevuti: unknown[] = [];
    processi[1].on('message', (m) => ricevuti.push(m));

    primary.emit('message', { id: 1 }, { type: 'socket_emit', event: 'x' });
    primary.emit('message', { id: 1 }, null);

    expect(ricevuti).toEqual([]);
  });

  it('senza cluster, o con il canale verso il primary chiuso, non manda nulla e non lancia', () => {
    const send = vi.fn();
    const chiuso: CanaleWorker = { connected: false, send };

    avvisaGliAltriWorker('prova', 1, { connected: true, send }, false);
    avvisaGliAltriWorker('prova', 1, chiuso, true);

    expect(send).not.toHaveBeenCalled();
  });

  it('un worker scollegato non riceve l\'avviso e gli altri si', () => {
    const { processi } = clusterFinto(3);
    processi[1].connected = false;
    const ricevuti: number[] = [];
    processi[1].on('message', () => ricevuti.push(2));
    processi[2].on('message', () => ricevuti.push(3));

    avvisaGliAltriWorker('prova-scollegato', 'x', processi[0], true);

    expect(ricevuti).toEqual([3]);
  });
});
