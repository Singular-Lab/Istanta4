import { afterEach, describe, expect, it, vi } from 'vitest';
import { cercaIndirizzi, geocodifica, INTERVALLO_MS } from './geocodifica';

vi.mock('../logger', () => ({ log: { warn: vi.fn() } }));

const risposta = (lat: string, lon: string) => new Response(JSON.stringify([{ lat, lon }]));

describe('geocodifica', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('l\'intervallo tra le richieste e di 1,2 secondi', () => {
    expect(INTERVALLO_MS).toBe(1200);
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

  it('cercaIndirizzi scompone i risultati nei campi del punto vendita e passa dalla stessa coda', async () => {
    vi.useFakeTimers();
    const partenze: number[] = [];
    const url: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (indirizzo: string) => {
      partenze.push(Date.now());
      url.push(indirizzo);
      return new Response(JSON.stringify([
        {
          lat: '43.84', lon: '10.50', display_name: 'Via Fillungo 12, Lucca',
          address: { road: 'Via Fillungo', house_number: '12', postcode: '55100', city: 'Lucca', state: 'Toscana', 'ISO3166-2-lvl6': 'IT-LU' },
        },
        { lat: 'x', lon: 'y' },
      ]));
    }));

    const risultati = Promise.all([geocodifica('Via Roma 10, Pisa'), cercaIndirizzi('Via Fillungo 12 Lucca')]);
    await vi.runAllTimersAsync();

    expect((await risultati)[1]).toEqual([{
      etichetta: 'Via Fillungo 12, Lucca', lat: 43.84, lon: 10.5, indirizzo: 'Via Fillungo 12',
      cap: '55100', citta: 'Lucca', provincia: 'LU', regione: 'Toscana',
    }]);
    expect(url[1]).toContain('countrycodes=it');
    expect(partenze[1] - partenze[0]).toBeGreaterThanOrEqual(INTERVALLO_MS);
  });

  it('cercaIndirizzi segnala Nominatim che non risponde', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));

    const ricerca = cercaIndirizzi('Via Roma 1 Pisa');
    const verifica = expect(ricerca).rejects.toThrow('Nominatim non disponibile (HTTP 503)');
    await vi.runAllTimersAsync();
    await verifica;
  });

  it('cercaIndirizzi segnala con il motivo Nominatim irraggiungibile', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('fetch failed'); }));

    const ricerca = cercaIndirizzi('Via Roma 1 Pisa');
    const verifica = expect(ricerca).rejects.toThrow('Nominatim non raggiungibile: fetch failed');
    await vi.runAllTimersAsync();
    await verifica;
  });
});
