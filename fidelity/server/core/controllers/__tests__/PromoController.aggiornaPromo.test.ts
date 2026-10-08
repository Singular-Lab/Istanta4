import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import config from '../../config';
import { AuditLogService } from '../../services/AuditLogService';
import { ServerUtils } from '../../utils/ServerUtils';
import { PromoController } from '../PromoController';

vi.mock('../../middleware/authMiddleware', () => ({
  authMiddleware: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../middleware/permissionGuard', () => ({
  permissionGuard: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Risposte nella forma di ServerUtils.sendToFICOApi, per servizio
type Risposta = { data: unknown; status: number; statusText?: string };

function createApp(istanta: Risposta, correggo: Risposta) {
  const promoService = { updatePromo: vi.fn(async (id: string) => ({ id, nome: 'A2641' })) };
  vi.spyOn(AuditLogService, 'getInstance').mockReturnValue({ configurationChanged: vi.fn() } as any);
  vi.spyOn(ServerUtils, 'sendToFICOApi').mockImplementation(async (_req, url) =>
    (String(url).includes('UpdateVolData.ashx') ? correggo : istanta) as any
  );

  const app = express();
  app.use(express.json());
  new PromoController(promoService as any, {} as any, {} as any).registerRoutes(app);
  return { app, promoService };
}

const correggoAttivo = (valore: string | undefined) => {
  const precedente = config.CORREGGO_IP_ADDRESS;
  (config as any).CORREGGO_IP_ADDRESS = valore;
  return () => ((config as any).CORREGGO_IP_ADDRESS = precedente);
};

const istantaOk: Risposta = { data: { esito: true, errorCode: 0, error: '' }, status: 200 };

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PUT /api/promo/:id', () => {
  it('se Istanta rifiuta risponde 502 con il motivo e non aggiorna la promo', async () => {
    const ripristina = correggoAttivo('http://127.0.0.1:61991');
    const { app, promoService } = createApp(
      { data: { esito: false, errorCode: 0, error: 'promo_not_found' }, status: 200 },
      { data: { result: 'ok' }, status: 200 }
    );

    const res = await request(app).put('/api/promo/p1').send({ nome: 'A2641' });
    ripristina();

    expect(res.status).toBe(502);
    expect(res.body.message).toBe('Istanta: promo non trovata');
    expect(promoService.updatePromo).not.toHaveBeenCalled();
  });

  it('se Correggo non riceve l\'aggiornamento la promo si aggiorna con un avviso', async () => {
    const ripristina = correggoAttivo('http://127.0.0.1:61991');
    const { app, promoService } = createApp(istantaOk, { data: null, status: 404, statusText: '' });

    const res = await request(app).put('/api/promo/p1').send({ nome: 'A2641' });
    ripristina();

    expect(res.status).toBe(200);
    expect(promoService.updatePromo).toHaveBeenCalledOnce();
    expect(res.body.avvisi).toEqual([
      "Correggo non ha ricevuto l'aggiornamento: Correggo non espone la funzione richiesta (/UpdateVolData.ashx)",
    ]);
  });

  it('un volantino non ancora in Correggo non genera avvisi', async () => {
    const ripristina = correggoAttivo('http://127.0.0.1:61991');
    const { app } = createApp(istantaOk, {
      data: { esito: false, result: false, error_detail: 'volantino_non_trovato' },
      status: 200,
    });

    const res = await request(app).put('/api/promo/p1').send({ nome: 'A2641' });
    ripristina();

    expect(res.status).toBe(200);
    expect(res.body.avvisi).toBeUndefined();
  });

  it('senza Correggo configurato non lo chiama', async () => {
    const ripristina = correggoAttivo(undefined);
    const { app } = createApp(istantaOk, { data: null, status: 404 });

    const res = await request(app).put('/api/promo/p1').send({ nome: 'A2641' });
    ripristina();

    expect(res.status).toBe(200);
    expect(res.body.avvisi).toBeUndefined();
    expect(ServerUtils.sendToFICOApi).toHaveBeenCalledTimes(1);
  });
});
