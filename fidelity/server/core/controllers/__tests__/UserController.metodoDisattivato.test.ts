import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STATO_UTENTI, TIPO_UTENTI } from '../../../../lib/enums';

// vi.mock viene spostato in cima al file: le costanti devono esserlo anche loro
const passa = vi.hoisted(() => (_req: any, _res: any, next: any) => next());
const metodo = vi.hoisted(() => ({ attivo: true }));

vi.mock('../../middleware/rateLimiter', () => ({
  authRateLimiter: passa,
  authEmailRateLimiter: passa,
  registrationRateLimiter: passa,
}));

vi.mock('../../services/AuditLogService', () => ({
  AuditLogService: { getInstance: () => ({ loginSuccess: vi.fn(), loginFailed: vi.fn() }) },
}));

// Stato del metodo email e password come lo imposta la gestione dei metodi di accesso
vi.mock('../../repositories/AuthProviderRepository', () => ({
  AuthProviderRepository: class {
    findByCode = async (codice: string) => ({ codice, attivo: metodo.attivo });
  },
}));

import { toUtenteResponseDTO } from '../../dto/UtenteDTO';
import { UserController } from '../UserController';

const utente = toUtenteResponseDTO({
  id_utenti: 'u1',
  email_utenti: 'mario@esempio.it',
  nome_utenti: 'Mario',
  cognome_utenti: 'Rossi',
  tipo_utenti: TIPO_UTENTI.GDO,
  stato_utenti: STATO_UTENTI.ATTIVO,
} as any);

function createApp() {
  const session: Record<string, any> = {
    regenerate: (cb: (err?: unknown) => void) => cb(),
    save: (cb: (err?: unknown) => void) => cb(),
  };
  const userService = {
    login: vi.fn().mockResolvedValue({ success: true, user: utente }),
    getPrivateKey: vi.fn().mockResolvedValue('chiave'),
    checkLoginForMultipleUsers: vi.fn().mockResolvedValue({ users: [utente] }),
  };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).session = session;
    next();
  });
  new UserController(userService as any, {} as any, {} as any, {} as any).registerRoutes(app);
  return { app, session, userService };
}

const CREDENZIALI = { email: 'mario@esempio.it', password: 'x' };

describe('login con email e password disattivato dalla gestione dei metodi di accesso', () => {
  beforeEach(() => {
    metodo.attivo = true;
  });

  it('rifiuta le credenziali senza aprire la sessione', async () => {
    metodo.attivo = false;
    const { app, session, userService } = createApp();

    const res = await request(app).post('/api/login_user').send(CREDENZIALI);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('METODO_ACCESSO_DISATTIVATO');
    expect(userService.login).not.toHaveBeenCalled();
    expect(session.id_utente).toBeUndefined();
  });

  it('rifiuta anche la scelta fra piu\' utenti con le stesse credenziali', async () => {
    metodo.attivo = false;
    const { app, userService } = createApp();

    const res = await request(app).post('/api/check_login_for_multiple_users').send(CREDENZIALI);

    expect(res.status).toBe(403);
    expect(userService.checkLoginForMultipleUsers).not.toHaveBeenCalled();
  });

  it('con il metodo attivo il login prosegue', async () => {
    const { app, session, userService } = createApp();

    const res = await request(app).post('/api/login_user').send(CREDENZIALI);

    expect(res.status).toBe(200);
    expect(userService.login).toHaveBeenCalled();
    expect(session.id_utente).toBe('u1');
  });
});
