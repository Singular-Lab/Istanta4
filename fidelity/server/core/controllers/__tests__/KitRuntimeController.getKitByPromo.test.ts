import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { log } from '../../logger';
import { Promo } from '../../models/promo';
import { ServerUtils } from '../../utils/ServerUtils';
import { idPezzo, MESSAGGIO_AVVIO_PROXY, type KitConfrontabile, type ProxyNoti } from '../../../../lib/areeCanali/proxy';
import { NESSUN_PEZZO, type ContestoPezzi } from '../../services/areeCanaliProxy';

/** Un kit come arriva nella risposta JSON. */
type Kit = Record<string, unknown>;
import { KitRuntimeController } from '../KitRuntimeController';

vi.mock('../../middleware/authMiddleware', () => ({
  authMiddleware: (_req: any, _res: any, next: any) => next(),
  // Istanta chiama con il bearer di Olympus: i test lo dicono con l'header x-test-auth
  integrationAuthMiddleware: (req: any, res: any, next: any) => { res.locals.authVia = req.headers['x-test-auth'] ?? 'internal'; next(); },
}));

vi.mock('../../middleware/permissionGuard', () => ({
  permissionGuard: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Proxy di canali e aree (lib/areeCanali/proxy.ts): le letture dal database sono finte, la divisione
// in pezzi (pezziPerIstanta) e' quella vera
const proxyDb = vi.hoisted(() => ({
  caricaProxy: vi.fn(async (): Promise<ProxyNoti> => ({ canali: new Map(), aree: new Map() })),
  contestoPezzi: vi.fn(async (): Promise<ContestoPezzi | undefined> => undefined),
  kitDellaPromo: vi.fn(async (_idPromo: string): Promise<Array<KitConfrontabile & { guidIdDesign: string | null }>> => []),
  trovaPezzo: vi.fn(async (_id: string): Promise<{ idDesign: string; idCanale: string; idArea: string } | null> => null),
}));
vi.mock('../../services/areeCanaliProxy', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/areeCanaliProxy')>()),
  ...proxyDb,
}));

beforeEach(() => {
  proxyDb.contestoPezzi.mockResolvedValue(NESSUN_PEZZO);
  proxyDb.caricaProxy.mockResolvedValue({ canali: new Map(), aree: new Map() });
  proxyDb.kitDellaPromo.mockResolvedValue([]);
  proxyDb.trovaPezzo.mockResolvedValue(null);
});

// getKitByPromo deve lasciare nei log ogni passaggio, con la stessa richiesta su tutte le righe

const design = {
  guidId: 'd1', titolo: 'SS TO VOL', tipo: 'AUTOMATICO', stato: 'ATTIVO',
  nomeCanale: 'Superstore', nomeArea: 'Toscana', guidCanale: 'c1', guidArea: 'a1', guidFormato: 'f1',
  guidIdRaccoglitore: 'r1', tipiDiExportInKit: [{}, {}], filtroContesto: [],
};

function createApp(kitRuntimeService: Record<string, any>, designKitService: Record<string, any> = {}) {
  vi.spyOn(Promo, 'update').mockResolvedValue([1] as any);
  vi.spyOn(ServerUtils, 'CREA_ATTIVITA').mockResolvedValue(undefined as any);
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => { req.session = {}; next(); });
  new KitRuntimeController(kitRuntimeService as any, designKitService as any).registerRoutes(app);
  return app;
}

const righe = (livello: 'info' | 'warn' | 'error') => vi.mocked(log[livello]).mock.calls;
const riga = (messaggio: string) => righe('info').find(([m]) => m === messaggio)?.[1];

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('PUT /api/getKitByPromo, ramo design', () => {
  it('nuovo runtime: richiesta, design, runtime creato, promo e risposta, tutti con la stessa richiesta', async () => {
    const app = createApp(
      {
        getAllKitRuntimeByIdPromo: vi.fn(async () => []),
        createKitRunTime: vi.fn(async (dati: any) => ({ ...dati })),
      },
      { getCombinazioneDesignById: vi.fn(async () => ({ ...design })) },
    );

    const res = await request(app).put('/api/getKitByPromo').send({ id: 'd1', idPromo: 'p1', lettura: false });

    expect(res.status).toBe(200);
    expect(riga('Richiesta ricevuta')).toMatchObject({ context: 'getKitByPromo', ramo: 'design', autenticazione: 'internal', id: 'd1', idPromo: 'p1', lettura: false });
    expect(riga('Design trovato')).toMatchObject({ idDesign: 'd1', titolo: 'SS TO VOL', canale: 'Superstore', area: 'Toscana', tipiExport: 2 });
    expect(riga('Runtime gia presenti nella promo')).toMatchObject({ idPromo: 'p1', runtime: 0 });
    expect(riga('Runtime creato')).toMatchObject({ idDesign: 'd1', idPromo: 'p1' });
    expect(riga('Primo runtime della promo: promo passata a IN_LAVORAZIONE')).toMatchObject({ idPromo: 'p1' });
    expect(riga('Risposta inviata')).toMatchObject({ esito: 'runtime', runtime: 1 });
    expect((riga('Risposta inviata') as { durataMs?: number }).durataMs).toEqual(expect.any(Number));

    const richieste = new Set(righe('info').map(([, ctx]) => (ctx as any).richiesta));
    expect(richieste.size).toBe(1);
  });

  it('runtime gia esistente per design e promo: lo dice', async () => {
    const app = createApp(
      {
        getAllKitRuntimeByIdPromo: vi.fn(async () => [{}]),
        createKitRunTime: vi.fn(async () => ({ guidId: 'rt-esistente', stato_lavorazione: 'IN_REVISIONE' })),
      },
      { getCombinazioneDesignById: vi.fn(async () => ({ ...design })) },
    );

    await request(app).put('/api/getKitByPromo').send({ id: 'd1', idPromo: 'p1', lettura: false });

    expect(riga('Runtime gia esistente per design e promo: restituito quello'))
      .toMatchObject({ idRuntime: 'rt-esistente', statoLavorazione: 'IN_REVISIONE' });
    expect(riga('Runtime creato')).toBeUndefined();
  });

  it('attivita non registrata per un errore del DB: il runtime resta e l\'errore va nel log', async () => {
    const app = createApp(
      {
        getAllKitRuntimeByIdPromo: vi.fn(async () => []),
        createKitRunTime: vi.fn(async (dati: Record<string, unknown>) => ({ ...dati })),
      },
      { getCombinazioneDesignById: vi.fn(async () => ({ ...design })) },
    );
    // Prima il rifiuto non era gestito e unhandledRejection spegneva il worker
    const errore = new Error('insert attivita fallita');
    vi.mocked(ServerUtils.CREA_ATTIVITA).mockRejectedValue(errore);

    const res = await request(app).put('/api/getKitByPromo').send({ id: 'd1', idPromo: 'p1', lettura: false });

    expect(res.status).toBe(200);
    await vi.waitFor(() => expect(log.warn).toHaveBeenCalledWith(
      'Attivita di creazione runtime non registrata',
      expect.objectContaining({ error: errore }),
    ));
  });

  it('design non trovato: avviso e 404', async () => {
    const app = createApp({}, { getCombinazioneDesignById: vi.fn(async () => null) });

    const res = await request(app).put('/api/getKitByPromo').send({ id: 'nessuno', idPromo: 'p1', lettura: false });

    expect(res.status).toBe(404);
    expect(righe('warn')[0]).toEqual(['Design non trovato: risposta 404', expect.objectContaining({ id: 'nessuno' })]);
  });

  it('errore: riga con i parametri della richiesta e la durata', async () => {
    const errore = new Error('connessione persa');
    const app = createApp(
      { getAllKitRuntimeByIdPromo: vi.fn(async () => { throw errore; }) },
      { getCombinazioneDesignById: vi.fn(async () => ({ ...design })) },
    );

    const res = await request(app).put('/api/getKitByPromo').send({ id: 'd1', idPromo: 'p1', lettura: false });

    expect(res.status).toBe(500);
    const [messaggio, err, ctx] = righe('error').find(([m]) => m === 'Richiesta fallita')!;
    expect(messaggio).toBe('Richiesta fallita');
    expect(err).toBe(errore);
    expect(ctx).toMatchObject({ context: 'getKitByPromo', id: 'd1', idPromo: 'p1', lettura: false, durataMs: expect.any(Number) });
  });
});

describe('PUT /api/getKitByPromo, ramo combinazioni', () => {
  it('passa la traccia al service e scrive quante combinazioni restituisce', async () => {
    const getAllKitByAreaCanalePV = vi.fn(async () => [{ guidId: 'd1' }, { guidId: 'd2' }]);
    const app = createApp({ getAllKitByAreaCanalePV });

    await request(app).put('/api/getKitByPromo').send({
      idCanale: 'c1', lettura: true, promoContext: [{ nome_field: 'ap_name', user_value: 'LA SPEZIA' }],
    });

    expect(riga('Richiesta ricevuta')).toMatchObject({ ramo: 'combinazioni', promoContext: ['ap_name=LA SPEZIA'] });
    const traccia = (getAllKitByAreaCanalePV.mock.calls[0] as any[])[1];
    expect(traccia).toEqual({ context: 'getKitByPromo', richiesta: (riga('Richiesta ricevuta') as any).richiesta });
    expect(riga('Sola lettura: restituite le combinazioni')).toMatchObject({ combinazioni: 2 });
  });

  it('creazione: la traccia arriva anche a bulkCreateRuntime', async () => {
    const bulkCreateRuntime = vi.fn(async () => [{ guidId: 'rt1' }]);
    const app = createApp({ getAllKitByAreaCanalePV: vi.fn(async () => [{ guidId: 'd1' }]), bulkCreateRuntime });

    await request(app).put('/api/getKitByPromo').send({ idCanale: 'c1', idPromo: 'p1', lettura: false });

    expect((bulkCreateRuntime.mock.calls[0] as any[])[1]).toMatchObject({ context: 'getKitByPromo' });
    expect(riga('Attivita di creazione non registrata: chiamata senza utente')).toBeDefined();
    expect(riga('Risposta inviata')).toMatchObject({ esito: 'runtime', runtime: 1 });
  });
});

// Il canale proxy SSCNCY (Superstore, Conad, City) e' noto a Istanta come un canale qualsiasi.
// Chiedendolo, Istanta riceve i kit dei membri e il design RIL diviso in un pezzo per combinazione
// membro attiva: SS·LA, CN·LA, CY·LA. Ogni pezzo si avvia con il suo id e ha il suo runtime.
describe('PUT /api/getKitByPromo da Istanta, con canali proxy', () => {
  const PROXY = { canali: new Map([['sscncy', ['ss', 'cn', 'cy']]]), aree: new Map() };
  const CONTESTO = {
    proxy: PROXY,
    attive: new Set(['ss|la', 'cn|la', 'cy|la']),
    canali: new Map([['ss', { codice: 'SS', nome: 'Superstore' }], ['cn', { codice: 'CN', nome: 'Conad' }], ['cy', { codice: 'CY', nome: 'City' }]]),
    aree: new Map([['la', { codice: 'LA', nome: 'Lazio' }]]),
  };
  const ril = { guidId: 'd-ril', titolo: 'RIL SSCNCY LA', guidCanale: 'sscncy', guidArea: 'la', guidFormato: 'f1', guidIdRaccoglitore: 'r1', tipiDiExportInKit: [], filtroContesto: [] };
  const vol = { guidId: 'd-ss', titolo: 'VOL SS LA', guidCanale: 'ss', guidArea: 'la', guidFormato: 'f1', guidIdRaccoglitore: 'r1', tipiDiExportInKit: [], filtroContesto: [] };
  const designPerId = { getCombinazioneDesignById: vi.fn(async (id: string) => (id === 'd-ril' ? { ...ril } : undefined)) };
  const PEZZO_CN = idPezzo('d-ril', 'cn', 'la');

  beforeEach(() => {
    proxyDb.contestoPezzi.mockResolvedValue(CONTESTO);
    proxyDb.caricaProxy.mockResolvedValue(PROXY);
    proxyDb.trovaPezzo.mockImplementation(async (id: string) => (id === PEZZO_CN ? { idDesign: 'd-ril', idCanale: 'cn', idArea: 'la' } : null));
  });

  it('Istanta chiede SSCNCY·LA: riceve i kit dei membri e il RIL diviso in SS·LA, CN·LA e CY·LA', async () => {
    const volAltroFormato = { ...vol, guidFormato: 'f2' };
    const getAllKitByAreaCanalePV = vi.fn(async (_dati: unknown) => [{ ...ril }, volAltroFormato]);
    const app = createApp({ getAllKitByAreaCanalePV });

    const res = await request(app).put('/api/getKitByPromo').set('x-test-auth', 'bearer').send({ idCanale: 'sscncy', idArea: 'la', lettura: true });

    expect(res.status).toBe(200);
    expect(getAllKitByAreaCanalePV.mock.calls[0][0]).toMatchObject({ idCanale: ['sscncy', 'ss', 'cn', 'cy'], idArea: ['la'] });
    expect((res.body.content as Kit[]).map(k => [k.guidId, k.guidCanale, k.guidArea])).toEqual([
      [idPezzo('d-ril', 'ss', 'la'), 'ss', 'la'],
      [PEZZO_CN, 'cn', 'la'],
      [idPezzo('d-ril', 'cy', 'la'), 'cy', 'la'],
      ['d-ss', 'ss', 'la'],
    ]);
    expect(res.body.content[1]).toMatchObject({ guidIdDesign: 'd-ril', titolo: 'RIL SSCNCY LA', nomeCanale: 'Conad', codiceCanale: 'CN', nomeArea: 'Lazio' });
  });

  it('Istanta chiede Superstore: solo i kit di Superstore, nessun pezzo del RIL', async () => {
    const getAllKitByAreaCanalePV = vi.fn(async (_dati: unknown) => [{ ...vol }]);
    const app = createApp({ getAllKitByAreaCanalePV });

    const res = await request(app).put('/api/getKitByPromo').set('x-test-auth', 'bearer').send({ idCanale: 'ss', idArea: 'la', lettura: true });

    expect(getAllKitByAreaCanalePV.mock.calls[0][0]).toMatchObject({ idCanale: ['ss'], idArea: ['la'] });
    expect(res.body.content).toEqual([vol]);
  });

  it('un pezzo e un kit della stessa combinazione, stesso raccoglitore e formato: 409 con il motivo, nulla creato', async () => {
    const bulkCreateRuntime = vi.fn(async () => []);
    const app = createApp({ getAllKitByAreaCanalePV: vi.fn(async () => [{ ...ril }, { ...vol }]), bulkCreateRuntime });

    const res = await request(app).put('/api/getKitByPromo').set('x-test-auth', 'bearer').send({ idCanale: 'sscncy', idPromo: 'p1', lettura: false });

    expect(res.status).toBe(409);
    expect(res.body.esito).toBe(false);
    expect(res.body.error).toContain('"RIL SSCNCY LA" e "VOL SS LA"');
    expect(bulkCreateRuntime).not.toHaveBeenCalled();
  });

  it('avvio di un pezzo: il runtime nasce sul canale e l\'area del membro, legato al design proxy', async () => {
    const createKitRunTime = vi.fn(async (dati: Kit, _opzioni?: unknown) => ({ ...dati }));
    const app = createApp({ getAllKitRuntimeByIdPromo: vi.fn(async () => []), createKitRunTime }, designPerId);

    const res = await request(app).put('/api/getKitByPromo').set('x-test-auth', 'bearer').send({ id: PEZZO_CN, idPromo: 'p1', lettura: false });

    expect(res.status).toBe(200);
    expect(createKitRunTime).toHaveBeenCalledTimes(1);
    const [dati, opzioni] = createKitRunTime.mock.calls[0];
    expect(dati).toMatchObject({ guidIdDesign: 'd-ril', guidCanale: 'cn', guidArea: 'la', nomeCanale: 'Conad', idPromo: 'p1' });
    // Un runtime per pezzo: quello esistente si cerca anche per canale e area
    expect(opzioni).toEqual({ perCombinazione: true });
    expect(res.body.content[0]).toMatchObject({ guidIdDesign: 'd-ril', guidCanale: 'cn', guidArea: 'la' });
  });

  it('avvio di un pezzo in una promo con un kit della stessa combinazione: 409, nessun runtime', async () => {
    proxyDb.kitDellaPromo.mockResolvedValue([{ ...vol, guidId: 'rt-cn', guidIdDesign: 'd-cn', guidCanale: 'cn', pezzo: false }]);
    const createKitRunTime = vi.fn(async (dati: Kit) => dati);
    const app = createApp({ getAllKitRuntimeByIdPromo: vi.fn(async () => []), createKitRunTime }, designPerId);

    const res = await request(app).put('/api/getKitByPromo').set('x-test-auth', 'bearer').send({ id: PEZZO_CN, idPromo: 'p1', lettura: false });

    expect(res.status).toBe(409);
    expect(proxyDb.kitDellaPromo).toHaveBeenCalledWith('p1');
    expect(createKitRunTime).not.toHaveBeenCalled();
  });

  it('un design proxy non si avvia intero, ne\' da Istanta ne\' da FP: 400', async () => {
    const createKitRunTime = vi.fn(async (dati: Kit) => dati);
    const app = createApp({ getAllKitRuntimeByIdPromo: vi.fn(async () => []), createKitRunTime }, designPerId);

    const daIstanta = await request(app).put('/api/getKitByPromo').set('x-test-auth', 'bearer').send({ id: 'd-ril', idPromo: 'p1', lettura: false });
    const daFp = await request(app).put('/api/getKitByPromo').send({ id: 'd-ril', idPromo: 'p1', lettura: false });

    expect(daIstanta.status).toBe(400);
    expect(daIstanta.body.error).toBe(MESSAGGIO_AVVIO_PROXY);
    expect(daFp.status).toBe(400);
    expect(createKitRunTime).not.toHaveBeenCalled();
  });

  it('Istanta che legge per id un design proxy lo riceve diviso in pezzi', async () => {
    const app = createApp({}, designPerId);

    const res = await request(app).put('/api/getKitByPromo').set('x-test-auth', 'bearer').send({ id: 'd-ril', lettura: true });

    expect((res.body.content as Kit[]).map(k => k.guidCanale)).toEqual(['ss', 'cn', 'cy']);
  });

  it('le chiamate di FP e del plugin vedono i kit come sono, senza leggere i proxy', async () => {
    const getAllKitByAreaCanalePV = vi.fn(async (_dati: unknown) => [{ ...ril }]);
    const app = createApp({ getAllKitByAreaCanalePV });

    const res = await request(app).put('/api/getKitByPromo').send({ idCanale: 'sscncy', lettura: true });

    expect(getAllKitByAreaCanalePV.mock.calls[0][0]).toMatchObject({ idCanale: 'sscncy' });
    expect(res.body.content).toEqual([ril]);
    expect(proxyDb.contestoPezzi).not.toHaveBeenCalled();
    expect(proxyDb.caricaProxy).not.toHaveBeenCalled();
  });
});
