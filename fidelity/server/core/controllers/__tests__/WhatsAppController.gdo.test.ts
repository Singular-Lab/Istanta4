import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../middleware/authMiddleware', () => ({
  authMiddleware: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../middleware/permissionGuard', () => ({
  permissionGuard: () => (_req: any, _res: any, next: any) => next(),
}));

import { sequelize } from '../../db/SequelizeConnector';
import { GDOWhatsappCampagne } from '../../models/whatsapp/gdo_whatsapp_campagne';
import { GDOWhatsappQueueJob } from '../../models/whatsapp/gdo_whatsapp_message_queue';
import { GDOWhatsappTemplate } from '../../models/whatsapp/gdo_whatsapp_template';
import { WhatsAppController } from '../WhatsAppController';

const BULK = '7b0c1d2e-3f40-4a5b-8c6d-7e8f9a0b1c2d';

// Utente della GDO "gdo-A"
function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).session = { id_utente: 'user-A' };
    next();
  });
  const whatsAppService = { getCurrentGDOWhatsappForCampaign: vi.fn().mockResolvedValue({ id: 'gdo-A' }) };
  new WhatsAppController(whatsAppService as any).registerRoutes(app);
  return app;
}

// Il bulk appartiene alla GDO del template della sua campagna
function bulkDellaGdo(idGdo: string) {
  vi.spyOn(GDOWhatsappQueueJob, 'findOne').mockResolvedValue({ campagna_id_whatsapp_queue_job: 'c1' } as any);
  vi.spyOn(GDOWhatsappCampagne, 'findByPk').mockResolvedValue({ template_id_whatsapp_campagna: 't1' } as any);
  vi.spyOn(GDOWhatsappTemplate, 'findByPk').mockResolvedValue({ id_gdo_gdowhatsapptemplate: idGdo } as any);
}

describe('campagne WhatsApp: isolamento per GDO', () => {
  let findAll: any;
  let update: any;

  beforeEach(() => {
    vi.spyOn(GDOWhatsappQueueJob, 'count').mockResolvedValue(0 as any);
    findAll = vi.spyOn(GDOWhatsappQueueJob, 'findAll').mockResolvedValue([
      { id_whatsapp_queue_job: 'j1', bulk_id_whatsapp_queue_job: BULK, to_whatsapp_queue_job: '393330000000' },
    ] as any);
    update = vi.spyOn(GDOWhatsappQueueJob, 'update').mockResolvedValue([0] as any);
  });

  it("l'elenco contiene solo le campagne della GDO dell'utente", async () => {
    const query = vi.spyOn(sequelize, 'query').mockResolvedValue([
      { bulkId: BULK, campagnaId: 'c1', titolo: 'Promo', createdAt: '2026-10-01T10:00:00.000Z' },
    ] as any);

    const res = await request(createApp()).get('/api/whatsapp/campaigns');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    const [sql, opzioni] = query.mock.calls[0] as any[];
    expect(sql).toContain('t.id_gdo_gdowhatsapptemplate = :idGdo');
    expect(opzioni.replacements).toEqual({ idGdo: 'gdo-A' });
  });

  it.each([
    ['get', 'status'],
    ['get', 'jobs'],
    ['post', 'cancel'],
    ['post', 'retry'],
  ] as const)('%s /campaigns/:bulkId/%s su una campagna di un\'altra GDO risponde 404', async (metodo, azione) => {
    bulkDellaGdo('gdo-B');

    const res = await request(createApp())[metodo](`/api/whatsapp/campaigns/${BULK}/${azione}`);

    expect(res.status).toBe(404);
    expect(findAll).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('un bulkId inesistente o non valido risponde 404', async () => {
    vi.spyOn(GDOWhatsappQueueJob, 'findOne').mockResolvedValue(null);

    expect((await request(createApp()).get(`/api/whatsapp/campaigns/${BULK}/jobs`)).status).toBe(404);
    expect((await request(createApp()).get('/api/whatsapp/campaigns/non-un-uuid/jobs')).status).toBe(404);
  });

  it('sulla propria campagna i messaggi vengono restituiti', async () => {
    bulkDellaGdo('gdo-A');

    const res = await request(createApp()).get(`/api/whatsapp/campaigns/${BULK}/jobs`);

    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({ jobId: 'j1', telefono: '393330000000' });
  });
});
