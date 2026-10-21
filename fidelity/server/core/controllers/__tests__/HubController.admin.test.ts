import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { TIPO_UTENTI } from '../../../../lib/enums';

vi.mock('../../middleware/authMiddleware', () => ({
  authMiddleware: (_req: any, _res: any, next: any) => next(),
}));
// Permessi dalla sessione: il Superadmin ha i permessi di sistema, gli altri no.
vi.mock('../../accessi/contestoAccesso', () => ({
  leggiContestoAccesso: async (req: any) => ({
    idUtente: req.session.id_utente,
    tipo: req.session.tipo_utente,
    idGdo: null,
    idRuoloGdo: null,
    superadmin: req.session.tipo_utente === 'Superadmin',
  }),
}));
vi.mock('../../accessi/RisolutoreAccessi', () => ({
  RisolutoreAccessi: { get: () => ({ puo: async (contesto: any) => contesto.superadmin }) },
}));
vi.mock('../../services/AuditLogService', () => ({
  AuditLogService: { getInstance: () => ({ accessDenied: vi.fn() }) },
}));

import { errorHandler } from '../../middleware/errorHandler';
import { HubController } from '../HubController';

function createApp(sessionOverrides: Record<string, unknown> = {}, hubNewsOverrides: Record<string, any> = {}) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).session = {
      id_utente: 'user-1',
      tipo_utente: TIPO_UTENTI.SUPERADMIN,
      ...sessionOverrides,
    };
    next();
  });

  const hubNewsService = {
    getAllNews: vi.fn().mockResolvedValue([
      {
        id: 'news-1',
        titolo: 'News admin',
        contenuto: '<p>Archivio</p>',
        tipo: 'info',
        icona: 'Info',
        url: 'https://example.com',
        in_evidenza: true,
        data_pubblicazione: '2026-03-20T10:00:00.000Z',
        data_scadenza: '2026-04-20T10:00:00.000Z',
        autore_nome: 'Sistema',
        meta: undefined,
        attivo: true,
        ruoli_destinatari: ['GDO_ADMIN'],
      },
    ]),
    getNewsForRole: vi.fn(),
    createNews: vi.fn(),
    updateNews: vi.fn(),
    deleteNews: vi.fn(),
    ...hubNewsOverrides,
  };

  const controller = new HubController(
    {} as any,
    {} as any,
    hubNewsService as any,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined
  );

  controller.registerRoutes(app);
  app.use(errorHandler({ includeStackTrace: false, logger: () => undefined }));

  return { app, hubNewsService };
}

describe('HubController admin news routes', () => {
  it('returns the full admin news archive for superadmin users', async () => {
    const { app, hubNewsService } = createApp();

    const res = await request(app).get('/api/hub-news/admin').set('Accept', 'application/json');

    expect(res.status).toBe(200);
    expect(hubNewsService.getAllNews).toHaveBeenCalledTimes(1);
    expect(res.body[0]).toMatchObject({
      titolo: 'News admin',
      attivo: true,
      ruoli_destinatari: ['GDO_ADMIN'],
    });
  });

  it('rejects users without the hub system permission from the admin news archive', async () => {
    const { app, hubNewsService } = createApp({
      tipo_utente: TIPO_UTENTI.GDO,
    });

    const res = await request(app).get('/api/hub-news/admin').set('Accept', 'application/json');

    expect(res.status).toBe(403);
    expect(hubNewsService.getAllNews).not.toHaveBeenCalled();
  });
});
