import type { Request } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ImportStorico } from '../../../../lib/types';
import { Area } from '../../models/aree';
import { Canale } from '../../models/canali';
import { DesignKit } from '../../models/design_kit';
import { Promo } from '../../models/promo';
import { Referenze } from '../../models/referenze';
import { RuntimeKit } from '../../models/runtime_kit';
import { TipiDiExport } from '../../models/tipi_di_export';
import { KitRuntimeService } from '../KitRuntimeService';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Il dettaglio produttivo del kit porta con sé il report dell'import da storico: la produzione
// non lo chiede più all'endpoint degli insight, che è della consultazione

const IMPORT: ImportStorico = {
  importatoIl: '2026-10-30T10:00:00.000Z',
  nomeFile: 'volantino-ottobre.json',
  nonImpaginate: [{ CODICE: '100' }],
  lasciapassareNonImpaginate: false,
  fuoriListino: [],
  fuoriListinoIgnorati: 0,
  report: {
    importatoIl: '2026-10-30T10:00:00.000Z',
    nomeFile: 'volantino-ottobre.json',
    nonImpaginate: [{ codice: '100', descrizione: 'Mozzarella', campi: [] }],
    lasciapassareNonImpaginate: true,
    totaleFuoriListino: 0, fuoriListinoIgnorati: 0, boxFuoriListino: [],
  },
};

const preparaKit = (importStorico: ImportStorico | null) => {
  vi.spyOn(RuntimeKit, 'findOne').mockResolvedValue({
    id: 'k1',
    id_design: 'd1',
    id_promo: 'p1',
    stato_lavorazione: 'PUBBLICATO',
    tipi_di_export_in_kit: [],
    import_storico: importStorico,
  } as never);
  vi.spyOn(DesignKit, 'findOne').mockResolvedValue({ id: 'd1', titolo: 'Volantino ottobre', id_area: 'a1', id_canale: 'c1' } as never);
  vi.spyOn(Canale, 'findByPk').mockResolvedValue({ nome_canali: 'Super' } as never);
  vi.spyOn(Area, 'findByPk').mockResolvedValue({ nome_aree: 'Nord' } as never);
  vi.spyOn(TipiDiExport, 'findAll').mockResolvedValue([]);
  vi.spyOn(Referenze, 'count').mockResolvedValue(0 as never);
  vi.spyOn(Promo, 'findOne').mockResolvedValue(null);
};

const service = () => new KitRuntimeService({} as never, {} as never);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getKitPerGestioneLavorazione: report dello storico', () => {
  it('un kit dallo storico porta il report finale preparato dal plugin', async () => {
    preparaKit(IMPORT);

    const kit = await service().getKitPerGestioneLavorazione('p1', 'k1', {} as Request);

    expect(kit.origineStorico).toMatchObject({
      importatoIl: '2026-10-30T10:00:00.000Z',
      nomeFile: 'volantino-ottobre.json',
      nonImpaginate: [{ codice: '100', descrizione: 'Mozzarella', campi: [] }],
      totaleFuoriListino: 0,
    });
    expect(kit).not.toHaveProperty('importStorico');
  });

  it('una lavorazione normale non ha il report', async () => {
    preparaKit(null);

    const kit = await service().getKitPerGestioneLavorazione('p1', 'k1', {} as Request);

    expect(kit.origineStorico).toBeUndefined();
  });
});
