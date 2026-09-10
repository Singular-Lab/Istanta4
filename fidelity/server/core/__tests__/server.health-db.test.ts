import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

const monitoringMock = vi.hoisted(() => ({
  getConnectionMonitor: vi.fn(),
  getQueryProfiler: vi.fn(),
  initializeConnectionMonitor: vi.fn(() => ({ startMonitoring: vi.fn() })),
  initializeQueryProfiler: vi.fn(() => ({ startProfiling: vi.fn() }))
}));

vi.mock('../monitoring', () => monitoringMock);
vi.mock('../routes', () => ({ applyRoutes: vi.fn() }));
vi.mock('../middlewares', () => ({
  applyMiddlewares: vi.fn(),
  applyErrorHandler: vi.fn()
}));
vi.mock('../session', () => ({
  sessionMiddleware: (_req: any, _res: any, next: any) => next()
}));
vi.mock('../logger', () => ({
  httpLogger: (_req: any, _res: any, next: any) => next(),
  log: { info: vi.fn(), error: vi.fn() },
  tryCatch: vi.fn(async (fn: () => Promise<void> | void) => fn())
}));

import { createHttpApp } from '../server';

describe('GET /api/health/db', () => {
  it('ritorna 503 se il monitor non e inizializzato', async () => {
    monitoringMock.getConnectionMonitor.mockReturnValue(undefined);

    const app = createHttpApp();
    const res = await request(app).get('/api/health/db');

    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      status: 'error',
      message: 'Connection monitor non inizializzato'
    });
  });

  it('ritorna 200 con payload health quando il monitor e disponibile', async () => {
    monitoringMock.getConnectionMonitor.mockReturnValue({
      healthCheck: vi.fn().mockResolvedValue({ ok: true }),
      getMetrics: vi.fn().mockReturnValue({ activeConnections: 2 }),
      getAverageMetrics: vi.fn().mockReturnValue({ queryMs: 12 })
    });

    const app = createHttpApp();
    const res = await request(app).get('/api/health/db');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: 'ok',
      health: { ok: true },
      metrics: { activeConnections: 2 },
      averages: { queryMs: 12 }
    });
  });
});
