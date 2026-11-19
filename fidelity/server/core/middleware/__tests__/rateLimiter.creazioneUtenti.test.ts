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

import { MAX_UTENTI_CREATI_ORA, registrationRateLimiter } from '../rateLimiter';

/** Come in produzione: la sessione c'e' gia' quando arriva il limite (dopo authMiddleware). */
function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use((req, _res, next) => {
    const idUtente = req.get('X-Utente-Prova');
    (req as unknown as { session: object }).session = idUtente ? { id_utente: idUtente } : {};
    next();
  });
  app.post('/register-user', registrationRateLimiter, (_req, res) => { res.sendStatus(200); });
  return app;
}

const crea = (app: express.Express, idUtente: string, ip = '203.0.113.10') =>
  request(app).post('/register-user').set('X-Forwarded-For', ip).set('X-Utente-Prova', idUtente).send({});

// Il limiter e' unico per il modulo: ogni test usa amministratori suoi, per non condividere i contatori
describe('limite della creazione manuale degli utenti', () => {
  it('l\'amministratore crea il quarto utente nella stessa ora', async () => {
    const app = createApp();
    for (let i = 0; i < 4; i++) {
      await crea(app, 'admin-quarto').expect(200);
    }
  });

  it(`si ferma oltre ${MAX_UTENTI_CREATI_ORA} utenti all'ora, con l'errore di limite delle registrazioni`, async () => {
    const app = createApp();
    for (let i = 0; i < MAX_UTENTI_CREATI_ORA; i++) {
      await crea(app, 'admin-limite').expect(200);
    }

    const res = await crea(app, 'admin-limite');

    expect(res.status).toBe(429);
    expect(JSON.stringify(res.body)).toContain('registration');
  });

  it('il limite e\' per amministratore: un collega dallo stesso IP continua a creare', async () => {
    const app = createApp();
    for (let i = 0; i < MAX_UTENTI_CREATI_ORA; i++) {
      await crea(app, 'admin-pieno').expect(200);
    }

    await crea(app, 'admin-pieno').expect(429);
    await crea(app, 'admin-collega').expect(200);
  });
});
