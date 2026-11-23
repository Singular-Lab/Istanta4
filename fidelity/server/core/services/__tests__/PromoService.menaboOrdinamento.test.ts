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

function makeService(
  ordinamentoLetto: OrdinamentoMerceologico,
  campiIdentita?: readonly string[],
  pagineAMano?: { confermaDaPagineTolte: number },
  colonnaRidimensionabile?: boolean,
) {
  vi.spyOn(TracciatiMomento, 'findAll').mockResolvedValue([
    { risultato: { tracciati: [{ guidCanale: '', guidArea: '', context: '[]', records: [record('B', 'macelleria', 'bovino'), record('A', 'ortofrutta', 'mele')] }] } },
  ] as any);
  const agenziaLib = {
    ...(campiIdentita ? { CAMPI_IDENTITA_MENABO: campiIdentita } : {}),
    ...(pagineAMano ? { MENABO_PAGINE_A_MANO: pagineAMano } : {}),
    ...(colonnaRidimensionabile ? { MENABO_COLONNA_GRUPPI_RIDIMENSIONABILE: true } : {}),
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

describe('PromoService.getDatoPerMenabo: campi che identificano le referenze', () => {
  const richiesta = {} as Parameters<PromoService['getDatoPerMenabo']>[2];

  it('restituisce i campi identificativi dichiarati dalla libreria agenzia', async () => {
    const { service } = makeService(ordinamento, ['Scatto.CodiceGruppo', 'Referenza.Codice']);

    const dato = await service.getDatoPerMenabo('p1', undefined, richiesta);

    expect(dato.campi_identita).toEqual(['Scatto.CodiceGruppo', 'Referenza.Codice']);
  });

  it('con una libreria che non li dichiara restituisce un elenco vuoto', async () => {
    const { service } = makeService(ordinamento);

    const dato = await service.getDatoPerMenabo('p1', undefined, richiesta);

    expect(dato.campi_identita).toEqual([]);
  });
});

describe('PromoService.getDatoPerMenabo: numero di pagine scritto a mano (I20-1256)', () => {
  const richiesta = {} as Parameters<PromoService['getDatoPerMenabo']>[2];

  it('passa al menabò la soglia della conferma quando la libreria agenzia lo dichiara', async () => {
    const { service } = makeService(ordinamento, undefined, { confermaDaPagineTolte: 5 });

    const dato = await service.getDatoPerMenabo('p1', undefined, richiesta);

    expect(dato.pagine_a_mano).toEqual({ conferma_da_pagine_tolte: 5 });
  });

  it('con una libreria che non lo dichiara non lo passa: restano solo le frecce', async () => {
    const { service } = makeService(ordinamento);

    const dato = await service.getDatoPerMenabo('p1', undefined, richiesta);

    expect(dato.pagine_a_mano).toBeUndefined();
  });
});

describe('PromoService.getDatoPerMenabo: colonna dei gruppi ridimensionabile (I20-1258)', () => {
  const richiesta = {} as Parameters<PromoService['getDatoPerMenabo']>[2];

  it('lo dice al menabò quando la libreria agenzia lo dichiara', async () => {
    const { service } = makeService(ordinamento, undefined, undefined, true);

    const dato = await service.getDatoPerMenabo('p1', undefined, richiesta);

    expect(dato.colonna_gruppi_ridimensionabile).toBe(true);
  });

  it('con una libreria che non lo dichiara la colonna resta fissa', async () => {
    const { service } = makeService(ordinamento);

    const dato = await service.getDatoPerMenabo('p1', undefined, richiesta);

    expect(dato.colonna_gruppi_ridimensionabile).toBeUndefined();
  });
});
