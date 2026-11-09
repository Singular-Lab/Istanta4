import { afterEach, describe, expect, it, vi } from 'vitest';
import { PESI_VISIBILITA, type PesiVisibilita } from '../../../../lib/insightVolantino/tipi';
import type { IConfigService } from '../../interfaces/IConfigService';
import { TipiDiExport } from '../../models';
import { FilesRuntime } from '../../models/files_runtime';
import { ReferenzeGruppo } from '../../models/referenze_gruppo';
import { kitNellAmbito, pdfDelKit, righeDelKit } from '../../repositories/InsightVolantinoRepository';
import { VolantinoService } from '../VolantinoService';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../repositories/InsightVolantinoRepository', () => ({
  kitNellAmbito: vi.fn(),
  pdfDelKit: vi.fn(),
  righeDelKit: vi.fn(),
}));

// Pesi della visibilita' della libreria agenzia del cliente negli insight del volantino (spec
// insight-volantino): la scheda calcola visibilita' e zone calde con quelli, e li dichiara.

/** Pagine 200×300: lo stesso box in copertina e a pagina 5, uno in cima e uno in fondo a pagina 4. */
const referenza = (id: string, dati: Record<string, unknown>) => ({
  id, compiled_fields: [], data_fields: { descrizione_uno: `Prodotto ${id}` }, foto: [], meccanica: '', codice_box: id, group_elements: [],
  pag: 1, x: 0, y: 0, w: 100, h: 100, w_page: 200, h_page: 300, perc_ingombro: 0, ...dati,
});

const REFERENZE = [
  referenza('copertina', { pag: 1 }),
  referenza('inCima', { pag: 4, x: 100, y: 0, h: 30 }),
  referenza('inFondo', { pag: 4, x: 100, y: 270, h: 30 }),
  referenza('interna', { pag: 5 }),
];

function creaServizio(agenziaLib?: ConstructorParameters<typeof VolantinoService>[1]) {
  vi.spyOn(TipiDiExport, 'findOne').mockResolvedValue({ id_tipiexport: 'tipo-vol' } as never);
  vi.spyOn(FilesRuntime, 'findAll').mockResolvedValue([]);
  vi.spyOn(ReferenzeGruppo, 'findAll').mockResolvedValue([] as never);
  vi.mocked(kitNellAmbito).mockResolvedValue({
    id: 'kit-1',
    titolo: 'Volantino di novembre',
    idPromo: 'promo-1',
    nomePromo: 'Promo di novembre',
    idArea: 'area-1',
    idCanale: 'canale-1',
    area: 'Nord',
    canale: 'Super',
    validitaDal: '2026-11-01',
    validitaAl: '2026-11-14',
    data: '2026-11-01',
    storico: false,
    importStorico: null,
    gdo: 'gdo-1',
  });
  vi.mocked(righeDelKit).mockResolvedValue(REFERENZE as never);
  vi.mocked(pdfDelKit).mockResolvedValue({ idOlimpoCloud: 'pdf-1', pagine: 8 });
  const configService = { getFlyerInsightsConfig: vi.fn(async () => ({})) } as unknown as IConfigService;
  return new VolantinoService(configService, agenziaLib);
}

const visibilitaPerId = (box: Array<{ id: string; visibilita: number }>) => Object.fromEntries(box.map(singolo => [singolo.id, singolo.visibilita]));

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('VolantinoService.getFlyerInsights: pesi della visibilita\' del cliente', () => {
  it('senza libreria agenzia, o senza pesi propri, valgono gli standard', async () => {
    const senzaLibreria = await creaServizio().getFlyerInsights('kit-1');
    const senzaPesi = await creaServizio({ insightVolantino: { intestazione: { cliente: 'Cliente' } } }).getFlyerInsights('kit-1');

    for (const insights of [senzaLibreria, senzaPesi]) {
      expect(insights.zoneCalde.pesi).toEqual(PESI_VISIBILITA);
      // La copertina pesa 1, una pagina interna 0,5
      expect(visibilitaPerId(insights.box)).toMatchObject({ copertina: 100, interna: 50 });
      expect(visibilitaPerId(insights.box).inCima).toBeGreaterThan(visibilitaPerId(insights.box).inFondo);
    }
  });

  it('con i pesi del cliente visibilita\' dei box, box piu\' visibili e zone calde usano quelli', async () => {
    // Un cliente per cui conta solo lo spazio: pagina e posizione pesano tutte uguale
    const pesi: PesiVisibilita = { copertina: 1, ultima: 1, primaDoppia: 1, altre: 1, alto: 1, basso: 1 };

    const insights = await creaServizio({ insightVolantino: { pesiVisibilita: pesi } }).getFlyerInsights('kit-1');

    expect(insights.zoneCalde.pesi).toEqual(pesi);
    expect(visibilitaPerId(insights.box)).toEqual({ copertina: 100, inCima: 30, inFondo: 30, interna: 100 });
    expect(insights.zoneCalde.boxPiuVisibili).toEqual(['copertina', 'interna', 'inCima', 'inFondo']);
  });
});
