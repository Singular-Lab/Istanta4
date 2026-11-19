import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import config from '../../config';
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

const area = { id: 'a1', id_gdo: 'g1', codice: 'TO', nome: 'Toscana' };

// Spec configurazioni-condivise: se Istanta rifiuta, Fidelity non scrive nel proprio database
function createApp(rispostaIstanta: { data: unknown; status: number; statusText?: string }) {
  // L'area a1 esiste gia' nella GDO g1: i salvataggi del test la modificano
  const areaService = {
    createArea: vi.fn(async (data: any) => ({ id: data.id, nome: data.nome })),
    deleteArea: vi.fn(async () => true),
    getAreaById: vi.fn(async (id: string): Promise<Record<string, unknown> | null> => (id === area.id ? area : null)),
    getAreasByGDOId: vi.fn(async (_idGdo: string): Promise<Array<Record<string, unknown>>> => [area]),
  };
  vi.spyOn(ServerUtils, 'sendToFICOApi').mockResolvedValue(rispostaIstanta as any);

  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => { req.session = {}; next(); });
  new AreaController(areaService as any, {} as any).registerRoutes(app);
  return { app, areaService };
}


const ambienteOriginale = config.NODE_ENV;

afterEach(() => {
  vi.restoreAllMocks();
  config.NODE_ENV = ambienteOriginale;
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

describe('development con Istanta non raggiungibile', () => {
  const NESSUNA_RISPOSTA = { data: null, status: 0, statusText: 'fetch failed' };

  it('l\'area si salva in FP e la risposta segnala la dissincronia', async () => {
    config.NODE_ENV = 'development';
    const { app, areaService } = createApp(NESSUNA_RISPOSTA);

    const res = await request(app).put('/api/ACPV/salvaArea').send(area);

    expect(res.status).toBe(200);
    expect(areaService.createArea).toHaveBeenCalledOnce();
    expect(res.headers['x-istanta-dissincronia']).toBe('/ACPV/salvaArea');
  });

  it('l\'area si elimina in FP e la risposta segnala la dissincronia', async () => {
    config.NODE_ENV = 'development';
    const { app, areaService } = createApp(NESSUNA_RISPOSTA);

    const res = await request(app).delete('/api/ACPV/eliminaArea/a1');

    expect(areaService.deleteArea).toHaveBeenCalledWith('a1');
    expect(res.headers['x-istanta-dissincronia']).toBe('/ACPV/eliminaArea');
  });

  it('in produzione resta l\'errore e l\'area non si salva', async () => {
    config.NODE_ENV = 'production';
    const { app, areaService } = createApp(NESSUNA_RISPOSTA);

    const res = await request(app).put('/api/ACPV/salvaArea').send(area);

    expect(res.status).toBe(502);
    expect(areaService.createArea).not.toHaveBeenCalled();
    expect(res.headers['x-istanta-dissincronia']).toBeUndefined();
  });
});

// Aree proxy (lib/areeCanali/proxy.ts): Istanta le conosce come aree qualsiasi, senza i membri
describe('aree proxy', () => {
  const ISTANTA_OK = { data: { esito: true, errorCode: 0, error: '' }, status: 200 };
  const liguria = { id: 'li', id_gdo: 'g1', codice: 'LI', nome: 'Liguria', membri: [] };
  const toli = { id: 'toli', id_gdo: 'g1', codice: 'TOLI', nome: 'Toscana + Liguria', membri: ['a1', 'li'] };

  it("un'area proxy nuova si salva in FP con i membri e va a Istanta come un'area qualsiasi", async () => {
    config.NODE_ENV = 'production';
    const { app, areaService } = createApp(ISTANTA_OK);
    areaService.getAreasByGDOId.mockResolvedValue([area, liguria]);

    const res = await request(app).put('/api/ACPV/salvaArea').send({ codice: 'TOLI', nome: 'Toscana + Liguria', id_gdo: 'g1', membri: ['li', 'a1'] });

    expect(res.status).toBe(201);
    const perIstanta = vi.mocked(ServerUtils.sendToFICOApi).mock.calls[0][3] as Record<string, unknown>;
    expect(perIstanta).toMatchObject({ sigla: 'TOLI', nome: 'Toscana + Liguria' });
    expect(perIstanta).not.toHaveProperty('membri');
    expect(areaService.createArea).toHaveBeenCalledWith(expect.objectContaining({ codice: 'TOLI', membri: ['li', 'a1'] }));
  });

  it("un'area esistente non diventa un proxy e un proxy con un solo membro non va", async () => {
    const { app, areaService } = createApp({ data: null, status: 0 });
    areaService.getAreasByGDOId.mockResolvedValue([area, liguria]);

    const conversione = await request(app).put('/api/ACPV/salvaArea').send({ ...area, membri: ['li', 'a1'] });
    const unSolo = await request(app).put('/api/ACPV/salvaArea').send({ codice: 'X', nome: 'X', id_gdo: 'g1', membri: ['li'] });

    expect(conversione.status).toBe(400);
    expect(conversione.body.message).toContain('Una voce esistente non diventa un proxy');
    expect(unSolo.status).toBe(400);
    expect(unSolo.body.message).toBe('Un proxy ha almeno 2 membri.');
    expect(areaService.createArea).not.toHaveBeenCalled();
    expect(ServerUtils.sendToFICOApi).not.toHaveBeenCalled();
  });

  it("un'area membro di un proxy non si elimina; un'area proxy si elimina anche in Istanta", async () => {
    config.NODE_ENV = 'production';
    const { app, areaService } = createApp(ISTANTA_OK);
    areaService.getAreaById.mockImplementation(async (id: string) => (id === 'toli' ? toli : area));
    areaService.getAreasByGDOId.mockResolvedValue([area, liguria, toli]);

    const membro = await request(app).delete('/api/ACPV/eliminaArea/a1');
    expect(membro.status).toBe(409);
    expect(membro.body.message).toBe("L'area è membro di Toscana + Liguria: toglila prima dal proxy.");
    expect(ServerUtils.sendToFICOApi).not.toHaveBeenCalled();

    const proxy = await request(app).delete('/api/ACPV/eliminaArea/toli');
    expect(proxy.status).toBe(200);
    expect(areaService.deleteArea).toHaveBeenCalledWith('toli');
    expect(areaService.deleteArea).toHaveBeenCalledTimes(1);
    expect(ServerUtils.sendToFICOApi).toHaveBeenCalledOnce();
    expect(String(vi.mocked(ServerUtils.sendToFICOApi).mock.calls[0][1])).toContain('/ACPV/eliminaArea/toli');
  });
});
