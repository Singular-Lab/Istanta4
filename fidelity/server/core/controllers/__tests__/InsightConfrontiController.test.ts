import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TIPO_UTENTI } from '../../../../lib/enums';
import { BadRequestError, NotFoundError } from '../../../../lib/errors';
import type { AmbitoGdo } from '../../accessi/contestoAccesso';
import type { IInsightConfrontiService } from '../../interfaces/IInsightConfrontiService';
import type { IVolantinoService } from '../../interfaces/IVolantinoService';

// Le API dei confronti degli insight del volantino: permesso, parametri controllati prima di leggere
// la sessione, ambito GDO passato al servizio, errori del servizio e convivenza con la scheda
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

import { InsightConfrontiController } from '../InsightConfrontiController';
import { VolantinoController } from '../VolantinoController';

const ID_KIT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ID_ALTRA = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function servizioFinto() {
  return {
    confronti: vi.fn(async (_idKit: string, _ambito: AmbitoGdo) => ({ edizionePrecedente: null, varianti: [] })),
    differenzeVarianti: vi.fn(async (idKit: string, idAltra: string, _ambito: AmbitoGdo) => ({ qui: { idKit }, altra: { idKit: idAltra } } as never)),
    viaggioProdotto: vi.fn(async (_idKit: string, chiave: string, _ambito: AmbitoGdo) => ({ chiave, nome: 'Mozzarella', marca: null, formato: null, foto: [], tappe: [] })),
  } satisfies IInsightConfrontiService;
}

function creaApp(tipo: TIPO_UTENTI = TIPO_UTENTI.GDO) {
  const confronti = servizioFinto();
  const scheda = {
    getFlyerInsights: vi.fn(async (guidIdKitRuntime: string) => ({ guidIdKitRuntime } as never)),
    prendiIVolantiniCaricatiDaDB: vi.fn(async () => []),
  } satisfies IVolantinoService;
  const app = express();
  app.use((req, _res, next) => {
    req.session = { id_utente: 'u1', tipo_utente: tipo } as Request['session'];
    next();
  });
  // Nello stesso ordine di routes.ts: prima la scheda, poi i confronti
  new VolantinoController(scheda).registerRoutes(app);
  new InsightConfrontiController(confronti).registerRoutes(app);
  return { app, confronti, scheda };
}

beforeEach(() => {
  vi.clearAllMocks();
  permessi.concessi = new Set(['materiali.visualizza']);
  anagrafica.idGdo = 'gdo-sessione';
});

describe('permessi', () => {
  it('senza materiali.visualizza nessuna delle tre API interroga il servizio', async () => {
    permessi.concessi = new Set(['volantini.visualizza', 'promo.visualizza']);
    const { app, confronti } = creaApp();

    for (const percorso of [
      `/api/flyer-insights/${ID_KIT}/confronti`,
      `/api/flyer-insights/${ID_KIT}/varianti/${ID_ALTRA}`,
      `/api/flyer-insights/${ID_KIT}/prodotti/c-123`,
    ]) {
      const risposta = await request(app).get(percorso);
      expect([risposta.status, risposta.body], percorso).toEqual([403, { codice: 'materiali.visualizza' }]);
    }
    expect(confronti.confronti).not.toHaveBeenCalled();
    expect(confronti.differenzeVarianti).not.toHaveBeenCalled();
    expect(confronti.viaggioProdotto).not.toHaveBeenCalled();
  });
});

describe('le tre API', () => {
  it('confronti, varianti e viaggio arrivano al servizio con i parametri e la GDO della sessione', async () => {
    const { app, confronti } = creaApp();

    const risposte = await Promise.all([
      request(app).get(`/api/flyer-insights/${ID_KIT}/confronti`),
      request(app).get(`/api/flyer-insights/${ID_KIT}/varianti/${ID_ALTRA}`),
      request(app).get(`/api/flyer-insights/${ID_KIT}/prodotti/${encodeURIComponent('d-TW96emFyZWxsYQ~1.2_x')}`),
    ]);

    expect(risposte.map(risposta => risposta.status)).toEqual([200, 200, 200]);
    expect(risposte[0].body).toEqual({ edizionePrecedente: null, varianti: [] });
    expect(risposte[2].body.chiave).toBe('d-TW96emFyZWxsYQ~1.2_x');
    expect(confronti.confronti).toHaveBeenCalledWith(ID_KIT, { idGdo: 'gdo-sessione' });
    expect(confronti.differenzeVarianti).toHaveBeenCalledWith(ID_KIT, ID_ALTRA, { idGdo: 'gdo-sessione' });
    expect(confronti.viaggioProdotto).toHaveBeenCalledWith(ID_KIT, 'd-TW96emFyZWxsYQ~1.2_x', { idGdo: 'gdo-sessione' });
  });

  it('la scheda del volantino resta sulla sua route: un solo segmento dopo /flyer-insights', async () => {
    const { app, confronti, scheda } = creaApp();

    expect((await request(app).get(`/api/flyer-insights/${ID_KIT}`)).body).toEqual({ guidIdKitRuntime: ID_KIT });
    expect(scheda.getFlyerInsights).toHaveBeenCalledTimes(1);
    expect(confronti.confronti).not.toHaveBeenCalled();

    await request(app).get(`/api/flyer-insights/${ID_KIT}/confronti`);
    expect(scheda.getFlyerInsights).toHaveBeenCalledTimes(1);
    expect(confronti.confronti).toHaveBeenCalledTimes(1);
  });
});

describe('parametri non validi', () => {
  it('un id del kit o della variante che non e\' un UUID e\' 400, senza interrogare il servizio', async () => {
    const { app, confronti } = creaApp();

    const risposte = await Promise.all([
      request(app).get('/api/flyer-insights/42/confronti'),
      request(app).get(`/api/flyer-insights/${ID_KIT}/varianti/non-un-kit`),
      request(app).get('/api/flyer-insights/non-un-uuid/prodotti/c-123'),
    ]);

    expect(risposte.map(risposta => risposta.status)).toEqual([400, 400, 400]);
    expect(confronti.confronti).not.toHaveBeenCalled();
    expect(confronti.differenzeVarianti).not.toHaveBeenCalled();
    expect(confronti.viaggioProdotto).not.toHaveBeenCalled();
  });

  it('una chiave che non e\' di un prodotto e\' 400', async () => {
    const { app, confronti } = creaApp();

    for (const chiave of ['x-123', 'c-', encodeURIComponent('c-con spazio'), encodeURIComponent('c-1;DROP')]) {
      const risposta = await request(app).get(`/api/flyer-insights/${ID_KIT}/prodotti/${chiave}`);
      expect(risposta.status, chiave).toBe(400);
    }
    expect(confronti.viaggioProdotto).not.toHaveBeenCalled();
  });
});

describe('ambito GDO', () => {
  it('un utente GDO resta nella sua GDO anche se ne indica un\'altra', async () => {
    const { app, confronti } = creaApp(TIPO_UTENTI.GDO);

    await request(app).get(`/api/flyer-insights/${ID_KIT}/confronti?gdo=altra-gdo`);

    expect(confronti.confronti).toHaveBeenCalledWith(ID_KIT, { idGdo: 'gdo-sessione' });
  });

  it('il Superadmin senza GDO vede tutte le GDO, o quella che indica', async () => {
    anagrafica.idGdo = null;
    const { app, confronti } = creaApp(TIPO_UTENTI.SUPERADMIN);

    await request(app).get(`/api/flyer-insights/${ID_KIT}/prodotti/c-123`);
    await request(app).get(`/api/flyer-insights/${ID_KIT}/prodotti/c-123?gdo=gdo-indicata`);

    expect(confronti.viaggioProdotto.mock.calls.map(chiamata => chiamata[2])).toEqual(['tutte', { idGdo: 'gdo-indicata' }]);
  });

  it('un utente senza GDO non vede i volantini di nessuna', async () => {
    anagrafica.idGdo = null;
    const { app, confronti } = creaApp(TIPO_UTENTI.CATEGORY);

    await request(app).get(`/api/flyer-insights/${ID_KIT}/varianti/${ID_ALTRA}`);

    expect(confronti.differenzeVarianti.mock.calls[0][2]).toBe('nessuna');
  });
});

describe('errori del servizio', () => {
  it('un kit fuori ambito o inesistente e\' 404; una variante di un\'altra promo e\' 400', async () => {
    const { app, confronti } = creaApp();
    confronti.confronti.mockRejectedValueOnce(new NotFoundError({ message: 'Volantino non trovato', entityType: 'RuntimeKit', entityId: ID_KIT }));
    confronti.differenzeVarianti.mockRejectedValueOnce(new BadRequestError({ message: "L'altro volantino non e' una variante della stessa promo" }));

    expect((await request(app).get(`/api/flyer-insights/${ID_KIT}/confronti`)).status).toBe(404);
    expect((await request(app).get(`/api/flyer-insights/${ID_KIT}/varianti/${ID_ALTRA}`)).status).toBe(400);
  });

  it('un errore imprevisto e\' 500', async () => {
    const { app, confronti } = creaApp();
    confronti.viaggioProdotto.mockRejectedValueOnce(new Error('connessione al database persa'));

    const risposta = await request(app).get(`/api/flyer-insights/${ID_KIT}/prodotti/c-123`);

    expect(risposta.status).toBe(500);
  });
});
