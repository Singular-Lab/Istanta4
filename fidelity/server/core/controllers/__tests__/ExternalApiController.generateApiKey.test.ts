import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../middleware/authMiddleware', () => ({
  authMiddleware: (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../../middleware/ephemeralTokenAuthMiddleware', () => ({
  ephemeralTokenAuthMiddleware: (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../../middleware/permissionGuard', () => ({
  permissionGuard: () => (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../di', () => ({ TYPES: {}, container: { get: vi.fn() } }));

import { ExternalApiController } from '../ExternalApiController';

function createApp() {
  const externalApiService = { generateApiKey: vi.fn(async () => ({ apiKey: 'k1' })) };
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => { req.session = { id_utente: 'u-sessione' }; next(); });
  new ExternalApiController(externalApiService as any, {} as any, {} as any).registerRoutes(app);
  return { app, externalApiService };
}

describe('POST /api/external/generate-api-key', () => {
  it('rigenera la chiave del ruolo dell\'utente della sessione', async () => {
    const { app, externalApiService } = createApp();

    await request(app).post('/api/external/generate-api-key').send({}).expect(200);

    expect(externalApiService.generateApiKey).toHaveBeenCalledWith('u-sessione');
  });

  it('ignora un id_utente diverso indicato nella richiesta', async () => {
    const { app, externalApiService } = createApp();

    await request(app).post('/api/external/generate-api-key').send({ id_utente: 'u-altra-gdo' }).expect(200);

    expect(externalApiService.generateApiKey).toHaveBeenCalledWith('u-sessione');
    expect(externalApiService.generateApiKey).not.toHaveBeenCalledWith('u-altra-gdo');
  });
});
