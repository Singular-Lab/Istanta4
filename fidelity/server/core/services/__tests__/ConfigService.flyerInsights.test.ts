import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '../../../../lib/errors';
import type { ImpostazioniGdoSalvate } from '../../repositories/ImpostazioniGdoRepository';

// La configurazione degli insight per GDO (spec impostazioni-gdo): quella salvata per la GDO, o il
// file dell'installazione; in cache con una chiave per GDO, che le Impostazioni GDO dimenticano.

const cache = vi.hoisted(() => ({
  memoria: new Map<string, unknown>(),
  remember: vi.fn(),
  del: vi.fn(),
}));

vi.mock('../../../src/shared/cache/cache.service.js', () => ({
  remember: cache.remember,
  del: cache.del,
}));

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const file = vi.hoisted(() => ({ contenuto: '{"dataMapping":{"referenzaFields":{}},"origine":"file"}' as string | null }));

vi.mock('fs', async (importOriginal) => {
  const vero = await importOriginal<typeof import('fs')>();
  const finto = {
    ...vero,
    existsSync: (percorso: string) => (String(percorso).endsWith('flyerInsightsConfig.json') ? file.contenuto !== null : vero.existsSync(percorso)),
    promises: {
      ...vero.promises,
      readFile: async (percorso: string, codifica: BufferEncoding) =>
        (String(percorso).endsWith('flyerInsightsConfig.json') ? file.contenuto ?? '' : vero.promises.readFile(percorso, codifica)),
    },
  };
  return { ...finto, default: finto };
});

import { chiaveCacheConfigInsight, dimenticaConfigInsight } from '../cacheConfigInsight';
import { ConfigService } from '../ConfigService';

const ID_GDO = '11111111-1111-4111-8111-111111111111';
const DELLA_GDO = { dataMapping: { referenzaFields: { reparto: 'data_fields.reparto' } }, origine: 'gdo' };

const salvate = (insightVolantino: Record<string, unknown> | null): ImpostazioniGdoSalvate => ({
  idGdo: ID_GDO, reparti: [], insightVolantino, insightAggiornatoIl: null, insightAggiornatoDa: null, aggiornatoIl: new Date(0),
});

beforeEach(() => {
  vi.clearAllMocks();
  cache.memoria.clear();
  file.contenuto = '{"dataMapping":{"referenzaFields":{}},"origine":"file"}';
  cache.remember.mockImplementation(async (chiave: string, _ttl: number, risolvi: () => Promise<unknown>) => {
    if (cache.memoria.has(chiave)) return cache.memoria.get(chiave);
    const valore = await risolvi();
    cache.memoria.set(chiave, valore);
    return valore;
  });
  cache.del.mockImplementation(async (chiave: string) => { cache.memoria.delete(chiave); });
});

describe('ConfigService.getFlyerInsightsConfig per GDO', () => {
  it('la configurazione salvata per la GDO prevale sul file, con la chiave di cache della GDO', async () => {
    const impostazioni = { trova: vi.fn(async () => salvate(DELLA_GDO)) };

    const config = await new ConfigService(impostazioni).getFlyerInsightsConfig(ID_GDO);

    expect(config).toEqual(DELLA_GDO);
    expect(impostazioni.trova).toHaveBeenCalledWith(ID_GDO);
    expect(cache.remember).toHaveBeenCalledWith(`config:flyer-insights:${ID_GDO}`, 300, expect.any(Function));
  });

  it('una GDO senza configurazione propria, o nessuna GDO, legge il file dell\'installazione', async () => {
    const impostazioni = { trova: vi.fn(async () => salvate(null)) };
    const servizio = new ConfigService(impostazioni);

    await expect(servizio.getFlyerInsightsConfig(ID_GDO)).resolves.toMatchObject({ origine: 'file' });
    await expect(servizio.getFlyerInsightsConfig(null)).resolves.toMatchObject({ origine: 'file' });
    await expect(servizio.getFlyerInsightsConfig()).resolves.toMatchObject({ origine: 'file' });
    // Senza GDO non si cercano impostazioni; la chiave e' quella dell'installazione
    expect(impostazioni.trova).toHaveBeenCalledTimes(1);
    expect(cache.remember.mock.calls.map(chiamata => chiamata[0])).toEqual([
      `config:flyer-insights:${ID_GDO}`,
      'config:flyer-insights:installazione',
      'config:flyer-insights:installazione',
    ]);
  });

  it('senza configurazione della GDO ne\' file: NotFoundError, come prima', async () => {
    file.contenuto = null;
    const servizio = new ConfigService({ trova: vi.fn(async () => null) });

    await expect(servizio.getFlyerInsightsConfig(ID_GDO)).rejects.toBeInstanceOf(NotFoundError);
    await expect(servizio.getFlyerInsightsConfig()).rejects.toBeInstanceOf(NotFoundError);
  });

  it('se la lettura della GDO fallisce vale il file, senza cache', async () => {
    const servizio = new ConfigService({ trova: vi.fn(async () => { throw new Error('relation "impostazioni_gdo" does not exist'); }) });

    await expect(servizio.getFlyerInsightsConfig(ID_GDO)).resolves.toMatchObject({ origine: 'file' });
  });

  it('dimenticare la GDO toglie la sua configurazione dalla cache: la lettura dopo il salvataggio e\' quella nuova', async () => {
    let configurazione: Record<string, unknown> | null = null;
    const servizio = new ConfigService({ trova: vi.fn(async () => salvate(configurazione)) });

    await expect(servizio.getFlyerInsightsConfig(ID_GDO)).resolves.toMatchObject({ origine: 'file' });
    configurazione = DELLA_GDO;
    await expect(servizio.getFlyerInsightsConfig(ID_GDO)).resolves.toMatchObject({ origine: 'file' });

    await dimenticaConfigInsight(ID_GDO);

    expect(cache.del).toHaveBeenCalledWith(chiaveCacheConfigInsight(ID_GDO));
    await expect(servizio.getFlyerInsightsConfig(ID_GDO)).resolves.toEqual(DELLA_GDO);
  });
});
