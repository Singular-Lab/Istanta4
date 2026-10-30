import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TIPO_UTENTI } from '../../../../lib/enums';
import { NotFoundError } from '../../../../lib/errors';
import type { IAnalisiPuntoVenditaService } from '../../interfaces/IAnalisiPuntoVenditaService';
import type { IConsultazionePuntiVenditaService } from '../../interfaces/IConsultazionePuntiVenditaService';
import type { IStoriaPuntoVenditaService } from '../../interfaces/IStoriaPuntoVenditaService';

// Le pagine del PV sulla timeline dei volantini: permessi, GDO della sessione e ordine delle route
// sullo stesso percorso base della consultazione e della storia.

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

import { AnalisiPuntoVenditaController } from '../AnalisiPuntoVenditaController';
import { ConsultazionePuntiVenditaController } from '../ConsultazionePuntiVenditaController';
import { StoriaPuntoVenditaController } from '../StoriaPuntoVenditaController';

const ID_PV = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ID_KIT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function servizioFinto() {
  return {
    analisi: vi.fn(async (idPuntoVendita: string, _idGdo: string | null) => ({ idPuntoVendita } as never)),
    volantino: vi.fn(async (_id: string, idKit: string, _idGdo: string | null) => ({ kit: { id: idKit, titolo: 'SS LI 45' } } as never)),
    referenza: vi.fn(async (_id: string, chiave: string, _idGdo: string | null) => ({ chiave } as never)),
    reteInsegne: vi.fn(async (_idGdo: string) => ({ anni: [], insegne: [] })),
    qualita: vi.fn(async (_idGdo: string) => ({ totale: 1, senzaCoordinate: 0, senzaCodice: 0, righeDaRevisionare: 0, conStoria: 1, dispositiviOffline: 0 })),
    righeNonAbbinate: vi.fn(async (_idGdo: string, pagina?: number, dimensione?: number) => ({ righe: [], totale: 0, pagina: pagina ?? 1, dimensione: dimensione ?? 10 })),
  } satisfies IAnalisiPuntoVenditaService;
}

function creaApp(opzioni: { tipo?: TIPO_UTENTI; consultazionePrima?: boolean } = {}) {
  const analisi = servizioFinto();
  const consultazione = {
    elenca: vi.fn(async () => []),
    dettaglio: vi.fn(async () => { throw new NotFoundError({ message: 'Punto vendita non trovato', entityType: 'PuntoVendita' }); }),
    volantiniAttivi: vi.fn(async () => []),
  } satisfies IConsultazionePuntiVenditaService;
  const app = express();
  app.use((req, _res, next) => {
    req.session = { id_utente: 'u1', tipo_utente: opzioni.tipo ?? TIPO_UTENTI.GDO } as Request['session'];
    next();
  });
  const controllerAnalisi = new AnalisiPuntoVenditaController(analisi);
  const controllerConsultazione = new ConsultazionePuntiVenditaController(consultazione);
  // Come in routes.ts: analisi, consultazione, storia; a richiesta la consultazione prima
  const ordine = opzioni.consultazionePrima ? [controllerConsultazione, controllerAnalisi] : [controllerAnalisi, controllerConsultazione];
  for (const controller of ordine) controller.registerRoutes(app);
  new StoriaPuntoVenditaController({} as IStoriaPuntoVenditaService).registerRoutes(app);
  return { app, analisi, consultazione };
}

beforeEach(() => {
  vi.clearAllMocks();
  permessi.concessi = new Set(['gdo.visualizza']);
  anagrafica.idGdo = 'gdo-sessione';
});

describe('GET /api/punti-vendita/:id/analisi', () => {
  it('con "gdo.visualizza" restituisce l\'analisi del PV cercato nella GDO dell\'utente', async () => {
    const { app, analisi } = creaApp();

    const res = await request(app).get(`/api/punti-vendita/${ID_PV}/analisi`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ idPuntoVendita: ID_PV });
    expect(analisi.analisi).toHaveBeenCalledWith(ID_PV, 'gdo-sessione');
  });

  it('senza "gdo.visualizza" 403', async () => {
    permessi.concessi = new Set(['gdo.gestisci_punti_vendita']);

    const res = await request(creaApp().app).get(`/api/punti-vendita/${ID_PV}/analisi`);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ codice: 'gdo.visualizza' });
  });

  it('PV inesistente o di un\'altra GDO: 404', async () => {
    const { app, analisi } = creaApp();
    analisi.analisi.mockRejectedValueOnce(new NotFoundError({ message: 'Punto vendita non trovato', entityType: 'PuntoVendita', entityId: ID_PV }));

    expect((await request(app).get(`/api/punti-vendita/${ID_PV}/analisi`)).status).toBe(404);
  });

  it('Superadmin senza GDO cerca fra tutte; un utente senza GDO che non lavora per piu\' GDO non vede nessun PV', async () => {
    anagrafica.idGdo = null;
    const superadmin = creaApp({ tipo: TIPO_UTENTI.SUPERADMIN });
    expect((await request(superadmin.app).get(`/api/punti-vendita/${ID_PV}/analisi`)).status).toBe(200);
    expect(superadmin.analisi.analisi).toHaveBeenCalledWith(ID_PV, null);

    const marketing = creaApp({ tipo: TIPO_UTENTI.MARKETING });
    expect((await request(marketing.app).get(`/api/punti-vendita/${ID_PV}/analisi`)).status).toBe(404);
    expect(marketing.analisi.analisi).not.toHaveBeenCalled();
  });
});

describe('GET /api/punti-vendita/:id/volantini/:idKit e /:id/referenze/:chiave', () => {
  it('passano PV, kit o chiave e la GDO della sessione, con "gdo.visualizza"', async () => {
    const { app, analisi } = creaApp();

    const volantino = await request(app).get(`/api/punti-vendita/${ID_PV}/volantini/${ID_KIT}`);
    const referenza = await request(app).get(`/api/punti-vendita/${ID_PV}/referenze/c-4969665`);

    expect(volantino.status).toBe(200);
    expect(volantino.body).toEqual({ kit: { id: ID_KIT, titolo: 'SS LI 45' } });
    expect(analisi.volantino).toHaveBeenCalledWith(ID_PV, ID_KIT, 'gdo-sessione');
    expect(referenza.status).toBe(200);
    expect(analisi.referenza).toHaveBeenCalledWith(ID_PV, 'c-4969665', 'gdo-sessione');
  });

  it('un kit che non e\' nella storia del PV: 404', async () => {
    const { app, analisi } = creaApp();
    analisi.volantino.mockRejectedValueOnce(new NotFoundError({ message: 'Volantino non trovato nella storia del punto vendita', entityType: 'RuntimeKit', entityId: ID_KIT }));

    expect((await request(app).get(`/api/punti-vendita/${ID_PV}/volantini/${ID_KIT}`)).status).toBe(404);
  });

  it('senza "gdo.visualizza" 403', async () => {
    permessi.concessi = new Set();
    const { app } = creaApp();

    expect((await request(app).get(`/api/punti-vendita/${ID_PV}/volantini/${ID_KIT}`)).status).toBe(403);
    expect((await request(app).get(`/api/punti-vendita/${ID_PV}/referenze/c-1`)).status).toBe(403);
  });
});

describe('GET /api/punti-vendita/rete/insegne', () => {
  it('"gdo.visualizza", sempre nella GDO della sessione', async () => {
    const { app, analisi } = creaApp({ tipo: TIPO_UTENTI.AGENZIA });

    const res = await request(app).get('/api/punti-vendita/rete/insegne').query({ idGdo: 'altra-gdo' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ anni: [], insegne: [] });
    expect(analisi.reteInsegne).toHaveBeenCalledWith('gdo-sessione');
  });

  it('senza GDO 400', async () => {
    anagrafica.idGdo = null;
    const { app, analisi } = creaApp({ tipo: TIPO_UTENTI.SUPERADMIN });

    expect((await request(app).get('/api/punti-vendita/rete/insegne')).status).toBe(400);
    expect(analisi.reteInsegne).not.toHaveBeenCalled();
  });
});

describe('GET /api/punti-vendita/gestione/...', () => {
  it('qualita\' e righe non abbinate vogliono "gdo.gestisci_punti_vendita": con la sola visualizzazione 403', async () => {
    const { app, analisi } = creaApp();

    const qualita = await request(app).get('/api/punti-vendita/gestione/qualita');
    const righe = await request(app).get('/api/punti-vendita/gestione/righe-non-abbinate');

    expect(qualita.status).toBe(403);
    expect(qualita.body).toEqual({ codice: 'gdo.gestisci_punti_vendita' });
    expect(righe.status).toBe(403);
    expect(analisi.qualita).not.toHaveBeenCalled();
    expect(analisi.righeNonAbbinate).not.toHaveBeenCalled();
  });

  it('con "gdo.gestisci_punti_vendita": qualita\' della GDO e righe con pagina e dimensione', async () => {
    permessi.concessi = new Set(['gdo.gestisci_punti_vendita']);
    const { app, analisi } = creaApp();

    expect((await request(app).get('/api/punti-vendita/gestione/qualita')).body).toMatchObject({ totale: 1, conStoria: 1 });
    expect(analisi.qualita).toHaveBeenCalledWith('gdo-sessione');

    const righe = await request(app).get('/api/punti-vendita/gestione/righe-non-abbinate').query({ pagina: '2', dimensione: '25' });
    expect(righe.body).toEqual({ righe: [], totale: 0, pagina: 2, dimensione: 25 });
    expect(analisi.righeNonAbbinate).toHaveBeenCalledWith('gdo-sessione', 2, 25);

    await request(app).get('/api/punti-vendita/gestione/righe-non-abbinate').query({ pagina: 'abc' });
    expect(analisi.righeNonAbbinate).toHaveBeenLastCalledWith('gdo-sessione', undefined, undefined);
  });
});

describe('ordine delle route sul percorso base /api/punti-vendita', () => {
  it.each([false, true])('"/rete/..." e "/gestione/..." non finiscono nel "/:id" della consultazione (consultazione prima: %s)', async (consultazionePrima) => {
    permessi.concessi = new Set(['gdo.visualizza', 'gdo.gestisci_punti_vendita']);
    const { app, analisi, consultazione } = creaApp({ consultazionePrima });

    expect((await request(app).get('/api/punti-vendita/rete/insegne')).status).toBe(200);
    expect((await request(app).get('/api/punti-vendita/gestione/qualita')).status).toBe(200);
    expect((await request(app).get('/api/punti-vendita/gestione/righe-non-abbinate')).status).toBe(200);
    expect(analisi.reteInsegne).toHaveBeenCalledTimes(1);
    expect(analisi.qualita).toHaveBeenCalledTimes(1);
    expect(analisi.righeNonAbbinate).toHaveBeenCalledTimes(1);
    expect(consultazione.dettaglio).not.toHaveBeenCalled();
  });

  it('la consultazione resta raggiungibile: "/:id" e "/:id/volantini-attivi" non finiscono nell\'analisi', async () => {
    const { app, analisi, consultazione } = creaApp();

    expect((await request(app).get(`/api/punti-vendita/${ID_PV}`)).status).toBe(404);
    expect((await request(app).get(`/api/punti-vendita/${ID_PV}/volantini-attivi`)).status).toBe(200);
    expect(consultazione.dettaglio).toHaveBeenCalledWith('gdo-sessione', ID_PV);
    expect(consultazione.volantiniAttivi).toHaveBeenCalledWith('gdo-sessione', ID_PV);
    expect(analisi.volantino).not.toHaveBeenCalled();
  });
});
