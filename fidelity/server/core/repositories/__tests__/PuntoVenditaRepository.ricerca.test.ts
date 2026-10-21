import { Op } from 'sequelize';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PuntoVendita } from '../../models/punto_vendita/punti_vendita';
import { PuntoVenditaRepository } from '../PuntoVenditaRepository';

// Proposta anagrafica-punti-vendita, "Elenco e ricerca dei punti vendita"

afterEach(() => {
  vi.restoreAllMocks();
});

async function condizioniDiRicerca(search: string) {
  const findAndCountAll = vi.spyOn(PuntoVendita, 'findAndCountAll').mockResolvedValue({ rows: [], count: 0 } as any);
  await new PuntoVenditaRepository().findPaginatedByGdo({ idGDO: 'g1', page: 1, pageSize: 10, search });
  const where = findAndCountAll.mock.calls[0][0]!.where as any;
  return where[Op.and][1][Op.or] as any[];
}

describe('PuntoVenditaRepository.findPaginatedByGdo, ricerca', () => {
  it('cerca senza distinguere maiuscole e minuscole su nome, citta, indirizzo e CAP', async () => {
    const condizioni = await condizioniDiRicerca(' Conad City ');

    for (const campo of ['nome_puntivendita', 'citta_puntivendita', 'indirizzo_puntivendita', 'cap_puntivendita']) {
      const condizione = condizioni.find(c => campo in c);
      expect(condizione[campo][Op.iLike]).toBe('%Conad City%');
    }
  });

  it('cerca anche nei codici del sistema della GDO conservati nei meta', async () => {
    const condizioni = await condizioniDiRicerca('004512');

    const neiMeta = condizioni.find(c => c.attribute?.val?.col === 'meta_puntivendita');
    expect(neiMeta.attribute.type).toBe('text');
    expect(neiMeta.logic[Op.iLike]).toBe('%004512%');
  });
});
