import type { Request } from 'express';
import { describe, expect, it, vi } from 'vitest';
import type { RisultatoConfrontoMomento } from '../../../../lib/types';
import type { IAgenziaLib } from '../../agenzia_lib/types';
import type { ITracciatiMomentoRepository } from '../../repositories/TracciatiMomentoRepository';
import type { ITracciatiRepository } from '../../repositories/TracciatiRepository';
import { ServerUtils } from '../../utils/ServerUtils';
import type { OrdinamentoMerceologicoService } from '../OrdinamentoMerceologicoService';
import { TracciatoService } from '../TracciatoService';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

/**
 * Calcolo del confronto tra momenti: i record del momento e quelli arricchiti da Istanta
 * si uniscono per Referenza.Codice. Un codice numerico vale come lo stesso codice testuale.
 */
type RecordProva = Record<string, unknown>;

function calcolaConfronto(recordMomento: RecordProva[], recordIstanta: RecordProva[]) {
  const tracciato = (records: RecordProva[]) => ({ guidCanale: 'c1', guidArea: 'a1', context: '[]', records });
  const momentoRepository = {
    findConfrontoById: vi.fn(async () => ({ id: 'conf-1', primario: 'm1', secondario: 'm2', tipo: 'lineare' })),
    findById: vi.fn(async (id: string) => ({ id, nome: `Momento ${id}`, risultato: [tracciato(id === 'm1' ? recordMomento : [])] })),
    updateConfronto: vi.fn(async (_id: string, _valori: { risultato: RisultatoConfrontoMomento }) => null),
  };
  const agenziaLib = { elaboraDatoPerAgenzia: vi.fn(async () => ({})) };
  const ordinamento = { getOrdinamento: vi.fn(async () => []) };

  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(ServerUtils, 'sendToFICOApi').mockResolvedValue({
    data: { esito: true, primario: { tracciati: [tracciato(recordIstanta)] }, secondario: { tracciati: [] } },
    status: 200,
  } as unknown as Awaited<ReturnType<typeof ServerUtils.sendToFICOApi>>);

  const service = new TracciatoService(
    {} as unknown as ITracciatiRepository,
    agenziaLib as unknown as IAgenziaLib,
    undefined,
    momentoRepository as unknown as ITracciatiMomentoRepository,
    undefined,
    ordinamento as unknown as OrdinamentoMerceologicoService,
  );

  return {
    esegui: async () => {
      await service.calcolaRisultatoMomentoConfronto('conf-1', {} as Request);
      const [, valori] = momentoRepository.updateConfronto.mock.calls[0];
      return valori.risultato.primario.tracciati[0].records;
    },
  };
}

describe('TracciatoService.calcolaRisultatoMomentoConfronto: unione dei record per codice', () => {
  it('un record con codice numerico 12345 e uno con "12345" si uniscono in un solo record', async () => {
    const { esegui } = calcolaConfronto(
      [{ 'Referenza.Codice': 12345, prezzo: '1,00' }],
      [{ 'Referenza.Codice': '12345', stato: 'modificato' }],
    );

    const records = await esegui();

    expect(records).toEqual([{ 'Referenza.Codice': '12345', prezzo: '1,00', stato: 'modificato' }]);
  });

  it('codici diversi restano record separati', async () => {
    const { esegui } = calcolaConfronto(
      [{ 'Referenza.Codice': 12345, prezzo: '1,00' }],
      [{ 'Referenza.Codice': '12346', stato: 'nuovo' }],
    );

    const records = await esegui();

    expect(records).toEqual([
      { 'Referenza.Codice': 12345, prezzo: '1,00' },
      { 'Referenza.Codice': '12346', stato: 'nuovo' },
    ]);
  });
});
