import { afterEach, describe, expect, it, vi } from 'vitest';
import { cercaIndirizzi, cercaPosizione, geocodifica, INTERVALLO_MS, intervalloProcessoMs } from './geocodifica';

vi.mock('../logger', () => ({ log: { warn: vi.fn() } }));

// Worker HTTP del server: 1 come in sviluppo, salvo dove il test lo cambia
const cluster = vi.hoisted(() => ({ numeroWorkerHttp: vi.fn(() => 1) }));
vi.mock('../cluster', () => cluster);

const risposta = (lat: string, lon: string) => new Response(JSON.stringify([{ lat, lon }]));

describe('geocodifica', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    cluster.numeroWorkerHttp.mockReturnValue(1);
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

  it('con piu worker HTTP ogni processo distanzia le chiamate per il numero di worker: il server resta entro 1 al secondo', async () => {
    cluster.numeroWorkerHttp.mockReturnValue(2);
    vi.useFakeTimers();
    const partenze: number[] = [];
    vi.stubGlobal('fetch', vi.fn(async () => {
      partenze.push(Date.now());
      return risposta('43.7', '10.4');
    }));

    const risultati = Promise.all([geocodifica('Via Roma 10, Pisa'), geocodifica('Via Po 1, Lucca')]);
    await vi.runAllTimersAsync();
    await risultati;

    expect(intervalloProcessoMs()).toBe(2 * INTERVALLO_MS);
    expect(partenze[1] - partenze[0]).toBeGreaterThanOrEqual(2 * INTERVALLO_MS);
  });

  it('con un paese limita la ricerca a quel paese', async () => {
    vi.useFakeTimers();
    const url: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (indirizzo: string) => {
      url.push(indirizzo);
      return risposta('43.7', '10.4');
    }));

    const risultati = Promise.all([geocodifica('Via Roma 10, Pisa', 'it'), geocodifica('Via Roma 10, Pisa')]);
    await vi.runAllTimersAsync();
    await risultati;

    expect(url[0]).toContain('countrycodes=it');
    expect(url[1]).not.toContain('countrycodes');
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

describe('cercaPosizione: la posizione di una riga stampata, dalla piu\' precisa', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  /** Nominatim finto: per ogni ricerca (q) il risultato indicato, o nessuno. */
  const nominatim = (risultati: Record<string, object | undefined>) => {
    const ricerche: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const q = new URL(url).searchParams.get('q') ?? '';
      ricerche.push(q);
      const risultato = risultati[q];
      return new Response(JSON.stringify(risultato ? [risultato] : []));
    }));
    return ricerche;
  };

  const cerca = async (dati: Parameters<typeof cercaPosizione>[0]) => {
    vi.useFakeTimers();
    const esito = cercaPosizione(dati);
    // Un errore si legge dopo i timer: intanto non e' una promessa rifiutata senza gestore
    esito.catch(() => undefined);
    await vi.runAllTimersAsync();
    return esito;
  };

  it('col civico in OpenStreetMap: precisione "civico", con una sola ricerca', async () => {
    const ricerche = nominatim({ 'Via Murtola 12/14, PRA': { lat: '44.4281', lon: '8.7836', category: 'place', type: 'house', address: { house_number: '12' } } });

    await expect(cerca({ indirizzo: 'Via Murtola 12/14', localita: 'PRA', provincia: 'GE' })).resolves.toEqual({
      lat: 44.4281, lon: 8.7836, precisione: 'civico', ricerca: 'Via Murtola 12/14, PRA',
    });
    expect(ricerche).toEqual(['Via Murtola 12/14, PRA']);
  });

  it('civico assente da OpenStreetMap: la via senza civici, precisione "via"', async () => {
    const ricerche = nominatim({ 'Via Murtola, PRA': { lat: '44.428', lon: '8.783', category: 'highway', type: 'residential', addresstype: 'road', address: {} } });

    await expect(cerca({ indirizzo: 'Via Murtola 12/14', localita: 'PRA', provincia: 'GE' })).resolves.toMatchObject({ precisione: 'via', ricerca: 'Via Murtola, PRA' });
    expect(ricerche).toEqual(['Via Murtola 12/14, PRA', 'Via Murtola, PRA']);
  });

  it('via assente: la localita\' con la sigla della provincia, precisione "comune"', async () => {
    const ricerche = nominatim({ 'PRA, GE': { lat: '44.43', lon: '8.78', category: 'place', type: 'suburb', address: {} } });

    await expect(cerca({ indirizzo: 'Via Inesistente 1', localita: 'PRA', provincia: 'GE' })).resolves.toMatchObject({ precisione: 'comune' });
    expect(ricerche).toEqual(['Via Inesistente 1, PRA', 'Via Inesistente, PRA', 'PRA, GE']);
  });

  it('senza indirizzo cerca solo la localita\'; niente trovato: undefined', async () => {
    const ricerche = nominatim({});

    await expect(cerca({ indirizzo: null, localita: 'ALASSIO', provincia: 'Savona' })).resolves.toBeUndefined();
    // Una provincia scritta per esteso non si aggiunge: confonderebbe la ricerca
    expect(ricerche).toEqual(['ALASSIO']);
  });

  it('Nominatim non risponde: errore con il motivo, per contare gli errori di fila', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 429 })));

    await expect(cerca({ indirizzo: 'Via Roma 1', localita: 'SANREMO' })).rejects.toThrow('Nominatim non disponibile (HTTP 429)');
  });
});
