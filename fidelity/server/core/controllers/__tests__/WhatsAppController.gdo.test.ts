import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TIPO_UTENTI } from '../../../../lib/enums';

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
import { AuditLogService } from '../../services/AuditLogService';
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

// Utente della GDO "gdo-A" oppure Superadmin, con un servizio WhatsApp finto
function createAppConfigurazione(superadmin = false) {
  const configurationChanged = vi.fn();
  vi.spyOn(AuditLogService, 'getInstance').mockReturnValue({ configurationChanged } as any);
  const service = {
    getCurrentGDOWhatsappForCampaign: vi.fn().mockResolvedValue({ id: 'gdo-A' }),
    getGDOWhatsappById: vi.fn().mockResolvedValue({ id: 'n1', id_gdo: 'gdo-A', access_token_configurato: true }),
    getAllTemplatesWhatsappByGdo: vi.fn().mockResolvedValue([]),
    getWhatsappTemplateById: vi.fn().mockResolvedValue({ id_gdowhatsapptemplate: 't1', id_gdo_gdowhatsapptemplate: 'gdo-B' }),
    syncTemplatesFromMeta: vi.fn().mockResolvedValue({ success: true }),
    creaTemplateLocale: vi.fn().mockResolvedValue({ success: true, newTemplateId: 't-nuovo' }),
    salvaInLocaleTemplateWhatsappSuperAdminPayload: vi.fn().mockResolvedValue({ success: true, newTemplateId: 't1' }),
    sendModifiedTemplateToMeta: vi.fn().mockResolvedValue({ success: true, stato: 'PENDING' }),
    salvaSetupGDOWhatsapp: vi.fn().mockResolvedValue({ success: true, creato: false, campiModificati: ['stato', 'access_token'] }),
  };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).session = superadmin
      ? { id_utente: 'super-1', tipo_utente: TIPO_UTENTI.SUPERADMIN }
      : { id_utente: 'user-A' };
    next();
  });
  new WhatsAppController(service as any).registerRoutes(app);
  return { app, service, configurationChanged };
}

const jsonMeta = { name: 'promo_autunno', language: { code: 'it' }, category: 'MARKETING', components: [{ type: 'BODY', text: 'Ciao' }] };

describe('configurazione e modelli WhatsApp: isolamento per GDO', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("la configurazione di un'altra GDO risulta inesistente", async () => {
    const { app, service } = createAppConfigurazione();

    const res = await request(app).get('/api/whatsapp/get_whatsapp_gdo_by_id?id=gdo-B');

    expect(res.status).toBe(404);
    expect(service.getGDOWhatsappById).not.toHaveBeenCalled();
  });

  it('la configurazione della propria GDO si legge, e il Superadmin legge quella di ogni GDO', async () => {
    const utente = createAppConfigurazione();
    expect((await request(utente.app).get('/api/whatsapp/get_whatsapp_gdo_by_id?id=gdo-A')).status).toBe(200);

    const superadmin = createAppConfigurazione(true);
    const res = await request(superadmin.app).get('/api/whatsapp/get_whatsapp_gdo_by_id?id=gdo-B');
    expect(res.status).toBe(200);
    expect(superadmin.service.getGDOWhatsappById).toHaveBeenCalledWith('gdo-B');
  });

  it("i modelli di un'altra GDO risultano inesistenti, e l'elenco risponde solo in GET", async () => {
    const { app, service } = createAppConfigurazione();

    expect((await request(app).get('/api/whatsapp/get_all_templates_whatsapp_by_gdo?id=gdo-B')).status).toBe(404);
    expect((await request(app).post('/api/whatsapp/get_all_templates_whatsapp_by_gdo?id=gdo-A')).status).toBe(404);
    expect(service.getAllTemplatesWhatsappByGdo).not.toHaveBeenCalled();
  });

  it("la sincronizzazione da Meta di un'altra GDO risulta inesistente", async () => {
    const { app, service } = createAppConfigurazione();

    const res = await request(app).put('/api/whatsapp/sync_templates_from_meta').send({ gdoId: 'gdo-B' });

    expect(res.status).toBe(404);
    expect(service.syncTemplatesFromMeta).not.toHaveBeenCalled();
  });

  it.each([
    ['get', '/get_whatsapp_template_by_id?id=t1', undefined],
    ['put', '/nuova_versione_locale_template_whatsapp', { id_template: 't1', json_meta: jsonMeta }],
    ['put', '/send_modified_template_to_meta', { id_template: 't1' }],
  ] as const)("%s %s su un modello di un'altra GDO risponde 404", async (metodo, percorso, corpo) => {
    const { app, service } = createAppConfigurazione();

    const richiesta = request(app)[metodo](`/api/whatsapp${percorso}`);
    const res = await (corpo ? richiesta.send(corpo) : richiesta);

    expect(res.status).toBe(404);
    expect(service.salvaInLocaleTemplateWhatsappSuperAdminPayload).not.toHaveBeenCalled();
    expect(service.sendModifiedTemplateToMeta).not.toHaveBeenCalled();
  });

  it('un modello della propria GDO si invia a Meta e risponde con lo stato restituito', async () => {
    const { app, service } = createAppConfigurazione();
    service.getWhatsappTemplateById.mockResolvedValue({ id_gdowhatsapptemplate: 't1', id_gdo_gdowhatsapptemplate: 'gdo-A' });

    const res = await request(app).put('/api/whatsapp/send_modified_template_to_meta').send({ id_template: 't1' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, stato: 'PENDING' });
  });

  it("la creazione di un modello per un'altra GDO viene rifiutata", async () => {
    const { app, service, configurationChanged } = createAppConfigurazione();

    const res = await request(app).post('/api/whatsapp/crea_template_whatsapp').send({ id_gdo: 'gdo-B', json_meta: jsonMeta });

    expect(res.status).toBe(404);
    expect(service.creaTemplateLocale).not.toHaveBeenCalled();
    expect(configurationChanged).not.toHaveBeenCalled();
  });

  it('un modello creato per la propria GDO restituisce il suo id e resta nel registro di audit', async () => {
    const { app, service, configurationChanged } = createAppConfigurazione();

    const res = await request(app).post('/api/whatsapp/crea_template_whatsapp').send({ id_gdo: 'gdo-A', json_meta: jsonMeta });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, newTemplateId: 't-nuovo' });
    expect(service.creaTemplateLocale).toHaveBeenCalledWith('gdo-A', jsonMeta);
    expect(configurationChanged).toHaveBeenCalledWith(expect.anything(), 'whatsapp_template', 'create', { id_gdo: 'gdo-A', id_template: 't-nuovo' });
  });

  it('il Superadmin crea modelli per ogni GDO', async () => {
    const { app, service } = createAppConfigurazione(true);

    const res = await request(app).post('/api/whatsapp/crea_template_whatsapp').send({ id_gdo: 'gdo-B', json_meta: jsonMeta });

    expect(res.status).toBe(200);
    expect(service.creaTemplateLocale).toHaveBeenCalledWith('gdo-B', jsonMeta);
  });

  it('il canale WhatsApp lo configura solo il Superadmin', async () => {
    const { app, service } = createAppConfigurazione();

    const res = await request(app).put('/api/whatsapp/setup_gdo_whatsapp').send({ id_gdo: 'gdo-A', display_name: 'Negozio', stato: 'VERIFIED' });

    expect(res.status).toBe(403);
    expect(service.salvaSetupGDOWhatsapp).not.toHaveBeenCalled();
  });

  it('il setup del Superadmin si salva e il registro di audit non contiene i token', async () => {
    const { app, service, configurationChanged } = createAppConfigurazione(true);
    const corpo = {
      id_gdo: 'gdo-B',
      display_name: 'Negozio Centro',
      id_numero_whatsapp: 'phone-id-finto',
      whatsapp_business_account_id: 'waba-finto',
      stato: 'VERIFIED',
      access_token: 'token-di-prova-segreto',
      verify_token: '',
    };

    const res = await request(app).put('/api/whatsapp/setup_gdo_whatsapp').send(corpo);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, creato: false });
    expect(service.salvaSetupGDOWhatsapp).toHaveBeenCalledWith(corpo);
    expect(configurationChanged).toHaveBeenCalledWith(expect.anything(), 'whatsapp_numero', 'update', {
      id_gdo: 'gdo-B',
      campi: ['stato', 'access_token'],
    });
    expect(JSON.stringify(configurationChanged.mock.calls.map((c) => c.slice(1)))).not.toContain('token-di-prova-segreto');
  });
});
