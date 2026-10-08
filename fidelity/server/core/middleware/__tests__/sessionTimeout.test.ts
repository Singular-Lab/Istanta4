import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

const ONE_HOUR = 60 * 60 * 1000;

vi.mock('../../session', () => ({
  calculateSessionTimeout: () => ONE_HOUR
}));

vi.mock('../../services/AuditLogService', () => ({
  AuditLogService: { getInstance: () => ({ sessionExpired: vi.fn() }) }
}));

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

import { authMiddleware } from '../authMiddleware';
import { sessionSecurityLogger } from '../securityMiddleware';

/** Stessa sequenza dell'app: prima il logger globale di sessione, poi l'autenticazione. */
function createApp(lastActivity: Date) {
  const app = express();
  app.use((req, _res, next) => {
    (req as any).session = {
      id_utente: 'user-1',
      tipo_utente: 'GDO',
      lastActivity,
      cookie: {},
      destroy: (cb: (err?: unknown) => void) => cb()
    };
    next();
  });
  app.use(sessionSecurityLogger);
  app.get('/protetta', authMiddleware, (_req, res) => { res.sendStatus(200); });
  return app;
}

describe('timeout di inattivita della sessione', () => {
  it('scade dopo il timeout del ruolo anche passando dal logger di sessione', async () => {
    const res = await request(createApp(new Date(Date.now() - 2 * ONE_HOUR)))
      .get('/protetta')
      .set('Accept', 'application/json');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('SESSION_EXPIRED');
  });

  it('resta valida se l\'ultima attivita e recente', async () => {
    await request(createApp(new Date(Date.now() - 5 * 60 * 1000)))
      .get('/protetta')
      .set('Accept', 'application/json')
      .expect(200);
  });
});
