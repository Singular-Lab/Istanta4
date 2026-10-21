import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { encryptString } from '../../../../lib/encryption';
import config from '../../config';
import type { IUserService } from '../../interfaces/IUserService';
import { PASSWORD_RESET_TOKEN_TTL_MS, createPasswordResetToken } from '../../utils/passwordResetToken';

vi.mock('../../middleware/rateLimiter', () => ({
  passwordResetRateLimiter: (_req: any, _res: any, next: any) => next()
}));

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

import { EmailController } from '../EmailController';

const EMAIL = 'mario@example.com';
const HASH_ATTUALE = '$2b$10$hash-attuale';

/** Utente con la password attuale; updatePassword la cambia davvero. */
function createApp(passwordHash: string | null = HASH_ATTUALE) {
  const state = { passwordHash };
  const userService = {
    getPasswordHashByEmail: vi.fn(async () => state.passwordHash),
    getUserByEmail: vi.fn(async (email: string) => state.passwordHash === null
      ? null
      : { id: 'user-1', email, nome: 'Mario', cognome: 'Rossi', nome_completo: 'Mario Rossi' }),
    updatePassword: vi.fn(async () => {
      state.passwordHash = '$2b$10$hash-nuovo';
      return true;
    })
  };

  const app = express();
  app.use(express.json());
  new EmailController(userService as unknown as IUserService).registerRoutes(app);

  return { app, userService };
}

const tokenValido = () => createPasswordResetToken(EMAIL, HASH_ATTUALE, config.FICO_SECRET);

describe('reset password tramite collegamento', () => {
  it('con un token valido mostra l\'utente e aggiorna la password', async () => {
    const { app, userService } = createApp();
    const ctx = tokenValido();

    const validate = await request(app).get('/api/email/validate-reset-token').query({ ctx });
    expect(validate.status).toBe(200);
    expect(validate.body).toMatchObject({ valid: true, user: { email: EMAIL } });

    const reset = await request(app).post('/api/email/reset-password').send({ ctx, password: 'nuova-password' });
    expect(reset.status).toBe(200);
    expect(userService.updatePassword).toHaveBeenCalledWith('user-1', 'nuova-password');
  });

  it('rifiuta un token forgiato con la cifratura di FICO_SECRET e una data futura', async () => {
    const { app, userService } = createApp();
    // Il token che prima si otteneva da PUT /api/return_json senza login.
    const ctx = encryptString(JSON.stringify({ email: EMAIL, timestamp: '2099-01-01T00:00:00Z' }), config.FICO_SECRET)
      .replace(/\+/g, '-pl-');

    const res = await request(app).post('/api/email/reset-password').send({ ctx, password: 'nuova-password' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Token non valido');
    expect(userService.updatePassword).not.toHaveBeenCalled();
  });

  it('non accetta lo stesso collegamento una seconda volta', async () => {
    const { app, userService } = createApp();
    const ctx = tokenValido();

    await request(app).post('/api/email/reset-password').send({ ctx, password: 'prima-password' }).expect(200);
    const seconda = await request(app).post('/api/email/reset-password').send({ ctx, password: 'seconda-password' });

    expect(seconda.status).toBe(400);
    expect(userService.updatePassword).toHaveBeenCalledTimes(1);
  });

  it('segnala come scaduto un collegamento di oltre 24 ore', async () => {
    const { app, userService } = createApp();
    const ctx = createPasswordResetToken(EMAIL, HASH_ATTUALE, config.FICO_SECRET, Date.now() - PASSWORD_RESET_TOKEN_TTL_MS - 60_000);

    const res = await request(app).post('/api/email/reset-password').send({ ctx, password: 'nuova-password' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/scaduto/i);
    expect(userService.updatePassword).not.toHaveBeenCalled();
  });

  it('tratta come non valido il token di un utente inesistente', async () => {
    const { app } = createApp(null);

    const res = await request(app).get('/api/email/validate-reset-token').query({ ctx: tokenValido() });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Token non valido');
  });
});
