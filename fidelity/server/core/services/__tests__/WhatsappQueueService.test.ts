import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GDOWhatsappQueueJobStatus, STATO_GDO_WHATSAPP_TEMPLATE } from '../../../../lib/enums';

const coda = vi.hoisted(() => ({ add: vi.fn() }));

vi.mock('../../../src/shared/queue/bullmq.client.js', () => ({ createQueue: () => ({ add: coda.add }) }));

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { sequelize } from '../../db/SequelizeConnector';
import { Utente } from '../../models/utenti';
import { UtentiGDO } from '../../models/utenti_gdo';
import { GDOWhatsappCampagne } from '../../models/whatsapp/gdo_whatsapp_campagne';
import { GDOWhatsappQueueJob } from '../../models/whatsapp/gdo_whatsapp_message_queue';
import { GDOWhatsappPreset } from '../../models/whatsapp/gdo_whatsapp_preset';
import { GDOWhatsappTemplate } from '../../models/whatsapp/gdo_whatsapp_template';
import { WhatsAppService } from '../WhatsAppService';
import { WhatsappQueueService } from '../WhatsappQueueService';

describe('WhatsappQueueService: annullamento e riprova', () => {
  it('annullare una campagna porta i messaggi in coda a CANCELLED', async () => {
    const update = vi.spyOn(GDOWhatsappQueueJob, 'update').mockResolvedValue([2] as any);

    const annullati = await new WhatsappQueueService().cancelBulk('b1');

    expect(annullati).toBe(2);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ status_whatsapp_queue_job: GDOWhatsappQueueJobStatus.CANCELLED }),
      { where: { bulk_id_whatsapp_queue_job: 'b1', status_whatsapp_queue_job: GDOWhatsappQueueJobStatus.PENDING } }
    );
  });

  it('riprova rimette in coda solo i FAILED: gli annullati restano annullati', async () => {
    const update = vi.spyOn(GDOWhatsappQueueJob, 'update').mockResolvedValue([1] as any);

    await new WhatsappQueueService().retryFailedJobs('b1');

    const [, opzioni] = update.mock.calls[0] as any[];
    expect(opzioni.where).toEqual({
      bulk_id_whatsapp_queue_job: 'b1',
      status_whatsapp_queue_job: GDOWhatsappQueueJobStatus.FAILED,
    });
  });

  it('una campagna annullata, senza messaggi in coda, risulta conclusa', async () => {
    const perStato: Record<string, number> = { SUCCESS: 3, CANCELLED: 7 };
    vi.spyOn(GDOWhatsappQueueJob, 'count').mockImplementation(async (opzioni: any) => {
      const stato = opzioni.where.status_whatsapp_queue_job;
      return (stato ? perStato[stato] ?? 0 : 10) as any;
    });

    const stato = await new WhatsappQueueService().getBulkStatus('b1');

    expect(stato).toMatchObject({ total: 10, success: 3, cancelled: 7, pending: 0, status: 'COMPLETED' });
  });
});

describe('WhatsAppService.iniziaInvioCampagnaWhatsApp: creazione dei job', () => {
  const template = (override: Record<string, unknown> = {}) => ({
    id_gdowhatsapptemplate: 't1',
    id_gdo_gdowhatsapptemplate: 'gdo-A',
    stato_meta_gdowhatsapptemplate: STATO_GDO_WHATSAPP_TEMPLATE.APPROVED,
    json_meta_gdowhatsapptemplate: { name: 'promo', language: 'it', components: [{ type: 'BODY', text: 'Ciao' }] },
    ...override,
  });

  let bulkCreate: ReturnType<typeof vi.spyOn>;
  let campagnaCreate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    coda.add.mockReset().mockResolvedValue({});
    vi.spyOn(UtentiGDO, 'findAll').mockResolvedValue([{ id_utente_utentegdo: 'u1' }, { id_utente_utentegdo: 'u2' }] as any);
    vi.spyOn(Utente, 'count').mockResolvedValue(3 as any);
    vi.spyOn(GDOWhatsappTemplate, 'findByPk').mockResolvedValue(template() as any);
    vi.spyOn(GDOWhatsappPreset, 'findOne').mockResolvedValue({ json_meta_gdowhatsappreset: {} } as any);
    vi.spyOn(sequelize, 'transaction').mockImplementation(async (...args: any[]) => args[args.length - 1]({}));
    campagnaCreate = vi.spyOn(GDOWhatsappCampagne, 'create').mockResolvedValue({} as any);
    bulkCreate = vi.spyOn(GDOWhatsappQueueJob, 'bulkCreate').mockResolvedValue([] as any);
  });

  it('piu\' utenti con lo stesso numero ricevono un solo messaggio', async () => {
    vi.spyOn(sequelize, 'query').mockResolvedValue([
      { id_utenti: 'u1', nome_utenti: 'Anna', telefono_utenti: '+39 333 1234567' },
      { id_utenti: 'u2', nome_utenti: 'Luca', telefono_utenti: '393331234567' },
      { id_utenti: 'u3', nome_utenti: 'Sara', telefono_utenti: '393470000000' },
    ] as any);

    const risultato = await new WhatsAppService({} as any).iniziaInvioCampagnaWhatsApp('gdo-A', 't1', 'Promo', null, {});

    expect(risultato.totalJobs).toBe(2);
    const [jobs] = bulkCreate.mock.calls[0] as any[];
    expect(jobs.map((j: any) => j.to_whatsapp_queue_job)).toEqual(['+39 333 1234567', '393470000000']);
    // La coda BullMQ riceve il bulk solo dopo il commit della transazione
    expect(coda.add).toHaveBeenCalledWith('process-bulk', { bulk_id: risultato.bulkId }, expect.anything());
  });

  it.each([
    ['di un\'altra GDO', template({ id_gdo_gdowhatsapptemplate: 'gdo-B' }), /non appartiene alla GDO/],
    ['non approvato da Meta', template({ stato_meta_gdowhatsapptemplate: STATO_GDO_WHATSAPP_TEMPLATE.PENDING }), /non è approvato/],
  ])('con un template %s la campagna non parte e nessun job viene creato', async (_caso, tpl, motivo) => {
    vi.spyOn(GDOWhatsappTemplate, 'findByPk').mockResolvedValue(tpl as any);
    const query = vi.spyOn(sequelize, 'query').mockResolvedValue([{ id_utenti: 'u1', telefono_utenti: '393331234567' }] as any);

    await expect(
      new WhatsAppService({} as any).iniziaInvioCampagnaWhatsApp('gdo-A', 't1', 'Promo', null, {})
    ).rejects.toMatchObject({ name: 'BusinessError', message: expect.stringMatching(motivo) });

    expect(query).not.toHaveBeenCalled();
    expect(campagnaCreate).not.toHaveBeenCalled();
    expect(bulkCreate).not.toHaveBeenCalled();
  });

  it('anteprima e invio selezionano i destinatari con gli stessi criteri e contano i telefoni distinti', async () => {
    const query = vi.spyOn(sequelize, 'query').mockResolvedValue([] as any);
    // "null" arriva dal client quando il filtro sesso e' vuoto
    const filtri = { sesso: 'null', dateRange: '1980-01-01 - 1990-12-31' };
    const service = new WhatsAppService({} as any);

    await service.getAllUtentiGuestWhatsappCount('gdo-A', filtri);
    await expect(service.iniziaInvioCampagnaWhatsApp('gdo-A', 't1', 'Promo', null, filtri)).rejects.toThrow(/Nessun utente/);

    const [conteggio, , invio] = query.mock.calls as any[];
    const where = (sql: string) => sql.slice(sql.indexOf('WHERE'));
    expect(conteggio[0]).toContain('COUNT(DISTINCT');
    expect(where(invio[0])).toBe(where(conteggio[0]));
    expect(invio[1].replacements).toEqual(conteggio[1].replacements);
    expect(conteggio[1].replacements.sesso).toBeNull();
  });
});
