import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TIPO_UTENTI } from '../../../../lib/enums';
import type { IAvanzamentoProduzioneService } from '../../interfaces/IAvanzamentoProduzioneService';
import type { IDashboardService } from '../../interfaces/IDashboardService';

// Lo stato delle lavorazioni e' produzione: la pagina Avanzamento produzione e il vecchio elenco dei
// kit in lavorazione della panoramica chiedono "kit_runtime.visualizza" e restano nella GDO della sessione.

const permessi = vi.hoisted(() => ({ concessi: new Set<string>() }));
const anagrafica = vi.hoisted(() => ({ idGdo: 'gdo-sessione' as string | null }));

vi.mock('../../middleware/authMiddleware', () => ({
  authMiddleware: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock('../../middleware/permissionGuard', () => ({
  permissionGuard: (codice: string) => (_req: Request, res: Response, next: NextFunction) => {
    if (permessi.concessi.has(codice)) {
      next();
      return;
    }
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

import { AvanzamentoProduzioneController } from '../AvanzamentoProduzioneController';
import { DashboardController } from '../DashboardController';

function creaApp(tipo: TIPO_UTENTI = TIPO_UTENTI.AGENZIA) {
  const avanzamento = { getAvanzamento: vi.fn(async (_idGdo: string | null, _req: Request) => ({ promozioni: [] })) } satisfies IAvanzamentoProduzioneService;
  const dashboard = {
    getVolantiniInCorso: vi.fn(),
    getVolantiniInLavorazione: vi.fn(async () => ({ totale: 0, inAttesa: 0, kit: [] })),
    getVolantiniPubblicatiInLavorazione: vi.fn(),
    getStoricoVolantini: vi.fn(),
  } satisfies IDashboardService;
  const app = express();
  app.use((req, _res, next) => {
    req.session = { id_utente: 'u1', tipo_utente: tipo } as Request['session'];
    next();
  });
  new AvanzamentoProduzioneController(avanzamento).registerRoutes(app);
  new DashboardController(dashboard).registerRoutes(app);
  return { app, avanzamento, dashboard };
}

beforeEach(() => {
  vi.clearAllMocks();
  permessi.concessi = new Set(['kit_runtime.visualizza']);
  anagrafica.idGdo = 'gdo-sessione';
});

describe('GET /api/produzione/avanzamento', () => {
  it('con "kit_runtime.visualizza" restituisce l\'avanzamento della GDO della sessione, qualunque GDO chieda il client', async () => {
    const { app, avanzamento } = creaApp();

    const res = await request(app).get('/api/produzione/avanzamento?gdo=altra-gdo');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ promozioni: [] });
    expect(avanzamento.getAvanzamento).toHaveBeenCalledWith('gdo-sessione', expect.anything());
  });

  it('senza "kit_runtime.visualizza" 403, come per un Category che consulta solo i dati', async () => {
    permessi.concessi = new Set(['materiali.visualizza']);
    const { app, avanzamento } = creaApp(TIPO_UTENTI.CATEGORY);

    const res = await request(app).get('/api/produzione/avanzamento');

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ codice: 'kit_runtime.visualizza' });
    expect(avanzamento.getAvanzamento).not.toHaveBeenCalled();
  });

  it('senza GDO il Superadmin vede tutte le promo; chi non lavora per piu\' GDO nessuna', async () => {
    anagrafica.idGdo = null;
    const superadmin = creaApp(TIPO_UTENTI.SUPERADMIN);
    expect((await request(superadmin.app).get('/api/produzione/avanzamento')).status).toBe(200);
    expect(superadmin.avanzamento.getAvanzamento).toHaveBeenCalledWith(null, expect.anything());

    const gdo = creaApp(TIPO_UTENTI.GDO);
    const res = await request(gdo.app).get('/api/produzione/avanzamento');
    expect(res.body).toEqual({ promozioni: [] });
    expect(gdo.avanzamento.getAvanzamento).not.toHaveBeenCalled();
  });
});

describe('GET /api/dashboard/volantini-in-lavorazione', () => {
  it('senza "kit_runtime.visualizza" rifiuta la richiesta', async () => {
    permessi.concessi = new Set();
    const { app, dashboard } = creaApp(TIPO_UTENTI.CATEGORY);

    const res = await request(app).get('/api/dashboard/volantini-in-lavorazione');

    expect(res.status).toBe(403);
    expect(dashboard.getVolantiniInLavorazione).not.toHaveBeenCalled();
  });

  it('con il permesso restituisce solo i kit delle promo della GDO della sessione', async () => {
    const { app, dashboard } = creaApp();

    const res = await request(app).get('/api/dashboard/volantini-in-lavorazione?id_area=a1');

    expect(res.status).toBe(200);
    expect(dashboard.getVolantiniInLavorazione).toHaveBeenCalledWith({ id_area: ['a1'] }, 'gdo-sessione');
  });

  it('un utente senza GDO che non lavora per piu\' GDO non riceve kit', async () => {
    anagrafica.idGdo = null;
    const { app, dashboard } = creaApp(TIPO_UTENTI.GDO);

    const res = await request(app).get('/api/dashboard/volantini-in-lavorazione');

    expect(res.body).toEqual({ totale: 0, inAttesa: 0, kit: [] });
    expect(dashboard.getVolantiniInLavorazione).not.toHaveBeenCalled();
  });
});
