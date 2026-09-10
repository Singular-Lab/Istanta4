import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';


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
