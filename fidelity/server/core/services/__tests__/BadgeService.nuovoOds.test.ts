import { afterEach, describe, expect, it, vi } from 'vitest';
import { STATO_PROMO } from '../../../../lib/enums';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { RisolutoreAccessi } from '../../accessi/RisolutoreAccessi';
import { OrdiniDiStampa } from '../../models/ordini_di_stampa';
import { Promo } from '../../models/promo';
import BadgeService from '../BadgeService';
import { PromoService } from '../PromoService';

afterEach(() => {
  vi.restoreAllMocks();
});

const badges = (promoSenzaOrdine: number) => {
  vi.spyOn(RisolutoreAccessi, 'get').mockReturnValue({ puoAprire: async () => true } as any);
  const promoService = { getCurrentPromoCount: async () => 0, contaPromoSenzaOrdineDiStampa: async () => promoSenzaOrdine };
  const ordiniStampaService = { getAllOrdiniDiStampaInCorso: async () => [] };
  return new BadgeService(promoService as any, ordiniStampaService as any).getBadgesForUser({} as any);
};

describe('badge di Nuovo ODS', () => {
  it('mostra il numero di promo senza ordine di stampa', async () => {
    expect(await badges(2)).toEqual({ '/nuovo-ods': { count: 2, variant: 'warning' } });
  });

  it('con zero promo non compare', async () => {
    expect(await badges(0)).toEqual({});
  });
});

describe('promo proponibili per un nuovo ordine di stampa', () => {
  const service = () => new PromoService({} as any, {} as any, {} as any, {} as any, {} as any);

  it('esclude le promo eliminate, concluse e quelle con un ordine già creato', async () => {
    vi.spyOn(Promo, 'findAll').mockResolvedValue([
      { id_promo: 'senza-ordine', stato: STATO_PROMO.IN_LAVORAZIONE },
      { id_promo: 'con-ordine', stato: STATO_PROMO.IN_LAVORAZIONE },
      { id_promo: 'eliminata', stato: STATO_PROMO.ELIMINATA },
      { id_promo: 'archiviata', stato: STATO_PROMO.ARCHIVIATA },
    ] as any);
    vi.spyOn(OrdiniDiStampa, 'findAll').mockResolvedValue([{ id_promo_ordinistampa: 'con-ordine' }] as any);
    const s = service();
    vi.spyOn(s, 'getAllPromo').mockResolvedValue(
      ['senza-ordine', 'con-ordine', 'eliminata', 'archiviata'].map((id) => ({ id, data_registrazione: new Date(2026, 9, 1) })) as any
    );

    expect(await s.contaPromoSenzaOrdineDiStampa()).toBe(1);
    expect((await s.getPromoSenzaOrdineDiStampa()).map((p) => p.id)).toEqual(['senza-ordine']);
  });
});
