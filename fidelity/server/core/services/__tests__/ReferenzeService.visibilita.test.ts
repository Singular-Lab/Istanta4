import dayjs from 'dayjs';
import { Op } from 'sequelize';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RuntimeKit } from '../../models/runtime_kit';
import { WorkspaceWebpliant } from '../../models/workspace_webpliant';
import { ReferenzeService } from '../ReferenzeService';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

// Spec referenze-webpliant, "Visibilita temporale": fuori dall'editor una promo si vede dalla
// validita iniziale anticipata di offset_visibilita giorni fino alla validita finale inclusa.

const oggi = '2026-10-28';
const giorni = (n: number) => dayjs(oggi).add(n, 'day').toDate();

// Promo che inizia fra 3 giorni con 5 giorni di anticipo, promo che inizia fra 3 giorni senza anticipo
const promo = [
  { id_promo: 'anticipata', validita_dal: giorni(3), validita_al: giorni(10), offset_visibilita: 5 },
  { id_promo: 'futura', validita_dal: giorni(3), validita_al: giorni(10), offset_visibilita: 0 },
  { id_promo: 'in-corso', validita_dal: giorni(-2), validita_al: giorni(0), offset_visibilita: 0 },
];

async function promoConsiderate(isEditor: boolean) {
  vi.spyOn(WorkspaceWebpliant, 'findOne').mockResolvedValue({ id: 'w1' } as any);
  const findAllKit = vi.spyOn(RuntimeKit, 'findAll').mockResolvedValue([] as any);
  const promoRepository = { findAllWithOptions: vi.fn().mockResolvedValue(promo) };
  const service = new ReferenzeService(promoRepository as any, {} as any);

  await service.getFilteredReferenze('w1', oggi, undefined, undefined, undefined, { content: {} } as any, isEditor);

  if (findAllKit.mock.calls.length === 0) return [];
  return ((findAllKit.mock.calls[0][0] as any).where.id_promo[Op.in] as string[]).sort();
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ReferenzeService.getFilteredReferenze: visibilita temporale', () => {
  it('per il pubblico la promo con anticipo e\' visibile prima dell\'inizio, quella senza anticipo no', async () => {
    expect(await promoConsiderate(false)).toEqual(['anticipata', 'in-corso']);
  });

  it('l\'ultimo giorno di validita la promo e\' ancora visibile', async () => {
    expect(await promoConsiderate(false)).toContain('in-corso');
  });

  it('nell\'editor l\'anticipo non si applica: conta la data scelta', async () => {
    expect(await promoConsiderate(true)).toEqual(['in-corso']);
  });
});
