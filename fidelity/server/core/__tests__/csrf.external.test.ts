import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
// I middleware di sicurezza registrano diversi eventi di audit: qui non interessano
vi.mock('../services/AuditLogService', () => ({
  AuditLogService: { getInstance: () => new Proxy({}, { get: () => vi.fn() }) },
}));

import { applyErrorHandler, applyMiddlewares } from '../middlewares';

// Le route a sessione sotto /api/external (chiavi API, statistiche, template del plugin)
// erano esenti dal CSRF: un form di un altro sito poteva rigenerare la chiave API.
function createApp(session?: Record<string, unknown>) {
  const app = express();
  app.use((req, _res, next) => {
    (req as any).session = session;
    next();
  });
  applyMiddlewares(app);
  app.post('/api/external/generate-api-key', (_req, res) => { res.json({ ok: true }); });
  applyErrorHandler(app);
  return app;
}

describe('CSRF sulle route /api/external', () => {
  it('con la sessione e senza token CSRF la richiesta viene rifiutata', async () => {
    const res = await request(createApp({ id_utente: 'u1' })).post('/api/external/generate-api-key').send({});

    expect(res.status).toBe(403);
  });

  it('le chiamate del plugin con token effimero passano dal proprio controllo', async () => {
    const res = await request(createApp({ id_utente: 'u1' }))
      .post('/api/external/generate-api-key')
      .set('X-Ephemeral-Token', 't1')
      .send({});

    expect(res.status).toBe(200);
  });

  it('senza sessione il CSRF non serve: decide l\'autenticazione della route', async () => {
    const res = await request(createApp()).post('/api/external/generate-api-key').send({});

    expect(res.status).toBe(200);
  });
});
