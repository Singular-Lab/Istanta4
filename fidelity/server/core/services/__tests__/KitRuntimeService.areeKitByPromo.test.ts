import { Op } from 'sequelize';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { STATO_LAVORAZIONE_KIT_RUNTIME } from '../../../../lib/enums';
import { DatabaseError } from '../../../../lib/errors';
import { Area } from '../../models/aree';
import { RuntimeKit } from '../../models/runtime_kit';
import { KitRuntimeService } from '../KitRuntimeService';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// I20-1271: le aree dei kit di ogni promo, che Correggo4 usa per dividere per canale le promo attive.

const service = () => new KitRuntimeService({} as any, {} as any);

const P_B = '11111111-1111-4111-8111-111111111111';
const P_TERRANUOVA = '22222222-2222-4222-8222-222222222222';
const P_SENZA_KIT = '33333333-3333-4333-8333-333333333333';
const AREA_B = 'aaaaaaaa-0000-4000-8000-00000000000b';
const AREA_B1 = 'aaaaaaaa-0000-4000-8000-0000000000b1';

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('getAreeKitByPromo', () => {
  it('per ogni promo restituisce i codici distinti delle aree dei suoi kit, in ordine', async () => {
    const findAllKit = vi.spyOn(RuntimeKit, 'findAll').mockResolvedValue([
      { id_promo: P_B, id_area: AREA_B1, codice_area: null },
      { id_promo: P_B, id_area: AREA_B, codice_area: null },
      { id_promo: P_B, id_area: AREA_B, codice_area: null },
      { id_promo: P_TERRANUOVA, id_area: AREA_B1, codice_area: null },
    ] as any);
    vi.spyOn(Area, 'findAll').mockResolvedValue([
      { id_aree: AREA_B, codice_aree: 'B' },
      { id_aree: AREA_B1, codice_aree: 'B1' },
    ] as any);

    const aree = await service().getAreeKitByPromo([P_B, P_TERRANUOVA, P_SENZA_KIT]);

    expect(aree).toEqual({ [P_B]: ['B', 'B1'], [P_TERRANUOVA]: ['B1'], [P_SENZA_KIT]: [] });
    // i kit eliminati non contano
    const where = (findAllKit.mock.calls[0][0] as any).where;
    expect(where.stato_lavorazione[Op.ne]).toBe(STATO_LAVORAZIONE_KIT_RUNTIME.ELIMINATO);
    expect(where.id_promo[Op.in]).toEqual([P_B, P_TERRANUOVA, P_SENZA_KIT]);
  });

  it('se l\'area non e piu in anagrafica usa il codice copiato sul kit', async () => {
    vi.spyOn(RuntimeKit, 'findAll').mockResolvedValue([
      { id_promo: P_B, id_area: AREA_B, codice_area: 'A-' },
    ] as any);
    vi.spyOn(Area, 'findAll').mockResolvedValue([] as any);

    expect(await service().getAreeKitByPromo([P_B])).toEqual({ [P_B]: ['A-'] });
  });

  it('scarta gli id che non sono uuid senza interrogare il database', async () => {
    const findAllKit = vi.spyOn(RuntimeKit, 'findAll');

    expect(await service().getAreeKitByPromo(['non-un-id', ''])).toEqual({});
    expect(findAllKit).not.toHaveBeenCalled();
  });

  it('un errore del database diventa un DatabaseError', async () => {
    vi.spyOn(RuntimeKit, 'findAll').mockRejectedValue(new Error('connessione persa'));

    await expect(service().getAreeKitByPromo([P_B])).rejects.toBeInstanceOf(DatabaseError);
  });
});
