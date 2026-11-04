import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { STATO_PROMO } from '../../../../lib/enums';
import type { IGdoService } from '../../interfaces/IGdoService';
import type { IImpostazioniService } from '../../interfaces/IImpostazioniService';
import type { IPromoService } from '../../interfaces/IPromoService';
import { PromoController } from '../PromoController';

vi.mock('../../middleware/authMiddleware', () => ({
  authMiddleware: (_req: Request, _res: Response, next: NextFunction) => {
    next();
  },
}));

vi.mock('../../middleware/permissionGuard', () => ({
  permissionGuard: () => (_req: Request, _res: Response, next: NextFunction) => {
    next();
  },
}));

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// POST /api/promo/verifica-archivio: il volantino-analyzer chiede quali promo e liste dell'archivio
// storico sono gia' in FP. Il controller valida l'elenco dei nomi e restituisce la risposta del service.

const ESITO = [
  {
    nome: 'P2101_VOL_07-01-21',
    promo: [{
      id: 'p1',
      nome: 'P2101_VOL_07-01-21',
      stato: STATO_PROMO.ARCHIVIATA,
      validita_dal: '2021-01-07T00:00:00.000Z',
      validita_al: '2021-01-16T00:00:00.000Z',
      tracciati: [{ id: 't1', filename: '01_SSCN_070121.xlsx', nome: '01_SSCN_070121.xlsx', md5: '0cc175b9c0f1b6a831c399e269772661' }],
    }],
  },
  { nome: 'P2102_VOL_21-01-21', promo: [] },
];

function creaApp() {
  const promoService = { verificaArchivio: vi.fn(async () => ESITO as never) };
  const app = express();
  app.use(express.json());
  new PromoController(promoService as unknown as IPromoService, {} as IImpostazioniService, {} as IGdoService).registerRoutes(app);
  return { app, promoService };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /api/promo/verifica-archivio', () => {
  it('restituisce per ogni nome le promo e i tracciati trovati dal service', async () => {
    const { app, promoService } = creaApp();

    const res = await request(app).post('/api/promo/verifica-archivio').send({ nomi: ['P2101_VOL_07-01-21', 'P2102_VOL_21-01-21'] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(ESITO);
    expect(promoService.verificaArchivio).toHaveBeenCalledWith(['P2101_VOL_07-01-21', 'P2102_VOL_21-01-21']);
  });

  it.each([
    ['senza elenco', {}],
    ['con un elenco vuoto', { nomi: [] }],
    ['con un elenco che non e\' un array', { nomi: 'P2101_VOL_07-01-21' }],
    ['con piu\' di 2000 nomi', { nomi: Array.from({ length: 2001 }, (_, i) => `P${i}`) }],
  ])('rifiuta una richiesta %s indicando l elenco dei nomi', async (_caso, corpo) => {
    const { app, promoService } = creaApp();

    const res = await request(app).post('/api/promo/verifica-archivio').send(corpo);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/^nomi:/);
    expect(promoService.verificaArchivio).not.toHaveBeenCalled();
  });

  it.each([
    ['un numero', 42],
    ['un oggetto', { nome: 'P2101' }],
    ['un testo vuoto', '   '],
  ])('rifiuta un nome che e\' %s', async (_caso, nome) => {
    const { app, promoService } = creaApp();

    const res = await request(app).post('/api/promo/verifica-archivio').send({ nomi: ['P2101_VOL_07-01-21', nome] });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/^nomi:/);
    expect(promoService.verificaArchivio).not.toHaveBeenCalled();
  });

  it('accetta esattamente 2000 nomi', async () => {
    const { app } = creaApp();

    const res = await request(app).post('/api/promo/verifica-archivio').send({ nomi: Array.from({ length: 2000 }, (_, i) => `P${i}`) });

    expect(res.status).toBe(200);
  });
});
