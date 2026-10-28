import express from 'express';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../logger', () => ({ log: { warn: vi.fn(), debug: vi.fn() } }));
vi.mock('../../services/AuditLogService', () => ({
  AuditLogService: { getInstance: () => ({ csrfTokenInvalid: vi.fn() }) },
}));

import { csrfProtection, segretoCsrf } from '../csrfProtection';

// Il segreto di default era scritto nel codice: chiunque poteva firmare token validi
// nelle installazioni senza CSRF_SECRET.

function createApp() {
  const app = express();
  app.use(cookieParser());
  app.use(csrfProtection());
  app.get('/csrf', (_req, res) => { res.end(); });
  app.post('/azione', (_req, res) => { res.json({ ok: true }); });
  app.use((err: any, _req: any, res: any, _next: any) => { res.status(err.httpStatus ?? 500).end(); });
  return app;
}

const tokenFirmato = (segreto: string) => {
  const data = `${'a'.repeat(64)}:${Date.now()}`;
  return `${data}:${createHmac('sha256', segreto).update(data).digest('hex')}`;
};

describe('segreto dei token CSRF', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('senza CSRF_SECRET si ricava da SESSION_SECRET, non da un valore fisso', () => {
    vi.stubEnv('CSRF_SECRET', '');
    vi.stubEnv('SESSION_SECRET', 'sessione-1');
    const primo = segretoCsrf();
    vi.stubEnv('SESSION_SECRET', 'sessione-2');

    expect(primo).not.toBe(segretoCsrf());
    expect(primo).not.toBe('default-csrf-secret-change-in-production');
  });

  it('CSRF_SECRET, se configurato, prevale', () => {
    vi.stubEnv('CSRF_SECRET', 'csrf-dedicato');

    expect(segretoCsrf()).toBe('csrf-dedicato');
  });

  it('un token firmato col vecchio segreto di default viene rifiutato', async () => {
    vi.stubEnv('CSRF_SECRET', '');
    const token = tokenFirmato('default-csrf-secret-change-in-production');

    const res = await request(createApp())
      .post('/azione')
      .set('Cookie', `csrf-token=${encodeURIComponent(token)}`)
      .set('x-csrf-token', token);

    expect(res.status).toBe(403);
  });

  it('il token emesso dal server viene accettato', async () => {
    vi.stubEnv('CSRF_SECRET', '');
    const app = createApp();
    const emesso = await request(app).get('/csrf');
    const cookie = String(emesso.headers['set-cookie']).split(';')[0];
    const token = decodeURIComponent(cookie.split('=')[1]);

    const res = await request(app).post('/azione').set('Cookie', cookie).set('x-csrf-token', token);

    expect(res.status).toBe(200);
  });
});
