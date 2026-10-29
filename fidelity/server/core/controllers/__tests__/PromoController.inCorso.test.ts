import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { STATO_PROMO } from '../../../../lib/enums';
import { wrapDatabaseError } from '../../../../lib/errors';
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

// Elenco gia' filtrato e ordinato dal service (dal database): il controller lo restituisce cosi' com'e'
const ELENCO = [
  { id: 'recente', nome: 'Recente', stato: STATO_PROMO.ELIMINATA, data_registrazione: '2026-10-14T08:00:00.000Z', numero_kit_collegati: 0, is_deletable: true },
  { id: 'vecchia', nome: 'Vecchia', stato: STATO_PROMO.IN_LAVORAZIONE, data_registrazione: '2026-10-01T08:00:00.000Z', numero_kit_collegati: 2, is_deletable: false },
];

function creaApp(getPromoInCorso: IPromoService['getPromoInCorso']) {
  const promoService = { getPromoInCorso: vi.fn(getPromoInCorso), getAllPromo: vi.fn() };
  const app = express();
  new PromoController(promoService as unknown as IPromoService, {} as IImpostazioniService, {} as IGdoService).registerRoutes(app);
  return { app, promoService };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/promo/in-corso', () => {
  it('restituisce l elenco del service senza rileggere tutte le promo', async () => {
    const { app, promoService } = creaApp(async () => ELENCO as never);

    const res = await request(app).get('/api/promo/in-corso');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(ELENCO);
    expect(promoService.getPromoInCorso).toHaveBeenCalledTimes(1);
    expect(promoService.getAllPromo).not.toHaveBeenCalled();
  });

  it('un errore del database risponde con lo stato del DatabaseError', async () => {
    const errore = wrapDatabaseError(new Error('Errore durante il recupero delle promozioni'), {
      message: 'Errore durante il recupero delle promozioni',
      operation: 'get',
      entity: 'Promo',
    });
    const { app } = creaApp(async () => {
      throw errore;
    });

    const res = await request(app).get('/api/promo/in-corso');

    expect(res.status).toBe(errore.httpStatus);
  });
});
