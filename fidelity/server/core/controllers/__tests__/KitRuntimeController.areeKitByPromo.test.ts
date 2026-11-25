import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

// I20-1271: GET /api/getAreeKitByPromo, la route che Correggo4 chiama col bearer di Olympus per
// dividere per canale le promo attive. Qui conta come la route legge gli id e cosa risponde;
// l'autenticazione col bearer e' quella di getKitByPromo (authMiddleware.bearer.test.ts).

const passa = vi.hoisted(() => (_req: Request, _res: Response, next: NextFunction) => next());
const permessi = vi.hoisted(() => [] as string[]);
const middleware = vi.hoisted(() => [] as string[]);

vi.mock('../../middleware/authMiddleware', () => ({
  authMiddleware: passa,
  integrationAuthMiddleware: (req: Request, _res: Response, next: NextFunction) => {
    // dentro il router montato su /api req.path e' relativo: la route completa e' baseUrl + path
    middleware.push(`${req.method} ${req.baseUrl}${req.path}`);
    return next();
  },
}));

vi.mock('../../middleware/permissionGuard', () => ({
  permissionGuard: (codice: string) => {
    permessi.push(codice);
    return passa;
  },
}));

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import type { IDesignKitService } from '../../interfaces/IDesignKitService';
import type { IKitRuntimeService } from '../../interfaces/IKitRuntimeService';
import { KitRuntimeController } from '../KitRuntimeController';

const P1 = '11111111-1111-4111-8111-111111111111';
const P2 = '22222222-2222-4222-8222-222222222222';

function app(getAreeKitByPromo = vi.fn(async (ids: string[]) => Object.fromEntries(ids.map(id => [id, ['B', 'B1']])))) {
  const a = express();
  new KitRuntimeController({ getAreeKitByPromo } as unknown as IKitRuntimeService, {} as IDesignKitService).registerRoutes(a);
  return { app: a, getAreeKitByPromo };
}

describe('GET /api/getAreeKitByPromo', () => {
  it('e una route di integrazione con il permesso di lettura dei kit', async () => {
    const { app: a } = app();
    middleware.length = 0;

    await request(a).get(`/api/getAreeKitByPromo?idPromo=${P1}`);

    expect(middleware).toContain('GET /api/getAreeKitByPromo');
    expect(permessi).toContain('kit_runtime.visualizza');
  });

  it('legge gli id separati da virgola e ripetuti e risponde con le aree di ogni promo', async () => {
    const { app: a, getAreeKitByPromo } = app();

    const res = await request(a).get(`/api/getAreeKitByPromo?idPromo=${P1},${P2}&idPromo=${P1}`);

    expect(res.status).toBe(200);
    expect(getAreeKitByPromo).toHaveBeenCalledWith([P1, P2, P1]);
    expect(res.body).toEqual({ aree: { [P1]: ['B', 'B1'], [P2]: ['B', 'B1'] } });
  });

  it('senza id risponde con un elenco vuoto', async () => {
    const { app: a, getAreeKitByPromo } = app(vi.fn(async () => ({})));

    const res = await request(a).get('/api/getAreeKitByPromo');

    expect(res.status).toBe(200);
    expect(getAreeKitByPromo).toHaveBeenCalledWith([]);
    expect(res.body).toEqual({ aree: {} });
  });

  it('rifiuta piu di 200 promo in una richiesta', async () => {
    const { app: a, getAreeKitByPromo } = app();
    const troppi = Array.from({ length: 201 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);

    const res = await request(a).get(`/api/getAreeKitByPromo?idPromo=${troppi.join(',')}`);

    expect(res.status).toBe(400);
    expect(getAreeKitByPromo).not.toHaveBeenCalled();
  });
});
