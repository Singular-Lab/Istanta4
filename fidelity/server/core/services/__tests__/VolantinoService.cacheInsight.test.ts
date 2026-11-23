import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IConfigService } from '../../interfaces/IConfigService';
import { TipiDiExport } from '../../models';
import { FilesRuntime } from '../../models/files_runtime';
import {
  type KitInsight,
  kitNellAmbito,
  pdfDelKit,
  righeDelKit,
  versioniRigheDeiKit,
} from '../../repositories/InsightVolantinoRepository';
import type { CacheConsultazione } from '../cacheConsultazione';
import { VolantinoService } from '../VolantinoService';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../repositories/InsightVolantinoRepository', () => ({
  kitNellAmbito: vi.fn(),
  pdfDelKit: vi.fn(),
  righeDelKit: vi.fn(),
  versioniRigheDeiKit: vi.fn(),
}));

// La pagina degli insight di un volantino: il risultato di una versione delle referenze si calcola
// una volta, poi si rilegge dalla cache senza leggere le righe (circa 9 KB l'una) dal database.

const ID_KIT = '3f2b8c1e-9a4d-4e6f-b1c2-7d8e9f0a1b2c';

const kit: KitInsight = {
  id: ID_KIT,
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
  storico: false,
  importStorico: null,
  gdo: 'gdo-1',
};

const referenza = (id: string) => ({
  id, compiled_fields: [], data_fields: {}, foto: [], meccanica: '', codice_box: id, group_elements: [],
  pag: 1, x: 10, y: 10, w: 50, h: 50, w_page: 210, h_page: 297, perc_ingombro: 5,
});

function cacheInMemoria(): CacheConsultazione & { valori: Map<string, unknown> } {
  const valori = new Map<string, unknown>();
  return {
    valori,
    async leggi<T>(chiave: string) {
      return (valori.get(chiave) as T | undefined) ?? null;
    },
    async scrivi(chiave, valore) {
      valori.set(chiave, JSON.parse(JSON.stringify(valore)));
    },
  };
}

function creaServizio(cache: CacheConsultazione | null, versione = '2@2026-11-20T10:00:00.000000') {
  vi.spyOn(TipiDiExport, 'findOne').mockResolvedValue({ id_tipiexport: 'tipo-vol' } as never);
  vi.spyOn(FilesRuntime, 'findAll').mockResolvedValue([]);
  vi.mocked(kitNellAmbito).mockResolvedValue(kit);
  vi.mocked(righeDelKit).mockResolvedValue([referenza('r1'), referenza('r2')] as never);
  vi.mocked(pdfDelKit).mockResolvedValue(null);
  vi.mocked(versioniRigheDeiKit).mockResolvedValue(new Map([[ID_KIT, versione]]));
  const configService = { getFlyerInsightsConfig: vi.fn(async () => ({})) } as unknown as IConfigService;
  return new VolantinoService(configService, undefined, undefined, null, cache);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('VolantinoService.getFlyerInsights: cache del risultato', () => {
  it('la seconda richiesta con la stessa versione non rilegge le referenze e risponde uguale', async () => {
    const cache = cacheInMemoria();
    const servizio = creaServizio(cache);

    const prima = await servizio.getFlyerInsights(ID_KIT);
    await new Promise(risolvi => setImmediate(risolvi));
    vi.mocked(righeDelKit).mockClear();
    const seconda = await servizio.getFlyerInsights(ID_KIT);

    expect(righeDelKit).not.toHaveBeenCalled();
    expect(seconda).toEqual(prima);
    expect(prima.totaleReferenze).toBe(2);
  });

  it('con una versione diversa delle referenze si ricalcola', async () => {
    const cache = cacheInMemoria();
    await creaServizio(cache, '2@2026-11-20T10:00:00.000000').getFlyerInsights(ID_KIT);
    await new Promise(risolvi => setImmediate(risolvi));
    vi.mocked(righeDelKit).mockClear();

    await creaServizio(cache, '3@2026-11-23T09:00:00.000000').getFlyerInsights(ID_KIT);

    expect(righeDelKit).toHaveBeenCalledTimes(1);
  });

  it('senza cache, o senza la versione delle referenze, si calcola sempre', async () => {
    const senzaCache = creaServizio(null);
    await senzaCache.getFlyerInsights(ID_KIT);
    await senzaCache.getFlyerInsights(ID_KIT);
    expect(righeDelKit).toHaveBeenCalledTimes(2);

    vi.mocked(righeDelKit).mockClear();
    const cache = cacheInMemoria();
    const servizio = creaServizio(cache);
    vi.mocked(versioniRigheDeiKit).mockResolvedValue(new Map());
    await servizio.getFlyerInsights(ID_KIT);
    await servizio.getFlyerInsights(ID_KIT);
    expect(righeDelKit).toHaveBeenCalledTimes(2);
    expect(cache.valori.size).toBe(0);
  });

  it('una cache che fallisce non rompe la pagina', async () => {
    const cacheRotta: CacheConsultazione = {
      leggi: () => Promise.reject(new Error('Redis non risponde')),
      scrivi: () => Promise.reject(new Error('Redis non risponde')),
    };
    const servizio = creaServizio(cacheRotta);

    const insights = await servizio.getFlyerInsights(ID_KIT);

    expect(insights.totaleReferenze).toBe(2);
  });
});
