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
    getPromoById: vi.fn(async (id: string) => ({ id, nome: 'A2625_SC_20-11-26', stato: statoNelDb })),
    deletePromo: vi.fn(async () => true),
    deleteNonPermanentePromo: vi.fn(async () => true),
    riportaInLavorazionePromo: vi.fn(async () => true),
  };
  const audit = { configurationChanged: vi.fn(), entityChanged: vi.fn() };
  vi.spyOn(AuditLogService, 'getInstance').mockReturnValue(audit as any);
  vi.spyOn(ServerUtils, 'sendToFICOApi').mockResolvedValue(istanta as any);

  const app = express();
  app.use(express.json());
  new PromoController(promoService as any, {} as any, {} as any).registerRoutes(app);
  return { app, promoService, audit };
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

/*
 * Chi elimina o ripristina una promo, e quando: prima eliminazione non definitiva e ripristino non
 * lasciavano traccia, e l'eliminazione definitiva non diceva quale promo per nome.
 */
describe('Registro Audit delle eliminazioni e dei ripristini', () => {
  it('eliminazione definitiva: id e nome della promo letti prima di cancellarla', async () => {
    const { app, audit } = createApp(istantaOk);

    expect((await request(app).delete('/api/promo/p1')).status).toBe(204);

    expect(audit.entityChanged).toHaveBeenCalledWith(expect.anything(), 'promo', 'delete',
      { type: 'Promo', id: 'p1' }, { promoId: 'p1', nomePromo: 'A2625_SC_20-11-26' });
  });

  it('eliminazione definitiva di una promo che Fidelity non legge: procede e registra senza nome', async () => {
    const { app, promoService, audit } = createApp(istantaOk);
    promoService.getPromoById.mockRejectedValueOnce(new Error('non trovata'));

    expect((await request(app).delete('/api/promo/p1')).status).toBe(204);

    expect(audit.entityChanged).toHaveBeenCalledWith(expect.anything(), 'promo', 'delete',
      { type: 'Promo', id: 'p1' }, { promoId: 'p1', nomePromo: null });
  });

  it('eliminazione non definitiva: registra id, nome e stato di prima', async () => {
    const { app, audit } = createApp(istantaOk, STATO_PROMO.IN_LAVORAZIONE);

    expect((await request(app).delete(`/api/promo/p1/stato/${STATO_PROMO.IN_LAVORAZIONE}`)).status).toBe(200);

    expect(audit.entityChanged).toHaveBeenCalledWith(expect.anything(), 'promo', 'soft_delete',
      { type: 'Promo', id: 'p1' }, { promoId: 'p1', nomePromo: 'A2625_SC_20-11-26', statoPrecedente: STATO_PROMO.IN_LAVORAZIONE });
  });

  it('ripristino: registra id, nome e stato di prima', async () => {
    const { app, audit } = createApp(istantaOk, STATO_PROMO.ELIMINATA);

    expect((await request(app).delete(`/api/promo/p1/stato/${STATO_PROMO.ELIMINATA}`)).status).toBe(200);

    expect(audit.entityChanged).toHaveBeenCalledWith(expect.anything(), 'promo', 'restore',
      { type: 'Promo', id: 'p1' }, { promoId: 'p1', nomePromo: 'A2625_SC_20-11-26', statoPrecedente: STATO_PROMO.ELIMINATA });
  });

  it('niente voce se Istanta rifiuta o se lo stato e cambiato nel frattempo', async () => {
    const rifiutata = createApp({ data: { esito: false, errorCode: 0, error: 'importazioni_esistenti_per_questa_promo' }, status: 200 });
    expect((await request(rifiutata.app).delete('/api/promo/p1')).status).toBe(502);
    expect(rifiutata.audit.entityChanged).not.toHaveBeenCalled();

    vi.restoreAllMocks();
    const cambiata = createApp(istantaOk, STATO_PROMO.IN_LAVORAZIONE);
    expect((await request(cambiata.app).delete(`/api/promo/p1/stato/${STATO_PROMO.ELIMINATA}`)).status).toBe(409);
    expect(cambiata.audit.entityChanged).not.toHaveBeenCalled();
  });

  it('niente voce se lo stato non cambia nel database', async () => {
    const { app, promoService, audit } = createApp(istantaOk, STATO_PROMO.IN_LAVORAZIONE);
    promoService.deleteNonPermanentePromo.mockResolvedValueOnce(false);

    await request(app).delete(`/api/promo/p1/stato/${STATO_PROMO.IN_LAVORAZIONE}`);

    expect(audit.entityChanged).not.toHaveBeenCalled();
  });
});
