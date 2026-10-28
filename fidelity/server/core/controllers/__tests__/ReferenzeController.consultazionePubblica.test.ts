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

  it('senza data usa quella di oggi', async () => {
    const { app, referenzeService } = createApp();

    await request(app).post('/api/get_filtered_referenze').send({ idWorkspace: 'w1', item: { content: {} } }).expect(200);

    expect(referenzeService.getFilteredReferenze.mock.calls[0][1]).toBe(oggi);
  });
});
