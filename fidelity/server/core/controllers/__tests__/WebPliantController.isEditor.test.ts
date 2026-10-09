import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../middleware/authMiddleware', () => ({
  authMiddleware: (req: any, res: any, next: any) => (req.session?.id_utente ? next() : res.status(401).end()),
}));

// Permessi presi dalla sessione finta del test
vi.mock('../../middleware/permissionGuard', () => ({
  permissionGuard: (codice: string) => (req: any, _res: any, next: any) =>
    (req.session?.permessi ?? []).includes(codice) ? next() : next(Object.assign(new Error('Permesso negato'), { httpStatus: 403 })),
}));

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { jsonGlobale } from '../../middleware/jsonGrande';
import { ServerUtils } from '../../utils/ServerUtils';
import { WebPliantController } from '../WebPliantController';

function createApp(session?: Record<string, unknown>) {
  const webPliantService = {
    prendiWorkspaceDaID: vi.fn().mockResolvedValue({ idWorkspace: 'w1' }),
    getReferenzeWebPliant: vi.fn().mockResolvedValue([]),
    creaWebPliantWorkspace: vi.fn().mockResolvedValue(true),
  };
  const app = express();
  app.use((req, _res, next) => {
    (req as any).session = session;
    next();
  });
  app.use(jsonGlobale);
  new WebPliantController(webPliantService as any, {} as any).registerRoutes(app);
  app.use((err: any, _req: any, res: any, _next: any) => { res.status(err.httpStatus ?? err.status ?? 500).end(); });
  return { app, webPliantService };
}

describe('modalita editor del volantino WebPliant', () => {
  it('a una richiesta anonima con isEditor=true risponde con la vista pubblica', async () => {
    const { app, webPliantService } = createApp();

    await request(app).get('/api/prendiWorkspaceDaID/w1?isEditor=true').expect(200);
    await request(app).get('/api/getReferenzeWebPliant?id=w1&isEditor=true').expect(200);

    expect(webPliantService.prendiWorkspaceDaID).toHaveBeenCalledWith('w1', false);
    expect(webPliantService.getReferenzeWebPliant.mock.calls[0][4]).toBe(false);
  });

  it('un utente senza il permesso di configurare WebPliant ottiene la vista pubblica', async () => {
    const { app, webPliantService } = createApp({ id_utente: 'u1', permessi: ['webpliant.visualizza'] });

    await request(app).get('/api/prendiWorkspaceDaID/w1?isEditor=true').expect(200);

    expect(webPliantService.prendiWorkspaceDaID).toHaveBeenCalledWith('w1', false);
  });

  it('chi configura WebPliant usa la modalita editor', async () => {
    const { app, webPliantService } = createApp({ id_utente: 'u1', permessi: ['webpliant.configura'] });

    await request(app).get('/api/prendiWorkspaceDaID/w1?isEditor=true').expect(200);
    await request(app).get('/api/getReferenzeWebPliant?id=w1&isEditor=true').expect(200);

    expect(webPliantService.prendiWorkspaceDaID).toHaveBeenCalledWith('w1', true);
    expect(webPliantService.getReferenzeWebPliant.mock.calls[0][4]).toBe(true);
  });
});

describe('limite del body JSON', () => {
  const corpoDa = (megabyte: number) => JSON.stringify({ media: 'x'.repeat(megabyte * 1024 * 1024) });

  it('su una route qualunque un JSON oltre 10MB viene rifiutato', async () => {
    const { app } = createApp({ id_utente: 'u1', permessi: ['webpliant.configura'] });

    const res = await request(app)
      .put('/api/getDataValiditaPerCarosello')
      .set('Content-Type', 'application/json')
      .send(corpoDa(11));

    expect(res.status).toBe(413);
  });

  it('senza permesso il salvataggio del workspace viene rifiutato', async () => {
    const { app, webPliantService } = createApp({ id_utente: 'u1', permessi: [] });

    const res = await request(app).post('/api/salva_workspace_webpliant').send({ webpliant: [] });

    expect(res.status).toBe(403);
    expect(webPliantService.creaWebPliantWorkspace).not.toHaveBeenCalled();
  });

  it('con il permesso il salvataggio accetta un body oltre il limite globale', async () => {
    vi.spyOn(ServerUtils, 'CREA_ATTIVITA').mockResolvedValue(undefined as any);
    const { app, webPliantService } = createApp({ id_utente: 'u1', permessi: ['webpliant.configura'] });

    // Il body va letto per intero: un rifiuto prima della lettura chiuderebbe la connessione
    const res = await request(app)
      .post('/api/salva_workspace_webpliant')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ webpliant: [], media: 'x'.repeat(11 * 1024 * 1024) }));

    expect(res.status).not.toBe(413);
    expect(webPliantService.creaWebPliantWorkspace).toHaveBeenCalledTimes(1);
  });
});
