import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ImportStorico } from '../../../../lib/types';
import type { IConfigService } from '../../interfaces/IConfigService';
import { TipiDiExport } from '../../models';
import { FilesRuntime } from '../../models/files_runtime';
import { kitNellAmbito, pdfDelKit, righeDelKit, type KitInsight } from '../../repositories/InsightVolantinoRepository';
import { VolantinoService } from '../VolantinoService';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../repositories/InsightVolantinoRepository', () => ({
  kitNellAmbito: vi.fn(),
  pdfDelKit: vi.fn(),
  righeDelKit: vi.fn(),
}));

// Riepilogo delle pagine di /api/flyer-insights: l'ingombro e' una percentuale della pagina qualunque
// sia la fonte. Istanta manda perc_ingombro come frazione, lo storico (sync del Plugin) gia' in
// percentuale: prima lo storico veniva moltiplicato per 100 una seconda volta.

const referenza = (id: string, dati: Record<string, unknown>) => ({
  id, compiled_fields: [], data_fields: {}, foto: [], meccanica: '', codice_box: id, group_elements: [], ...dati,
});

const kitInsight = (importStorico: ImportStorico | null): KitInsight => ({
  id: 'kit-1',
  titolo: 'Volantino Nord',
  idPromo: 'promo-1',
  nomePromo: 'Promo di ottobre',
  idArea: 'area-1',
  idCanale: 'canale-1',
  area: 'Nord',
  canale: 'Super',
  validitaDal: '2026-10-01',
  validitaAl: '2026-10-14',
  data: '2026-10-01',
  storico: importStorico !== null,
  importStorico,
  gdo: 'gdo-1',
});

function creaServizio(referenze: Array<Record<string, unknown>>, importStorico: ImportStorico | null = null) {
  vi.spyOn(TipiDiExport, 'findOne').mockResolvedValue({ id_tipiexport: 'tipo-vol' } as never);
  vi.spyOn(FilesRuntime, 'findAll').mockResolvedValue([]);
  vi.mocked(kitNellAmbito).mockResolvedValue(kitInsight(importStorico));
  vi.mocked(righeDelKit).mockResolvedValue(referenze as never);
  vi.mocked(pdfDelKit).mockResolvedValue(null);
  const configService = { getFlyerInsightsConfig: vi.fn(async () => ({})) } as unknown as IConfigService;
  return new VolantinoService(configService);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('VolantinoService.getFlyerInsights: ingombro delle pagine', () => {
  it('storico in percentuale e Istanta in frazione danno la stessa unita\': percentuale della pagina', async () => {
    const servizio = creaServizio([
      // Storico: x relativa alla pagina 210×287, perc_ingombro gia' in percentuale
      referenza('s1', { pag: 2, x: 15, y: 20, w: 63, h: 61.5, w_page: 210, h_page: 287, perc_ingombro: 6.43 }),
      referenza('s2', { pag: 2, x: 100, y: 20, w: 63, h: 61.5, w_page: 210, h_page: 287, perc_ingombro: 6.43 }),
      // Istanta: pagina destra della doppia pagina, perc_ingombro come frazione
      referenza('i1', { pag: 3, x: 296.5, y: 34, w: 65.3, h: 78.4, w_page: 290, h_page: 320, perc_ingombro: 0.0551 }),
      // Senza misure: vale perc_ingombro, frazione se non supera 1
      referenza('i2', { pag: 4, x: 10, y: 10, w: null, h: null, w_page: null, h_page: null, perc_ingombro: 0.25 }),
      referenza('s3', { pag: 4, x: 10, y: 10, w: null, h: null, w_page: null, h_page: null, perc_ingombro: 12.5 }),
    ]);

    const insights = await servizio.getFlyerInsights('kit-1');

    expect(insights.contesto).toEqual({ titolo: 'Volantino Nord', nomeArea: 'Nord', nomeCanale: 'Super', idPromo: 'promo-1' });
    expect(insights.riepilogoPagine.map(pagina => [pagina.pagina, pagina.numeroReferenze, pagina.ingombroTotalePerc])).toEqual([
      [2, 2, 12.86],
      [3, 1, 5.52],
      [4, 2, 37.5],
    ]);
  });

  it('una referenza senza misure ne\' perc_ingombro non aggiunge ingombro alla pagina', async () => {
    const servizio = creaServizio([
      referenza('a', { pag: 1, x: 15, y: 20, w: 63, h: 61.5, w_page: 210, h_page: 287, perc_ingombro: 6.43 }),
      referenza('b', { pag: 1, x: 0, y: 0, w: null, h: null, w_page: null, h_page: null, perc_ingombro: null }),
    ]);

    const insights = await servizio.getFlyerInsights('kit-1');

    expect(insights.riepilogoPagine.map(pagina => [pagina.pagina, pagina.numeroReferenze, pagina.ingombroTotalePerc])).toEqual([[1, 2, 6.43]]);
  });

  it('include il report dello storico negli insight anche senza referenze', async () => {
    const servizio = creaServizio([], {
      importatoIl: '2026-10-30T10:00:00.000Z',
      nomeFile: 'volantino-ottobre.json',
      nonImpaginate: [],
      lasciapassareNonImpaginate: false,
      fuoriListino: [],
      fuoriListinoIgnorati: 0,
    });

    const insights = await servizio.getFlyerInsights('kit-1');

    expect(insights.origineStorico).toMatchObject({
      importatoIl: '2026-10-30T10:00:00.000Z',
      nomeFile: 'volantino-ottobre.json',
      totaleFuoriListino: 0,
    });
  });

  it('un runtime inesistente non produce un dettaglio insight vuoto', async () => {
    const servizio = creaServizio([]);
    vi.mocked(kitNellAmbito).mockResolvedValue(null);

    await expect(servizio.getFlyerInsights('kit-assente')).rejects.toMatchObject({ httpStatus: 404 });
    expect(righeDelKit).not.toHaveBeenCalled();
  });
});

describe('VolantinoService.getFlyerInsights: GDO e PDF del volantino', () => {
  it('un kit di un\'altra GDO risponde 404 come un kit inesistente, senza leggerne le referenze', async () => {
    const servizio = creaServizio([referenza('a', { pag: 1, x: 15, y: 20, w: 63, h: 61.5, w_page: 210, h_page: 287 })]);
    // Il repository non trova il kit nell'ambito della GDO richiesta
    vi.mocked(kitNellAmbito).mockResolvedValue(null);

    await expect(servizio.getFlyerInsights('kit-1', { idGdo: 'gdo-2' })).rejects.toMatchObject({ httpStatus: 404 });
    expect(kitNellAmbito).toHaveBeenCalledWith('kit-1', { idGdo: 'gdo-2' });
    expect(righeDelKit).not.toHaveBeenCalled();
    expect(pdfDelKit).not.toHaveBeenCalled();
  });

  it('senza ambito vale per tutte le GDO; il contesto viene dal kit con area e canale', async () => {
    const servizio = creaServizio([]);

    const insights = await servizio.getFlyerInsights('kit-1');

    expect(kitNellAmbito).toHaveBeenCalledWith('kit-1', 'tutte');
    expect(insights.contesto).toEqual({ titolo: 'Volantino Nord', nomeArea: 'Nord', nomeCanale: 'Super', idPromo: 'promo-1' });
  });

  it('con il PDF in Olimpo ne restituisce id e pagine; senza pagine nel file valgono quelle del volantino', async () => {
    const righe = [referenza('a', { pag: 3, x: 15, y: 20, w: 63, h: 61.5, w_page: 210, h_page: 287 })];
    const servizio = creaServizio(righe);
    vi.mocked(pdfDelKit).mockResolvedValueOnce({ idOlimpoCloud: 'olimpo-1', pagine: 8 });
    vi.mocked(pdfDelKit).mockResolvedValueOnce({ idOlimpoCloud: 'olimpo-2', pagine: 0 });

    const conPagine = await servizio.getFlyerInsights('kit-1');
    const senzaPagine = await servizio.getFlyerInsights('kit-1');

    expect(conPagine.pdf).toEqual({ idOlimpoCloud: 'olimpo-1', pagine: 8 });
    // Nessun file VOL con le pagine: il volantino arriva fino all'ultima pagina con una referenza
    expect(senzaPagine.pdf).toEqual({ idOlimpoCloud: 'olimpo-2', pagine: 3 });
  });

  it('la sintesi conta le pagine come i confronti: quelle del PDF, o fino all\'ultima con un box', async () => {
    const righe = [referenza('a', { pag: 3, x: 15, y: 20, w: 63, h: 61.5, w_page: 210, h_page: 287 })];
    const servizio = creaServizio(righe);
    // I file del kit dichiarano 12 pagine: valgono per il totale di sempre, non per le sezioni nuove
    vi.mocked(FilesRuntime.findAll).mockResolvedValue([{ pages: 12 }] as never);
    vi.mocked(pdfDelKit).mockResolvedValueOnce({ idOlimpoCloud: 'olimpo-1', pagine: 8 });
    vi.mocked(pdfDelKit).mockResolvedValueOnce(null);

    const conPdf = await servizio.getFlyerInsights('kit-1');
    const senzaPdf = await servizio.getFlyerInsights('kit-1');

    expect([conPdf.totalePagine, conPdf.sintesi.pagine, conPdf.spazio.perPagina.length]).toEqual([12, 8, 8]);
    expect([senzaPdf.totalePagine, senzaPdf.sintesi.pagine, senzaPdf.spazio.perPagina.length]).toEqual([12, 3, 3]);
  });

  it('senza PDF in Olimpo il pdf e\' null e gli insight restano completi', async () => {
    const servizio = creaServizio([referenza('a', { pag: 1, x: 15, y: 20, w: 63, h: 61.5, w_page: 210, h_page: 287 })]);

    const insights = await servizio.getFlyerInsights('kit-1');

    expect(insights.pdf).toBeNull();
    expect(insights.box).toHaveLength(1);
    expect(insights.box[0]).toMatchObject({ id: 'a', pagina: 1, visibilita: 100 });
    expect(insights.sintesi).toMatchObject({ referenze: 1, box: 1, pagine: 1 });
    expect(insights.spazio.perPagina).toEqual([{ pagina: 1, box: 1, spazioOccupato: 6.43 }]);
  });

  it('volantino senza referenze: riepiloghi di sempre vuoti e sezioni nuove vuote', async () => {
    const servizio = creaServizio([]);

    const insights = await servizio.getFlyerInsights('kit-1');

    expect(insights).toMatchObject({
      totaleReferenze: 0,
      totalePagine: 0,
      riepilogoPagine: [],
      riepilogoReparti: [],
      riepilogoMeccaniche: [],
      referenze: [],
      pdf: null,
      box: [],
    });
    expect(insights.sintesi).toMatchObject({ referenze: 0, box: 0, scontoMedio: null });
    expect(insights.zoneCalde.calore).toEqual([]);
  });
});
