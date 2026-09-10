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

let client: Redis | null = null;
let redisStatus: RedisStatus = 'disabled';
let connectPromise: Promise<RedisStatus> | null = null;
let isClosing = false;

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

function markRedisUnavailable(message?: string): void {
  if (isClosing) return;

  setRedisStatus('unavailable', message);

  if (client) {
    client.disconnect();
    client = null;
  }
}

function createRedisClient(url: string): Redis {
  const redis = new Redis(url, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 0,
    connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
    retryStrategy: () => null,
  });

  redis.on('error', (error) => {
    markRedisUnavailable(getErrorMessage(error));
  });

  redis.on('end', () => {
    if (redisStatus === 'ready') {
      markRedisUnavailable('connection closed');
    }
  });

  return redis;
}

export async function initializeRedisClient(): Promise<RedisStatus> {
  const url = getRedisUrl();

  if (!url) {
    setRedisStatus('disabled');
    return 'disabled';
  }

  if (redisStatus === 'ready' && client?.status === 'ready') {
    return 'ready';
  }

  if (redisStatus === 'unavailable') {
    return 'unavailable';
  }

  if (connectPromise) {
    return connectPromise;
  }

  connectPromise = (async () => {
    const redis = createRedisClient(url);

    try {
      await redis.connect();
      await redis.ping();
      client = redis;
      setRedisStatus('ready');
      return 'ready';
    } catch (error) {
      redis.disconnect();
      markRedisUnavailable(getErrorMessage(error));
      return 'unavailable';
    } finally {
      connectPromise = null;
    }
  })();

  return connectPromise;
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

  if (client) {
    await client.quit().catch(() => client?.disconnect());
    client = null;
  }

  connectPromise = null;
  redisStatus = getRedisUrl() ? 'unavailable' : 'disabled';
  isClosing = false;
}
