import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TIPO_UTENTI } from '../../../../lib/enums';
import { NotFoundError } from '../../../../lib/errors';
import type { RichiestaSimulazione } from '../../../../lib/insightVolantino/rendimento';
import type { AmbitoGdo } from '../../accessi/contestoAccesso';
import type { IInsightVenditeService } from '../../interfaces/IInsightVenditeService';
import type { IVolantinoService } from '../../interfaces/IVolantinoService';

// Le API di rendimento, previsione e simulazione degli insight del volantino: permesso, parametri
// della simulazione controllati prima di leggere la sessione, ambito GDO passato al servizio, 404
// del servizio e convivenza con la scheda GET /api/flyer-insights/:id sullo stesso percorso base.

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

import { InsightVenditeController, richiestaDallaQuery } from '../InsightVenditeController';
import { VolantinoController } from '../VolantinoController';

const ID_KIT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SIMULAZIONE = `/api/flyer-insights/${ID_KIT}/simulazione?chiave=c-123&pagina=2&x=0.5&y=0.25&spazio=12.5`;

function servizioFinto() {
  return {
    rendimento: vi.fn(async (_idKit: string, _ambito: AmbitoGdo) => null),
    previsione: vi.fn(async (_idKit: string, _ambito: AmbitoGdo) => ({ tipo: 'teorica', perBox: [] } as never)),
    simula: vi.fn(async (_idKit: string, _richiesta: RichiestaSimulazione, _ambito: AmbitoGdo) => ({ tipo: 'teorica', valore: 40 } as never)),
  } satisfies IInsightVenditeService;
}

function creaApp(tipo: TIPO_UTENTI = TIPO_UTENTI.GDO) {
  const vendite = servizioFinto();
  const scheda = {
    getFlyerInsights: vi.fn(async (guidIdKitRuntime: string) => ({ guidIdKitRuntime } as never)),
    prendiIVolantiniCaricatiDaDB: vi.fn(async () => []),
  } satisfies IVolantinoService;
  const app = express();
  app.use((req, _res, next) => {
    req.session = { id_utente: 'u1', tipo_utente: tipo } as Request['session'];
    next();
  });
  // Nello stesso ordine di routes.ts: prima la scheda, poi le altre API degli insight
  new VolantinoController(scheda).registerRoutes(app);
  new InsightVenditeController(vendite).registerRoutes(app);
  return { app, vendite, scheda };
}

beforeEach(() => {
  vi.clearAllMocks();
  permessi.concessi = new Set(['materiali.visualizza']);
  anagrafica.idGdo = 'gdo-sessione';
});

describe('permessi', () => {
  it('senza materiali.visualizza nessuna delle tre API interroga il servizio', async () => {
    permessi.concessi = new Set(['volantini.visualizza']);
    const { app, vendite } = creaApp();

    for (const percorso of [`/api/flyer-insights/${ID_KIT}/vendite`, `/api/flyer-insights/${ID_KIT}/previsione`, SIMULAZIONE]) {
      const risposta = await request(app).get(percorso);
      expect([risposta.status, risposta.body], percorso).toEqual([403, { codice: 'materiali.visualizza' }]);
    }
    expect(vendite.rendimento).not.toHaveBeenCalled();
    expect(vendite.previsione).not.toHaveBeenCalled();
    expect(vendite.simula).not.toHaveBeenCalled();
  });
});

describe('le tre API', () => {
  it('rendimento (anche null), previsione e simulazione arrivano al servizio con i parametri e la GDO della sessione', async () => {
    const { app, vendite } = creaApp();

    const [rendimento, previsione, simulazione] = await Promise.all([
      request(app).get(`/api/flyer-insights/${ID_KIT}/vendite`),
      request(app).get(`/api/flyer-insights/${ID_KIT}/previsione`),
      request(app).get(`${SIMULAZIONE}&sconto=30`),
    ]);

    expect([rendimento.status, rendimento.body]).toEqual([200, null]);
    expect([previsione.status, previsione.body]).toEqual([200, { tipo: 'teorica', perBox: [] }]);
    expect([simulazione.status, simulazione.body]).toEqual([200, { tipo: 'teorica', valore: 40 }]);
    expect(vendite.rendimento).toHaveBeenCalledWith(ID_KIT, { idGdo: 'gdo-sessione' });
    expect(vendite.previsione).toHaveBeenCalledWith(ID_KIT, { idGdo: 'gdo-sessione' });
    expect(vendite.simula).toHaveBeenCalledWith(
      ID_KIT,
      { chiave: 'c-123', pagina: 2, x: 0.5, y: 0.25, spazio: 12.5, sconto: 30 },
      { idGdo: 'gdo-sessione' },
    );
  });

  it('senza sconto (o vuoto) la simulazione e\' senza sconto', async () => {
    const { app, vendite } = creaApp();

    await request(app).get(SIMULAZIONE);
    await request(app).get(`${SIMULAZIONE}&sconto=`);

    expect(vendite.simula.mock.calls.map(chiamata => chiamata[1].sconto)).toEqual([null, null]);
  });

  it('la scheda del volantino resta sulla sua route: un solo segmento dopo /flyer-insights', async () => {
    const { app, vendite, scheda } = creaApp();

    expect((await request(app).get(`/api/flyer-insights/${ID_KIT}`)).body).toEqual({ guidIdKitRuntime: ID_KIT });
    expect(vendite.rendimento).not.toHaveBeenCalled();

    await request(app).get(`/api/flyer-insights/${ID_KIT}/vendite`);
    expect(scheda.getFlyerInsights).toHaveBeenCalledTimes(1);
    expect(vendite.rendimento).toHaveBeenCalledTimes(1);
  });
});

describe('parametri della simulazione', () => {
  it.each([
    ['senza chiave', `/api/flyer-insights/${ID_KIT}/simulazione?pagina=2&x=0.5&y=0.25&spazio=12`],
    ['chiave che non e\' di un prodotto', `/api/flyer-insights/${ID_KIT}/simulazione?chiave=x-1&pagina=2&x=0.5&y=0.25&spazio=12`],
    ['pagina 0', `/api/flyer-insights/${ID_KIT}/simulazione?chiave=c-1&pagina=0&x=0.5&y=0.25&spazio=12`],
    ['pagina non numerica', `/api/flyer-insights/${ID_KIT}/simulazione?chiave=c-1&pagina=due&x=0.5&y=0.25&spazio=12`],
    ['x fuori pagina', `/api/flyer-insights/${ID_KIT}/simulazione?chiave=c-1&pagina=2&x=1.5&y=0.25&spazio=12`],
    ['y mancante', `/api/flyer-insights/${ID_KIT}/simulazione?chiave=c-1&pagina=2&x=0.5&spazio=12`],
    ['spazio 0', `/api/flyer-insights/${ID_KIT}/simulazione?chiave=c-1&pagina=2&x=0.5&y=0.25&spazio=0`],
    ['spazio oltre 100', `/api/flyer-insights/${ID_KIT}/simulazione?chiave=c-1&pagina=2&x=0.5&y=0.25&spazio=150`],
    ['sconto negativo', `/api/flyer-insights/${ID_KIT}/simulazione?chiave=c-1&pagina=2&x=0.5&y=0.25&spazio=12&sconto=-5`],
    ['sconto ripetuto', `/api/flyer-insights/${ID_KIT}/simulazione?chiave=c-1&pagina=2&x=0.5&y=0.25&spazio=12&sconto=10&sconto=20`],
  ])('%s e\' 400 senza interrogare il servizio', async (_, percorso) => {
    const { app, vendite } = creaApp();

    const risposta = await request(app).get(percorso);

    expect(risposta.status).toBe(400);
    expect(vendite.simula).not.toHaveBeenCalled();
  });

  it('richiestaDallaQuery: testi in numeri, valori mancanti o ripetuti non validi', () => {
    expect(richiestaDallaQuery({ chiave: ' c-1 ', pagina: '3', x: '0', y: '1', spazio: '5.5', sconto: ' ' })).toEqual({
      chiave: 'c-1', pagina: 3, x: 0, y: 1, spazio: 5.5, sconto: null,
    });
    const errata = richiestaDallaQuery({ chiave: ['c-1', 'c-2'], pagina: '', x: 'mezzo' });
    expect(errata.chiave).toBe('');
    expect([errata.pagina, errata.x, errata.y, errata.spazio]).toEqual([Number.NaN, Number.NaN, Number.NaN, Number.NaN]);
    expect(errata.sconto).toBeNull();
  });
});

describe('ambito GDO ed errori del servizio', () => {
  it('il Superadmin senza GDO vede tutte le GDO, o quella che indica; un utente GDO resta nella sua', async () => {
    anagrafica.idGdo = null;
    const superadmin = creaApp(TIPO_UTENTI.SUPERADMIN);
    await request(superadmin.app).get(`/api/flyer-insights/${ID_KIT}/previsione`);
    await request(superadmin.app).get(`/api/flyer-insights/${ID_KIT}/previsione?gdo=gdo-indicata`);
    expect(superadmin.vendite.previsione.mock.calls.map(chiamata => chiamata[1])).toEqual(['tutte', { idGdo: 'gdo-indicata' }]);

    anagrafica.idGdo = 'gdo-sessione';
    const gdo = creaApp(TIPO_UTENTI.GDO);
    await request(gdo.app).get(`/api/flyer-insights/${ID_KIT}/vendite?gdo=altra-gdo`);
    expect(gdo.vendite.rendimento).toHaveBeenCalledWith(ID_KIT, { idGdo: 'gdo-sessione' });
  });

  it('un kit fuori ambito o che non e\' un kit e\' 404; un errore imprevisto e\' 500', async () => {
    const { app, vendite } = creaApp();
    vendite.rendimento.mockRejectedValueOnce(new NotFoundError({ message: 'Volantino non trovato', entityType: 'RuntimeKit', entityId: 'non-un-kit' }));
    vendite.previsione.mockRejectedValueOnce(new Error('connessione al database persa'));

    expect((await request(app).get('/api/flyer-insights/non-un-kit/vendite')).status).toBe(404);
    expect(vendite.rendimento).toHaveBeenCalledWith('non-un-kit', { idGdo: 'gdo-sessione' });
    expect((await request(app).get(`/api/flyer-insights/${ID_KIT}/previsione`)).status).toBe(500);
  });
});
