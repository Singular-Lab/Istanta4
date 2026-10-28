import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../middleware/authMiddleware', () => ({
  authMiddleware: (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../../middleware/permissionGuard', () => ({
  permissionGuard: () => (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../../ws-server', () => ({
  emitToClients: () => undefined,
}));

import { ConfigController } from '../ConfigController';

const configCompleta = {
  webpliant: { css_text: '', stili: [] },
  color: '#03045e',
  dashboard: { widgets: ['vendite'] },
  dashboardsByRole: { GDO: {} },
  maintenanceAlert: { attivo: true },
  regoleMenabo: { regole: [] },
  funzionalita: { momenti: true, menabo: false },
};

function createApp(session?: Record<string, unknown>) {
  const configService = { get_config: vi.fn().mockResolvedValue(configCompleta) };
  const app = express();
  app.use((req, _res, next) => {
    (req as any).session = session;
    next();
  });
  new ConfigController(configService as any).registerRoutes(app);
  return app;
}

describe('GET /api/get_config', () => {
  it('senza sessione restituisce solo cio\' che serve alle pagine pubbliche di WebPliant', async () => {
    const res = await request(createApp()).get('/api/get_config').expect(200);

    expect(res.body).toEqual({ webpliant: configCompleta.webpliant, color: configCompleta.color });
  });

  it('con la sessione restituisce la configurazione completa', async () => {
    const res = await request(createApp({ id_utente: 'u1' })).get('/api/get_config').expect(200);

    expect(res.body).toEqual(configCompleta);
  });
});
