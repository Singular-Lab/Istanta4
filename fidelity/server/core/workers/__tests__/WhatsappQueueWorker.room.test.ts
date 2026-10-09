import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GDOWhatsappQueueJobStatus } from '../../../../lib/enums';

const socket = vi.hoisted(() => ({ emitToClients: vi.fn() }));

vi.mock('../../../ws-server', () => ({ emitToClients: socket.emitToClients }));

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { GDOWhatsappCampagne } from '../../models/whatsapp/gdo_whatsapp_campagne';
import { GDOWhatsappQueueJob } from '../../models/whatsapp/gdo_whatsapp_message_queue';
import { GDOWhatsappTemplate } from '../../models/whatsapp/gdo_whatsapp_template';
import { WhatsappQueueWorker } from '../WhatsappQueueWorker';

const job = {
  id_whatsapp_queue_job: 'j1',
  bulk_id_whatsapp_queue_job: 'b1',
  campagna_id_whatsapp_queue_job: 'c1',
  index_whatsapp_queue_job: 1,
  total_whatsapp_queue_job: 2,
  to_whatsapp_queue_job: '+393330000000',
  attempts_whatsapp_queue_job: 0,
};

describe('notifiche socket della coda WhatsApp', () => {
  beforeEach(() => {
    socket.emitToClients.mockReset();
    vi.spyOn(GDOWhatsappQueueJob, 'count').mockResolvedValue(0 as any);
    vi.spyOn(GDOWhatsappQueueJob, 'findOne').mockResolvedValue(null);
    vi.spyOn(GDOWhatsappCampagne, 'findByPk').mockResolvedValue({ template_id_whatsapp_campagna: 't1' } as any);
  });

  it('lo stato del messaggio arriva solo agli utenti della GDO della campagna', async () => {
    vi.spyOn(GDOWhatsappTemplate, 'findByPk').mockResolvedValue({ id_gdo_gdowhatsapptemplate: 'gdo-A' } as any);
    const worker = new WhatsappQueueWorker() as any;

    await worker.ensureBulkState(job);
    worker.emitJobStatus(job, GDOWhatsappQueueJobStatus.PROCESSING);

    expect(socket.emitToClients).toHaveBeenCalledWith(
      'whatsapp:job-status',
      expect.objectContaining({ jobId: 'j1', telefono: '+393330000000' }),
      'gdo:gdo-A'
    );
  });

  it('se la GDO della campagna non si trova lo stato non viene mandato a nessuno', async () => {
    vi.spyOn(GDOWhatsappTemplate, 'findByPk').mockResolvedValue(null);
    const worker = new WhatsappQueueWorker() as any;

    await worker.ensureBulkState(job);
    worker.emitJobStatus(job, GDOWhatsappQueueJobStatus.PROCESSING);
    await worker.emitBulkStatus('b1');

    expect(socket.emitToClients).not.toHaveBeenCalled();
  });
});
