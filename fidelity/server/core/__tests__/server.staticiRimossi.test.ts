import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../monitoring', () => ({
  getConnectionMonitor: vi.fn(),
  getQueryProfiler: vi.fn(),
  initializeConnectionMonitor: vi.fn(() => ({ startMonitoring: vi.fn() })),
  initializeQueryProfiler: vi.fn(() => ({ startProfiling: vi.fn() }))
}));
vi.mock('../routes', () => ({ applyRoutes: vi.fn() }));
vi.mock('../middlewares', () => ({
  applyMiddlewares: vi.fn(),
  applyErrorHandler: vi.fn()
}));
vi.mock('../session', () => ({
  sessionMiddleware: (req: any, _res: any, next: any) => {
    req.session = {};
    next();
  },
  calculateSessionTimeout: () => 60 * 60 * 1000
}));
vi.mock('../logger', () => ({
  httpLogger: (_req: any, _res: any, next: any) => next(),
  log: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
  tryCatch: vi.fn(async (fn: () => Promise<void> | void) => fn())
}));

import { createHttpApp } from '../server';

// Accept esplicito: senza, il fallback SPA risponderebbe con index.html
describe('cartelle non piu servite in HTTP', () => {
  it('le immagini dei sorgenti non sono raggiungibili su /src/assets/images', async () => {
    const app = await createHttpApp();
    // logo_ext.png esiste in src/assets/images: prima veniva servito cosi' com'e'
    const res = await request(app).get('/src/assets/images/logo_ext.png').set('Accept', 'image/png');

    expect(res.status).toBe(404);
  });

  it('non esiste piu il mount /insegne', async () => {
    const app = await createHttpApp();
    const res = await request(app).get('/insegne/stile.css').set('Accept', 'text/css');

    expect(res.status).toBe(404);
  });
});
