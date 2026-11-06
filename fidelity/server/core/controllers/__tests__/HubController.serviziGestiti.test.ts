import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { TIPO_UTENTI } from '../../../../lib/enums';

vi.mock('../../middleware/authMiddleware', () => ({
  authMiddleware: (_req: any, _res: any, next: any) => next(),
}));

// Le rotte di eliminazione sono sotto sistema.gestisci_hub: il permesso lo verifica permissionGuard.test.ts,
// qui si verifica solo la regola sui servizi gestiti.
vi.mock('../../middleware/permissionGuard', () => ({
  permissionGuard: () => (_req: any, _res: any, next: any) => next(),
}));

import { HubController } from '../HubController';

/**
 * Istanta e Correggo li gestisce Fidelity: dalla gestione dell'hub se ne tolgono i destinatari, ma non si
 * eliminano per intero (si disattivano).
 */
function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).session = { id_utente: 'user-1', tipo_utente: TIPO_UTENTI.SUPERADMIN };
    next();
  });

  const hubServiceService = {
    isUltimaVarianteGestita: vi.fn().mockImplementation(async (id: string) => id === 'ultima-gestita'),
    isCodiceGestito: vi.fn().mockImplementation(async (codice: string) => codice === 'correggo'),
    deleteService: vi.fn().mockResolvedValue(true),
    deleteServiceByCode: vi.fn().mockResolvedValue(2),
  };

  const controller = new HubController({} as any, hubServiceService as any, {} as any);
  controller.registerRoutes(app);
  return { app, hubServiceService };
}

describe('HubController: eliminazione dei servizi gestiti', () => {
  it('rifiuta con 409 l eliminazione dell ultima variante di un servizio gestito', async () => {
    const { app, hubServiceService } = createApp();

    const res = await request(app).delete('/api/hub-services/ultima-gestita');

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('disattivala');
    expect(hubServiceService.deleteService).not.toHaveBeenCalled();
  });

  it('elimina una variante di un servizio gestito che ne ha altre: il Superadmin toglie un destinatario', async () => {
    const { app, hubServiceService } = createApp();

    const res = await request(app).delete('/api/hub-services/gestita-con-altre');

    expect(res.status).toBe(200);
    expect(hubServiceService.deleteService).toHaveBeenCalledWith('gestita-con-altre');
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
