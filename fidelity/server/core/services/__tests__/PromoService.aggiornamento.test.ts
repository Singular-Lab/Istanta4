import { afterEach, describe, expect, it, vi } from 'vitest';
import { STATO_PROMO } from '../../../../lib/enums';
import { PromoService } from '../PromoService';

const salvata = {
  id_promo: 'p1',
  nome_promo: 'A2641',
  data_registrazione: new Date(2026, 9, 1),
  validita_dal: new Date(2026, 9, 8),
  validita_al: new Date(2026, 9, 18),
  data_scadenza: new Date(2026, 9, 7),
  offset_visibilita: 0,
  stato: STATO_PROMO.IN_LAVORAZIONE,
  context: [],
  meta: {},
  gdo: 'g1',
};

function makeService() {
  const promoRepository = {
    findById: vi.fn(async () => salvata),
    update: vi.fn(async (_id: string, valori: any) => ({ ...salvata, ...valori })),
  };
  const service = new PromoService({} as any, {} as any, promoRepository as any, {} as any, {} as any);
  return { service, promoRepository };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PromoService.updatePromo', () => {
  it('ignora stato e gdo arrivati dal client e aggiorna gli altri campi', async () => {
    const { service, promoRepository } = makeService();

    await service.updatePromo('p1', { nome: 'A2642', stato: STATO_PROMO.ELIMINATA, gdo: 'g2' } as any);

    expect(promoRepository.update).toHaveBeenCalledOnce();
    expect(promoRepository.update.mock.calls[0][1]).toMatchObject({
      nome_promo: 'A2642',
      stato: STATO_PROMO.IN_LAVORAZIONE,
      gdo: 'g1',
    });
  });
});
