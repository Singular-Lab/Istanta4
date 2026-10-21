import { Op } from 'sequelize';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GDOWhatsappQueueJobStatus } from '../../../../lib/enums';

const socket = vi.hoisted(() => ({ emitToClients: vi.fn() }));

vi.mock('../../../ws-server', () => ({ emitToClients: socket.emitToClients }));

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { sequelize } from '../../db/SequelizeConnector';
import { GDOWhatsappCampagne } from '../../models/whatsapp/gdo_whatsapp_campagne';
import { GDOWhatsappQueueJob } from '../../models/whatsapp/gdo_whatsapp_message_queue';
import { GDOWhatsappNumbers } from '../../models/whatsapp/gdo_whatsapp_numbers';
import { GDOWhatsappTemplate } from '../../models/whatsapp/gdo_whatsapp_template';
import { WhatsappQueueWorker } from '../WhatsappQueueWorker';

const nuovoJob = () => ({
  id_whatsapp_queue_job: 'j1',
  bulk_id_whatsapp_queue_job: 'b1',
  campagna_id_whatsapp_queue_job: 'c1',
  index_whatsapp_queue_job: 1,
  total_whatsapp_queue_job: 1,
  to_whatsapp_queue_job: '393330000000',
  body_whatsapp_queue_job: { messaging_product: 'whatsapp', to: '393330000000', type: 'template' },
  attempts_whatsapp_queue_job: 0,
  max_attempts_whatsapp_queue_job: 3,
  status_whatsapp_queue_job: GDOWhatsappQueueJobStatus.PROCESSING,
  run_at_whatsapp_queue_job: new Date(),
  last_error_whatsapp_queue_job: null as string | null,
  wamid_whatsapp_queue_job: null as string | null,
  updatedat: undefined as Date | undefined,
  save: vi.fn().mockResolvedValue(undefined),
});

const rispostaMeta = (status: number, body: unknown) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(body), { status }));

describe('invio dei messaggi della coda WhatsApp', () => {
  beforeEach(() => {
    socket.emitToClients.mockReset();
    vi.spyOn(GDOWhatsappQueueJob, 'count').mockResolvedValue(0 as any);
    vi.spyOn(GDOWhatsappQueueJob, 'findOne').mockResolvedValue(null);
    vi.spyOn(GDOWhatsappCampagne, 'findByPk').mockResolvedValue({ template_id_whatsapp_campagna: 't1' } as any);
    vi.spyOn(GDOWhatsappTemplate, 'findByPk').mockResolvedValue({ id_gdo_gdowhatsapptemplate: 'gdo-A' } as any);
    vi.spyOn(GDOWhatsappNumbers, 'findOne').mockResolvedValue({
      id_numero_whatsapp_gdowhatsappnumbers: 'phone-id-finto',
      access_token_gdowhatsappnumbers: 'token-finto',
    } as any);
  });

  it('un errore 400 di Meta fallisce subito, senza altri tentativi', async () => {
    rispostaMeta(400, { error: { message: 'Invalid parameter' } });
    const job = nuovoJob();

    await (new WhatsappQueueWorker() as any).processJob(job);

    expect(job.status_whatsapp_queue_job).toBe(GDOWhatsappQueueJobStatus.FAILED);
    expect(job.attempts_whatsapp_queue_job).toBe(1);
    expect(job.last_error_whatsapp_queue_job).toContain('400');
  });

  it('un errore 500 di Meta resta in coda per un nuovo tentativo', async () => {
    rispostaMeta(500, { error: { message: 'Service unavailable' } });
    const job = nuovoJob();

    await (new WhatsappQueueWorker() as any).processJob(job);

    expect(job.status_whatsapp_queue_job).toBe(GDOWhatsappQueueJobStatus.PENDING);
    expect(job.run_at_whatsapp_queue_job.getTime()).toBeGreaterThan(Date.now());
  });

  it('un job in invio quando la campagna viene annullata non torna in coda dopo un errore 500', async () => {
    rispostaMeta(500, { error: { message: 'Service unavailable' } });
    const job = nuovoJob();
    job.updatedat = new Date(Date.now() - 5_000);
    const count = vi.spyOn(GDOWhatsappQueueJob, 'count').mockImplementation(async (opzioni: any) =>
      (opzioni.where.status_whatsapp_queue_job === GDOWhatsappQueueJobStatus.CANCELLED ? 4 : 0) as any);

    await (new WhatsappQueueWorker() as any).processJob(job);

    expect(job.status_whatsapp_queue_job).toBe(GDOWhatsappQueueJobStatus.CANCELLED);
    // Solo gli annullamenti dopo la presa in carico: un annullamento precedente a "Riprova falliti" non conta
    const annullati = (count.mock.calls as any[]).map(([o]) => o.where).find((w: any) => w.updatedat);
    expect(annullati.status_whatsapp_queue_job).toBe(GDOWhatsappQueueJobStatus.CANCELLED);
    expect(annullati.bulk_id_whatsapp_queue_job).toBe('b1');
    expect(annullati.updatedat[Op.gte]).toBe(job.updatedat);
  });

  it('un job in invio quando la campagna viene annullata resta SUCCESS se l\'invio riesce', async () => {
    rispostaMeta(200, { messages: [{ id: 'wamid.ABC123' }] });
    const job = nuovoJob();
    vi.spyOn(GDOWhatsappQueueJob, 'count').mockResolvedValue(4 as any);

    await (new WhatsappQueueWorker() as any).processJob(job);

    expect(job.status_whatsapp_queue_job).toBe(GDOWhatsappQueueJobStatus.SUCCESS);
  });

  it('un invio riuscito salva il wamid restituito da Meta', async () => {
    const chiamataMeta = rispostaMeta(200, { messages: [{ id: 'wamid.ABC123' }] });
    const job = nuovoJob();

    await (new WhatsappQueueWorker() as any).processJob(job);

    expect(job.status_whatsapp_queue_job).toBe(GDOWhatsappQueueJobStatus.SUCCESS);
    expect(job.wamid_whatsapp_queue_job).toBe('wamid.ABC123');
    // Senza timeout una chiamata appesa bloccherebbe il worker
    expect((chiamataMeta.mock.calls[0][1] as RequestInit).signal).toBeInstanceOf(AbortSignal);
  });

  it('il messaggio parte solo dopo il commit della transazione che lo prende in carico', async () => {
    const ordine: string[] = [];
    const job = nuovoJob();
    job.status_whatsapp_queue_job = GDOWhatsappQueueJobStatus.PENDING;
    vi.spyOn(GDOWhatsappQueueJob, 'update').mockResolvedValue([0] as any);
    vi.spyOn(GDOWhatsappQueueJob, 'findAll').mockResolvedValue([job] as any);
    vi.spyOn(sequelize, 'transaction').mockImplementation(async (...args: any[]) => {
      const risultato = await args[args.length - 1]({});
      ordine.push('commit');
      return risultato;
    });
    const worker = new WhatsappQueueWorker() as any;
    vi.spyOn(worker, 'processJob').mockImplementation(async () => {
      ordine.push('invio');
    });

    await worker.tick();

    expect(ordine).toEqual(['commit', 'invio']);
    expect(job.status_whatsapp_queue_job).toBe(GDOWhatsappQueueJobStatus.PROCESSING);
    expect(job.updatedat).toBeInstanceOf(Date);
  });

  it('i messaggi rimasti PROCESSING da piu\' di 10 minuti non vengono reinviati: SUCCESS con wamid, altrimenti FAILED', async () => {
    const update = vi.spyOn(GDOWhatsappQueueJob, 'update').mockResolvedValue([1] as any);

    await (new WhatsappQueueWorker() as any).recuperaJobInterrotti();

    const [[conWamid, opzioniConWamid], [senzaWamid, opzioniSenzaWamid]] = update.mock.calls as any[];
    for (const { where } of [opzioniConWamid, opzioniSenzaWamid]) {
      expect(where.status_whatsapp_queue_job).toBe(GDOWhatsappQueueJobStatus.PROCESSING);
      expect(where.updatedat[Op.lt].getTime()).toBeLessThanOrEqual(Date.now() - 10 * 60_000);
    }
    expect(conWamid.status_whatsapp_queue_job).toBe(GDOWhatsappQueueJobStatus.SUCCESS);
    expect(opzioniConWamid.where.wamid_whatsapp_queue_job[Op.ne]).toBeNull();
    expect(senzaWamid).toEqual({
      status_whatsapp_queue_job: GDOWhatsappQueueJobStatus.FAILED,
      last_error_whatsapp_queue_job: 'Invio interrotto: esito sconosciuto',
    });
    expect(opzioniSenzaWamid.where.wamid_whatsapp_queue_job).toBeNull();
  });
});
