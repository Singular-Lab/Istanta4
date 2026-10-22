import { afterEach, describe, expect, it, vi } from 'vitest';

// Senza Redis: ogni lettura va a Istanta
vi.mock('../../../src/shared/cache/cache.service.js', () => ({
  remember: (_chiave: string, _durata: number, leggi: () => Promise<unknown>) => leggi(),
}));

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { ORDINAMENTO_MERCEOLOGICO_VUOTO } from '../../../../lib/ordinamentoMerceologico';
import { ServerUtils } from '../../utils/ServerUtils';
import { OrdinamentoMerceologicoService, normalizzaOrdinamento } from '../OrdinamentoMerceologicoService';

const rispostaCoopfi = {
  esito: true,
  universale: true,
  campi: { area: 'settore', settore: 'reparto', reparto: 'categoria', categoria: '' },
  voci: [
    { area: 'freschissimi', settore: 'macelleria', reparto: 'bovino', categoria: '', orderIndex: 10 },
    { area: 'freschissimi', settore: 'ortofrutta', reparto: 'mele', categoria: '', orderIndex: 1 },
  ],
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('OrdinamentoMerceologicoService.getOrdinamento', () => {
  it('chiama FicoProcess/getOrdinamentoMerceologico e restituisce le voci in ordine', async () => {
    const chiamata = vi.spyOn(ServerUtils, 'sendToFICOApi').mockResolvedValue({ data: rispostaCoopfi, status: 200 } as any);

    const ordinamento = await new OrdinamentoMerceologicoService().getOrdinamento({} as any);

    expect(chiamata.mock.calls[0][1]).toMatch(/\/FicoProcess\/getOrdinamentoMerceologico$/);
    expect(chiamata.mock.calls[0][2]).toBe('GET');
    expect(ordinamento.universale).toBe(true);
    expect(ordinamento.campi).toEqual(rispostaCoopfi.campi);
    expect(ordinamento.voci.map(v => v.orderIndex)).toEqual([1, 10]);
  });

  it.each([
    ['esito false', { data: { esito: false, error: 'errore' }, status: 400 }],
    ['sessione non valida', { data: { esito: false, error: 'no_login' }, status: 401 }],
    ['Istanta non raggiungibile', { data: null, status: 0, statusText: 'fetch failed' }],
  ])('%s: ordinamento vuoto, senza errore', async (_caso, risposta) => {
    vi.spyOn(ServerUtils, 'sendToFICOApi').mockResolvedValue(risposta as any);

    await expect(new OrdinamentoMerceologicoService().getOrdinamento({} as any)).resolves.toEqual(ORDINAMENTO_MERCEOLOGICO_VUOTO);
  });

  it('ordina i record con l\'ordinamento di Istanta', async () => {
    vi.spyOn(ServerUtils, 'sendToFICOApi').mockResolvedValue({ data: rispostaCoopfi, status: 200 } as any);
    const records = [
      { codice: 'B', settore: 'freschissimi', reparto: 'macelleria', categoria: 'bovino' },
      { codice: 'A', settore: 'freschissimi', reparto: 'ortofrutta', categoria: 'mele' },
    ];

    const ordinati = await new OrdinamentoMerceologicoService().ordina({} as any, records);

    expect(ordinati.map(r => r.codice)).toEqual(['A', 'B']);
  });
});

describe('normalizzaOrdinamento', () => {
  it('un cliente senza ordinamento universale non ha voci', () => {
    expect(normalizzaOrdinamento({ esito: true, universale: false, voci: [] })).toEqual(ORDINAMENTO_MERCEOLOGICO_VUOTO);
  });

  it('scarta le voci senza orderIndex numerico e completa i campi mancanti', () => {
    const ordinamento = normalizzaOrdinamento({
      universale: true,
      campi: { area: 'settore' },
      voci: [{ area: 'casa' } as any, { area: 'freschissimi', orderIndex: 3 }],
    });

    expect(ordinamento.campi).toEqual({ area: 'settore', settore: '', reparto: '', categoria: '' });
    expect(ordinamento.voci).toEqual([{ area: 'freschissimi', settore: '', reparto: '', categoria: '', orderIndex: 3 }]);
  });
});
