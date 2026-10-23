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
  const canaleRepository = { delete: vi.fn(async () => true) };
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
