import { afterEach, describe, expect, it, vi } from 'vitest';
import { STATO_LAVORAZIONE_KIT_RUNTIME } from '../../../../lib/enums';
import { BusinessError, DatabaseError, NotFoundError } from '../../../../lib/errors';
import { sequelize } from '../../db/SequelizeConnector';
import { Area } from '../../models/aree';
import { Canale } from '../../models/canali';
import { FilesRuntime } from '../../models/files_runtime';
import { Promo } from '../../models/promo';
import { RuntimeKit } from '../../models/runtime_kit';
import { KitRuntimeService } from '../KitRuntimeService';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Transazione finta: la callback gira subito, senza database
const t = { LOCK: { UPDATE: 'UPDATE' } };
const req = { session: { id_utente: 'u1' } } as any;

function makeService(kit: Record<string, unknown> | null, webhook = vi.fn(async () => undefined)) {
  vi.spyOn(sequelize, 'transaction').mockImplementation((async (cb: any) => cb(t)) as any);
  const findOne = vi.spyOn(RuntimeKit, 'findOne').mockImplementation((async () => kit) as any);
  const update = vi.spyOn(RuntimeKit, 'update').mockResolvedValue([1] as any);
  vi.spyOn(Area, 'findOne').mockResolvedValue(null);
  vi.spyOn(Canale, 'findOne').mockResolvedValue(null);
  vi.spyOn(FilesRuntime, 'findAll').mockResolvedValue([]);
  vi.spyOn(Promo, 'findOne').mockResolvedValue(null);
  vi.spyOn(KitRuntimeService.prototype as any, 'creaLogPubblicazioneFiles').mockResolvedValue(undefined);
  const service = new KitRuntimeService({} as any, { scatenaEvento: webhook } as any);
  return { service, findOne, update, webhook };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('KitRuntimeService.pubblicaKitRuntime', () => {
  it.each([STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO, STATO_LAVORAZIONE_KIT_RUNTIME.ELIMINATO])(
    'kit %s: BusinessError senza aggiornamento ne webhook',
    async (stato) => {
      const { service, update, webhook } = makeService({ id: 'k1', stato_lavorazione: stato });

      const errore = await service.pubblicaKitRuntime('k1', req).catch((e) => e);

      expect(errore).toBeInstanceOf(BusinessError);
      expect(update).not.toHaveBeenCalled();
      expect(webhook).not.toHaveBeenCalled();
    }
  );

  it('legge il kit con il lock della transazione', async () => {
    const { service, findOne } = makeService({ id: 'k1', stato_lavorazione: STATO_LAVORAZIONE_KIT_RUNTIME.IN_REVISIONE });

    await service.pubblicaKitRuntime('k1', req);

    expect(findOne).toHaveBeenCalledWith(expect.objectContaining({ transaction: t, lock: t.LOCK.UPDATE }));
  });

  it('webhook che fallisce: la pubblicazione resta riuscita', async () => {
    const webhook = vi.fn(async () => { throw new Error('webhook giu'); });
    const { service, update } = makeService({ id: 'k1', stato_lavorazione: STATO_LAVORAZIONE_KIT_RUNTIME.IN_REVISIONE }, webhook);

    const risultato = await service.pubblicaKitRuntime('k1', req);

    expect(risultato).toMatchObject({ id: 'k1' });
    expect(update).toHaveBeenCalledOnce();
    expect(webhook).toHaveBeenCalledOnce();
  });

  it('kit inesistente: NotFoundError e non DatabaseError', async () => {
    const { service, update } = makeService(null);

    const errore = await service.pubblicaKitRuntime('k1', req).catch((e) => e);

    expect(errore).toBeInstanceOf(NotFoundError);
    expect(errore).not.toBeInstanceOf(DatabaseError);
    expect(update).not.toHaveBeenCalled();
  });
});

describe('KitRuntimeService.mettiInStatoDiEliminazione', () => {
  it('kit PUBBLICATO: BusinessError e nessun salvataggio', async () => {
    const save = vi.fn();
    const { service } = makeService({ id: 'k1', stato_lavorazione: STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO, save });

    const errore = await service.mettiInStatoDiEliminazione('k1').catch((e) => e);

    expect(errore).toBeInstanceOf(BusinessError);
    expect(save).not.toHaveBeenCalled();
  });
});
