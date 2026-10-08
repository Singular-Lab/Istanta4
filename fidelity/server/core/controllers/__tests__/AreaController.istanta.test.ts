import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServerUtils } from '../../utils/ServerUtils';
import { AreaController } from '../AreaController';

vi.mock('../../middleware/authMiddleware', () => ({
  authMiddleware: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../middleware/permissionGuard', () => ({
  permissionGuard: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Spec configurazioni-condivise: se Istanta rifiuta, Fidelity non scrive nel proprio database
function createApp(rispostaIstanta: { data: unknown; status: number; statusText?: string }) {
  const areaService = {
    createArea: vi.fn(async (data: any) => ({ id: data.id, nome: data.nome })),
    deleteArea: vi.fn(async () => true),
  };
  vi.spyOn(ServerUtils, 'sendToFICOApi').mockResolvedValue(rispostaIstanta as any);

  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => { req.session = {}; next(); });
  new AreaController(areaService as any, {} as any).registerRoutes(app);
  return { app, areaService };
}

const area = { id: 'a1', id_gdo: 'g1', codice: 'TO', nome: 'Toscana' };

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PUT /api/ACPV/salvaArea', () => {
  it('Istanta rifiuta: 502 con il motivo di Istanta e nessun salvataggio locale', async () => {
    const { app, areaService } = createApp({ data: { esito: false, errorCode: 0, error: 'Sigla già usata' }, status: 400 });

    const res = await request(app).put('/api/ACPV/salvaArea').send(area);

    expect(res.status).toBe(502);
    expect(res.body.message).toBe('Istanta: Sigla già usata');
    expect(res.body.details).toMatchObject({ service: 'ISTANTA', endpoint: '/ACPV/salvaArea', statusCode: 400 });
    expect(areaService.createArea).not.toHaveBeenCalled();
  });

  it('esito false con motivo vuoto non e piu un successo', async () => {
    const { app, areaService } = createApp({ data: { esito: false, errorCode: 0, error: '' }, status: 200 });

    const res = await request(app).put('/api/ACPV/salvaArea').send(area);

    expect(res.status).toBe(502);
    expect(areaService.createArea).not.toHaveBeenCalled();
  });

  it('Istanta accetta: l\'area viene salvata', async () => {
    const { app, areaService } = createApp({ data: { esito: true, errorCode: 0, error: '' }, status: 200 });

    const res = await request(app).put('/api/ACPV/salvaArea').send(area);

    expect(res.status).toBe(200);
    expect(areaService.createArea).toHaveBeenCalledOnce();
  });
});

describe('DELETE /api/ACPV/eliminaArea/:guidID', () => {
  it('utente non riconosciuto da Istanta: 502, non 401, e area non eliminata', async () => {
    const { app, areaService } = createApp({ data: { esito: false, errorCode: 0, error: 'no_login' }, status: 401 });

    const res = await request(app).delete('/api/ACPV/eliminaArea/a1');

    expect(res.status).toBe(502);
    expect(res.body.message).toBe("Istanta non ha riconosciuto l'utente");
    expect(areaService.deleteArea).not.toHaveBeenCalled();
  });
});
