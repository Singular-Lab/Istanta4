import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const log = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }));
vi.mock('../../logger', () => ({ log }));

const systemError = vi.hoisted(() => vi.fn());
vi.mock('../../services/AuditLogService', () => ({
  AuditLogService: { getInstance: () => ({ systemError }) },
}));

import { BusinessError } from '../../../../lib/errors/domain/BusinessError';
import { errorHandler } from '../errorHandler';
import { jsonGlobale } from '../jsonGrande';

function creaApp() {
  const app = express();
  app.use(jsonGlobale);
  app.post('/api/qualunque', (req, res) => {
    res.json({ ricevuto: req.body });
  });
  app.get('/api/guasto', () => {
    throw new Error('connessione al database: password errata per utente x');
  });
  app.get('/api/regola', () => {
    throw new BusinessError({ message: 'regola violata' });
  });
  app.use(errorHandler({ logger: (e) => log.error(String(e)) }));
  return app;
}

describe('errorHandler: corpo della richiesta non leggibile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('risponde 400 al JSON rotto, senza il testo interno di JSON.parse e senza INF_002', async () => {
    const res = await request(creaApp())
      .post('/api/v1/code/blocks/exec/start')
      .set('Content-Type', 'application/json')
      .send('{"code":"x","lang" "y"}');

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Corpo della richiesta non valido');
    expect(res.body.code).not.toBe('INF_002');
    expect(JSON.stringify(res.body)).not.toMatch(/position|Expected|JSON/);
  });

  it('non scrive errori di sistema nell\'audit e registra solo un avviso', async () => {
    await request(creaApp())
      .post('/api/qualunque')
      .set('Content-Type', 'application/json')
      .send('{"a":');

    expect(systemError).not.toHaveBeenCalled();
    expect(log.error).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledTimes(1);
  });

  it('risponde 413 a un corpo oltre il limite', async () => {
    const grande = JSON.stringify({ dati: 'x'.repeat(11 * 1024 * 1024) });
    const res = await request(creaApp())
      .post('/api/qualunque')
      .set('Content-Type', 'application/json')
      .send(grande);

    expect(res.status).toBe(413);
    expect(res.body.message).toBe('Corpo della richiesta troppo grande');
    expect(systemError).not.toHaveBeenCalled();
  });

  it('lascia passare il JSON valido', async () => {
    const res = await request(creaApp())
      .post('/api/qualunque')
      .set('Content-Type', 'application/json')
      .send({ a: 1 });

    expect(res.status).toBe(200);
    expect(res.body.ricevuto).toEqual({ a: 1 });
  });

  it('mantiene 500 e audit per un errore imprevisto', async () => {
    const res = await request(creaApp()).get('/api/guasto');

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('INF_002');
    expect(systemError).toHaveBeenCalledTimes(1);
    expect(log.error).toHaveBeenCalled();
  });

  it('mantiene lo stato degli errori applicativi', async () => {
    const res = await request(creaApp()).get('/api/regola');

    expect(res.status).toBe(422);
    expect(res.body.message).toBe('regola violata');
    expect(systemError).not.toHaveBeenCalled();
  });
});
