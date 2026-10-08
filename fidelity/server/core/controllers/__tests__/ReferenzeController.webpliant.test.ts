import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServerUtils } from '../../utils/ServerUtils';
import { ReferenzeController } from '../ReferenzeController';

vi.mock('../../middleware/authMiddleware', () => ({
  authMiddleware: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../middleware/permissionGuard', () => ({
  permissionGuard: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Servizi del container: configurazione Webpliant e kit runtime minimi
const servizi = vi.hoisted(() => ({
  ConfigService: { getConfigWebPliantFromVolantino: async () => ({ data_fields_refs: [] }) },
  KitRuntimeService: {
    getKitRuntimeById: async () => ({ idPromo: 'p1', titolo: 'VOL TO', tipiDiExportInKit: [] }),
    getKitRuntimeByIdPerWebhook: async () => ({}),
    insertNewFileRuntimeLog: async () => undefined,
  },
}));
vi.mock('../../di', () => ({
  TYPES: { ConfigService: 'ConfigService', KitRuntimeService: 'KitRuntimeService', WebhookService: 'WebhookService' },
  container: { get: (tipo: keyof typeof servizi) => servizi[tipo] },
}));

function createApp(rispostaIstanta: { data: unknown; status: number }) {
  const referenzeService = {
    bulkEliminateReferenzeFromGuidIdKitRuntime: vi.fn(async () => ({ acknowledged: true })),
    bulkCreateReferenze: vi.fn(async () => undefined),
  };
  vi.spyOn(ServerUtils, 'sendToFICOApi').mockResolvedValue(rispostaIstanta as any);

  const app = express();
  app.use((req: any, _res, next) => { req.session = { id_utente: 'u1' }; next(); });
  new ReferenzeController(referenzeService as any).registerRoutes(app);
  return { app, referenzeService };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/richiediReferenzeWebpliant', () => {
  it.each([
    ['esito false con motivo vuoto', { data: { esito: false, error: '' }, status: 200 }],
    ['risposta senza lista di referenze', { data: { esito: true, errors: [] }, status: 200 }],
    ['Istanta non raggiungibile', { data: null, status: 0 }],
  ])('%s: 502 e le referenze esistenti restano', async (_caso, risposta) => {
    const { app, referenzeService } = createApp(risposta);

    const res = await request(app).get('/api/richiediReferenzeWebpliant?id=k1');

    expect(res.status).toBe(502);
    expect(referenzeService.bulkEliminateReferenzeFromGuidIdKitRuntime).not.toHaveBeenCalled();
    expect(referenzeService.bulkCreateReferenze).not.toHaveBeenCalled();
  });

  it('Istanta restituisce le referenze: sostituisce quelle esistenti', async () => {
    const { app, referenzeService } = createApp({
      data: { esito: true, errors: [], results: [{ dataFields: [], compiledFields: [], deletedFields: [] }] },
      status: 200,
    });

    const res = await request(app).get('/api/richiediReferenzeWebpliant?id=k1');

    expect(res.status).toBe(200);
    expect(referenzeService.bulkEliminateReferenzeFromGuidIdKitRuntime).toHaveBeenCalledWith('k1');
    expect(referenzeService.bulkCreateReferenze).toHaveBeenCalledOnce();
  });
});
