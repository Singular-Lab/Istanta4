import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { TIPO_UTENTI } from '../../../../lib/enums';

vi.mock('../../middleware/authMiddleware', () => ({
  authMiddleware: (_req: any, _res: any, next: any) => next(),
}));

import { HubController } from '../HubController';

/** Istanta e Correggo li gestisce Fidelity: dalla gestione dell'hub si disattivano, non si eliminano. */
function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).session = { id_utente: 'user-1', tipo_utente: TIPO_UTENTI.SUPERADMIN };
    next();
  });

  const hubServiceService = {
    isServizioGestito: vi.fn().mockImplementation(async (id: string) => id === 'gestito'),
    isCodiceGestito: vi.fn().mockImplementation(async (codice: string) => codice === 'correggo'),
    deleteService: vi.fn().mockResolvedValue(true),
    deleteServiceByCode: vi.fn().mockResolvedValue(2),
  };

  const controller = new HubController({} as any, hubServiceService as any, {} as any);
  controller.registerRoutes(app);
  return { app, hubServiceService };
}

describe('HubController: eliminazione dei servizi gestiti', () => {
  it('rifiuta con 409 l eliminazione di una variante gestita', async () => {
    const { app, hubServiceService } = createApp();

    const res = await request(app).delete('/api/hub-services/gestito');

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('disattivalo');
    expect(hubServiceService.deleteService).not.toHaveBeenCalled();
  });

  it('rifiuta con 409 l eliminazione del gruppo di un servizio gestito', async () => {
    const { app, hubServiceService } = createApp();

    const res = await request(app).delete('/api/hub-services/by-code/correggo');

    expect(res.status).toBe(409);
    expect(hubServiceService.deleteServiceByCode).not.toHaveBeenCalled();
  });

  it('continua a eliminare i servizi normali', async () => {
    const { app, hubServiceService } = createApp();

    expect((await request(app).delete('/api/hub-services/normale')).status).toBe(200);
    expect((await request(app).delete('/api/hub-services/by-code/mio')).status).toBe(200);
    expect(hubServiceService.deleteService).toHaveBeenCalledWith('normale');
    expect(hubServiceService.deleteServiceByCode).toHaveBeenCalledWith('mio');
  });
});
