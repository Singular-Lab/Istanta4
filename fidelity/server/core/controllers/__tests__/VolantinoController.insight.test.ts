import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IVolantinoService } from '../../interfaces/IVolantinoService';
import { VolantinoController } from '../VolantinoController';

const permessi = vi.hoisted(() => ({ concessi: new Set<string>() }));

vi.mock('../../middleware/authMiddleware', () => ({
  authMiddleware: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock('../../middleware/permissionGuard', () => ({
  permissionGuard: (codice: string) => (_req: Request, res: Response, next: NextFunction) => {
    if (permessi.concessi.has(codice)) return next();
    res.status(403).json({ codice });
  },
}));

const servizio = (): IVolantinoService => ({
  getFlyerInsights: vi.fn(async (guidIdKitRuntime: string) => ({
    guidIdKitRuntime,
    contesto: { titolo: 'Volantino Nord', idPromo: 'p1' },
    totaleReferenze: 0,
    totalePagine: 0,
    riepilogoPagine: [],
    riepilogoReparti: [],
    riepilogoMeccaniche: [],
    referenze: [],
  })),
  prendiIVolantiniCaricatiDaDB: vi.fn(async () => []),
});

const creaApp = (volantinoService: IVolantinoService) => {
  const app = express();
  new VolantinoController(volantinoService).registerRoutes(app);
  return app;
};

beforeEach(() => {
  permessi.concessi = new Set();
});

describe('GET /api/flyer-insights/:guidIdKitRuntime', () => {
  it('con materiali.visualizza restituisce il dettaglio di consultazione', async () => {
    permessi.concessi.add('materiali.visualizza');
    const volantinoService = servizio();

    const res = await request(creaApp(volantinoService)).get('/api/flyer-insights/k1');

    expect(res.status).toBe(200);
    expect(res.body.contesto.titolo).toBe('Volantino Nord');
    expect(volantinoService.getFlyerInsights).toHaveBeenCalledWith('k1');
  });

  it('senza materiali.visualizza non interroga il servizio', async () => {
    const volantinoService = servizio();

    const res = await request(creaApp(volantinoService)).get('/api/flyer-insights/k1');

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ codice: 'materiali.visualizza' });
    expect(volantinoService.getFlyerInsights).not.toHaveBeenCalled();
  });
});
