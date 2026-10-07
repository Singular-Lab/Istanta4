import { afterEach, describe, expect, it, vi } from 'vitest';
import { geocodifica, INTERVALLO_MS } from './geocodifica';

vi.mock('../logger', () => ({ log: { warn: vi.fn() } }));

const risposta = (lat: string, lon: string) => new Response(JSON.stringify([{ lat, lon }]));

describe('geocodifica', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('distanzia le richieste a Nominatim di almeno un secondo, anche se partono insieme', async () => {
    vi.useFakeTimers();
    const partenze: number[] = [];
    vi.stubGlobal('fetch', vi.fn(async () => {
      partenze.push(Date.now());
      return risposta('43.7', '10.4');
    }));

    const risultati = Promise.all([geocodifica('Via Roma 10, Pisa'), geocodifica('Via Po 1, Lucca'), geocodifica('Via Dante 3, Livorno')]);
    await vi.runAllTimersAsync();

    expect(await risultati).toEqual([{ lat: 43.7, lon: 10.4 }, { lat: 43.7, lon: 10.4 }, { lat: 43.7, lon: 10.4 }]);
    expect(partenze[1] - partenze[0]).toBeGreaterThanOrEqual(INTERVALLO_MS);
    expect(partenze[2] - partenze[1]).toBeGreaterThanOrEqual(INTERVALLO_MS);
  });

  it('se Nominatim fallisce torna senza coordinate e non blocca le richieste in coda', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn()
      .mockRejectedValueOnce(new Error('The operation was aborted due to timeout'))
      .mockResolvedValueOnce(risposta('1', '2')));

    const risultati = Promise.all([geocodifica('Via Roma 10, Pisa'), geocodifica('Via Po 1, Lucca')]);
    await vi.runAllTimersAsync();

    expect(await risultati).toEqual([{}, { lat: 1, lon: 2 }]);
  });
});
