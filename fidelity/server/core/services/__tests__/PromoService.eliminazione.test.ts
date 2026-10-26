import { afterEach, describe, expect, it, vi } from 'vitest';
import { STATO_PROMO } from '../../../../lib/enums';
import { RuntimeKit } from '../../models/runtime_kit';
import { Tracciati } from '../../models/tracciati';
import { PromoService } from '../PromoService';

// I20-1052: Istanta rifiuta l'eliminazione definitiva di una promo con importazioni o tracciati
const promo = (id_promo: string) => ({
  id_promo,
  nome_promo: `PROMO ${id_promo}`,
  data_registrazione: new Date(2026, 9, 1),
  validita_dal: new Date(2026, 9, 8),
  validita_al: new Date(2026, 9, 18),
  data_scadenza: new Date(2026, 9, 7),
  offset_visibilita: 0,
  stato: STATO_PROMO.IN_LAVORAZIONE,
  context: [],
  gdo: 'g1',
});

function makeService(kit: Record<string, number>, tracciati: Record<string, number>) {
  const promoRepository = { findAll: vi.fn().mockResolvedValue([promo('vuota'), promo('con-liste'), promo('con-kit')]) };
  vi.spyOn(RuntimeKit, 'findAll').mockImplementation(async (opzioni: any) =>
    Array.from({ length: kit[opzioni.where.id_promo] ?? 0 }) as any
  );
  vi.spyOn(Tracciati, 'count').mockImplementation(async (opzioni: any) => (tracciati[opzioni.where.id_promo_tracciati] ?? 0) as any);
  return new PromoService({} as any, {} as any, promoRepository as any, {} as any, {} as any);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PromoService.getAllPromo: eliminazione definitiva', () => {
  it('e proposta solo per una promo senza kit e senza tracciati', async () => {
    const service = makeService({ 'con-kit': 2 }, { 'con-liste': 3 });

    const elenco = await service.getAllPromo();
    const eliminabile = Object.fromEntries(elenco.map((p) => [p.id, p.is_deletable]));

    expect(eliminabile).toEqual({ vuota: true, 'con-liste': false, 'con-kit': false });
  });
});
