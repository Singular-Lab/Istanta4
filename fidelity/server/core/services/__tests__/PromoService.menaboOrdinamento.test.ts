import { afterEach, describe, expect, it, vi } from 'vitest';
import { ORDINAMENTO_MERCEOLOGICO_VUOTO, type OrdinamentoMerceologico } from '../../../../lib/ordinamentoMerceologico';
import { TracciatiMomento } from '../../models/tracciati_momento';
import { PromoService } from '../PromoService';

const ordinamento: OrdinamentoMerceologico = {
  universale: true,
  campi: { area: 'settore', settore: 'reparto', reparto: 'categoria', categoria: '' },
  voci: [
    { area: 'freschissimi', settore: 'ortofrutta', reparto: 'mele', categoria: '', orderIndex: 1 },
    { area: 'freschissimi', settore: 'macelleria', reparto: 'bovino', categoria: '', orderIndex: 10 },
  ],
};

const record = (codice: string, reparto: string, categoria: string) => ({
  'Referenza.Codice': codice,
  'Scatto.CodiceGruppo': codice,
  settore: 'freschissimi',
  reparto,
  categoria,
  tema: 'SPRINT',
});

function makeService(ordinamentoLetto: OrdinamentoMerceologico) {
  vi.spyOn(TracciatiMomento, 'findAll').mockResolvedValue([
    { risultato: { tracciati: [{ guidCanale: '', guidArea: '', context: '[]', records: [record('B', 'macelleria', 'bovino'), record('A', 'ortofrutta', 'mele')] }] } },
  ] as any);
  const agenziaLib = {
    // Restituisce i codici nell'ordine in cui la libreria li riceve
    getDatoPerMenabo: vi.fn(async (risultati: any[]) => ({
      tipoDivisione: 'canale',
      risultati: [],
      codiciRicevuti: risultati.flatMap(t => t.records.map((r: any) => r['Referenza.Codice'])),
    })),
  };
  const ordinamentoService = { getOrdinamento: vi.fn().mockResolvedValue(ordinamentoLetto) };
  const service = new PromoService(
    {} as any,
    {} as any,
    { findById: vi.fn().mockResolvedValue({ id_promo: 'p1', nome_promo: 'Promo' }) } as any,
    agenziaLib as any,
    { getRegoleMenabo: vi.fn().mockResolvedValue({ tipoDivisione: 'canale' }) } as any,
    ordinamentoService as any,
  );
  return { service, ordinamentoService };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PromoService.getDatoPerMenabo: ordine merceologico', () => {
  it('passa al raggruppamento le referenze in ordine merceologico', async () => {
    const { service } = makeService(ordinamento);

    const dato = await service.getDatoPerMenabo('p1', undefined, {} as any);

    expect(dato.codiciRicevuti).toEqual(['A', 'B']);
  });

  it('senza ordinamento disponibile lascia l\'ordine del tracciato', async () => {
    const { service } = makeService(ORDINAMENTO_MERCEOLOGICO_VUOTO);

    const dato = await service.getDatoPerMenabo('p1', undefined, {} as any);

    expect(dato.codiciRicevuti).toEqual(['B', 'A']);
  });

  it('senza richiesta utente non chiede l\'ordinamento a Istanta', async () => {
    const { service, ordinamentoService } = makeService(ordinamento);

    const dato = await service.getDatoPerMenabo('p1');

    expect(dato.codiciRicevuti).toEqual(['B', 'A']);
    expect(ordinamentoService.getOrdinamento).not.toHaveBeenCalled();
  });
});
