import express, { Router } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Il modulo controlla PostgreSQL e Redis appena caricato: qui nessuno dei due
vi.mock('../../cache/redis.client.js', () => ({
  getRedisClient: () => null,
  getRedisStatus: () => 'disabled',
}));
vi.mock('../../../../core/db/SequelizeConnector.js', () => ({
  sequelize: { authenticate: async () => undefined },
}));

import { etichettaRoute, httpErrorsTotal, httpRequestsTotal, metricsMiddleware, ROUTE_NON_TROVATA } from '../metrics';

const UUID = '3f2b8c1e-9a4d-4e6f-b1c2-7d8e9f0a1b2c';

/** App come quella vera: metriche in testa, controller montati su /api con un Router. */
function creaApp() {
  const app = express();
  app.use(metricsMiddleware);
  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });
  const router = Router();
  router.get('/promo/:id', (req, res) => {
    res.json({ id: req.params.id });
  });
  router.delete('/promo/:id', (_req, res) => {
    res.status(403).json({ message: 'vietato' });
  });
  app.use('/api', router);
  return app;
}

async function etichetteRegistrate(): Promise<Array<Record<string, string | number>>> {
  const { values } = await httpRequestsTotal.get();
  return values.map(({ labels }) => labels as Record<string, string | number>);
}

beforeEach(() => {
  httpRequestsTotal.reset();
  httpErrorsTotal.reset();
});

describe('metriche HTTP: etichetta route', () => {
  it('usa il pattern della route, non il percorso con l\'UUID', async () => {
    const app = creaApp();

    await request(app).get(`/api/promo/${UUID}`).expect(200);
    await request(app).get('/api/promo/un-altro-id').expect(200);

    await vi.waitFor(async () => {
      expect(await etichetteRegistrate()).toEqual([
        { method: 'GET', route: '/api/promo/:id', status_code: '200' },
      ]);
    });
    const { values } = await httpRequestsTotal.get();
    expect(values[0].value).toBe(2);
    expect(JSON.stringify(values)).not.toContain(UUID);
  });

  it('una richiesta che nessuna route prende in carico finisce in "non_trovata"', async () => {
    const app = creaApp();

    await request(app).get(`/api/inesistente/${UUID}`).expect(404);

    await vi.waitFor(async () => {
      expect(await etichetteRegistrate()).toEqual([
        { method: 'GET', route: ROUTE_NON_TROVATA, status_code: '404' },
      ]);
    });
  });

  it('route montata sull\'app e errori: pattern anche nelle serie degli errori', async () => {
    const app = creaApp();

    await request(app).get('/health').expect(200);
    await request(app).delete(`/api/promo/${UUID}`).expect(403);

    await vi.waitFor(async () => {
      expect(await etichetteRegistrate()).toEqual(expect.arrayContaining([
        { method: 'GET', route: '/health', status_code: '200' },
        { method: 'DELETE', route: '/api/promo/:id', status_code: '403' },
      ]));
    });
    const errori = await httpErrorsTotal.get();
    expect(errori.values.map(({ labels }) => labels.route)).toEqual(['/api/promo/:id']);
  });

  it('etichettaRoute: base del router piu\' pattern, non_trovata senza route', () => {
    expect(etichettaRoute({} as express.Request)).toBe(ROUTE_NON_TROVATA);
    expect(etichettaRoute({ route: { path: '/x/:id' }, baseUrl: '/api' } as unknown as express.Request)).toBe('/api/x/:id');
  });
});
