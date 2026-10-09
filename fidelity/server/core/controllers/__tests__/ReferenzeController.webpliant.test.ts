import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

// Servizi del container: configurazione Webpliant, kit runtime e webhook minimi
const servizi = vi.hoisted(() => ({
  ConfigService: { getConfigWebPliantFromVolantino: async () => ({ data_fields_refs: [] }) },
  KitRuntimeService: {
    getKitRuntimeById: vi.fn(),
    getKitRuntimeByIdPerWebhook: async () => ({}),
    insertNewFileRuntimeLog: async () => undefined,
  },
  WebhookService: { scatenaEvento: vi.fn(async () => undefined) },
}));
vi.mock('../../di', () => ({
  TYPES: { ConfigService: 'ConfigService', KitRuntimeService: 'KitRuntimeService', WebhookService: 'WebhookService' },
  container: { get: (tipo: keyof typeof servizi) => servizi[tipo] },
}));

const kit = (tipiDiExportInKit: unknown[] = []) => ({ idPromo: 'p1', titolo: 'VOL TO', tipiDiExportInKit });

const rispostaConReferenze = {
  data: { esito: true, errors: [], results: [{ dataFields: [], compiledFields: [], deletedFields: [] }] },
  status: 200,
};

function createApp(rispostaIstanta: { data: unknown; status: number }) {
  const referenzeService = {
    sostituisciReferenzeKit: vi.fn(async () => undefined),
  };
  vi.spyOn(ServerUtils, 'sendToFICOApi').mockResolvedValue(rispostaIstanta as any);

  const app = express();
  app.use((req: any, _res, next) => { req.session = { id_utente: 'u1' }; next(); });
  new ReferenzeController(referenzeService as any).registerRoutes(app);
  return { app, referenzeService };
}

beforeEach(() => {
  servizi.KitRuntimeService.getKitRuntimeById.mockResolvedValue(kit());
  servizi.WebhookService.scatenaEvento.mockClear();
});

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
    expect(referenzeService.sostituisciReferenzeKit).not.toHaveBeenCalled();
  });

  it('Istanta restituisce le referenze: sostituisce quelle esistenti in un solo passo', async () => {
    const { app, referenzeService } = createApp(rispostaConReferenze);

    const res = await request(app).get('/api/richiediReferenzeWebpliant?id=k1');

    expect(res.status).toBe(200);
    expect(referenzeService.sostituisciReferenzeKit).toHaveBeenCalledOnce();
    expect(referenzeService.sostituisciReferenzeKit).toHaveBeenCalledWith('k1', expect.any(Array));
  });

  it('il webhook del kit parte dopo il salvataggio delle referenze', async () => {
    servizi.KitRuntimeService.getKitRuntimeById.mockResolvedValue(kit([{ useWebhook: true, webhookEvents: 'all' }]));
    const { app, referenzeService } = createApp(rispostaConReferenze);

    const res = await request(app).get('/api/richiediReferenzeWebpliant?id=k1');

    expect(res.status).toBe(200);
    expect(servizi.WebhookService.scatenaEvento).toHaveBeenCalledOnce();
    expect(referenzeService.sostituisciReferenzeKit.mock.invocationCallOrder[0])
      .toBeLessThan(servizi.WebhookService.scatenaEvento.mock.invocationCallOrder[0]);
  });

  it('salvataggio fallito: errore e nessun webhook', async () => {
    servizi.KitRuntimeService.getKitRuntimeById.mockResolvedValue(kit([{ useWebhook: true, webhookEvents: 'all' }]));
    const { app, referenzeService } = createApp(rispostaConReferenze);
    referenzeService.sostituisciReferenzeKit.mockRejectedValueOnce(new Error('db non raggiungibile'));

    const res = await request(app).get('/api/richiediReferenzeWebpliant?id=k1');

    expect(res.status).toBe(500);
    expect(servizi.WebhookService.scatenaEvento).not.toHaveBeenCalled();
  });
});
