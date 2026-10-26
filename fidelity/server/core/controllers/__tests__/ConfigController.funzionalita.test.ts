import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TIPO_UTENTI } from '../../../../lib/enums';

// L'anagrafica collega l'utente alla GDO "coop-firenze"
const utentiGdo = vi.hoisted(() => ({ findOne: vi.fn() }));
vi.mock('../../models', () => ({ UtentiGDO: utentiGdo }));

vi.mock('../../middleware/authMiddleware', () => ({
  authMiddleware: (_req: any, _res: any, next: any) => next(),
}));

// Il permesso lo decide la sessione del test
vi.mock('../../middleware/permissionGuard', () => ({
  permissionGuard: (codice: string) => (req: any, res: any, next: any) =>
    req.session?.permessi?.includes(codice) ? next() : res.status(403).json({ codice }),
}));

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../ws-server', () => ({
  emitToClients: () => undefined,
}));

vi.mock('../../services/AuditLogService', () => ({
  AuditLogService: { getInstance: () => ({ configurationChanged: vi.fn() }) },
}));

import { ConfigController } from '../ConfigController';

function createApp(session: Record<string, unknown>) {
  const configService = {
    getFunzionalita: vi.fn().mockResolvedValue({ momenti: true, menabo: false }),
    saveFunzionalita: vi.fn(async (_idGdo: string, f: unknown) => f),
  };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).session = session;
    next();
  });
  new ConfigController(configService as any).registerRoutes(app);
  return { app, configService };
}

const operatoreGdo = { id_utente: 'u1', tipo_utente: TIPO_UTENTI.GDO, permessi: [] as string[] };
const adminGdo = { ...operatoreGdo, permessi: ['impostazioni.modifica_generali'] };

beforeEach(() => {
  utentiGdo.findOne.mockReset().mockResolvedValue({ id_gdo_utentegdo: 'coop-firenze', id_ruolo_utente_gdo: 'admin' });
});

describe('GET /api/funzionalita', () => {
  it('restituisce le funzionalita della GDO dell utente', async () => {
    const { app, configService } = createApp(operatoreGdo);

    const res = await request(app).get('/api/funzionalita');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ momenti: true, menabo: false });
    expect(configService.getFunzionalita).toHaveBeenCalledWith('coop-firenze');
  });

  it('un utente GDO non legge le funzionalita di un altra GDO', async () => {
    const { app, configService } = createApp(operatoreGdo);

    await request(app).get('/api/funzionalita?gdo=altra-gdo');

    expect(configService.getFunzionalita).toHaveBeenCalledWith('coop-firenze');
  });

  it('un Superadmin puo indicare la GDO', async () => {
    const { app, configService } = createApp({ id_utente: 's1', tipo_utente: TIPO_UTENTI.SUPERADMIN });

    await request(app).get('/api/funzionalita?gdo=coop-lazio');

    expect(configService.getFunzionalita).toHaveBeenCalledWith('coop-lazio');
  });
});

describe('PUT /api/funzionalita', () => {
  it('salva le funzionalita sulla GDO dell utente', async () => {
    const { app, configService } = createApp(adminGdo);

    const res = await request(app).put('/api/funzionalita').send({ momenti: true, menabo: true, gdo: 'altra-gdo' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ momenti: true, menabo: true });
    expect(configService.saveFunzionalita).toHaveBeenCalledWith('coop-firenze', { momenti: true, menabo: true });
  });

  it('senza permesso la richiesta e rifiutata e nulla cambia', async () => {
    const { app, configService } = createApp(operatoreGdo);

    const res = await request(app).put('/api/funzionalita').send({ momenti: true, menabo: true });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ codice: 'impostazioni.modifica_generali' });
    expect(configService.saveFunzionalita).not.toHaveBeenCalled();
  });

  it('valori non booleani sono rifiutati', async () => {
    const { app, configService } = createApp(adminGdo);

    const res = await request(app).put('/api/funzionalita').send({ momenti: 'true', menabo: true });

    expect(res.status).toBe(400);
    expect(configService.saveFunzionalita).not.toHaveBeenCalled();
  });

  it('senza GDO su cui salvare la richiesta e rifiutata', async () => {
    utentiGdo.findOne.mockResolvedValue(null);
    const { app, configService } = createApp({
      id_utente: 's1',
      tipo_utente: TIPO_UTENTI.SUPERADMIN,
      permessi: ['impostazioni.modifica_generali'],
    });

    const res = await request(app).put('/api/funzionalita').send({ momenti: true, menabo: false });

    expect(res.status).toBe(400);
    expect(configService.saveFunzionalita).not.toHaveBeenCalled();
  });
});
