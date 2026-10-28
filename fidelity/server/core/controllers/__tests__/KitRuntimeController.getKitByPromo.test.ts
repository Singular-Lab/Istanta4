import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { log } from '../../logger';
import { Promo } from '../../models/promo';
import { ServerUtils } from '../../utils/ServerUtils';
import { KitRuntimeController } from '../KitRuntimeController';

vi.mock('../../middleware/authMiddleware', () => ({
  authMiddleware: (_req: any, _res: any, next: any) => next(),
  integrationAuthMiddleware: (_req: any, res: any, next: any) => { res.locals.authVia = 'internal'; next(); },
}));

vi.mock('../../middleware/permissionGuard', () => ({
  permissionGuard: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

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
