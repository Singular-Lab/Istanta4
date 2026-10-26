import { afterEach, describe, expect, it, vi } from 'vitest';
import { DatabaseError } from '../../../../lib/errors';
import { sequelize } from '../../db/SequelizeConnector';
import { Referenze } from '../../models/referenze';
import { ReferenzeService } from '../ReferenzeService';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

// Spec referenze-webpliant, "Sostituzione per runtime": vecchio insieme eliminato e nuovo inserito in modo atomico
const transazione = { id: 't-1' };

function makeService() {
  // Come sequelize: esegue il callback dentro la transazione e ne propaga l'errore (che causa il rollback)
  const transaction = vi.spyOn(sequelize, 'transaction').mockImplementation((async (callback: any) => callback(transazione)) as any);
  return { service: new ReferenzeService({} as any, {} as any), transaction };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ReferenzeService.sostituisciReferenzeKit', () => {
  it('elimina le referenze del kit e inserisce le nuove nella stessa transazione', async () => {
    const { service } = makeService();
    const destroy = vi.spyOn(Referenze, 'destroy').mockResolvedValue(3 as any);
    const bulkCreate = vi.spyOn(Referenze, 'bulkCreate').mockResolvedValue([] as any);

    await service.sostituisciReferenzeKit('kit-1', [{
      id: 'r-nuova',
      guidIdKitRuntime: 'kit-1',
      foto: [{ nome: 'a.jpg', guidId: 'g-1' }, { nome: 'b.jpg', guidId: '' }],
    } as any]);

    expect(destroy).toHaveBeenCalledWith({ where: { id_runtime_kit: 'kit-1' }, transaction: transazione });
    expect(bulkCreate).toHaveBeenCalledWith(
      [expect.objectContaining({ id: 'r-nuova', id_runtime_kit: 'kit-1', foto: ['g-1'] })],
      { transaction: transazione }
    );
    expect(destroy.mock.invocationCallOrder[0]).toBeLessThan(bulkCreate.mock.invocationCallOrder[0]);
  });

  it('inserimento fallito: errore di database e la transazione non viene confermata', async () => {
    const { service, transaction } = makeService();
    vi.spyOn(Referenze, 'destroy').mockResolvedValue(3 as any);
    vi.spyOn(Referenze, 'bulkCreate').mockRejectedValue(new Error('violazione di vincolo'));

    await expect(service.sostituisciReferenzeKit('kit-1', [{ id: 'r-nuova' } as any])).rejects.toBeInstanceOf(DatabaseError);
    // Il callback della transazione rigetta: sequelize annulla anche la cancellazione
    await expect(transaction.mock.results[0].value).rejects.toThrow('violazione di vincolo');
  });
});
