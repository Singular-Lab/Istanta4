import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../logger', () => ({ log: { warn: vi.fn(), debug: vi.fn() } }));

import config from '../config';
import { applyCors } from '../cors';
import { UXP_CLIENT_TOKEN_HEADER } from '../middleware/uxpOriginSession';

const createApp = () => {
  const app = express();
  applyCors(app);
  app.get('/api/ping', (_req, res) => res.json({ ok: true }));
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const appError = error as { httpStatus?: number; code?: string };
    res.status(appError.httpStatus || 500).json({ code: appError.code });
  });
  return app;
};

describe('CORS della webview UXP locale', () => {
  it('mantiene invariato un origin esplicitamente autorizzato', async () => {
    const res = await request(createApp())
      .get('/api/ping')
      .set('Origin', config.CLIENT_URL);

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(config.CLIENT_URL);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('rifiuta Origin null quando non viene richiesto il trasporto UXP protetto', async () => {
    const res = await request(createApp())
      .options('/api/ping')
      .set('Origin', 'null')
      .set('Access-Control-Request-Method', 'GET');

    expect(res.status).toBe(403);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('completa il preflight opaco soltanto con l header UXP e senza wildcard', async () => {
    const res = await request(createApp())
      .options('/api/ping')
      .set('Origin', 'null')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', `content-type,x-csrf-token,${UXP_CLIENT_TOKEN_HEADER}`);

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('null');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(res.headers['access-control-allow-headers'].toLowerCase()).toContain('x-uxp-client-token');
    expect(res.headers.vary).toContain('Access-Control-Request-Headers');
  });

  it('completa il preflight da file:// (WebKit macOS) soltanto con l header UXP', async () => {
    const res = await request(createApp())
      .options('/api/ping')
      .set('Origin', 'file://')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', `content-type,x-csrf-token,${UXP_CLIENT_TOKEN_HEADER}`);

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('file://');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(res.headers.vary).toContain('Access-Control-Request-Headers');
  });

  it('rifiuta Origin file:// quando non viene richiesto il trasporto UXP protetto', async () => {
    const res = await request(createApp())
      .options('/api/ping')
      .set('Origin', 'file://')
      .set('Access-Control-Request-Method', 'GET');

    expect(res.status).toBe(403);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('rifiuta una GET da file:// senza X-UXP-Client-Token', async () => {
    const res = await request(createApp())
      .get('/api/ping')
      .set('Origin', 'file://');

    expect(res.status).toBe(403);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('consente una GET da file:// che trasporta X-UXP-Client-Token', async () => {
    const res = await request(createApp())
      .get('/api/ping')
      .set('Origin', 'file://')
      .set(UXP_CLIENT_TOKEN_HEADER, 'ab'.repeat(32));

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('file://');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });
});
