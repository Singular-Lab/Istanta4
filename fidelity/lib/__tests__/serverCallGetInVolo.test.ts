import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ServerCall } from '../server_call';

// Il volantino pubblico chiedeva gli stessi dati dal layout e dalla pagina nello stesso momento:
// le GET identiche in corso ora partono una volta sola, ma ogni chiamante riceve il proprio oggetto.

type Risposta = { resolve: (corpo: unknown) => void; reject: (errore: unknown) => void };

let inAttesa: Risposta[] = [];
let fetchFinta: ReturnType<typeof vi.fn>;

const rispondi = (indice: number, corpo: unknown) =>
  inAttesa[indice].resolve(new Response(JSON.stringify(corpo), { status: 200 }));

const chiamateA = (percorso: string) =>
  fetchFinta.mock.calls.filter(([indirizzo]) => String(indirizzo).endsWith(percorso));

beforeEach(() => {
  inAttesa = [];
  fetchFinta = vi.fn(
    () => new Promise<Response>((resolve, reject) => {
      inAttesa.push({ resolve: resolve as Risposta['resolve'], reject });
    })
  );
  vi.stubGlobal('fetch', fetchFinta);
  // Le scritture chiedono il token CSRF dal cookie: qui non c'e il DOM
  vi.spyOn(ServerCall, 'ensureCSRFToken').mockResolvedValue(null);
  vi.spyOn(ServerCall, 'getCSRFToken').mockReturnValue(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ServerCall.get con richieste identiche in corso', () => {
  it('fa una sola richiesta e da a ogni chiamante una copia indipendente', async () => {
    const primo = ServerCall.get<{ voci: string[] }>('/get_config');
    const secondo = ServerCall.get<{ voci: string[] }>('/get_config');

    expect(fetchFinta).toHaveBeenCalledTimes(1);
    rispondi(0, { voci: ['a'] });
    const [a, b] = await Promise.all([primo, secondo]);

    expect(a).toEqual({ voci: ['a'] });
    expect(b).toEqual({ voci: ['a'] });
    expect(a).not.toBe(b);
    a.voci.push('modificata');
    expect(b.voci).toEqual(['a']);
  });

  it('finita la richiesta, la GET successiva ne fa una nuova', async () => {
    const primo = ServerCall.get('/get_config');
    rispondi(0, { versione: 1 });
    await primo;

    const secondo = ServerCall.get('/get_config');
    expect(fetchFinta).toHaveBeenCalledTimes(2);
    rispondi(1, { versione: 2 });
    await expect(secondo).resolves.toEqual({ versione: 2 });
  });

  it('indirizzi o header diversi restano richieste separate', async () => {
    const promesse = [
      ServerCall.get('/prendiWorkspaceDaID/w1?isEditor=false'),
      ServerCall.get('/prendiWorkspaceDaID/w2?isEditor=false'),
      ServerCall.get('/prendiWorkspaceDaID/w1?isEditor=false', undefined, { 'x-prova': '1' }),
    ];

    expect(fetchFinta).toHaveBeenCalledTimes(3);
    inAttesa.forEach((_, indice) => rispondi(indice, indice));
    await expect(Promise.all(promesse)).resolves.toEqual([0, 1, 2]);
  });

  it('una GET con signal non si condivide: annullarla non tocca gli altri chiamanti', async () => {
    const controller = new AbortController();
    const condivisa = ServerCall.get('/getAllPV?IdGDO=g1');
    const conSignal = ServerCall.get('/getAllPV?IdGDO=g1', controller.signal);

    expect(fetchFinta).toHaveBeenCalledTimes(2);
    expect(fetchFinta.mock.calls[1][1]).toMatchObject({ signal: controller.signal });
    rispondi(0, ['pv']);
    rispondi(1, ['pv']);
    await expect(condivisa).resolves.toEqual(['pv']);
    await expect(conSignal).resolves.toEqual(['pv']);
  });

  it('dopo una scrittura la GET riparte invece di ricevere la risposta letta prima', async () => {
    const primaDellaScrittura = ServerCall.get('/getAllReferenzeFromWishlistId?id=w1');
    const scrittura = ServerCall.put('/insertReferenzaInWishlist', { codice: 'r1' });
    await vi.waitFor(() => expect(chiamateA('/insertReferenzaInWishlist')).toHaveLength(1));
    rispondi(1, 'ok');
    await scrittura;

    const dopoLaScrittura = ServerCall.get('/getAllReferenzeFromWishlistId?id=w1');

    expect(chiamateA('/getAllReferenzeFromWishlistId?id=w1')).toHaveLength(2);
    rispondi(0, []);
    rispondi(2, [{ codice: 'r1' }]);
    await expect(primaDellaScrittura).resolves.toEqual([]);
    await expect(dopoLaScrittura).resolves.toEqual([{ codice: 'r1' }]);
  });

  it('un errore arriva a tutti i chiamanti e libera la richiesta', async () => {
    const primo = ServerCall.get('/get_config');
    const secondo = ServerCall.get('/get_config');
    inAttesa[0].resolve(new Response(JSON.stringify({ message: 'giu' }), { status: 500 }));

    await expect(primo).rejects.toMatchObject({ httpStatus: 500 });
    await expect(secondo).rejects.toMatchObject({ httpStatus: 500 });

    const terzo = ServerCall.get('/get_config');
    expect(fetchFinta).toHaveBeenCalledTimes(2);
    rispondi(1, { ok: true });
    await expect(terzo).resolves.toEqual({ ok: true });
  });

  it('un corpo che non e JSON resta un errore di parsing per ogni chiamante', async () => {
    const primo = ServerCall.get('/getStiliToText');
    const secondo = ServerCall.get('/getStiliToText');
    inAttesa[0].resolve(new Response('non json', { status: 200 }));

    await expect(primo).rejects.toMatchObject({ code: 'PARSE_ERROR' });
    await expect(secondo).rejects.toMatchObject({ code: 'PARSE_ERROR' });
  });
});
