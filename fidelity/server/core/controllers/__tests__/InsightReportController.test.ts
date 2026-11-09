import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TIPO_UTENTI } from '../../../../lib/enums';
import { NotFoundError } from '../../../../lib/errors';
import type { ReportVolantino } from '../../../../lib/insightVolantino/report';
import type { AmbitoGdo } from '../../accessi/contestoAccesso';
import type { IReportVolantinoService } from '../../interfaces/IReportVolantinoService';
import type { IVolantinoService } from '../../interfaces/IVolantinoService';

// GET /api/flyer-insights/:idKit/report (spec insight-volantino): permesso, id controllato prima di
// leggere la sessione, ambito GDO passato al servizio, errori del servizio e convivenza con la scheda
// GET /api/flyer-insights/:id sullo stesso percorso base.

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

import { InsightReportController } from '../InsightReportController';
import { VolantinoController } from '../VolantinoController';

const ID_KIT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function creaApp(tipo: TIPO_UTENTI = TIPO_UTENTI.GDO) {
  const servizio = {
    report: vi.fn(async (idKit: string, _ambito: AmbitoGdo) => ({ idKit, titolo: 'Volantino di novembre', sezioni: [] } as unknown as ReportVolantino)),
  } satisfies IReportVolantinoService;
  const scheda = {
    getFlyerInsights: vi.fn(async (guidIdKitRuntime: string) => ({ guidIdKitRuntime } as never)),
    prendiIVolantiniCaricatiDaDB: vi.fn(async () => []),
  } satisfies IVolantinoService;
  const app = express();
  app.use((req, _res, next) => {
    req.session = { id_utente: 'u1', tipo_utente: tipo } as Request['session'];
    next();
  });
  new VolantinoController(scheda).registerRoutes(app);
  new InsightReportController(servizio).registerRoutes(app);
  return { app, servizio, scheda };
}

beforeEach(() => {
  vi.clearAllMocks();
  permessi.concessi = new Set(['materiali.visualizza']);
  anagrafica.idGdo = 'gdo-sessione';
});

describe('GET /api/flyer-insights/:idKit/report', () => {
  it('risponde con il report del servizio, chiesto con la GDO della sessione', async () => {
    const { app, servizio } = creaApp();

    const risposta = await request(app).get(`/api/flyer-insights/${ID_KIT}/report`);

    expect(risposta.status).toBe(200);
    expect(risposta.body).toEqual({ idKit: ID_KIT, titolo: 'Volantino di novembre', sezioni: [] });
    expect(servizio.report).toHaveBeenCalledWith(ID_KIT, { idGdo: 'gdo-sessione' });
  });

  it('senza materiali.visualizza e\' 403 e il servizio non viene interrogato', async () => {
    permessi.concessi = new Set(['volantini.visualizza']);
    const { app, servizio } = creaApp();

    const risposta = await request(app).get(`/api/flyer-insights/${ID_KIT}/report`);

    expect([risposta.status, risposta.body]).toEqual([403, { codice: 'materiali.visualizza' }]);
    expect(servizio.report).not.toHaveBeenCalled();
  });

  it('un id che non e\' un UUID e\' 400, senza interrogare il servizio', async () => {
    const { app, servizio } = creaApp();

    const risposta = await request(app).get('/api/flyer-insights/non-un-kit/report');

    expect(risposta.status).toBe(400);
    expect(servizio.report).not.toHaveBeenCalled();
  });

  it('la scheda del volantino resta sulla sua route', async () => {
    const { app, servizio, scheda } = creaApp();

    expect((await request(app).get(`/api/flyer-insights/${ID_KIT}`)).body).toEqual({ guidIdKitRuntime: ID_KIT });
    expect(servizio.report).not.toHaveBeenCalled();

    await request(app).get(`/api/flyer-insights/${ID_KIT}/report`);
    expect(scheda.getFlyerInsights).toHaveBeenCalledTimes(1);
    expect(servizio.report).toHaveBeenCalledTimes(1);
  });
});

describe('ambito GDO', () => {
  it('un utente GDO resta nella sua GDO anche se ne indica un\'altra', async () => {
    const { app, servizio } = creaApp(TIPO_UTENTI.GDO);

    await request(app).get(`/api/flyer-insights/${ID_KIT}/report?gdo=altra-gdo`);

    expect(servizio.report).toHaveBeenCalledWith(ID_KIT, { idGdo: 'gdo-sessione' });
  });

  it('il Superadmin senza GDO vede tutte le GDO, o quella che indica', async () => {
    anagrafica.idGdo = null;
    const { app, servizio } = creaApp(TIPO_UTENTI.SUPERADMIN);

    await request(app).get(`/api/flyer-insights/${ID_KIT}/report`);
    await request(app).get(`/api/flyer-insights/${ID_KIT}/report?gdo=gdo-indicata`);

    expect(servizio.report.mock.calls.map(chiamata => chiamata[1])).toEqual(['tutte', { idGdo: 'gdo-indicata' }]);
  });
});

describe('errori del servizio', () => {
  it('un kit fuori ambito o inesistente e\' 404', async () => {
    const { app, servizio } = creaApp();
    servizio.report.mockRejectedValueOnce(new NotFoundError({ message: 'Volantino non trovato', entityType: 'RuntimeKit', entityId: ID_KIT }));

    expect((await request(app).get(`/api/flyer-insights/${ID_KIT}/report`)).status).toBe(404);
  });

  it('un errore imprevisto e\' 500', async () => {
    const { app, servizio } = creaApp();
    servizio.report.mockRejectedValueOnce(new Error('connessione al database persa'));

    expect((await request(app).get(`/api/flyer-insights/${ID_KIT}/report`)).status).toBe(500);
  });
});
