import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ redis: null as unknown, redisHits: 0 }));

// getRedisClient restituisce il client solo quando la connessione e' 'ready'.
vi.mock('../../../src/shared/cache/redis.client', () => ({
  getRedisClient: () => state.redis
}));

vi.mock('../RedisRateLimitStore', () => ({
  RedisRateLimitStore: class {
    async increment() {
      state.redisHits++;
      return { totalHits: 1, resetTime: new Date(Date.now() + 60_000) };
    }
    async decrement() {}
    async resetKey() {}
  }
}));

vi.mock('../../services/AuditLogService', () => ({
  AuditLogService: { getInstance: () => ({ rateLimitExceeded: vi.fn(), loginFailed: vi.fn() }) }
}));

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

import { apiRateLimiter } from '../rateLimiter';

function createApp() {
  const app = express();
  app.use(apiRateLimiter);
  app.get('/ping', (_req, res) => { res.sendStatus(200); });
  return app;
}

describe('rate limiter distribuito', () => {
  beforeEach(() => {
    state.redisHits = 0;
  });

  it('conta le richieste su Redis quando il client e\' pronto', async () => {
    state.redis = {};

    await request(createApp()).get('/ping').expect(200);

    expect(state.redisHits).toBe(1);
  });

  it('senza Redis usa lo store in memoria', async () => {
    state.redis = null;

    await request(createApp()).get('/ping').expect(200);

    expect(state.redisHits).toBe(0);
  });
});
