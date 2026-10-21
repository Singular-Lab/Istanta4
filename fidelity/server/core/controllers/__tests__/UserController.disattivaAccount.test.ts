import bcrypt from 'bcrypt';
import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { STATO_UTENTI, TIPO_UTENTI } from '../../../../lib/enums';

const passa = vi.hoisted(() => (_req: any, _res: any, next: any) => next());

vi.mock('../../middleware/rateLimiter', () => ({
  authRateLimiter: passa,
  authEmailRateLimiter: passa,
  registrationRateLimiter: passa,
}));
vi.mock('../../middleware/authMiddleware', () => ({ authMiddleware: passa }));
vi.mock('../../services/AuditLogService', () => ({
  AuditLogService: { getInstance: () => ({ userUpdated: vi.fn(), loginFailed: vi.fn(), loginSuccess: vi.fn() }) },
}));

import { sequelize } from '../../db/SequelizeConnector';
import { Utente } from '../../models/utenti';
import { ACCOUNT_NON_ATTIVO, UserService } from '../../services/UserService';
import { UserController } from '../UserController';

const PASSWORD = 'password-di-prova';
const hash = bcrypt.hashSync(PASSWORD, 4);

const utente = (extra: Record<string, unknown> = {}) => ({
  id_utenti: 'u1',
  email_utenti: 'utente@esempio.it',
  tipo_utenti: TIPO_UTENTI.AGENZIA,
  stato_utenti: STATO_UTENTI.ATTIVO,
  outsider_utenti: false,
  password_utenti: hash,
  ...extra,
});

function createApp(record: Record<string, unknown>) {
  const repository = {
    findById: vi.fn(async () => record),
    update: vi.fn(async () => record),
  };
  const query = vi.spyOn(sequelize, 'query').mockResolvedValue([] as any);
  const session: Record<string, any> = { id_utente: 'u1', destroy: vi.fn((cb: () => void) => cb()) };
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => { req.session = session; next(); });
  new UserController(new UserService(repository as any), {} as any, {} as any, {} as any).registerRoutes(app);
  return { app, repository, query, session };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /api/utente/disattiva-account', () => {
  it('con la password corretta disattiva l\'account e chiude tutte le sessioni', async () => {
    const { app, repository, query, session } = createApp(utente());

    const res = await request(app).post('/api/utente/disattiva-account').send({ password: PASSWORD });

    expect(res.status).toBe(200);
    expect(repository.update).toHaveBeenCalledWith('u1', { stato_utenti: STATO_UTENTI.DISATTIVO });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM sessions'), { replacements: { id: 'u1' } });
    expect(session.destroy).toHaveBeenCalled();
  });

  it('con la password errata rifiuta e l\'account resta attivo', async () => {
    const { app, repository } = createApp(utente());

    const res = await request(app).post('/api/utente/disattiva-account').send({ password: 'altra-password' });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('l\'ultimo Superadmin attivo non può disattivarsi', async () => {
    const { app, repository } = createApp(utente({ tipo_utenti: TIPO_UTENTI.SUPERADMIN }));
    vi.spyOn(Utente, 'count').mockResolvedValue(1 as any);

    const res = await request(app).post('/api/utente/disattiva-account').send({ password: PASSWORD });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('ultimo Superadmin');
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('un account con autenticazione esterna non si disattiva dal profilo', async () => {
    const { app, repository } = createApp(utente({ outsider_utenti: true, password_utenti: null }));

    const res = await request(app).post('/api/utente/disattiva-account').send({ password: PASSWORD });

    expect(res.status).toBe(403);
    expect(repository.update).not.toHaveBeenCalled();
  });
});

describe('accesso di un account non attivo', () => {
  const service = (record: Record<string, unknown>) =>
    new UserService({ findByEmail: vi.fn(async () => record), findById: vi.fn(async () => record) } as any);

  it('il login con la password corretta non apre la sessione', async () => {
    const esito = await service(utente({ stato_utenti: STATO_UTENTI.DISATTIVO })).login('utente@esempio.it', PASSWORD);

    expect(esito).toEqual({ success: false, message: ACCOUNT_NON_ATTIVO });
  });

  it('la scelta del tipo di accesso viene rifiutata', async () => {
    await expect(
      service(utente({ stato_utenti: STATO_UTENTI.BLOCCATO })).checkLoginForMultipleUsers('utente@esempio.it', PASSWORD)
    ).rejects.toMatchObject({ message: ACCOUNT_NON_ATTIVO });
  });

  it('il ritorno da un fornitore esterno viene rifiutato', async () => {
    await expect(service(utente({ stato_utenti: STATO_UTENTI.DISATTIVO })).verificaAccountAttivo('u1')).rejects.toMatchObject({
      message: ACCOUNT_NON_ATTIVO,
    });
    await expect(service(utente()).verificaAccountAttivo('u1')).resolves.toBeUndefined();
  });
});
