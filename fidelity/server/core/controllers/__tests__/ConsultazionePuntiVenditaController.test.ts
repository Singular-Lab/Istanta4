import express, { Router, type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TIPO_UTENTI } from '../../../../lib/enums';
import type {
  IConsultazionePuntiVenditaRepository,
  RigaPuntoVenditaConsultazione,
  RigaStoriaInElenco,
} from '../../repositories/ConsultazionePuntiVenditaRepository';
import { ConsultazionePuntiVenditaService } from '../../services/ConsultazionePuntiVenditaService';
import { ConsultazionePuntiVenditaController } from '../ConsultazionePuntiVenditaController';
import { PuntoVenditaController } from '../PuntoVenditaController';

// Consultazione dei punti vendita (pagine /punti-vendita): "gdo.visualizza", sempre nella GDO della sessione.

const permessi = vi.hoisted(() => ({ concessi: new Set<string>() }));
/** I volantini dei PV per l'elenco: ogni test sceglie le righe. */
let storie: RigaStoriaInElenco[] = [];

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

// L'anagrafica lega l'utente della sessione alla GDO "gdo-sessione"
vi.mock('../../models', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  UtentiGDO: { findOne: vi.fn(async () => ({ id_gdo_utentegdo: 'gdo-sessione', id_ruolo_utente_gdo: null })) },
}));

const PV_NOSTRO = '11111111-1111-4111-8111-111111111111';
const PV_ALTRA_GDO = '22222222-2222-4222-8222-222222222222';

const riga = (dati: Partial<RigaPuntoVenditaConsultazione>): RigaPuntoVenditaConsultazione => ({
  id: PV_NOSTRO,
  nome: 'Conad Lucca',
  ragione_sociale: 'Conad Lucca Srl',
  indirizzo: 'Via Roma 1',
  cap: '55100',
  citta: 'Lucca',
  provincia: 'LU',
  regione: 'Toscana',
  telefono: '0583 123456',
  meta: { id_anacan: '004512', id_muro: 'M12' },
  lat: '43.84',
  lon: '10.50',
  id_canale: 'c1',
  nome_canale: 'Conad City',
  codice_canale: 'CC',
  id_area: 'a1',
  nome_area: 'Toscana',
  codice_area: 'TO',
  ...dati,
});

/** Il database di prova: un PV nella GDO della sessione, uno in un'altra. */
const PUNTI_VENDITA: Array<RigaPuntoVenditaConsultazione & { id_gdo: string }> = [
  { ...riga({}), id_gdo: 'gdo-sessione' },
  { ...riga({ id: PV_ALTRA_GDO, nome: 'Conad Altrove' }), id_gdo: 'altra-gdo' },
];

function creaApp(tipo_utente: TIPO_UTENTI = TIPO_UTENTI.GDO) {
  const repository: IConsultazionePuntiVenditaRepository = {
    elencaDellaGdo: vi.fn(async (idGdo: string) =>
      PUNTI_VENDITA.filter(pv => pv.id_gdo === idGdo).map(({ id_gdo: _gdo, ...resto }) => resto)),
    trovaDellaGdo: vi.fn(async (idGdo: string, id: string) => {
      const trovato = PUNTI_VENDITA.find(pv => pv.id_gdo === idGdo && pv.id === id);
      if (!trovato) return null;
      const { id_gdo: _gdo, ...resto } = trovato;
      return resto;
    }),
    storiaInElenco: vi.fn(async (_idGdo: string) => storie),
  };
  const puntoVenditaService = {
    getVolantiniAttivi: vi.fn(async (idPv: string) => [{ id_kit: `kit-${idPv}`, promo: { id: 'p1', nome: 'Promo' }, files: [] }]),
  };
  const app = express();
  app.use((req: Request, _res, next) => {
    (req as unknown as { session: Record<string, unknown> }).session = { id_utente: 'u1', tipo_utente };
    next();
  });
  // Come in routes.ts: la gestione dei punti vendita e' registrata prima della consultazione
  new PuntoVenditaController({} as never, {} as never, {} as never).registerRoutes(app);
  new ConsultazionePuntiVenditaController(new ConsultazionePuntiVenditaService(repository, puntoVenditaService as never)).registerRoutes(app);
  return { app, repository, puntoVenditaService };
}

beforeEach(() => {
  vi.clearAllMocks();
  permessi.concessi = new Set(['gdo.visualizza']);
  storie = [];
});

describe('GET /api/punti-vendita', () => {
  it('basta "gdo.visualizza": senza, 403', async () => {
    permessi.concessi = new Set(['gdo.gestisci_punti_vendita']);

    const res = await request(creaApp().app).get('/api/punti-vendita');

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ codice: 'gdo.visualizza' });
  });

  it('elenca solo i punti vendita della GDO della sessione, anche se la richiesta ne indica un\'altra', async () => {
    const { app, repository } = creaApp(TIPO_UTENTI.AGENZIA);

    const res = await request(app).get('/api/punti-vendita').query({ idGdo: 'altra-gdo', IdGDO: 'altra-gdo' });

    expect(res.status).toBe(200);
    expect(repository.elencaDellaGdo).toHaveBeenCalledWith('gdo-sessione');
    expect(res.body.map((pv: { id: string }) => pv.id)).toEqual([PV_NOSTRO]);
  });

  it('ogni punto vendita porta anagrafica, canale e area con il codice, codici GDO e coordinate', async () => {
    const res = await request(creaApp().app).get('/api/punti-vendita');

    expect(res.body[0]).toEqual({
      id: PV_NOSTRO,
      nome: 'Conad Lucca',
      ragioneSociale: 'Conad Lucca Srl',
      indirizzo: 'Via Roma 1',
      cap: '55100',
      citta: 'Lucca',
      provincia: 'LU',
      regione: 'Toscana',
      telefono: '0583 123456',
      canale: { id: 'c1', nome: 'Conad City', codice: 'CC' },
      area: { id: 'a1', nome: 'Toscana', codice: 'TO' },
      meta: { id_anacan: '004512', id_muro: 'M12' },
      coordinate: { lat: 43.84, lon: 10.5 },
    });
  });

  it('il punto vendita con dei volantini porta la loro storia: quanti, l\'insegna anno per anno e se e\' cambiata', async () => {
    storie = [
      { id_punto_vendita: PV_NOSTRO, anno: 2023, id_canale: 'c1', nome_canale: 'Conad City', volantini: 20 },
      { id_punto_vendita: PV_NOSTRO, anno: 2024, id_canale: 'c2', nome_canale: 'Conad Superstore', volantini: 18 },
      { id_punto_vendita: PV_NOSTRO, anno: 2024, id_canale: 'c1', nome_canale: 'Conad City', volantini: 4 },
    ];
    const { app, repository } = creaApp();

    const res = await request(app).get('/api/punti-vendita');

    expect(repository.storiaInElenco).toHaveBeenCalledWith('gdo-sessione');
    expect(res.body[0].storia).toEqual({
      volantini: 42,
      insegnePerAnno: [
        { anno: 2023, canale: { id: 'c1', nome: 'Conad City' } },
        { anno: 2024, canale: { id: 'c2', nome: 'Conad Superstore' } },
      ],
      cambioInsegna: true,
    });
  });

  it('senza volantini, o se la storia non si legge, l\'elenco esce lo stesso senza', async () => {
    const { app, repository } = creaApp();
    expect(Object.keys((await request(app).get('/api/punti-vendita')).body[0])).not.toContain('storia');

    vi.mocked(repository.storiaInElenco).mockRejectedValueOnce(new Error('tabella non raggiungibile'));
    const res = await request(app).get('/api/punti-vendita');
    expect(res.status).toBe(200);
    expect(res.body.map((pv: { id: string }) => pv.id)).toEqual([PV_NOSTRO]);
  });

  it('non espone dispositivi, token, contesti display ne\' dati interni', async () => {
    const res = await request(creaApp().app).get('/api/punti-vendita');

    const chiavi = Object.keys(res.body[0]);
    for (const vietata of ['dispositivi', 'token', 'display_url', 'displayContext', 'id_gdo', 'numero_utenti_collegati', 'id_combinazione_canale_area']) {
      expect(chiavi).not.toContain(vietata);
    }
    expect(JSON.stringify(res.body)).not.toMatch(/token|dispositiv|display/i);
  });
});

describe('GET /api/punti-vendita/:id', () => {
  it('restituisce il punto vendita della GDO', async () => {
    const res = await request(creaApp().app).get(`/api/punti-vendita/${PV_NOSTRO}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: PV_NOSTRO, nome: 'Conad Lucca' });
  });

  it('un punto vendita di un\'altra GDO risponde come inesistente', async () => {
    const res = await request(creaApp().app).get(`/api/punti-vendita/${PV_ALTRA_GDO}`);

    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain('Conad Altrove');
  });

  it('un id che non e\' un UUID e\' 404, senza interrogare il database', async () => {
    const { app, repository } = creaApp();

    const res = await request(app).get('/api/punti-vendita/42');

    expect(res.status).toBe(404);
    expect(repository.trovaDellaGdo).not.toHaveBeenCalled();
  });

  it('senza "gdo.visualizza" 403', async () => {
    permessi.concessi = new Set();

    const res = await request(creaApp().app).get(`/api/punti-vendita/${PV_NOSTRO}`);

    expect(res.status).toBe(403);
  });
});

describe('GET /api/punti-vendita/:id/volantini-attivi', () => {
  it('basta "gdo.visualizza": la gestione non lo intercetta piu\' con "gdo.gestisci_punti_vendita"', async () => {
    const { app, puntoVenditaService } = creaApp();

    const res = await request(app).get(`/api/punti-vendita/${PV_NOSTRO}/volantini-attivi`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([expect.objectContaining({ id_kit: `kit-${PV_NOSTRO}` })]);
    expect(puntoVenditaService.getVolantiniAttivi).toHaveBeenCalledWith(PV_NOSTRO);
  });

  it('senza "gdo.visualizza" 403', async () => {
    permessi.concessi = new Set(['gdo.gestisci_punti_vendita']);

    const res = await request(creaApp().app).get(`/api/punti-vendita/${PV_NOSTRO}/volantini-attivi`);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ codice: 'gdo.visualizza' });
  });

  it('per un punto vendita di un\'altra GDO 404, senza cercarne i volantini', async () => {
    const { app, puntoVenditaService } = creaApp();

    const res = await request(app).get(`/api/punti-vendita/${PV_ALTRA_GDO}/volantini-attivi`);

    expect(res.status).toBe(404);
    expect(puntoVenditaService.getVolantiniAttivi).not.toHaveBeenCalled();
  });
});

describe('percorsi della storia sullo stesso percorso base', () => {
  it('/:id/storia e /storia/import-export non sono coperti dalla consultazione', async () => {
    const { app } = creaApp();
    // Il controller della storia, registrato dopo, riceve le sue richieste
    const storia = Router();
    storia.get('/:id/storia', (_req, res) => { res.json({ da: 'storia' }); });
    storia.get('/:id/storia/volantini', (_req, res) => { res.json({ da: 'volantini della storia' }); });
    storia.post('/storia/import-export', (_req, res) => { res.json({ da: 'import' }); });
    app.use('/api/punti-vendita', storia);

    expect((await request(app).get(`/api/punti-vendita/${PV_NOSTRO}/storia`)).body).toEqual({ da: 'storia' });
    expect((await request(app).get(`/api/punti-vendita/${PV_NOSTRO}/storia/volantini`)).body).toEqual({ da: 'volantini della storia' });
    expect((await request(app).post('/api/punti-vendita/storia/import-export')).body).toEqual({ da: 'import' });
  });
});
