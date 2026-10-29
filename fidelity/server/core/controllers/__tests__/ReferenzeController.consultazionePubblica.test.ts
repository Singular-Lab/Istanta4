import dayjs from 'dayjs';
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../middleware/authMiddleware', () => ({
  authMiddleware: (req: any, res: any, next: any) => (req.session?.id_utente ? next() : res.status(401).end()),
}));

// Permessi presi dalla sessione finta del test
vi.mock('../../middleware/permissionGuard', () => ({
  permissionGuard: (codice: string) => (req: any, _res: any, next: any) =>
    (req.session?.permessi ?? []).includes(codice) ? next() : next(Object.assign(new Error('Permesso negato'), { httpStatus: 403 })),
}));

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../di', () => ({ TYPES: {}, container: { get: vi.fn() } }));

import type { IPromoRepository } from '../../repositories/PromoRepository';
import type { IWebPliantService } from '../../interfaces/IWebPliantService';
import { ReferenzeService } from '../../services/ReferenzeService';
import { ReferenzeController } from '../ReferenzeController';

// /api/get_filtered_referenze e' pubblica (volantino WebPliant): la data e la modalita' editor
// indicate dal browser non devono mostrare in anticipo le promo future (spec referenze-webpliant)

const oggi = dayjs().format('YYYY-MM-DD');
const futura = dayjs().add(30, 'day').format('YYYY-MM-DD');

function createApp(session?: Record<string, unknown>) {
  const referenzeService = { getFilteredReferenze: vi.fn().mockResolvedValue([]) };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).session = session;
    next();
  });
  new ReferenzeController(referenzeService as any).registerRoutes(app);
  return { app, referenzeService };
}

const richiesta = { idWorkspace: 'w1', dataSelezionata: futura, item: { content: {} }, isEditor: true };

describe('POST /api/get_filtered_referenze', () => {
  it('a una richiesta anonima con una data futura risponde con la vista di oggi, non da editor', async () => {
    const { app, referenzeService } = createApp();

    await request(app).post('/api/get_filtered_referenze').send(richiesta).expect(200);

    const [, data, , , , , isEditor] = referenzeService.getFilteredReferenze.mock.calls[0];
    expect(data).toBe(oggi);
    expect(isEditor).toBe(false);
  });

  it('un utente senza il permesso di configurare WebPliant non sceglie la data', async () => {
    const { app, referenzeService } = createApp({ id_utente: 'u1', permessi: ['webpliant.visualizza'] });

    await request(app).post('/api/get_filtered_referenze').send(richiesta).expect(200);

    expect(referenzeService.getFilteredReferenze.mock.calls[0][1]).toBe(oggi);
  });

  it('chi configura WebPliant consulta alla data scelta e in modalita editor', async () => {
    const { app, referenzeService } = createApp({ id_utente: 'u1', permessi: ['webpliant.configura'] });

    await request(app).post('/api/get_filtered_referenze').send(richiesta).expect(200);

    const [, data, , , , , isEditor] = referenzeService.getFilteredReferenze.mock.calls[0];
    expect(data).toBe(futura);
    expect(isEditor).toBe(true);
  });

  it('senza l\'elemento della pagina risponde 400 e non consulta le referenze', async () => {
    const { app, referenzeService } = createApp();

    const res = await request(app).post('/api/get_filtered_referenze').send({ idWorkspace: 'w1', dataSelezionata: oggi });

    expect(res.status).toBe(400);
    expect(referenzeService.getFilteredReferenze).not.toHaveBeenCalled();
  });

  it('senza data usa quella di oggi', async () => {
    const { app, referenzeService } = createApp();

    await request(app).post('/api/get_filtered_referenze').send({ idWorkspace: 'w1', item: { content: {} } }).expect(200);

    expect(referenzeService.getFilteredReferenze.mock.calls[0][1]).toBe(oggi);
  });
});

// Spec referenze-webpliant, "Referenze pubbliche per area e canale": la ricerca pubblica senza
// area o canale e' una richiesta non valida
describe('POST /api/ricercaReferenzePromo', () => {
  function createAppRicerca() {
    const getReferenzeWebPliant = vi.fn().mockResolvedValue([]);
    const service = new ReferenzeService({} as unknown as IPromoRepository, { getReferenzeWebPliant } as unknown as IWebPliantService);
    const app = express();
    app.use(express.json());
    new ReferenzeController(service).registerRoutes(app);
    return { app, getReferenzeWebPliant };
  }

  it.each([
    ['senza area', { query: 'pasta', idWorkspace: 'w1', idCanale: 'c1' }],
    ['senza canale', { query: 'pasta', idWorkspace: 'w1', idArea: 'a1', idCanale: null }],
    ['senza query', { idWorkspace: 'w1', idArea: 'a1', idCanale: 'c1' }],
  ])('%s risponde 400', async (_caso, corpo) => {
    const { app, getReferenzeWebPliant } = createAppRicerca();

    const res = await request(app).post('/api/ricercaReferenzePromo').send(corpo);

    expect(res.status).toBe(400);
    expect(getReferenzeWebPliant).not.toHaveBeenCalled();
  });
});
