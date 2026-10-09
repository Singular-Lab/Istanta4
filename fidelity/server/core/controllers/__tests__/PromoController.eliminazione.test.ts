import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { STATO_PROMO } from '../../../../lib/enums';
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

// Risposta di Istanta nella forma di ServerUtils.sendToFICOApi
function createApp(istanta: { data: unknown; status: number }, statoNelDb: STATO_PROMO = STATO_PROMO.IN_LAVORAZIONE) {
  const promoService = {
    getPromoById: vi.fn(async (id: string) => ({ id, stato: statoNelDb })),
    deletePromo: vi.fn(async () => true),
    deleteNonPermanentePromo: vi.fn(async () => true),
    riportaInLavorazionePromo: vi.fn(async () => true),
  };
  vi.spyOn(AuditLogService, 'getInstance').mockReturnValue({ configurationChanged: vi.fn() } as any);
  vi.spyOn(ServerUtils, 'sendToFICOApi').mockResolvedValue(istanta as any);

  const app = express();
  app.use(express.json());
  new PromoController(promoService as any, {} as any, {} as any).registerRoutes(app);
  return { app, promoService };
}

const istantaOk = { data: { esito: true, errorCode: 0, error: '' }, status: 200 };

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DELETE /api/promo/:id (eliminazione definitiva)', () => {
  it('promo_not_found da Istanta vale come gia eliminata: la promo si cancella in Fidelity', async () => {
    const { app, promoService } = createApp({ data: { esito: false, errorCode: 0, error: 'promo_not_found' }, status: 200 });

    const res = await request(app).delete('/api/promo/p1');

    expect(res.status).toBe(204);
    expect(promoService.deletePromo).toHaveBeenCalledWith('p1');
  });

  it('un altro rifiuto di Istanta blocca la cancellazione', async () => {
    const { app, promoService } = createApp({
      data: { esito: false, errorCode: 0, error: 'importazioni_esistenti_per_questa_promo' },
      status: 200,
    });

    const res = await request(app).delete('/api/promo/p1');

    expect(res.status).toBe(502);
    expect(promoService.deletePromo).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/promo/:id/stato/:stato', () => {
  it('ripristino chiesto su una promo che nel DB non e ELIMINATA: 409 senza chiamare Istanta', async () => {
    const { app, promoService } = createApp(istantaOk, STATO_PROMO.IN_LAVORAZIONE);

    const res = await request(app).delete(`/api/promo/p1/stato/${STATO_PROMO.ELIMINATA}`);

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Lo stato della promo è cambiato, ricarica la pagina');
    expect(ServerUtils.sendToFICOApi).not.toHaveBeenCalled();
    expect(promoService.riportaInLavorazionePromo).not.toHaveBeenCalled();
  });

  it('ripristino di una promo ELIMINATA nel DB: procede come prima', async () => {
    const { app, promoService } = createApp(istantaOk, STATO_PROMO.ELIMINATA);

    const res = await request(app).delete(`/api/promo/p1/stato/${STATO_PROMO.ELIMINATA}`);

    expect(res.status).toBe(200);
    expect(promoService.riportaInLavorazionePromo).toHaveBeenCalledWith('p1');
  });
});
