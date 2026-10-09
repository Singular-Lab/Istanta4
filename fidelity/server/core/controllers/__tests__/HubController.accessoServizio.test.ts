import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

import config from '../../config';
import { createAccessoServizioParams } from '../../utils/accessoServizioLink';
import { HubController } from '../HubController';

const SEGRETO = 'segreto-di-test-lungo-almeno-trentadue-caratteri';

function createApp() {
  const session: Record<string, any> = {
    regenerate: (cb: (err?: unknown) => void) => cb(),
    save: (cb: (err?: unknown) => void) => cb(),
  };
  const app = express();
  app.use((req, _res, next) => {
    (req as any).session = session;
    next();
  });

  const agenziaLib = {
    parseUtenteOIDC: vi.fn().mockResolvedValue({
      id: 'u1',
      private_key: 'chiave-privata',
      id_gdo: 'g1',
      email: 'mario@esempio.it',
      tipo_utente: TIPO_UTENTI.SUPERADMIN,
    }),
  };

  new HubController(
    {} as any, {} as any, {} as any, undefined, undefined, undefined, undefined, agenziaLib as any
  ).registerRoutes(app);

  return { app, session, agenziaLib };
}

function link(params: Record<string, string>) {
  return `/api/auth/oidc/fake-callback?${new URLSearchParams(params)}`;
}

describe('accesso di servizio OIDC (fake-callback)', () => {
  afterEach(() => {
    (config as any).OIDC_FAKE_CALLBACK_SECRET = undefined;
    audit.loginSuccess.mockReset();
  });

  it('senza segreto configurato non esiste', async () => {
    const { app, agenziaLib } = createApp();

    const res = await request(app).get(link({ email: 'mario@esempio.it' }));

    expect(res.status).toBe(404);
    expect(agenziaLib.parseUtenteOIDC).not.toHaveBeenCalled();
  });

  it('con la sola email, senza firma, non apre alcuna sessione', async () => {
    (config as any).OIDC_FAKE_CALLBACK_SECRET = SEGRETO;
    const { app, session, agenziaLib } = createApp();

    const res = await request(app).get(link({ email: 'mario@esempio.it' }));

    expect(res.status).toBe(403);
    expect(agenziaLib.parseUtenteOIDC).not.toHaveBeenCalled();
    expect(session.id_utente).toBeUndefined();
  });

  it('rifiuta un link con l\'email cambiata dopo la firma', async () => {
    (config as any).OIDC_FAKE_CALLBACK_SECRET = SEGRETO;
    const { app, agenziaLib } = createApp();
    const params = createAccessoServizioParams('mario@esempio.it', '', SEGRETO);

    const res = await request(app).get(link({ ...params, email: 'admin@esempio.it' }));

    expect(res.status).toBe(403);
    expect(agenziaLib.parseUtenteOIDC).not.toHaveBeenCalled();
  });

  it('rifiuta un link scaduto', async () => {
    (config as any).OIDC_FAKE_CALLBACK_SECRET = SEGRETO;
    const { app, agenziaLib } = createApp();
    const params = createAccessoServizioParams('mario@esempio.it', '', SEGRETO, Date.now() - 10 * 60 * 1000);

    const res = await request(app).get(link({ ...params }));

    expect(res.status).toBe(403);
    expect(agenziaLib.parseUtenteOIDC).not.toHaveBeenCalled();
  });

  it('con un link firmato valido apre la sessione e porta all\'hub', async () => {
    (config as any).OIDC_FAKE_CALLBACK_SECRET = SEGRETO;
    const { app, session, agenziaLib } = createApp();
    const params = createAccessoServizioParams('mario@esempio.it', 'oid-1', SEGRETO);

    const res = await request(app).get(link({ ...params }));

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/hub');
    expect(agenziaLib.parseUtenteOIDC).toHaveBeenCalledWith('mario@esempio.it', expect.objectContaining({ oid: 'oid-1' }));
    expect(session.id_utente).toBe('u1');
    expect(audit.loginSuccess).toHaveBeenCalledWith(expect.anything(), 'u1', TIPO_UTENTI.SUPERADMIN, 'login_accesso_servizio');
  });
});
