import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../middleware/authMiddleware', () => ({
  authMiddleware: (_req: any, _res: any, next: any) => next(),
  integrationAuthMiddleware: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../middleware/permissionGuard', () => ({
  permissionGuard: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Il container risolve tutti i servizi all'import: per le rotte qui non serve
vi.mock('../../di', () => ({
  TYPES: {},
  container: { get: vi.fn() },
}));

vi.mock('../../../ws-server', () => ({
  emitToClients: () => undefined,
}));

import { ImpostazioniController } from '../ImpostazioniController';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => { req.session = { id_utente: 'u1', private_key: 'chiave' }; next(); });
  new ImpostazioniController({} as any, {} as any, {} as any).registerRoutes(app);
  return app;
}

describe('ImpostazioniController senza MongoDB', () => {
  it('PUT /api/update_data_fields_translation_map non esiste piu', async () => {
    const res = await request(createApp()).put('/api/update_data_fields_translation_map').send({});

    expect(res.status).toBe(404);
  });

  it('le altre rotte del controller restano registrate', async () => {
    const res = await request(createApp()).get('/api/getGestionePagineSingular');

    expect(res.status).not.toBe(404);
  });
});
