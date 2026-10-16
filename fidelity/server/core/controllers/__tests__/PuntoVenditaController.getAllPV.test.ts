import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TIPO_UTENTI } from '../../../../lib/enums';

vi.mock('../../middleware/authMiddleware', () => ({
  authMiddleware: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../middleware/permissionGuard', () => ({
  permissionGuard: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// L'anagrafica lega l'utente della sessione alla GDO "gdo-sessione"; il resto dei modelli resta quello vero.
vi.mock('../../models', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  UtentiGDO: { findOne: vi.fn(async () => ({ id_gdo_utentegdo: 'gdo-sessione', id_ruolo_utente_gdo: null })) },
}));

import { PuntoVenditaController } from '../PuntoVenditaController';

/** ruoli-permessi, "Amministrazione limitata alla propria GDO": scenario "Punti vendita di un'altra GDO". */
function createApp(tipo_utente: TIPO_UTENTI) {
  const puntoVenditaService = {
    getAllPuntiVenditaFromIdGDO: vi.fn(async (idGDO: string) => [{ id: 'pv1', id_gdo: idGDO }]),
  };
  const app = express();
  app.use((req: any, _res, next) => { req.session = { id_utente: 'u1', tipo_utente }; next(); });
  new PuntoVenditaController(puntoVenditaService as any, {} as any, {} as any).registerRoutes(app);
  return { app, puntoVenditaService };
}

beforeEach(() => vi.clearAllMocks());

describe('GET /api/getAllPV', () => {
  it('un utente GDO che indica un\'altra GDO riceve solo i punti vendita della propria', async () => {
    const { app, puntoVenditaService } = createApp(TIPO_UTENTI.GDO);

    const res = await request(app).get('/api/getAllPV').query({ IdGDO: 'altra-gdo' });

    expect(res.status).toBe(200);
    expect(puntoVenditaService.getAllPuntiVenditaFromIdGDO).toHaveBeenCalledWith('gdo-sessione');
    expect(res.body).toEqual([{ id: 'pv1', id_gdo: 'gdo-sessione' }]);
  });

  it('senza GDO nella richiesta vale quella della sessione', async () => {
    const { app, puntoVenditaService } = createApp(TIPO_UTENTI.MARKETING);

    await request(app).get('/api/getAllPV');

    expect(puntoVenditaService.getAllPuntiVenditaFromIdGDO).toHaveBeenCalledWith('gdo-sessione');
  });

  it('un utente Agenzia puo indicare la GDO su cui opera', async () => {
    const { app, puntoVenditaService } = createApp(TIPO_UTENTI.AGENZIA);

    await request(app).get('/api/getAllPV').query({ IdGDO: 'gdo-cliente' });

    expect(puntoVenditaService.getAllPuntiVenditaFromIdGDO).toHaveBeenCalledWith('gdo-cliente');
  });
});
