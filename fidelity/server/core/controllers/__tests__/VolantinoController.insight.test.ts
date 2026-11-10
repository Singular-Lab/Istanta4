import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TIPO_UTENTI } from '../../../../lib/enums';
import { NotFoundError } from '../../../../lib/errors';
import type { IVolantinoService } from '../../interfaces/IVolantinoService';

// GET /api/flyer-insights/:id: il permesso, la GDO della sessione passata al servizio (Superadmin e
// Agenzia senza GDO: tutte, o quella in ?gdo=; utente senza GDO: nessuna) e il 404 per un kit fuori ambito.

const permessi = vi.hoisted(() => ({ concessi: new Set<string>() }));
const anagrafica = vi.hoisted(() => ({ idGdo: 'gdo-sessione' as string | null }));

vi.mock('../../middleware/authMiddleware', () => ({
  authMiddleware: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock('../../middleware/permissionGuard', () => ({
  permissionGuard: (codice: string) => (_req: Request, res: Response, next: NextFunction) => {
    if (permessi.concessi.has(codice)) return next();
    res.status(403).json({ codice });
  },
}));

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../models', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  UtentiGDO: { findOne: vi.fn(async () => (anagrafica.idGdo ? { id_gdo_utentegdo: anagrafica.idGdo, id_ruolo_utente_gdo: null } : null)) },
}));

import { VolantinoController } from '../VolantinoController';

const servizio = () => ({
  getFlyerInsights: vi.fn(async (guidIdKitRuntime: string, _ambito?: unknown) => ({
    guidIdKitRuntime,
    contesto: { titolo: 'Volantino Nord', idPromo: 'p1' },
    totaleReferenze: 0,
    totalePagine: 0,
    riepilogoPagine: [],
    riepilogoReparti: [],
    riepilogoMeccaniche: [],
    referenze: [],
    pdf: null,
    box: [],
  })),
  prendiIVolantiniCaricatiDaDB: vi.fn(async () => []),
});

const creaApp = (volantinoService: ReturnType<typeof servizio>, tipo: TIPO_UTENTI = TIPO_UTENTI.GDO) => {
  const app = express();
  app.use((req, _res, next) => {
    req.session = { id_utente: 'u1', tipo_utente: tipo } as Request['session'];
    next();
  });
  new VolantinoController(volantinoService as unknown as IVolantinoService).registerRoutes(app);
  return app;
};

beforeEach(() => {
  vi.clearAllMocks();
  permessi.concessi = new Set();
  anagrafica.idGdo = 'gdo-sessione';
});

describe('GET /api/flyer-insights/:guidIdKitRuntime', () => {
  it('con materiali.visualizza restituisce il dettaglio di consultazione nella GDO della sessione', async () => {
    permessi.concessi.add('materiali.visualizza');
    const volantinoService = servizio();

    const res = await request(creaApp(volantinoService)).get('/api/flyer-insights/k1');

    expect(res.status).toBe(200);
    expect(res.body.contesto.titolo).toBe('Volantino Nord');
    expect(volantinoService.getFlyerInsights).toHaveBeenCalledWith('k1', { idGdo: 'gdo-sessione' }, expect.anything());
  });

  it('senza materiali.visualizza non interroga il servizio', async () => {
    const volantinoService = servizio();

    const res = await request(creaApp(volantinoService)).get('/api/flyer-insights/k1');

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ codice: 'materiali.visualizza' });
    expect(volantinoService.getFlyerInsights).not.toHaveBeenCalled();
  });

  it('un utente GDO legge la sua GDO anche se ne indica un\'altra', async () => {
    permessi.concessi.add('materiali.visualizza');
    const volantinoService = servizio();

    await request(creaApp(volantinoService)).get('/api/flyer-insights/k1?gdo=altra-gdo');

    expect(volantinoService.getFlyerInsights).toHaveBeenCalledWith('k1', { idGdo: 'gdo-sessione' }, expect.anything());
  });

  it('il Superadmin senza GDO legge tutte le GDO, o quella che indica', async () => {
    permessi.concessi.add('materiali.visualizza');
    anagrafica.idGdo = null;
    const volantinoService = servizio();
    const app = creaApp(volantinoService, TIPO_UTENTI.SUPERADMIN);

    await request(app).get('/api/flyer-insights/k1');
    await request(app).get('/api/flyer-insights/k1?gdo=gdo-scelta');

    expect(volantinoService.getFlyerInsights.mock.calls.map(chiamata => chiamata[1])).toEqual(['tutte', { idGdo: 'gdo-scelta' }]);
  });

  it('un utente senza GDO non legge i volantini di nessuna', async () => {
    permessi.concessi.add('materiali.visualizza');
    anagrafica.idGdo = null;
    const volantinoService = servizio();

    await request(creaApp(volantinoService, TIPO_UTENTI.CATEGORY)).get('/api/flyer-insights/k1');

    expect(volantinoService.getFlyerInsights.mock.calls[0][1]).toBe('nessuna');
  });

  it('un kit fuori dalla GDO risponde 404 come un kit inesistente', async () => {
    permessi.concessi.add('materiali.visualizza');
    const volantinoService = servizio();
    volantinoService.getFlyerInsights.mockRejectedValueOnce(
      new NotFoundError({ message: 'Volantino non trovato', entityType: 'RuntimeKit', entityId: 'k-altra-gdo' })
    );

    const res = await request(creaApp(volantinoService)).get('/api/flyer-insights/k-altra-gdo');

    expect(res.status).toBe(404);
    expect(volantinoService.getFlyerInsights).toHaveBeenCalledWith('k-altra-gdo', { idGdo: 'gdo-sessione' }, expect.anything());
  });
});
