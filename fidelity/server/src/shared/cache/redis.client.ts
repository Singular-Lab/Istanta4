import Redis from 'ioredis';
import { log } from '../../../core/logger/index.js';

export type RedisStatus = 'disabled' | 'ready' | 'unavailable';

export interface RedisConnectionOptions {
  host: string;
  port: number;
  username?: string;
  password?: string;
  db?: number;
  connectTimeout: number;
  enableOfflineQueue: boolean;
  maxRetriesPerRequest: number;
  retryStrategy: () => null;
}

const REDIS_CONNECT_TIMEOUT_MS = 1_000;

/**
 * Attesa prima di un nuovo tentativo di connessione: raddoppia a ogni tentativo fallito, fino a 10 s.
 * Cosi' Redis torna in uso entro pochi secondi da quando risponde (spec processi-in-produzione,
 * "Interruzioni del database e di Redis superate senza riavvio"): prima, dopo il primo errore il
 * processo restava sui fallback locali fino al riavvio.
 */
export const ritardoRiconnessioneRedisMs = (tentativiFalliti: number): number =>
  Math.min(1000 * 2 ** tentativiFalliti, 10_000);

let client: Redis | null = null;
let redisStatus: RedisStatus = 'disabled';
let connectPromise: Promise<RedisStatus> | null = null;
let isClosing = false;
let timerRiconnessione: ReturnType<typeof setTimeout> | null = null;
let tentativiFalliti = 0;

function getRedisUrl(): string | null {
  const url = process.env.REDIS_URL?.trim();
  return url ? url : null;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function setRedisStatus(nextStatus: RedisStatus, message?: string): void {
  if (redisStatus === nextStatus) return;

  redisStatus = nextStatus;

  if (nextStatus === 'ready') {
    log.info('Redis disponibile', { context: 'Redis' });
    return;
  }

  if (nextStatus === 'unavailable') {
    log.warn('Redis non disponibile, fallback locali attivi', {
      context: 'Redis',
      message,
    });
  }
}

/** Nuovo tentativo di connessione fra poco, se non ce n'e' gia' uno in programma. */
function programmaRiconnessione(): void {
  if (isClosing || timerRiconnessione || !getRedisUrl()) return;

  const ritardo = ritardoRiconnessioneRedisMs(tentativiFalliti);
  timerRiconnessione = setTimeout(() => {
    timerRiconnessione = null;
    void connetti();
  }, ritardo);
  // Il tentativo in programma non tiene in vita il processo
  timerRiconnessione.unref?.();
}

/** `istanza`: il client che ha dato l'errore; quello di una connessione precedente non conta piu'. */
function markRedisUnavailable(message?: string, istanza?: Redis): void {
  if (isClosing) return;
  if (istanza && client && istanza !== client) return;

  setRedisStatus('unavailable', message);

  if (client) {
    client.disconnect();
    client = null;
  }
  programmaRiconnessione();
}

function createRedisClient(url: string): Redis {
  const redis = new Redis(url, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 0,
    connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
    // ioredis non riprova da se': i nuovi tentativi li programma programmaRiconnessione
    retryStrategy: () => null,
  });

  redis.on('error', (error) => {
    markRedisUnavailable(getErrorMessage(error), redis);
  });

  redis.on('end', () => {
    if (redisStatus === 'ready') {
      markRedisUnavailable('connection closed', redis);
    }
  });

  return redis;
}

/** Un tentativo di connessione; piu' chiamate contemporanee ne fanno partire uno solo. */
function connetti(): Promise<RedisStatus> {
  const url = getRedisUrl();
  if (!url) {
    setRedisStatus('disabled');
    return Promise.resolve('disabled');
  }

  if (connectPromise !== null) {
    return connectPromise;
  }

  connectPromise = (async () => {
    const redis = createRedisClient(url);

    try {
      await redis.connect();
      await redis.ping();
      if (isClosing) {
        redis.disconnect();
        return 'unavailable';
      }
      client = redis;
      tentativiFalliti = 0;
      setRedisStatus('ready');
      return 'ready';
    } catch (error) {
      redis.disconnect();
      // Il prossimo tentativo parte dopo 1 s, poi 2, 4, 8 e 10 s
      markRedisUnavailable(getErrorMessage(error));
      tentativiFalliti++;
      return 'unavailable';
    } finally {
      connectPromise = null;
    }
  })();

  return connectPromise;
}

export async function initializeRedisClient(): Promise<RedisStatus> {
  if (!getRedisUrl()) {
    setRedisStatus('disabled');
    return 'disabled';
  }

  if (redisStatus === 'ready' && client?.status === 'ready') {
    return 'ready';
  }

  return connetti();
}

export function getRedisClient(): Redis | null {
  if (!getRedisUrl()) {
    setRedisStatus('disabled');
    return null;
  }

  if (redisStatus !== 'ready' || client?.status !== 'ready') {
    return null;
  }

  return client;
}

export function getRedisStatus(): RedisStatus {
  if (!getRedisUrl()) return 'disabled';
  return redisStatus === 'disabled' ? 'unavailable' : redisStatus;
}

export function isRedisReady(): boolean {
  return getRedisClient() !== null;
}

export function getRedisConnectionOptions(): RedisConnectionOptions | null {
  if (!isRedisReady()) return null;

  const url = getRedisUrl();
  if (!url) return null;

  const parsed = new URL(url);
  const db = parsed.pathname ? Number.parseInt(parsed.pathname.slice(1), 10) : Number.NaN;

  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 6379,
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    db: Number.isFinite(db) ? db : undefined,
    connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 0,
    retryStrategy: () => null,
  };
}

export async function closeRedisClient(): Promise<void> {
  isClosing = true;

  if (timerRiconnessione) {
    clearTimeout(timerRiconnessione);
    timerRiconnessione = null;
  }
  tentativiFalliti = 0;

  if (client) {
    await client.quit().catch(() => client?.disconnect());
    client = null;
  }

  connectPromise = null;
  redisStatus = getRedisUrl() ? 'unavailable' : 'disabled';
  isClosing = false;
}
