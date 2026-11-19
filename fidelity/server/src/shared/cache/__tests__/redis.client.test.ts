import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../core/logger/index.js', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

/** ioredis finto: la connessione riesce o fallisce come decide il test. */
const redisFinto = vi.hoisted(() => ({ istanze: [] as Array<{ emit: (e: string, ...a: unknown[]) => boolean; status: string }>, raggiungibile: false }));

vi.mock('ioredis', async () => {
  const { EventEmitter } = await import('node:events');
  class FintoRedis extends EventEmitter {
    status = 'wait';
    constructor() {
      super();
      redisFinto.istanze.push(this);
    }
    async connect() {
      if (!redisFinto.raggiungibile) {
        this.status = 'end';
        throw new Error('connect ECONNREFUSED 127.0.0.1:6379');
      }
      this.status = 'ready';
    }
    async ping() {
      return 'PONG';
    }
    disconnect() {
      this.status = 'end';
    }
    async quit() {
      this.status = 'end';
      return 'OK';
    }
  }
  return { default: FintoRedis };
});

import {
  closeRedisClient,
  getRedisClient,
  getRedisStatus,
  initializeRedisClient,
  ritardoRiconnessioneRedisMs,
} from '../redis.client';

/**
 * Spec processi-in-produzione, "Interruzioni del database e di Redis superate senza riavvio": dopo
 * un'interruzione ogni processo torna a usare Redis entro 30 secondi, senza essere riavviato.
 */

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv('REDIS_URL', 'redis://redis:6379');
  redisFinto.istanze.length = 0;
  redisFinto.raggiungibile = false;
});

afterEach(async () => {
  await closeRedisClient();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('redis.client: riconnessione', () => {
  it('l\'attesa fra i tentativi raddoppia da 1 s fino a 10 s', () => {
    expect([0, 1, 2, 3, 4, 10].map(ritardoRiconnessioneRedisMs)).toEqual([1000, 2000, 4000, 8000, 10000, 10000]);
  });

  it('Redis non pronto all\'avvio: il processo lo usa appena risponde', async () => {
    expect(await initializeRedisClient()).toBe('unavailable');
    expect(getRedisClient()).toBeNull();

    redisFinto.raggiungibile = true;
    await vi.advanceTimersByTimeAsync(1000);

    expect(getRedisStatus()).toBe('ready');
    expect(getRedisClient()).not.toBeNull();
  });

  it('Redis che cade e torna: entro 30 s il processo lo usa di nuovo', async () => {
    redisFinto.raggiungibile = true;
    expect(await initializeRedisClient()).toBe('ready');
    const primo = getRedisClient();

    redisFinto.raggiungibile = false;
    redisFinto.istanze[0].emit('error', new Error('read ECONNRESET'));
    expect(getRedisStatus()).toBe('unavailable');
    expect(getRedisClient()).toBeNull();

    // Redis riparte dopo 20 s
    await vi.advanceTimersByTimeAsync(20_000);
    redisFinto.raggiungibile = true;
    await vi.advanceTimersByTimeAsync(10_000);

    expect(getRedisStatus()).toBe('ready');
    expect(getRedisClient()).not.toBeNull();
    expect(getRedisClient()).not.toBe(primo);
  });

  it('un errore del client vecchio non tocca la connessione nuova', async () => {
    redisFinto.raggiungibile = true;
    await initializeRedisClient();
    const vecchio = redisFinto.istanze[0];
    vecchio.emit('error', new Error('read ECONNRESET'));
    await vi.advanceTimersByTimeAsync(1000);
    expect(getRedisStatus()).toBe('ready');

    vecchio.emit('error', new Error('errore tardivo'));

    expect(getRedisStatus()).toBe('ready');
    expect(getRedisClient()).not.toBeNull();
  });

  it('dopo la chiusura non si riprova piu\'', async () => {
    await initializeRedisClient();
    await closeRedisClient();
    const istanze = redisFinto.istanze.length;

    redisFinto.raggiungibile = true;
    await vi.advanceTimersByTimeAsync(60_000);

    expect(redisFinto.istanze).toHaveLength(istanze);
  });
});
