import { Op } from 'sequelize';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { STATO_PROMO } from '../../../../lib/enums';
import { DatabaseError } from '../../../../lib/errors';
import type { IAgenziaLib } from '../../agenzia_lib/types';
import type { IConfigService } from '../../interfaces/IConfigService';
import type { IIstantaService } from '../../interfaces/IIstantaService';
import type { IWebPliantService } from '../../interfaces/IWebPliantService';
import type { PromoAttributes } from '../../models/promo';
import { RuntimeKit } from '../../models/runtime_kit';
import { Tracciati } from '../../models/tracciati';
import type { IPromoRepository } from '../../repositories/PromoRepository';
import { PromoService } from '../PromoService';

// GET /api/promo/in-corso: filtro e ordinamento in SQL, kit e tracciati contati con due query
// raggruppate invece di due query per ogni promo. Il confronto con la vecchia risposta su
// PostgreSQL vero e' in PromoService.inCorso.integrazione.test.ts.

const promo = (id_promo: string, stato: STATO_PROMO): PromoAttributes => ({
  id_promo,
  nome_promo: `PROMO ${id_promo}`,
  data_registrazione: new Date('2026-10-01T08:00:00Z'),
  validita_dal: new Date('2026-10-08T00:00:00Z'),
  validita_al: new Date('2026-10-18T00:00:00Z'),
  data_scadenza: new Date('2026-10-07T00:00:00Z'),
  offset_visibilita: 0,
  stato,
  context: [],
  gdo: 'g1',
});

function creaService(righe: PromoAttributes[]) {
  const findAllWithOptions = vi.fn(async () => righe);
  // findAll e' la lettura di getAllPromo: tutte le promo, senza filtri
  const findAll = vi.fn(async () => righe);
  const repository = { findAllWithOptions, findAll } as unknown as IPromoRepository;
  const service = new PromoService(
    {} as IWebPliantService,
    {} as IIstantaService,
    repository,
    {} as IAgenziaLib,
    {} as IConfigService
  );
  return { service, findAllWithOptions };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PromoService.getPromoInCorso', () => {
  it('chiede al database solo le promo in corso, con le colonne della risposta, dalla piu recente', async () => {
    const { service, findAllWithOptions } = creaService([]);

    await service.getPromoInCorso();

    expect(findAllWithOptions).toHaveBeenCalledTimes(1);
    const [opzioni] = findAllWithOptions.mock.calls[0] as unknown as [{
      attributes: string[];
      where: { stato: Record<symbol, STATO_PROMO[]> };
      order: unknown;
    }];
    expect(opzioni.where.stato[Op.notIn]).toEqual([STATO_PROMO.VALIDA, STATO_PROMO.VALIDA_CON_ERRORI, STATO_PROMO.ARCHIVIATA]);
    expect(opzioni.attributes).toEqual([
      'id_promo', 'nome_promo', 'data_registrazione', 'validita_dal', 'validita_al', 'data_scadenza',
      'offset_visibilita', 'stato', 'context', 'gdo',
    ]);
    expect(opzioni.order).toEqual([['data_registrazione', 'DESC'], ['id_promo', 'ASC']]);
  });

  it('senza promo in corso risponde [] senza contare kit e tracciati', async () => {
    const { service } = creaService([]);
    const contaKit = vi.spyOn(RuntimeKit, 'count');
    const contaTracciati = vi.spyOn(Tracciati, 'count');

    expect(await service.getPromoInCorso()).toEqual([]);
    expect(contaKit).not.toHaveBeenCalled();
    expect(contaTracciati).not.toHaveBeenCalled();
  });

  it('conta kit e tracciati con una query raggruppata ciascuno, non una per promo', async () => {
    const { service } = creaService([
      promo('con-kit', STATO_PROMO.IN_LAVORAZIONE),
      promo('con-tracciati', STATO_PROMO.PIANIFICATA),
      promo('vuota', STATO_PROMO.ELIMINATA),
    ]);
    const leggiKit = vi.spyOn(RuntimeKit, 'findAll').mockResolvedValue([]);
    const contaKit = vi.spyOn(RuntimeKit, 'count').mockResolvedValue([{ id_promo: 'con-kit', count: 2 }] as never);
    const contaTracciati = vi.spyOn(Tracciati, 'count')
      .mockResolvedValue([{ id_promo_tracciati: 'con-tracciati', count: 3 }] as never);

    const elenco = await service.getPromoInCorso();

    expect(elenco.map(p => [p.id, p.numero_kit_collegati, p.is_deletable])).toEqual([
      ['con-kit', 2, false],
      ['con-tracciati', 0, false],
      ['vuota', 0, true],
    ]);
    expect(contaKit).toHaveBeenCalledTimes(1);
    expect(contaKit).toHaveBeenCalledWith({
      where: { id_promo: { [Op.in]: ['con-kit', 'con-tracciati', 'vuota'] } },
      group: ['id_promo'],
    });
    expect(contaTracciati).toHaveBeenCalledTimes(1);
    expect(contaTracciati).toHaveBeenCalledWith({
      where: { id_promo_tracciati: { [Op.in]: ['con-kit', 'con-tracciati', 'vuota'] } },
      group: ['id_promo_tracciati'],
    });
    expect(leggiKit).not.toHaveBeenCalled();
  });

  it('ha gli stessi campi, nello stesso ordine, delle promo di getAllPromo', async () => {
    const riga = promo('p1', STATO_PROMO.IN_LAVORAZIONE);
    const { service } = creaService([riga]);
    vi.spyOn(RuntimeKit, 'findAll').mockResolvedValue([{}, {}] as never);
    vi.spyOn(RuntimeKit, 'count').mockResolvedValue([{ id_promo: 'p1', count: 2 }] as never);
    vi.spyOn(Tracciati, 'count').mockResolvedValue([] as never);

    const [inCorso] = await service.getPromoInCorso();
    const [daGetAll] = await service.getAllPromo();

    expect(Object.keys(inCorso)).toEqual(Object.keys(daGetAll));
    expect(inCorso).toEqual(daGetAll);
  });

  it('un errore del database diventa il DatabaseError del recupero delle promozioni', async () => {
    const { service, findAllWithOptions } = creaService([]);
    findAllWithOptions.mockRejectedValue(new Error('connessione persa'));

    const errore = await service.getPromoInCorso().catch((e: unknown) => e);

    expect(errore).toBeInstanceOf(DatabaseError);
    expect((errore as DatabaseError).message).toBe('Errore durante il recupero delle promozioni');
  });
});
