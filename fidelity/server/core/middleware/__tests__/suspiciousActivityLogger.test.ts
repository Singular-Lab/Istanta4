import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { log } from '../../logger';
import { AuditLogService } from '../../services/AuditLogService';
import { suspiciousActivityLogger } from '../securityMiddleware';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Istanta chiama getKitByPromo da server, senza user agent e con un bearer: non e attivita sospetta.
// Le richieste davvero sospette restano nei log, ma senza credenziali ne body.

function createApp() {
  const audit = vi.spyOn(AuditLogService.getInstance(), 'suspiciousActivity').mockImplementation(() => undefined);
  const app = express();
  app.use(express.json());
  app.use(suspiciousActivityLogger);
  app.put('/api/getKitByPromo', (_req, res) => { res.json({ esito: true }); });
  return { app, audit };
}

const avvisi = () => vi.mocked(log.warn).mock.calls.filter(([messaggio]) => messaggio === 'Suspicious activity detected');

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('suspiciousActivityLogger', () => {
  it('chiamata da server senza user agent e con bearer: nessun avviso e nessun audit', async () => {
    const { app, audit } = createApp();

    const res = await request(app).put('/api/getKitByPromo').set('Authorization', 'Bearer 03ceab72').send({ idPromo: 'p1' });

    expect(res.status).toBe(200);
    expect(avvisi()).toHaveLength(0);
    expect(audit).not.toHaveBeenCalled();
  });

  it('user agent "-" con bearer: anche questa e una chiamata da server', async () => {
    const { app, audit } = createApp();

    await request(app).put('/api/getKitByPromo').set('User-Agent', '-').set('Authorization', 'Bearer 03ceab72').send({});

    expect(audit).not.toHaveBeenCalled();
  });

  it('user agent vuoto senza bearer: resta sospetto', async () => {
    const { app, audit } = createApp();

    const res = await request(app).put('/api/getKitByPromo').send({});

    expect(res.status).toBe(200);
    expect(avvisi()).toHaveLength(1);
    expect(audit).toHaveBeenCalledOnce();
  });

  it('uno scanner resta sospetto anche con un bearer', async () => {
    const { app, audit } = createApp();

    await request(app).put('/api/getKitByPromo').set('User-Agent', 'sqlmap/1.7').set('Authorization', 'Bearer x').send({});

    expect(avvisi()).toHaveLength(1);
    expect(audit).toHaveBeenCalledOnce();
  });

  it('nel log niente credenziali, cookie ne body: solo i nomi dei campi', async () => {
    const { app } = createApp();

    await request(app)
      .put('/api/getKitByPromo?token=segreto&pagina=2')
      .set('User-Agent', 'curl/8.0')
      .set('Authorization', 'Bearer 03ceab72')
      .set('Cookie', 'connect.sid=abc')
      .send({ email: 'a@b.it', password: 'Segreta1!' });

    const [, ctx] = avvisi()[0] as [string, any];
    expect(ctx.headers.authorization).toBe('[omesso]');
    expect(ctx.headers.cookie).toBe('[omesso]');
    expect(ctx.headers['user-agent']).toBe('curl/8.0');
    expect(ctx.campiBody).toEqual(['email', 'password']);
    expect(ctx).not.toHaveProperty('body');
    expect(ctx.query).toEqual({ token: '[omesso]', pagina: '2' });
    expect(ctx.path).toBe('/api/getKitByPromo');
    expect(JSON.stringify(ctx)).not.toContain('03ceab72');
    expect(JSON.stringify(ctx)).not.toContain('Segreta1!');
  });

  it('un body sospetto viene ancora bloccato', async () => {
    const { app } = createApp();

    const res = await request(app).put('/api/getKitByPromo').set('Authorization', 'Bearer x').send({ nome: '<script>alert(1)</script>' });

    expect(res.status).toBe(400);
  });
});
