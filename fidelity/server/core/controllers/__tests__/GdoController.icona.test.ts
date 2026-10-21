import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const gdo = vi.hoisted(() => ({
  record: { update: vi.fn(), icona_gdo: Buffer.from('<svg>vecchia</svg>') },
  findByPk: vi.fn(),
}));

vi.mock('../../models', () => ({ GDO: { findByPk: gdo.findByPk } }));

vi.mock('../../middleware/authMiddleware', () => ({
  authMiddleware: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../middleware/permissionGuard', () => ({
  permissionGuard: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { GdoController } from '../GdoController';

function createApp() {
  const app = express();
  app.use((req: any, _res, next) => { req.session = { id_gdo: 'gdo-1' }; next(); });
  new GdoController({} as any, {} as any, {} as any).registerRoutes(app);
  return app;
}

const carica = (svg: string) =>
  request(createApp())
    .post('/api/gdo/icona')
    .attach('icona', Buffer.from(svg), { filename: 'icona.svg', contentType: 'image/svg+xml' });

beforeEach(() => {
  gdo.record.update.mockReset().mockResolvedValue(undefined);
  gdo.findByPk.mockReset().mockResolvedValue(gdo.record);
});

describe("POST /api/gdo/icona", () => {
  it.each([
    ['uno script', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'],
    ['un attributo onload', '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>'],
  ])("rifiuta un SVG con %s e lascia invariata l'icona salvata", async (_caso, svg) => {
    const res = await carica(svg);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/^SVG non valido/);
    expect(gdo.record.update).not.toHaveBeenCalled();
  });

  it('salva un SVG statico', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><circle cx="2" cy="2" r="2" fill="#c00"/></svg>';

    const res = await carica(svg);

    expect(res.status).toBe(200);
    expect(gdo.record.update).toHaveBeenCalledWith({ icona_gdo: Buffer.from(svg) });
  });
});
