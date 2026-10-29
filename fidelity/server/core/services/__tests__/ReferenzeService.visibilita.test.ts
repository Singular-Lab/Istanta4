import dayjs from 'dayjs';
import { Op } from 'sequelize';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PageLayoutItem } from '../../../../lib/types';
import type { IWebPliantService } from '../../interfaces/IWebPliantService';
import { RuntimeKit } from '../../models/runtime_kit';
import { WorkspaceWebpliant } from '../../models/workspace_webpliant';
import type { IPromoRepository } from '../../repositories/PromoRepository';
import { ReferenzeService } from '../ReferenzeService';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

// Spec referenze-webpliant, "Visibilita temporale": fuori dall'editor una promo si vede dalla
// validita iniziale anticipata di offset_visibilita giorni fino alla validita finale inclusa,
// a giorni di calendario di Roma. "Solo kit pubblicati nella consultazione pubblica".

const oggi = '2026-10-28';
const giorni = (n: number) => dayjs(oggi).add(n, 'day').toDate();

// Promo che inizia fra 3 giorni con 5 giorni di anticipo, promo che inizia fra 3 giorni senza anticipo,
// promo all'ultimo giorno, promo finita ieri (il finto repository la restituisce comunque)
const promo = [
  { id_promo: 'anticipata', validita_dal: giorni(3), validita_al: giorni(10), offset_visibilita: 5 },
  { id_promo: 'futura', validita_dal: giorni(3), validita_al: giorni(10), offset_visibilita: 0 },
  { id_promo: 'in-corso', validita_dal: giorni(-2), validita_al: giorni(0), offset_visibilita: 0 },
  { id_promo: 'finita-ieri', validita_dal: giorni(-5), validita_al: giorni(-1), offset_visibilita: 0 },
];

type FiltroKit = { id_promo: { [Op.in]: string[] }; stato_lavorazione?: string };
type FiltroPromo = { validita_al: { [Op.gte]: Date } };

async function consulta(isEditor: boolean, data: string = oggi) {
  vi.spyOn(WorkspaceWebpliant, 'findOne').mockResolvedValue({ id: 'w1' } as unknown as Awaited<ReturnType<typeof WorkspaceWebpliant.findOne>>);
  const findAllKit = vi.spyOn(RuntimeKit, 'findAll').mockResolvedValue([] as unknown as Awaited<ReturnType<typeof RuntimeKit.findAll>>);
  const findAllWithOptions = vi.fn().mockResolvedValue(promo);
  const service = new ReferenzeService({ findAllWithOptions } as unknown as IPromoRepository, {} as unknown as IWebPliantService);

  await service.getFilteredReferenze('w1', data, undefined, undefined, undefined, { content: {} } as unknown as PageLayoutItem, isEditor);

  const filtroKit = findAllKit.mock.calls[0]?.[0]?.where as FiltroKit | undefined;
  return {
    promoConsiderate: filtroKit ? [...filtroKit.id_promo[Op.in]].sort() : [],
    filtroKit,
    filtroPromo: findAllWithOptions.mock.calls[0][0].where as FiltroPromo,
  };
}

const promoConsiderate = async (isEditor: boolean) => (await consulta(isEditor)).promoConsiderate;

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

  it('il giorno dopo la fine di validita la promo non e\' visibile, ne\' al pubblico ne\' nell\'editor', async () => {
    expect(await promoConsiderate(false)).not.toContain('finita-ieri');
    expect(await promoConsiderate(true)).not.toContain('finita-ieri');
  });

  it('nell\'editor l\'anticipo non si applica: conta la data scelta', async () => {
    expect(await promoConsiderate(true)).toEqual(['in-corso']);
  });

  it('il DB non scarta la promo che finisce alle 00:00 di Roma del giorno consultato', async () => {
    // 31 ottobre 00:00 a Roma: il 31 ottobre e' l'ultimo giorno di validita
    const fineValidita = new Date('2026-10-30T23:00:00Z');

    const { filtroPromo } = await consulta(false, '2026-10-31');

    expect(filtroPromo.validita_al[Op.gte].getTime()).toBeLessThanOrEqual(fineValidita.getTime());
  });
});

describe('ReferenzeService.getFilteredReferenze: stato dei kit', () => {
  it('il pubblico vede solo i kit PUBBLICATI', async () => {
    const { filtroKit } = await consulta(false);

    expect(filtroKit?.stato_lavorazione).toBe('PUBBLICATO');
  });

  it('l\'editor vede i kit in ogni stato di lavorazione', async () => {
    const { filtroKit } = await consulta(true);

    expect(filtroKit).toBeDefined();
    expect(filtroKit).not.toHaveProperty('stato_lavorazione');
  });
});
