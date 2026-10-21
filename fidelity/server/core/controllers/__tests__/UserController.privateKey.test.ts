import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { STATO_UTENTI, TIPO_UTENTI } from '../../../../lib/enums';

// vi.mock viene spostato in cima al file: la costante deve esserlo anche lei
const passa = vi.hoisted(() => (_req: any, _res: any, next: any) => next());

vi.mock('../../middleware/rateLimiter', () => ({
  authRateLimiter: passa,
  authEmailRateLimiter: passa,
  registrationRateLimiter: passa,
}));

vi.mock('../../services/AuditLogService', () => ({
  AuditLogService: { getInstance: () => ({ loginSuccess: vi.fn(), loginFailed: vi.fn() }) },
}));

import { toUtenteResponseDTO } from '../../dto/UtenteDTO';
import { UserService } from '../../services/UserService';
import { sequelize } from '../../db/SequelizeConnector';
import { UserController } from '../UserController';

const utenteDb = {
  id_utenti: 'u1',
  email_utenti: 'mario@esempio.it',
  nome_utenti: 'Mario',
  cognome_utenti: 'Rossi',
  tipo_utenti: TIPO_UTENTI.GDO,
  stato_utenti: STATO_UTENTI.ATTIVO,
  privatekey_utenti: 'chiave-privata-olympus',
} as any;

describe('chiave privata Olympus', () => {
  it('non compare nel DTO dell\'utente', () => {
    expect(toUtenteResponseDTO(utenteDb)).not.toHaveProperty('private_key');
  });

  it('il login la mette in sessione ma non nella risposta', async () => {
    const session: Record<string, any> = {
      regenerate: (cb: (err?: unknown) => void) => cb(),
      save: (cb: (err?: unknown) => void) => cb(),
    };
    const userService = {
      login: vi.fn().mockResolvedValue({ success: true, user: toUtenteResponseDTO(utenteDb) }),
      getPrivateKey: vi.fn().mockResolvedValue('chiave-privata-olympus'),
    };
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).session = session;
      next();
    });
    new UserController(userService as any, {} as any, {} as any, {} as any).registerRoutes(app);

    const res = await request(app).post('/api/login_user').send({ email: 'mario@esempio.it', password: 'x' });

    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain('chiave-privata-olympus');
    expect(session.private_key).toBe('chiave-privata-olympus');
  });

  it('l\'elenco utenti dalla vista materializzata non la restituisce', async () => {
    vi.spyOn(sequelize, 'query').mockResolvedValue([
      { id: 'u1', email: 'mario@esempio.it', private_key: 'chiave-privata-olympus', canali_interazione: '[]' },
    ] as any);

    const utenti = await new UserService({} as any).getUtentiWithFilters({});

    expect(utenti[0]).not.toHaveProperty('private_key');
    expect(utenti[0].email).toBe('mario@esempio.it');
  });

  it('per gli usi interni si legge dal database', async () => {
    const repository = { findById: vi.fn().mockResolvedValue(utenteDb) };

    await expect(new UserService(repository as any).getPrivateKey('u1')).resolves.toBe('chiave-privata-olympus');
  });
});
