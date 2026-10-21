import { Op } from 'sequelize';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GDOWhatsappQueueJobStatus, STATO_GDO_WHATSAPP_TEMPLATE } from '../../../../lib/enums';

const meta = vi.hoisted(() => ({ fetch: vi.fn() }));

vi.mock('node-fetch', () => ({ default: meta.fetch }));
vi.mock('../../../src/shared/queue/bullmq.client.js', () => ({ createQueue: () => ({ add: vi.fn() }) }));
vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { sequelize } from '../../db/SequelizeConnector';
import { GDOWhatsappCampagne } from '../../models/whatsapp/gdo_whatsapp_campagne';
import { GDOWhatsappQueueJob } from '../../models/whatsapp/gdo_whatsapp_message_queue';
import { GDOWhatsappNumbers } from '../../models/whatsapp/gdo_whatsapp_numbers';
import { GDOWhatsappPreset } from '../../models/whatsapp/gdo_whatsapp_preset';
import { GDOWhatsappTemplate } from '../../models/whatsapp/gdo_whatsapp_template';
import { WhatsAppService } from '../WhatsAppService';

const service = () => new WhatsAppService({} as any);

const preset = (extra: Record<string, unknown> = {}) => ({
  id_gdowhatsappreset: 'p1',
  id_template_gdowhatsappreset: 't1',
  is_default_gdowhatsappreset: false,
  destroy: vi.fn(),
  ...extra,
});

const template = (extra: Record<string, unknown> = {}) => ({
  id_gdowhatsapptemplate: 't1',
  id_gdo_gdowhatsapptemplate: 'gdo-a',
  stato_meta_gdowhatsapptemplate: STATO_GDO_WHATSAPP_TEMPLATE.APPROVED,
  json_meta_gdowhatsapptemplate: { id: 'hsm-1', name: 'promo_settimana' },
  destroy: vi.fn(),
  update: vi.fn(),
  ...extra,
});

afterEach(() => {
  vi.restoreAllMocks();
  meta.fetch.mockReset();
});

describe('eliminazione di un preset', () => {
  it('il predefinito non si elimina finché il modello ha altri preset', async () => {
    const p = preset({ is_default_gdowhatsappreset: true });
    vi.spyOn(GDOWhatsappPreset, 'findByPk').mockResolvedValue(p as any);
    vi.spyOn(GDOWhatsappTemplate, 'findByPk').mockResolvedValue(template() as any);
    vi.spyOn(GDOWhatsappPreset, 'count').mockResolvedValue(1 as any);

    await expect(service().eliminaPresetTemplateWhatsapp('p1', null)).rejects.toMatchObject({
      message: 'Imposta prima un altro preset come predefinito',
    });
    expect(p.destroy).not.toHaveBeenCalled();
  });

  it('un preset di un\'altra GDO risulta inesistente', async () => {
    const p = preset();
    vi.spyOn(GDOWhatsappPreset, 'findByPk').mockResolvedValue(p as any);
    vi.spyOn(GDOWhatsappTemplate, 'findByPk').mockResolvedValue(template() as any);

    await expect(service().eliminaPresetTemplateWhatsapp('p1', 'gdo-b')).rejects.toMatchObject({ message: 'Preset non trovato' });
    expect(p.destroy).not.toHaveBeenCalled();
  });

  it('un preset non predefinito della propria GDO viene eliminato', async () => {
    const p = preset();
    vi.spyOn(GDOWhatsappPreset, 'findByPk').mockResolvedValue(p as any);
    vi.spyOn(GDOWhatsappTemplate, 'findByPk').mockResolvedValue(template() as any);

    await service().eliminaPresetTemplateWhatsapp('p1', 'gdo-a');

    expect(p.destroy).toHaveBeenCalled();
  });
});

describe('eliminazione di un template', () => {
  it('mai inviato a Meta: si cancella con i suoi preset, senza chiamare Meta', async () => {
    const t = template({ stato_meta_gdowhatsapptemplate: STATO_GDO_WHATSAPP_TEMPLATE.CREATED_BUT_NOT_SYNCED, json_meta_gdowhatsapptemplate: { name: 'bozza' } });
    vi.spyOn(GDOWhatsappTemplate, 'findByPk').mockResolvedValue(t as any);
    vi.spyOn(sequelize, 'transaction').mockImplementation(async (fn: any) => fn({}));
    const presetEliminati = vi.spyOn(GDOWhatsappPreset, 'destroy').mockResolvedValue(2 as any);

    await service().eliminaTemplateWhatsapp('t1', null);

    expect(presetEliminati).toHaveBeenCalledWith(expect.objectContaining({ where: { id_template_gdowhatsappreset: 't1' } }));
    expect(t.destroy).toHaveBeenCalled();
    expect(meta.fetch).not.toHaveBeenCalled();
  });

  it('con messaggi in coda rifiuta e non chiama Meta', async () => {
    const t = template();
    vi.spyOn(GDOWhatsappTemplate, 'findByPk').mockResolvedValue(t as any);
    vi.spyOn(GDOWhatsappCampagne, 'findAll').mockResolvedValue([{ id_whatsapp_campagna: 'c1' }] as any);
    const conta = vi.spyOn(GDOWhatsappQueueJob, 'count').mockResolvedValue(3 as any);

    await expect(service().eliminaTemplateWhatsapp('t1', null)).rejects.toMatchObject({
      message: expect.stringContaining('invii in corso'),
    });
    const where = (conta.mock.calls[0][0] as any).where;
    expect(where.campagna_id_whatsapp_queue_job[Op.in]).toEqual(['c1']);
    expect(where.status_whatsapp_queue_job[Op.in]).toEqual([GDOWhatsappQueueJobStatus.PENDING, GDOWhatsappQueueJobStatus.PROCESSING]);
    expect(meta.fetch).not.toHaveBeenCalled();
    expect(t.update).not.toHaveBeenCalled();
  });

  it('approvato: si elimina su Meta solo quella lingua e resta come DELETED', async () => {
    const t = template();
    vi.spyOn(GDOWhatsappTemplate, 'findByPk').mockResolvedValue(t as any);
    vi.spyOn(GDOWhatsappCampagne, 'findAll').mockResolvedValue([] as any);
    vi.spyOn(GDOWhatsappNumbers, 'findOne').mockResolvedValue({
      whatsapp_business_account_id_gdowhatsappnumbers: 'waba-1',
      access_token_gdowhatsappnumbers: 'token-di-prova',
    } as any);
    meta.fetch.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });

    await service().eliminaTemplateWhatsapp('t1', 'gdo-a');

    const [url, opzioni] = meta.fetch.mock.calls[0];
    expect(url).toContain('/waba-1/message_templates?');
    expect(url).toContain('hsm_id=hsm-1');
    expect(url).toContain('name=promo_settimana');
    expect(opzioni.method).toBe('DELETE');
    expect(t.update).toHaveBeenCalledWith({ stato_meta_gdowhatsapptemplate: STATO_GDO_WHATSAPP_TEMPLATE.DELETED });
    expect(t.destroy).not.toHaveBeenCalled();
  });

  it('se Meta rifiuta il template resta invariato', async () => {
    const t = template();
    vi.spyOn(GDOWhatsappTemplate, 'findByPk').mockResolvedValue(t as any);
    vi.spyOn(GDOWhatsappCampagne, 'findAll').mockResolvedValue([] as any);
    vi.spyOn(GDOWhatsappNumbers, 'findOne').mockResolvedValue({
      whatsapp_business_account_id_gdowhatsappnumbers: 'waba-1',
      access_token_gdowhatsappnumbers: 'token-di-prova',
    } as any);
    meta.fetch.mockResolvedValue({ ok: false, status: 400, statusText: 'Bad Request', json: async () => ({ error: { message: 'Template inesistente' } }) });

    await expect(service().eliminaTemplateWhatsapp('t1', null)).rejects.toMatchObject({
      message: expect.stringContaining('Template inesistente'),
    });
    expect(t.update).not.toHaveBeenCalled();
  });

  it('un template di un\'altra GDO risulta inesistente', async () => {
    vi.spyOn(GDOWhatsappTemplate, 'findByPk').mockResolvedValue(template() as any);

    await expect(service().eliminaTemplateWhatsapp('t1', 'gdo-b')).rejects.toMatchObject({ message: 'Template non trovato' });
    expect(meta.fetch).not.toHaveBeenCalled();
  });
});
