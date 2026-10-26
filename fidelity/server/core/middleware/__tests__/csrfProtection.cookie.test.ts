import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../logger', () => ({ log: { warn: vi.fn(), debug: vi.fn() } }));
vi.mock('../../services/AuditLogService', () => ({
  AuditLogService: { getInstance: () => ({ csrfTokenInvalid: vi.fn() }) },
}));

import { csrfProtection } from '../csrfProtection';

const cookieCsrf = async () => {
  const app = express();
  app.get('/csrf-token', csrfProtection(), (_req, res) => { res.end(); });
  const res = await request(app).get('/csrf-token');
  return String(res.headers['set-cookie']);
};

describe('cookie CSRF', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('in produzione su https torna anche da un altro sito, come quello del plugin InDesign', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CLIENT_URL', 'https://www.istantademo.it');
    expect(await cookieCsrf()).toMatch(/Secure; SameSite=None/);
  });

  it('in sviluppo resta Strict', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('CLIENT_URL', 'http://localhost:5173');
    expect(await cookieCsrf()).toMatch(/SameSite=Strict/);
  });
});
