import { describe, expect, it, vi } from 'vitest';
import {
  type CacheConsultazione,
  chiaveCacheElenco,
  chiaveCacheInsightKit,
  impronta,
  improntaInsightKit,
  ricorda,
  VERSIONE_CALCOLO_INSIGHT_KIT,
} from '../cacheConsultazione';

const cacheDi = (valori: Record<string, unknown> = {}): CacheConsultazione & { scrivi: ReturnType<typeof vi.fn> } => ({
  leggi: vi.fn(async (chiave: string) => (valori[chiave] as never) ?? null),
  scrivi: vi.fn(async () => undefined),
});

describe('cacheConsultazione', () => {
  it('l\'impronta cambia con quello da cui dipende il risultato e non con le funzioni', () => {
    expect(impronta('3@x', { a: 1 })).toBe(impronta('3@x', { a: 1 }));
    expect(impronta('3@x', { a: 1 })).not.toBe(impronta('4@x', { a: 1 }));
    expect(impronta({ a: 1, f: () => 1 })).toBe(impronta({ a: 1, f: () => 2 }));
  });

  it('l\'impronta degli insight porta la versione del calcolo', () => {
    expect(improntaInsightKit('3@x')).toBe(impronta(VERSIONE_CALCOLO_INSIGHT_KIT, '3@x'));
  });

  it('le chiavi non dipendono dalle maiuscole dell\'id del kit', () => {
    expect(chiaveCacheInsightKit('ABCDEF', 'x')).toBe(chiaveCacheInsightKit('abcdef', 'x'));
    expect(chiaveCacheElenco('riepilogo', { periodo: 'attivi' })).not.toBe(chiaveCacheElenco('riepilogo', { periodo: 'storico' }));
  });

  it('ricorda: dal cache non calcola', async () => {
    const cache = cacheDi({ k: { n: 1 } });
    const calcola = vi.fn(async () => ({ n: 2 }));

    await expect(ricorda(cache, 'k', 30, calcola)).resolves.toEqual({ n: 1 });
    expect(calcola).not.toHaveBeenCalled();
  });

  it('ricorda: senza il valore calcola e lo mette in cache per la durata data', async () => {
    const cache = cacheDi();

    await expect(ricorda(cache, 'k', 30, async () => ({ n: 2 }))).resolves.toEqual({ n: 2 });
    expect(cache.scrivi).toHaveBeenCalledWith('k', { n: 2 }, 30);
  });

  it('ricorda: una cache che fallisce non impedisce di rispondere', async () => {
    const cacheRotta: CacheConsultazione = {
      leggi: () => Promise.reject(new Error('giu')),
      scrivi: () => Promise.reject(new Error('giu')),
    };

    await expect(ricorda(cacheRotta, 'k', 30, async () => 7)).resolves.toBe(7);
  });

  it('ricorda: senza cache calcola sempre', async () => {
    const calcola = vi.fn(async () => 5);

    await ricorda(null, 'k', 30, calcola);
    await ricorda(null, 'k', 30, calcola);

    expect(calcola).toHaveBeenCalledTimes(2);
  });
});
