import express, { type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EphemeralTokenErrorCode } from '../../dto/EphemeralTokenDTO';
import ephemeralTokenService from '../../services/EphemeralTokenService';
import { apiKeyAuthMiddleware } from '../apiKeyAuth';
import { ephemeralTokenAuthMiddleware } from '../ephemeralTokenAuthMiddleware';

vi.mock('../../services/EphemeralTokenService', () => ({ default: { validateToken: vi.fn() } }));
vi.mock('../apiKeyAuth', () => ({ apiKeyAuthMiddleware: vi.fn() }));
vi.mock('../../logger', () => ({ log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

// Quando passa all'API Key, il middleware aspetta che abbia finito: prima la lasciava andare da
// sola, e un suo rifiuto arrivava a unhandledRejection, che spegne il worker.

const richiesta = (intestazioni: Record<string, string>) => ({
  ip: '127.0.0.1',
  path: '/api/external/promo',
  get: (nome: string) => intestazioni[nome.toLowerCase()],
}) as unknown as Request;

/** L'API Key legge la chiave dal DB: risponde dopo un giro dell'event loop. */
const apiKeyLenta = () =>
  vi.mocked(apiKeyAuthMiddleware).mockImplementation(async (_req, _res, next) => {
    await new Promise(resolve => setTimeout(resolve, 5));
    next();
    return undefined;
  });

describe('ephemeralTokenAuthMiddleware: passaggio all\'API Key', () => {
  beforeEach(() => {
    vi.mocked(apiKeyAuthMiddleware).mockReset();
  });

  it('senza token effimero finisce solo dopo l\'API Key', async () => {
    apiKeyLenta();
    const next = vi.fn();

    await ephemeralTokenAuthMiddleware(richiesta({}), {} as Response, next);

    expect(apiKeyAuthMiddleware).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledOnce();
  });

  it('con token scaduto finisce solo dopo l\'API Key', async () => {
    apiKeyLenta();
    vi.mocked(ephemeralTokenService.validateToken).mockResolvedValue({
      valid: false,
      errorCode: EphemeralTokenErrorCode.TOKEN_EXPIRED,
      errorMessage: 'scaduto',
    } as Awaited<ReturnType<typeof ephemeralTokenService.validateToken>>);
    const next = vi.fn();

    await ephemeralTokenAuthMiddleware(richiesta({ 'x-ephemeral-token': 't', 'x-browser-hash': 'h' }), {} as Response, next);

    expect(apiKeyAuthMiddleware).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledOnce();
  });

  it('un errore imprevisto dell\'API Key diventa una risposta di errore, non un rifiuto perso', async () => {
    vi.mocked(apiKeyAuthMiddleware).mockRejectedValue(new Error('DB non raggiungibile'));
    const app = express();
    app.get('/api/external/promo', ephemeralTokenAuthMiddleware, (_req, res) => { res.json({ ok: true }); });
    app.use((err: Error, _req: Request, res: Response, _next: express.NextFunction) => {
      res.status(500).json({ errore: err.message });
    });

    const res = await request(app).get('/api/external/promo');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ errore: 'DB non raggiungibile' });
  });
});
