import { Op } from 'sequelize';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STATO_PROMO } from '../../../../lib/enums';

const cron = vi.hoisted(() => ({ schedule: vi.fn() }));

vi.mock('node-cron', () => ({ default: { schedule: cron.schedule } }));

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// La coda WhatsApp non serve qui: evita di caricare socket e BullMQ
vi.mock('../../workers/WhatsappQueueWorker', () => ({ getWhatsappQueueWorker: vi.fn() }));

import { Promo } from '../../models/promo';
import { ChronService } from '../ChronService';

const promo = (id_promo: string, stato: STATO_PROMO, validita_dal: string, validita_al: string) => ({
  id_promo,
  nome_promo: `PROMO ${id_promo}`,
  data_registrazione: new Date('2026-09-01T00:00:00Z'),
  validita_dal: new Date(validita_dal),
  validita_al: new Date(validita_al),
  data_scadenza: null,
  offset_visibilita: 0,
  stato,
  context: [],
  gdo: 'g1',
});

/** Esegue una volta il job degli stati promo, come farebbe node-cron. */
async function eseguiJobStatiPromo() {
  new ChronService().startPromoCronJob();
  const [, job, opzioni] = cron.schedule.mock.calls[0];
  expect(opzioni).toEqual({ timezone: 'Europe/Rome' });
  await job();
}

beforeEach(() => {
  // Server in UTC come nel container: le 23:30 UTC del 10 ottobre a Roma sono gia' l'11
  vi.stubEnv('TZ', 'UTC');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-10T23:30:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  cron.schedule.mockReset();
});

describe('ChronService: sincronizzazione stati promo', () => {
  it('alle 23:30 UTC del 10 ottobre archivia la promo valida fino al 10, solo se e ancora nello stato letto', async () => {
    vi.spyOn(Promo, 'findAll').mockResolvedValue([
      promo('p1', STATO_PROMO.VALIDA, '2026-10-01T00:00:00Z', '2026-10-10T00:00:00Z'),
    ] as any);
    const update = vi.spyOn(Promo, 'update').mockResolvedValue([1] as any);

    await eseguiJobStatiPromo();

    expect(update).toHaveBeenCalledWith(
      { stato: STATO_PROMO.ARCHIVIATA },
      { where: { id_promo: 'p1', stato: STATO_PROMO.VALIDA } }
    );
  });

  it('una ARCHIVIATA con le date spostate in avanti torna VALIDA', async () => {
    vi.spyOn(Promo, 'findAll').mockResolvedValue([
      promo('p2', STATO_PROMO.ARCHIVIATA, '2026-10-05T00:00:00Z', '2026-10-20T00:00:00Z'),
    ] as any);
    const update = vi.spyOn(Promo, 'update').mockResolvedValue([1] as any);

    await eseguiJobStatiPromo();

    expect(update).toHaveBeenCalledWith(
      { stato: STATO_PROMO.VALIDA },
      { where: { id_promo: 'p2', stato: STATO_PROMO.ARCHIVIATA } }
    );
  });

  it('la query esclude le eliminate e le ARCHIVIATA gia scadute secondo il giorno di Roma', async () => {
    const findAll = vi.spyOn(Promo, 'findAll').mockResolvedValue([] as any);

    await new ChronService().getAllPromo();

    expect(findAll.mock.calls[0][0]).toEqual({
      where: {
        stato: { [Op.ne]: STATO_PROMO.ELIMINATA },
        [Op.or]: [
          { stato: { [Op.ne]: STATO_PROMO.ARCHIVIATA } },
          // inizio dell'11 ottobre a Roma: un'ARCHIVIATA valida fino al 10 resta fuori
          { validita_al: { [Op.gte]: new Date('2026-10-10T22:00:00Z') } },
        ],
      },
    });
  });
});
