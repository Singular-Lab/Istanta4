import type { Request } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExternalApiError } from '../../../../lib/errors';
import { log } from '../../logger';
import { type CacheCatalogo, CatalogoLoghiService, type LettoreCatalogo, urlImmagineLogo, vociDelCatalogo } from '../CatalogoLoghiService';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Il catalogo dei loghi e bolli di Istanta per le linee del distributore: letto con la richiesta
// dell'utente, tenuto un'ora, vuoto (mai un errore) se Istanta non risponde.

const RISPOSTA = {
  esito: true,
  content: [
    { id: '1', nome: 'Conad 11 Paralleli', guidId: 'guid-11p', sigla: 'conad_11P', tipo: 3, escluso: false },
    { id: '2', nome: 'DOP', guidId: 'guid-dop', sigla: 'dop', tipo: 2, escluso: false },
    { id: '3', nome: 'Escluso', guidId: 'guid-x', sigla: 'escluso', tipo: 3, escluso: true },
    { id: '4', nome: 'Senza file', guidId: '', sigla: 'vuoto', tipo: 3 },
    { id: '5', nome: 'Doppione', guidId: 'guid-altro', sigla: 'DOP', tipo: 2 },
  ],
};

const richiesta = (idUtente: string | undefined = 'u1') => ({ session: { id_utente: idUtente }, headers: {} }) as unknown as Request;

function crea(opzioni: { lettore?: LettoreCatalogo; inCache?: unknown } = {}) {
  let adesso = 1_000_000;
  const memoria = new Map<string, unknown>(opzioni.inCache === undefined ? [] : [['istanta:catalogo-loghi-bolli', opzioni.inCache]]);
  const cache = {
    get: vi.fn(async (chiave: string) => (memoria.get(chiave) ?? null) as never),
    set: vi.fn(async (chiave: string, valore: unknown) => { memoria.set(chiave, valore); }),
  } satisfies CacheCatalogo;
  const leggi = vi.fn(opzioni.lettore ?? (async () => RISPOSTA));
  const servizio = new CatalogoLoghiService(leggi, cache, () => adesso);
  return { servizio, leggi, cache, memoria, avanza: (ms: number) => { adesso += ms; } };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('vociDelCatalogo', () => {
  it('per sigla senza maiuscole, la prima voce; senza sigla o file, o escluse, non contano', () => {
    expect(vociDelCatalogo(RISPOSTA)).toEqual([
      { sigla: 'conad_11P', guidId: 'guid-11p', tipo: 3 },
      { sigla: 'dop', guidId: 'guid-dop', tipo: 2 },
    ]);
    expect(vociDelCatalogo(null)).toEqual([]);
    expect(vociDelCatalogo({ esito: true })).toEqual([]);
  });
});

describe('CatalogoLoghiService', () => {
  it('legge da Istanta con la richiesta dell\'utente: sigla in minuscolo -> voce, e lo mette in cache per un\'ora', async () => {
    const { servizio, leggi, cache } = crea();
    const req = richiesta();

    const catalogo = await servizio.catalogo(req);

    expect(leggi).toHaveBeenCalledWith(req);
    expect([...catalogo.keys()]).toEqual(['conad_11p', 'dop']);
    expect(catalogo.get('conad_11p')).toEqual({ sigla: 'conad_11P', guidId: 'guid-11p', tipo: 3 });
    expect(cache.set).toHaveBeenCalledWith('istanta:catalogo-loghi-bolli', expect.any(Array), 3600);
  });

  it('URL del logo dal proxy di Olimpo, larghezza 96 se non indicata; null per una sigla che non c\'e\'', async () => {
    const { servizio } = crea();
    const req = richiesta();

    await expect(servizio.urlLogo('CONAD_11p', undefined, req)).resolves.toBe('/olimpo/foto/getThumbNailOnDemand?guidId=guid-11p&width=96&height=0');
    await expect(servizio.urlLogo('dop', 48, req)).resolves.toBe(urlImmagineLogo('guid-dop', 48));
    await expect(servizio.urlLogo('igp', undefined, req)).resolves.toBeNull();
  });

  it('una seconda lettura entro l\'ora non richiama Istanta, nemmeno senza richiesta', async () => {
    const { servizio, leggi } = crea();

    await servizio.catalogo(richiesta());
    const senzaRichiesta = await servizio.catalogo();

    expect(senzaRichiesta.size).toBe(2);
    expect(leggi).toHaveBeenCalledTimes(1);
  });

  it('il catalogo in Redis vale anche per un altro processo; scaduta l\'ora in memoria si rilegge', async () => {
    const { servizio, leggi, avanza, memoria } = crea({ inCache: [{ sigla: 'dop', guidId: 'guid-redis', tipo: 2 }] });

    expect((await servizio.catalogo()).get('dop')?.guidId).toBe('guid-redis');
    expect(leggi).not.toHaveBeenCalled();

    memoria.clear();
    avanza(3_600_001);
    await servizio.catalogo(richiesta());
    expect(leggi).toHaveBeenCalledTimes(1);
  });

  it('senza richiesta (o senza utente) e senza cache il catalogo e\' vuoto, senza chiamare Istanta', async () => {
    const { servizio, leggi } = crea();

    expect((await servizio.catalogo()).size).toBe(0);
    // Una richiesta senza utente in sessione (richiesta(undefined) prenderebbe l'utente predefinito)
    const senzaUtente = { session: {}, headers: {} } as unknown as Request;
    expect((await servizio.catalogo(senzaUtente)).size).toBe(0);
    expect(leggi).not.toHaveBeenCalled();
  });

  it('Istanta che non risponde: catalogo vuoto con un avviso, e per un minuto non si riprova', async () => {
    const { servizio, leggi, avanza, cache } = crea({
      lettore: async () => { throw new ExternalApiError({ message: 'Istanta non risponde', service: 'ISTANTA', endpoint: '/FicoProcess/getLoghiBolli' }); },
    });

    await expect(servizio.catalogo(richiesta())).resolves.toEqual(new Map());
    await expect(servizio.urlLogo('dop', undefined, richiesta())).resolves.toBeNull();
    expect(leggi).toHaveBeenCalledTimes(1);
    expect(log.warn).toHaveBeenCalledTimes(1);
    expect(cache.set).not.toHaveBeenCalled();

    avanza(60_001);
    await servizio.catalogo(richiesta());
    expect(leggi).toHaveBeenCalledTimes(2);
  });

  it('piu\' richieste insieme: una sola lettura da Istanta', async () => {
    const { servizio, leggi } = crea();

    const [primo, secondo] = await Promise.all([servizio.catalogo(richiesta()), servizio.catalogo(richiesta('u2'))]);

    expect(primo.size).toBe(2);
    expect(secondo.size).toBe(2);
    expect(leggi).toHaveBeenCalledTimes(1);
  });
});
