import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { metodoAccessoAttivo } from '../metodoAccessoAttivo';

function createApp(provider: { attivo: boolean } | null) {
  const login = vi.fn((_req, res) => res.status(200).json({ ok: true }));
  const app = express();
  app.post('/api/login_user', metodoAccessoAttivo('email_password', { findByCode: async () => provider } as any), login);
  return { app, login };
}

describe('metodoAccessoAttivo', () => {
  it('rifiuta email e password quando il metodo e\' disattivato', async () => {
    const { app, login } = createApp({ attivo: false });

    const res = await request(app).post('/api/login_user').send({});

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('METODO_ACCESSO_DISATTIVATO');
    expect(login).not.toHaveBeenCalled();
  });

  it('lascia passare con il metodo attivo', async () => {
    const { app, login } = createApp({ attivo: true });

    const res = await request(app).post('/api/login_user').send({});

    expect(res.status).toBe(200);
    expect(login).toHaveBeenCalled();
  });

  it('lascia passare se il metodo non e\' mai stato creato', async () => {
    const { app } = createApp(null);

    expect((await request(app).post('/api/login_user').send({})).status).toBe(200);
  });
});
