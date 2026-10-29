import express, { Router } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TIPO_UTENTI } from '../../../../lib/enums';

const log = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }));
vi.mock('../../logger', () => ({ log }));

import { contatoreChiamate, creaRouteDeprecata, INTERVALLO_AVVISI_MS } from '../routeDeprecata';

const UUID = '3f2b8c1e-9a4d-4e6f-b1c2-7d8e9f0a1b2c';

/** Router montato su /api come i controller, con una sessione gia' autenticata. */
function creaApp(ora: () => number) {
  const routeDeprecata = creaRouteDeprecata({ ora });
  const app = express();
  app.use((req, _res, next) => {
    (req as unknown as { session: object }).session = {
      id_utente: 'u-1',
      id_gdo: 'gdo-1',
      tipo_utente: TIPO_UTENTI.GDO,
      email: 'mario.rossi@esempio.it',
    };
    next();
  });
  const router = Router();
  router.get('/vecchia/:id', routeDeprecata, (req, res) => {
    res.json({ id: req.params.id });
  });
  router.delete('/altra', routeDeprecata, (_req, res) => {
    res.status(204).end();
  });
  app.use('/api', router);
  return app;
}

async function chiamateContate(): Promise<Array<{ labels: Record<string, string | number>; value: number }>> {
  const { values } = await contatoreChiamate.get();
  return values.map(({ labels, value }) => ({ labels: labels as Record<string, string | number>, value }));
}

beforeEach(() => {
  contatoreChiamate.reset();
});

afterEach(() => {
  for (const spia of Object.values(log)) {
    spia.mockReset();
  }
});

describe('routeDeprecata', () => {
  it('non cambia la risposta e conta ogni chiamata con il pattern della route', async () => {
    const app = creaApp(() => 1_000);

    const res = await request(app).get(`/api/vecchia/${UUID}`);
    await request(app).get('/api/vecchia/altro-id');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: UUID });
    expect(await chiamateContate()).toEqual([
      { labels: { method: 'GET', route: '/api/vecchia/:id' }, value: 2 },
    ]);
  });

  it('scrive al massimo un avviso per route nell\'intervallo, poi riporta le chiamate saltate', async () => {
    let adesso = 1_000;
    const app = creaApp(() => adesso);

    await request(app).get('/api/vecchia/1');
    await request(app).get('/api/vecchia/2');
    await request(app).get('/api/vecchia/3');
    expect(log.warn).toHaveBeenCalledTimes(1);

    adesso += INTERVALLO_AVVISI_MS;
    await request(app).get('/api/vecchia/4');

    expect(log.warn).toHaveBeenCalledTimes(2);
    expect(log.warn).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({ metodo: 'GET', route: '/api/vecchia/:id', chiamateNonRiportate: 2 }),
    );
  });

  it('route diverse hanno avvisi indipendenti', async () => {
    const app = creaApp(() => 1_000);

    await request(app).get('/api/vecchia/1');
    await request(app).delete('/api/altra');

    expect(log.warn).toHaveBeenCalledTimes(2);
    expect(log.warn.mock.calls.map(([, contesto]) => (contesto as { route: string }).route)).toEqual(['/api/vecchia/:id', '/api/altra']);
  });

  it('l\'avviso dice tipo utente e GDO, senza dati personali', async () => {
    const app = creaApp(() => 1_000);

    await request(app).get(`/api/vecchia/${UUID}`);

    expect(log.warn).toHaveBeenCalledWith(
      'Chiamata a una route senza chiamanti noti, candidata alla rimozione',
      expect.objectContaining({ tipoUtente: TIPO_UTENTI.GDO, idGdo: 'gdo-1', marcataIl: '2026-10-29' }),
    );
    const scritto = JSON.stringify(log.warn.mock.calls);
    expect(scritto).not.toContain('mario.rossi@esempio.it');
    expect(scritto).not.toContain(UUID);
  });
});
