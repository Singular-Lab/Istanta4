import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../middleware/authMiddleware', () => ({
  authMiddleware: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../middleware/permissionGuard', () => ({
  permissionGuard: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../services/AuditLogService', () => ({
  AuditLogService: { getInstance: () => ({ configurationChanged: vi.fn() }) },
}));

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { WebhookController } from '../WebhookController';

function createApp() {
  const webhookService = { creaWebhook: vi.fn(async (dati: Record<string, unknown>) => ({ id_webhook: 'w1', ...dati })) };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).session = { id_utente: 'u1' };
    next();
  });
  new WebhookController(webhookService as any).registerRoutes(app);
  return { app, webhookService };
}

// Come lo invia la pagina Gestione webhook: timeout in secondi, nessuna attesa fra i retry
const DAL_FORM = {
  nome_webhook: 'ERP',
  url_webhook: 'https://ricevente.esempio.it/eventi',
  eventi_webhook: ['KIT_PUBBLICATO'],
  timeout_webhook: 30,
  retry_webhook: 3,
  stato_webhook: 'ATTIVO',
  headers_webhook: '{}',
};

describe('POST /api/webhooks', () => {
  it('l\'attesa fra i retry non viene presa dal timeout: senza valore resta il default del modello', async () => {
    const { app, webhookService } = createApp();

    const res = await request(app).post('/api/webhooks').send(DAL_FORM);

    expect(res.status).toBe(201);
    const dati = webhookService.creaWebhook.mock.calls[0][0];
    expect(dati).toMatchObject({ timeout_webhook: 30, retry_count_webhook: 3 });
    expect(dati).not.toHaveProperty('retry_delay_webhook');
  });

  it('usa retry_delay_webhook quando arriva', async () => {
    const { app, webhookService } = createApp();

    await request(app).post('/api/webhooks').send({ ...DAL_FORM, retry_delay_webhook: 2000 });

    expect(webhookService.creaWebhook.mock.calls[0][0]).toMatchObject({ retry_delay_webhook: 2000, timeout_webhook: 30 });
  });
});
