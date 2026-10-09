import express from 'express';
import crypto from 'node:crypto';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../authMiddleware', () => ({
  authMiddleware: (_req: any, _res: any, next: any) => next(),
}));

import config from '../../config';
import { GdoController } from '../../controllers/GdoController';
import { GDO } from '../../models';
import { RuoloUtenteGDO } from '../../models/ruolo_gdo';
import { GdoService } from '../../services/GdoService';
import { apiKeyAuthMiddleware } from '../apiKeyAuth';

/** Chiave nel formato emesso da Fidelity: uuid-timestamp cifrato con FICO_SECRET. */
function chiaveApiValida(): string {
  const key = crypto.createHash('sha256').update(config.FICO_SECRET).digest();
  const cipher = crypto.createCipheriv('aes-256-cbc', key, key.subarray(0, 16));
  return cipher.update(`${crypto.randomUUID().replace(/-/g, '')}-${Date.now()}`, 'utf8', 'hex') + cipher.final('hex');
}

describe('chiave API delle integrazioni esterne', () => {
  it('nelle statistiche e nei log arriva solo il prefisso della chiave', async () => {
    const chiave = chiaveApiValida();
    vi.spyOn(RuoloUtenteGDO, 'findOne').mockResolvedValue({
      id_ruolo_utente_gdo: 'r1',
      ruolo_ruolo_utente_gdo: 'Integrazione',
    } as any);

    let registrata: string | undefined;
    const app = express();
    app.get('/api/external/test', apiKeyAuthMiddleware, (req, res) => {
      registrata = (req as any).apiKeyInfo.apiKey;
      res.sendStatus(200);
    });
    app.use((err: any, _req: any, res: any, _next: any) => { res.status(err.httpStatus ?? 500).end(); });

    await request(app).get('/api/external/test').set('x-api-key', chiave).expect(200);

    expect(registrata).toBe(`${chiave.substring(0, 8)}...`);
  });

  it('l\'elenco dei ruoli non restituisce le chiavi API', async () => {
    const ruoli = {
      findAll: vi.fn().mockResolvedValue([
        { id_ruolo_utente_gdo: 'r1', ruolo_ruolo_utente_gdo: 'Integrazione', api_key_ruolo_utente_gdo: 'chiave-segreta', updatedat: new Date() },
      ]),
    };

    const risultato = await new GdoService({} as any, ruoli as any).getAllRuoliGDO();

    expect(risultato[0]).not.toHaveProperty('api_key');
    expect(JSON.stringify(risultato)).not.toContain('chiave-segreta');
  });
});

describe('icona SVG della GDO', () => {
  it('aperta direttamente nel browser non puo\' eseguire script', async () => {
    vi.spyOn(GDO, 'findByPk').mockResolvedValue({ icona_gdo: '<svg><script>alert(1)</script></svg>' } as any);
    const app = express();
    app.use((req, _res, next) => {
      (req as any).session = { id_utente: 'u1', id_gdo: 'g1' };
      next();
    });
    new GdoController({} as any, {} as any, {} as any).registerRoutes(app);

    const res = await request(app).get('/api/gdo/icona');

    expect(res.status).toBe(200);
    expect(res.headers['content-security-policy']).toContain('sandbox');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
