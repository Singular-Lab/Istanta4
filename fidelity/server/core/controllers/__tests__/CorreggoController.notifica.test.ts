import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import config from '../../config';
import type { IKitRuntimeService } from '../../interfaces/IKitRuntimeService';
import type { IServiceFacade } from '../../interfaces/IServiceFacade';
import { CorreggoController } from '../CorreggoController';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

/*
 * PUT /api/notificaRisultatoPubblicazioneSuCorreggo serve solo al Correggo legacy, non piu' in uso:
 * qui si verifica soltanto che la rotta sia protetta dal Bearer con FICO_SECRET.
 */

const ROTTA = '/api/notificaRisultatoPubblicazioneSuCorreggo';
const corpo = { guidIdKitRuntime: 'kit-1', id_vol: 'vol-1', error: '', versione: 2 };

function creaApp() {
  // Il kit non esiste: dopo l'autenticazione la rotta si ferma alla prima lettura
  const kitRuntimeService = {
    getKitRuntimeById: vi.fn().mockResolvedValue(null),
    getFilesRuntimeByIdKitRuntime: vi.fn(),
    getFileRunTimeLogByNomeFileEIdKitRuntime: vi.fn(),
    updateSingleFileRuntimeLog: vi.fn(),
  };
  const facadeService = { getAllTipiExport: vi.fn() };

  const app = express();
  app.use(express.json());
  new CorreggoController(
    kitRuntimeService as unknown as IKitRuntimeService,
    facadeService as unknown as IServiceFacade
  ).registerRoutes(app);
  return { app, kitRuntimeService, facadeService };
}

/** Nessun servizio deve essere stato interrogato. */
const nessunServizioChiamato = ({ kitRuntimeService, facadeService }: ReturnType<typeof creaApp>) => {
  for (const funzione of [...Object.values(kitRuntimeService), ...Object.values(facadeService)]) {
    expect(funzione).not.toHaveBeenCalled();
  }
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PUT /api/notificaRisultatoPubblicazioneSuCorreggo: autenticazione', () => {
  it('senza Authorization risponde 401 e non interroga alcun servizio', async () => {
    const contesto = creaApp();

    const res = await request(contesto.app).put(ROTTA).send(corpo);

    expect(res.status).toBe(401);
    nessunServizioChiamato(contesto);
  });

  it('con un Bearer sbagliato della stessa lunghezza risponde 401 e non rimanda l\'header ricevuto', async () => {
    const contesto = creaApp();
    const segreto = config.FICO_SECRET;
    const sbagliato = `${segreto.slice(0, -1)}${segreto.endsWith('x') ? 'y' : 'x'}`;
    expect(sbagliato).toHaveLength(segreto.length);

    const res = await request(contesto.app).put(ROTTA).set('Authorization', `Bearer ${sbagliato}`).send(corpo);

    expect(res.status).toBe(401);
    expect(JSON.stringify(res.body)).not.toContain(sbagliato);
    nessunServizioChiamato(contesto);
  });

  it.each([
    { caso: 'più corto', segreto: () => config.FICO_SECRET.slice(0, 3) },
    { caso: 'più lungo', segreto: () => `${config.FICO_SECRET}-con-un-suffisso-molto-piu-lungo` },
  ])('con un segreto di lunghezza diversa ($caso) risponde 401, non 500: il confronto a tempo costante non dipende dalla lunghezza', async ({ segreto }) => {
    const contesto = creaApp();

    const res = await request(contesto.app).put(ROTTA).set('Authorization', `Bearer ${segreto()}`).send(corpo);

    expect(res.status).toBe(401);
    nessunServizioChiamato(contesto);
  });

  it('con il Bearer corretto passa l\'autenticazione e cerca il kit', async () => {
    const contesto = creaApp();

    const res = await request(contesto.app).put(ROTTA).set('Authorization', `Bearer ${config.FICO_SECRET}`).send(corpo);

    expect(res.status).not.toBe(401);
    // Kit inesistente: la richiesta arriva al servizio e si ferma li', con 400
    expect(contesto.kitRuntimeService.getKitRuntimeById).toHaveBeenCalledWith('kit-1');
    expect(res.status).toBe(400);
  });
});
