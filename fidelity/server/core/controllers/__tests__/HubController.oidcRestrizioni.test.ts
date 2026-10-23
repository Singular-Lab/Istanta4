import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { TIPO_UTENTI } from '../../../../lib/enums';

const audit = vi.hoisted(() => ({ loginSuccess: vi.fn() }));

vi.mock('../../middleware/authMiddleware', () => ({
  authMiddleware: (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../../middleware/rateLimiter', () => ({
  authRateLimiter: (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../../services/AuditLogService', () => ({
  AuditLogService: { getInstance: () => audit },
}));
vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { HubController } from '../HubController';

/** Callback OIDC con il fornitore che ha gia' riconosciuto l'utente: si verificano le restrizioni del metodo. */
function createApp(provider: Record<string, unknown>, utente: { email: string; tipo_utente: TIPO_UTENTI }) {
  const session: Record<string, any> = {
    oidc_state: 'stato-1',
    oidc_nonce: 'nonce-1',
    oidc_code_verifier: 'verifier-1',
    oidc_provider_code: 'entra_id',
    regenerate: (cb: (err?: unknown) => void) => cb(),
    save: (cb: (err?: unknown) => void) => cb(),
  };
  const app = express();
  app.use((req, _res, next) => {
    (req as any).session = session;
    next();
  });

  const oidcService = {
    exchangeCodeForTokens: vi.fn().mockResolvedValue({ id_token: 'token' }),
    validateIdToken: vi.fn().mockResolvedValue({ sub: 's1', email: utente.email }),
  };
  const repository = {
    findByCode: vi.fn().mockResolvedValue({ codice: 'entra_id', tipo: 'oidc', attivo: true, config_server: {}, ruoli_ammessi: null, ...provider }),
  };
  const agenziaLib = { parseUtenteOIDC: vi.fn().mockResolvedValue({ id: 'u1', ...utente }) };
  const userService = { verificaAccountAttivo: vi.fn().mockResolvedValue(undefined) };

  new HubController(
    {} as any, {} as any, {} as any, undefined, userService as any, oidcService as any, repository as any, agenziaLib as any
  ).registerRoutes(app);

  return { app, session };
}

const callback = (app: express.Express) => request(app).get('/api/auth/oidc/callback?code=c1&state=stato-1');

describe('HubController - restrizioni del metodo OIDC', () => {
  it('apre la sessione per un utente ammesso', async () => {
    const { app, session } = createApp(
      { config_server: { domini_ammessi: ['esempio.it'] }, ruoli_ammessi: ['GDO'] },
      { email: 'mario@esempio.it', tipo_utente: TIPO_UTENTI.GDO },
    );

    const res = await callback(app);

    expect(res.headers.location).toBe('/hub');
    expect(session.id_utente).toBe('u1');
    expect(session.oidc_state).toBeUndefined();
  });

  it('rifiuta un dominio email non ammesso', async () => {
    const { app, session } = createApp(
      { config_server: { domini_ammessi: ['esempio.it'] } },
      { email: 'mario@altro.it', tipo_utente: TIPO_UTENTI.GDO },
    );

    const res = await callback(app);

    expect(res.headers.location).toMatch(/^\/login\?reason=oidc_access_denied/);
    expect(session.id_utente).toBeUndefined();
  });

  it('rifiuta un tipo utente non ammesso', async () => {
    const { app, session } = createApp(
      { ruoli_ammessi: ['GDO', 'Marketing'] },
      { email: 'anna@esempio.it', tipo_utente: TIPO_UTENTI.AGENZIA },
    );

    const res = await callback(app);

    expect(res.headers.location).toMatch(/^\/login\?reason=oidc_access_denied&message=.*Agenzia/);
    expect(session.id_utente).toBeUndefined();
  });
});
