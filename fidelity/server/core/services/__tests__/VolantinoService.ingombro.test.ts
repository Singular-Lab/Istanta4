import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IAgenziaLib } from '../../agenzia_lib/types';
import type { IConfigService } from '../../interfaces/IConfigService';
import { TipiDiExport } from '../../models';
import { FilesRuntime } from '../../models/files_runtime';
import { Referenze } from '../../models/referenze';
import { RuntimeKit } from '../../models/runtime_kit';
import { VolantinoService } from '../VolantinoService';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Riepilogo delle pagine di /api/flyer-insights: l'ingombro e' una percentuale della pagina qualunque
// sia la fonte. Istanta manda perc_ingombro come frazione, lo storico (sync del Plugin) gia' in
// percentuale: prima lo storico veniva moltiplicato per 100 una seconda volta.

const referenza = (id: string, dati: Record<string, unknown>) => ({
  id, compiled_fields: [], data_fields: {}, foto: [], meccanica: '', codice_box: id, group_elements: [], ...dati,
});

function creaServizio(referenze: Array<Record<string, unknown>>) {
  vi.spyOn(TipiDiExport, 'findOne').mockResolvedValue({ id_tipiexport: 'tipo-vol' } as never);
  vi.spyOn(FilesRuntime, 'findAll').mockResolvedValue([]);
  vi.spyOn(Referenze, 'findAll').mockResolvedValue(referenze as never);
  vi.spyOn(RuntimeKit, 'findOne').mockResolvedValue({ import_storico: null } as never);
  const configService = { getFlyerInsightsConfig: vi.fn(async () => ({})) } as unknown as IConfigService;
  return new VolantinoService(configService, {} as IAgenziaLib);
}

afterEach(() => {
  vi.restoreAllMocks();
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
});
