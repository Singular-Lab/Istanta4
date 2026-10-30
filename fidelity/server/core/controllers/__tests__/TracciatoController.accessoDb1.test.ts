import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type { ITracciatoService } from '../../interfaces/ITracciatoService';
import { TracciatoController } from '../TracciatoController';

vi.mock('../../middleware/authMiddleware', () => ({
  authMiddleware: (_req: unknown, res: express.Response) => {
    res.status(401).json({ message: 'Non autenticato' });
  },
}));

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

function createApp() {
  const tracciati = [{
    id: 'tracciato-1',
    id_promo: 'promo-1',
    blobfile: Buffer.from('contenuto-tracciato'),
  }];
  const service = {
    getTracciatiByPromoId: vi.fn().mockResolvedValue(tracciati),
    getTracciatoById: vi.fn(),
  };

  const app = express();
  new TracciatoController(service as unknown as ITracciatoService).registerRoutes(app);

  return { app, service };
}

describe('GET /api/tracciati/promo/:idPromo per DB1', () => {
  it('restituisce i tracciati completi anche senza una sessione Fidelity', async () => {
    const { app, service } = createApp();

    const response = await request(app)
      .get('/api/tracciati/promo/promo-1?includeBlob=true')
      .set('Accept', 'application/json');

    expect(response.status).toBe(200);
    expect(response.body[0].blobfile).toBeDefined();
    expect(service.getTracciatiByPromoId).toHaveBeenCalledWith('promo-1', true);
  });

  it('mantiene protette le altre API dei tracciati', async () => {
    const { app, service } = createApp();

    const response = await request(app)
      .get('/api/tracciati/tracciato-1')
      .set('Accept', 'application/json');

    expect(response.status).toBe(401);
    expect(service.getTracciatoById).not.toHaveBeenCalled();
  });
});
