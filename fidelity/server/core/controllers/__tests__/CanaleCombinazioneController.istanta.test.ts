import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import config from '../../config';
import { sequelize } from '../../db';
import { CanaleService } from '../../services/CanaleService';
import { ServerUtils } from '../../utils/ServerUtils';
import { CanaleController } from '../CanaleController';
import { CombinazioneAreeCanaliController } from '../CombinazioneAreeCanaliController';

vi.mock('../../middleware/authMiddleware', () => ({
  authMiddleware: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../middleware/permissionGuard', () => ({
  permissionGuard: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// In development, Istanta non raggiungibile non blocca canali e combinazioni: si salva in FP con un avviso

const NESSUNA_RISPOSTA = { data: null, status: 0, statusText: 'fetch failed' };
const ambienteOriginale = config.NODE_ENV;

function createApp(ambiente: 'development' | 'production') {
  config.NODE_ENV = ambiente;
  vi.spyOn(ServerUtils, 'sendToFICOApi').mockResolvedValue(NESSUNA_RISPOSTA as any);
  // Dopo l'eliminazione del canale si aggiorna la view: nessun database nei test
  vi.spyOn(sequelize, 'query').mockResolvedValue([] as any);
  // Nessun canale gia' salvato nella GDO: niente doppioni ne' proxy da controllare
  const canaleRepository = {
    delete: vi.fn(async () => true),
    findById: vi.fn(async (_id: string): Promise<Record<string, unknown> | null> => null),
    findByGdoId: vi.fn(async (_idGdo: string): Promise<Array<Record<string, unknown>>> => []),
  };
  const canaleService = new CanaleService(canaleRepository as any);
  const createCanale = vi.spyOn(canaleService, 'createCanale').mockImplementation(async (data: any) => ({ id: data.id }) as any);
  const combinazioneService = {
    createCombinazione: vi.fn(async (data: any) => ({ id: data.guidID })),
    deleteCombinazione: vi.fn(async () => true),
  };

  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => { req.session = {}; next(); });
  new CanaleController(canaleService).registerRoutes(app);
  new CombinazioneAreeCanaliController(combinazioneService as any).registerRoutes(app);
  return { app, canaleRepository, createCanale, combinazioneService };
}

afterEach(() => {
  vi.restoreAllMocks();
  config.NODE_ENV = ambienteOriginale;
});

describe('development con Istanta non raggiungibile', () => {
  it('il canale si salva in FP e la risposta segnala la dissincronia', async () => {
    const { app, createCanale } = createApp('development');

    const res = await request(app).put('/api/ACPV/salvaCanale').send({ id: 'c1', nome: 'TuDay', sigla: 'tuday', idGDO: 'g1' });

    expect(res.status).toBeLessThan(300);
    expect(createCanale).toHaveBeenCalledOnce();
    expect(res.headers['x-istanta-dissincronia']).toBe('/ACPV/salvaCanale');
  });

  it('il canale si elimina in FP e la risposta segnala la dissincronia', async () => {
    const { app, canaleRepository } = createApp('development');

    const res = await request(app).delete('/api/ACPV/eliminaCanale/c1');

    expect(canaleRepository.delete).toHaveBeenCalledWith('c1');
    expect(res.headers['x-istanta-dissincronia']).toBe('/ACPV/eliminaCanale');
  });

  it('la combinazione si salva e si elimina in FP, segnalando la dissincronia', async () => {
    const { app, combinazioneService } = createApp('development');

    const salvata = await request(app)
      .put('/api/ACPV/setCombinazione')
      .send({ guidID: 'k1', guidIDCanale: 'c1', guidIDArea: 'a1', enabled: true, idGDO: 'g1' });
    const eliminata = await request(app).delete('/api/ACPV/deleteCombinazione/k1');

    expect(combinazioneService.createCombinazione).toHaveBeenCalledOnce();
    expect(salvata.headers['x-istanta-dissincronia']).toBe('/ACPV/setCombinazione');
    expect(combinazioneService.deleteCombinazione).toHaveBeenCalledWith('k1');
    expect(eliminata.headers['x-istanta-dissincronia']).toBe('/ACPV/eliminaCombinazione');
  });
});

describe('produzione con Istanta non raggiungibile', () => {
  it('canale e combinazione non si salvano', async () => {
    const { app, createCanale, combinazioneService } = createApp('production');

    const canale = await request(app).put('/api/ACPV/salvaCanale').send({ id: 'c1', nome: 'TuDay', sigla: 'tuday', idGDO: 'g1' });
    const combinazione = await request(app)
      .put('/api/ACPV/setCombinazione')
      .send({ guidID: 'k1', guidIDCanale: 'c1', guidIDArea: 'a1', enabled: true, idGDO: 'g1' });

    expect(canale.status).toBe(502);
    expect(combinazione.status).toBe(502);
    expect(createCanale).not.toHaveBeenCalled();
    expect(combinazioneService.createCombinazione).not.toHaveBeenCalled();
  });
});

// Canali proxy (lib/areeCanali/proxy.ts): Istanta li conosce come canali qualsiasi, senza i membri,
// e cosi' le loro combinazioni
describe('canali e combinazioni proxy', () => {
  const ISTANTA_OK = { data: { esito: true, errorCode: 0, error: '' }, status: 200 };
  const istantaRisponde = () => vi.mocked(ServerUtils.sendToFICOApi).mockResolvedValue(ISTANTA_OK as Awaited<ReturnType<typeof ServerUtils.sendToFICOApi>>);
  const canale = (id: string, codice: string, nome: string, membri: string[] = []) =>
    ({ id_canali: id, codice_canali: codice, nome_canali: nome, id_gdo_canali: 'g1', membri_canali: membri });

  it('un canale proxy nuovo si salva in FP con i membri e va a Istanta come un canale qualsiasi', async () => {
    const { app, canaleRepository, createCanale } = createApp('production');
    istantaRisponde();
    canaleRepository.findByGdoId.mockResolvedValue([canale('ss', 'SS', 'Superstore'), canale('cn', 'CN', 'Conad')]);

    const res = await request(app).put('/api/ACPV/salvaCanale').send({ nome: 'Superstore + Conad', sigla: 'SSCN', idGDO: 'g1', membri: ['cn', 'ss'] });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ esito: true, isUpdate: false });
    const perIstanta = vi.mocked(ServerUtils.sendToFICOApi).mock.calls[0][3] as Record<string, unknown>;
    expect(perIstanta).toMatchObject({ sigla: 'SSCN', nome: 'Superstore + Conad' });
    expect(perIstanta).not.toHaveProperty('membri');
    expect(createCanale).toHaveBeenCalledWith(expect.objectContaining({ sigla: 'SSCN', membri: ['cn', 'ss'] }));
  });

  it('un codice gia\' usato nella GDO o un proxy dentro un proxy si rifiutano senza scrivere da nessuna parte', async () => {
    const { app, canaleRepository, createCanale } = createApp('production');
    canaleRepository.findByGdoId.mockResolvedValue([
      canale('ss', 'SS', 'Superstore'), canale('cn', 'CN', 'Conad'), canale('sscn', 'SSCN', 'Superstore + Conad', ['ss', 'cn']),
    ]);

    const doppio = await request(app).put('/api/ACPV/salvaCanale').send({ nome: 'Altro', sigla: 'ss', idGDO: 'g1' });
    const annidato = await request(app).put('/api/ACPV/salvaCanale').send({ nome: 'Tutti', sigla: 'TUTTI', idGDO: 'g1', membri: ['sscn', 'cn'] });

    expect(doppio.status).toBe(400);
    expect(doppio.body.message).toBe('Il codice ss è già usato dal canale Superstore.');
    expect(annidato.status).toBe(400);
    expect(annidato.body.message).toContain('Superstore + Conad è a sua volta un proxy');
    expect(ServerUtils.sendToFICOApi).not.toHaveBeenCalled();
    expect(createCanale).not.toHaveBeenCalled();
  });

  it('un canale membro di un proxy non si elimina; un proxy si elimina anche in Istanta', async () => {
    const { app, canaleRepository } = createApp('production');
    istantaRisponde();
    const proxy = canale('sscn', 'SSCN', 'Superstore + Conad', ['ss', 'cn']);
    canaleRepository.findById.mockImplementation(async (id: string) => (id === 'ss' ? canale('ss', 'SS', 'Superstore') : proxy));
    canaleRepository.findByGdoId.mockResolvedValue([canale('ss', 'SS', 'Superstore'), canale('cn', 'CN', 'Conad'), proxy]);

    const membro = await request(app).delete('/api/ACPV/eliminaCanale/ss');
    expect(membro.status).toBe(409);
    expect(membro.body.message).toBe('Il canale è membro di Superstore + Conad: toglilo prima dal proxy.');
    expect(canaleRepository.delete).not.toHaveBeenCalled();
    expect(ServerUtils.sendToFICOApi).not.toHaveBeenCalled();

    const eliminato = await request(app).delete('/api/ACPV/eliminaCanale/sscn');
    expect(eliminato.status).toBe(200);
    expect(canaleRepository.delete).toHaveBeenCalledWith('sscn');
    expect(String(vi.mocked(ServerUtils.sendToFICOApi).mock.calls[0][1])).toContain('/ACPV/eliminaCanale/sscn');
  });

  it('una combinazione con un canale o un\'area proxy si salva e si elimina anche in Istanta', async () => {
    const { app, combinazioneService } = createApp('production');
    istantaRisponde();

    const salvata = await request(app)
      .put('/api/ACPV/setCombinazione')
      .send({ guidIDCanale: 'sscn', guidIDArea: 'la', enabled: true, idGDO: 'g1' });
    const eliminata = await request(app).delete('/api/ACPV/deleteCombinazione/k9');

    expect(salvata.status).toBe(201);
    expect(salvata.body).toMatchObject({ esito: true, isUpdate: false });
    expect(combinazioneService.createCombinazione).toHaveBeenCalledOnce();
    expect(combinazioneService.deleteCombinazione).toHaveBeenCalledWith('k9');
    expect(eliminata.status).toBe(200);
    const chiamate = vi.mocked(ServerUtils.sendToFICOApi).mock.calls.map(([, url]) => String(url));
    expect(chiamate).toEqual([expect.stringContaining('/ACPV/setCombinazione'), expect.stringContaining('/ACPV/eliminaCombinazione/k9')]);
  });

  it('lo stato inviato come testo "false" disattiva la combinazione, anche verso Istanta', async () => {
    const { app, combinazioneService } = createApp('development');

    await request(app)
      .put('/api/ACPV/setCombinazione')
      .send({ guidID: 'k1', guidIDCanale: 'ss', guidIDArea: 'la', enabled: 'false', idGDO: 'g1' });

    expect(combinazioneService.createCombinazione).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
    expect((vi.mocked(ServerUtils.sendToFICOApi).mock.calls[0][3] as Record<string, unknown>).enabled).toBe(false);
  });
});
