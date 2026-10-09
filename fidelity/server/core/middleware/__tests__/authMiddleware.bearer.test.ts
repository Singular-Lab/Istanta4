import express from 'express';
import { createHmac } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const olympus = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('axios', () => ({ default: { get: olympus.get } }));

vi.mock('../../config', () => ({
  default: {
    OLYMPUS_IP_ADDRESS: 'http://olympus.test',
    FICO_SECRET: 'test-fico-secret',
    INTERNAL_REQUEST_SECRET: 'segreto-interno',
    INTERNAL_REQUEST_WINDOW_MS: 60_000,
  },
}));

vi.mock('../../session', () => ({ calculateSessionTimeout: () => 60 * 60 * 1000 }));

vi.mock('../../services/AuditLogService', () => ({
  AuditLogService: { getInstance: () => ({ sessionExpired: vi.fn(), accessDenied: vi.fn() }) },
}));

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Il ruolo GDO di questi test non ha alcun permesso
vi.mock('../../services/PermessiService', () => ({
  PermessiService: class { getPermessiUtente = vi.fn().mockResolvedValue([]); },
}));
vi.mock('../../repositories/PermessiRepository', () => ({ PermessiRepository: class {} }));

import { authMiddleware, integrationAuthMiddleware } from '../authMiddleware';
import { permissionGuard } from '../permissionGuard';

function createApp(session: Record<string, unknown> = {}) {
  const app = express();
  app.use((req, _res, next) => {
    (req as any).session = { cookie: {}, destroy: (cb: () => void) => cb(), ...session };
    next();
  });
  // Come getKitByPromo: route di integrazione con permesso per gli utenti di sessione
  app.put('/api/getKitByPromo', integrationAuthMiddleware, permissionGuard('kit_runtime.crea'), (_req, res) => {
    res.sendStatus(200);
  });
  // Una route qualunque protetta solo dall'autenticazione
  app.delete('/api/tracciati/:id', authMiddleware, (_req, res) => { res.sendStatus(200); });
  app.use((err: any, _req: any, res: any, _next: any) => { res.status(err.httpStatus ?? 500).end(); });
  return app;
}

describe('bearer di Olympus', () => {
  beforeEach(() => {
    olympus.get.mockReset();
  });

  it('rifiuta un bearer che Olympus non riconosce (200 con autorizzato:false)', async () => {
    olympus.get.mockResolvedValue({ data: { origin: '', username: '', autorizzato: false } });

    const res = await request(createApp())
      .put('/api/getKitByPromo')
      .set('Authorization', 'Bearer qualunque-stringa')
      .set('Accept', 'application/json');

    expect(res.status).toBe(401);
  });

  it('accetta il bearer di Istanta sulle route di integrazione, senza sessione ne\' permessi', async () => {
    olympus.get.mockResolvedValue({ data: { origin: 'IS', username: 'istanta@esempio.it', autorizzato: true } });

    const res = await request(createApp())
      .put('/api/getKitByPromo')
      .set('Authorization', 'Bearer chiave-pubblica-istanta')
      .set('Accept', 'application/json');

    expect(res.status).toBe(200);
    expect(olympus.get).toHaveBeenCalledTimes(1);
  });

  it('ignora un bearer valido sulle route non di integrazione: serve la sessione', async () => {
    olympus.get.mockResolvedValue({ data: { origin: 'IS', username: 'istanta@esempio.it', autorizzato: true } });

    const res = await request(createApp())
      .delete('/api/tracciati/t1')
      .set('Authorization', 'Bearer chiave-pubblica-istanta')
      .set('Accept', 'application/json');

    expect(res.status).toBe(401);
    expect(olympus.get).not.toHaveBeenCalled();
  });

  it('sulle route di integrazione un utente di sessione deve avere il permesso', async () => {
    const res = await request(createApp({ id_utente: 'u1', tipo_utente: 'GDO', lastActivity: new Date() }))
      .put('/api/getKitByPromo')
      .set('Accept', 'application/json');

    expect(res.status).toBe(403);
  });

  it('le richieste interne firmate passano anche dal permissionGuard', async () => {
    const ts = String(Date.now());
    const firma = createHmac('sha256', 'segreto-interno').update(`PUT\n/api/getKitByPromo\n${ts}`).digest('hex');

    const res = await request(createApp())
      .put('/api/getKitByPromo')
      .set('x-internal-request-ts', ts)
      .set('x-internal-request-signature', firma)
      .set('Accept', 'application/json');

    expect(res.status).toBe(200);
  });
});
