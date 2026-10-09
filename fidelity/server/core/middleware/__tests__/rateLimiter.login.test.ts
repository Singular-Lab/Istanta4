import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

// Senza Redis: store in memoria
vi.mock('../../../src/shared/cache/redis.client', () => ({ getRedisClient: () => null }));

vi.mock('../../services/AuditLogService', () => ({
  AuditLogService: { getInstance: () => ({ rateLimitExceeded: vi.fn(), loginFailed: vi.fn() }) },
}));

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { authEmailRateLimiter, authRateLimiter } from '../rateLimiter';

function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  // Login sempre fallito: ogni tentativo conta
  app.post('/login', authRateLimiter, authEmailRateLimiter, (_req, res) => { res.sendStatus(401); });
  return app;
}

describe('limite dei tentativi di login', () => {
  it('cambiare User-Agent non azzera il conteggio per IP', async () => {
    const app = createApp();
    for (let i = 0; i < 5; i++) {
      await request(app).post('/login')
        .set('X-Forwarded-For', '203.0.113.10')
        .set('User-Agent', `browser-${i}`)
        .send({ email: `utente${i}@esempio.it` })
        .expect(401);
    }

    const res = await request(app).post('/login')
      .set('X-Forwarded-For', '203.0.113.10')
      .set('User-Agent', 'browser-nuovo')
      .send({ email: 'altro@esempio.it' });

    expect(res.status).toBe(429);
  });

  it('cambiare IP non moltiplica i tentativi sullo stesso account', async () => {
    const app = createApp();
    for (let i = 0; i < 10; i++) {
      await request(app).post('/login')
        .set('X-Forwarded-For', `198.51.100.${i + 1}`)
        .send({ email: 'Bersaglio@Esempio.it ' })
        .expect(401);
    }

    const res = await request(app).post('/login')
      .set('X-Forwarded-For', '198.51.100.200')
      .send({ email: 'bersaglio@esempio.it' });

    expect(res.status).toBe(429);
  });
});
