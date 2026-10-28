import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../logger', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { svuotaCachePassaporti } from '../http/cachePassaporti';
import { Utente } from '../models/utenti';
import { ServerUtils } from './ServerUtils';

// Il client HTTP comune usa il fetch globale: qui rispondono servizi finti, niente rete
const fetchFinto = vi.fn();
vi.stubGlobal('fetch', fetchFinto);

const risposta = (status: number, corpo: string, contentType = 'application/json') =>
  new Response(corpo, { status, headers: { 'content-type': contentType } });
const erroreConnessione = (code: string) => Object.assign(new TypeError('fetch failed'), { cause: { code } });
/** Risponde dopo `ms`, o mai se il segnale scade prima. */
const rispostaDopo = (ms: number, crea: () => Response) => (_url: string, init: RequestInit) =>
  new Promise((ok, ko) => {
    const t = setTimeout(() => ok(crea()), ms);
    init.signal!.addEventListener('abort', () => { clearTimeout(t); ko(init.signal!.reason); });
  });
const headerInviato = (chiamata: number, nome: string) =>
  new Headers((fetchFinto.mock.calls[chiamata][1] as RequestInit).headers).get(nome);

// Con Authorization gia presente sendToFICOApi non chiede il passaporto a Olimpo
const req = { session: {}, headers: { authorization: 'Bearer test' } } as any;
const URL_ISTANTA = 'http://127.0.0.1:5000/FicoProcess/x';

afterEach(() => {
  fetchFinto.mockReset();
  vi.unstubAllEnvs();
  svuotaCachePassaporti();
});

describe('ServerUtils.sendToFICOApi su risposta non OK', () => {
  it('conserva lo stato reale e il corpo JSON di Istanta', async () => {
    fetchFinto.mockResolvedValue(risposta(401, '{"esito":false,"errorCode":0,"error":"no_login"}'));

    const r = await ServerUtils.sendToFICOApi(req, URL_ISTANTA, 'GET', undefined);

    expect(r.status).toBe(401);
    expect(r.data).toEqual({ esito: false, errorCode: 0, error: 'no_login' });
  });

  it('corpo vuoto o non JSON: data null e testo in statusText', async () => {
    fetchFinto.mockResolvedValue(risposta(500, '<html>Error</html>', 'text/html'));

    const r = await ServerUtils.sendToFICOApi(req, URL_ISTANTA, 'GET', undefined);

    expect(r.status).toBe(500);
    expect(r.data).toBeNull();
    expect(r.statusText).toBe('<html>Error</html>');
  });
});

describe('ServerUtils.sendToFICOApi senza risposta HTTP: status 0 con il motivo', () => {
  it('servizio non raggiungibile (ECONNREFUSED): motivo rete', async () => {
    fetchFinto.mockRejectedValue(erroreConnessione('ECONNREFUSED'));

    const r = await ServerUtils.sendToFICOApi(req, URL_ISTANTA, 'PUT', {}, undefined, undefined, { categoria: 'scrittura' });

    expect(r.status).toBe(0);
    expect(r.data).toBeNull();
    expect(r.motivo).toBe('rete');
    // Una scrittura non si ripete
    expect(fetchFinto).toHaveBeenCalledTimes(1);
  });

  it('Istanta non risponde entro FICO_API_TIMEOUT_MS (categoria di default): motivo timeout', async () => {
    vi.stubEnv('FICO_API_TIMEOUT_MS', '20');
    fetchFinto.mockImplementation(rispostaDopo(10_000, () => risposta(200, '{}')));

    const r = await ServerUtils.sendToFICOApi(req, URL_ISTANTA, 'GET', undefined);

    expect(r.status).toBe(0);
    expect(r.data).toBeNull();
    expect(r.motivo).toBe('timeout');
  });

  it('passaporto non rilasciato da Olimpo: motivo passaporto e Istanta non viene chiamata', async () => {
    vi.spyOn(Utente, 'findByPk').mockResolvedValue({
      id_utenti: 'u1', outsider_utenti: false, privatekey_utenti: 'chiave', email_utenti: 'mario@esempio.it', meta_utenti: {}, save: vi.fn(),
    } as any);
    fetchFinto.mockResolvedValue(risposta(200, '{"esito":false,"error":"utente sconosciuto","publicKey":""}'));
    const conSessione = { session: { id_utente: 'u1', private_key: 'chiave' }, headers: {} } as any;

    const r = await ServerUtils.sendToFICOApi(conSessione, URL_ISTANTA, 'GET', undefined);

    expect(r.status).toBe(0);
    expect(r.motivo).toBe('passaporto');
    expect(fetchFinto).toHaveBeenCalledTimes(1);
    expect(fetchFinto.mock.calls[0][0]).toMatch(/\/auth\/getPassport$/);
  });
});

describe('ServerUtils.sendToFICOApi: tempo massimo', () => {
  it('il timeout della singola chiamata prevale su FICO_API_TIMEOUT_MS', async () => {
    vi.stubEnv('FICO_API_TIMEOUT_MS', '20');
    // risponde dopo 100 ms: oltre il timeout generico, entro quello della chiamata
    fetchFinto.mockImplementation(rispostaDopo(100, () => risposta(200, '{"esito":true}')));

    const r = await ServerUtils.sendToFICOApi(req, 'http://127.0.0.1:5000/UploadVolStorico.ashx', 'POST', {}, undefined, 5_000);

    expect(r.status).toBe(200);
    expect(r.data).toEqual({ esito: true });
  });

  it('il timeout esplicito prevale anche sulla categoria', async () => {
    fetchFinto.mockImplementation(rispostaDopo(200, () => risposta(200, '{"esito":true}')));

    const r = await ServerUtils.sendToFICOApi(req, URL_ISTANTA, 'GET', undefined, undefined, 20, { categoria: 'lettura' });

    expect(r.status).toBe(0);
    expect(r.motivo).toBe('timeout');
  });

  it('con una categoria non vale piu il default lungo di FICO_API_TIMEOUT_MS', async () => {
    vi.stubEnv('FICO_API_TIMEOUT_MS', '20');
    // 100 ms: oltre il default lungo (qui 20 ms), entro i 30 s di una lettura
    fetchFinto.mockImplementation(rispostaDopo(100, () => risposta(200, '{"esito":true}')));

    const r = await ServerUtils.sendToFICOApi(req, URL_ISTANTA, 'GET', undefined, undefined, undefined, { categoria: 'lettura' });

    expect(r.status).toBe(200);
  });
});

describe('ServerUtils.sendToFICOApi: ripetizioni', () => {
  it('una lettura idempotente viene ritentata su 503', async () => {
    fetchFinto
      .mockResolvedValueOnce(risposta(503, ''))
      .mockResolvedValueOnce(risposta(200, '{"esito":true}'));

    const r = await ServerUtils.sendToFICOApi(req, URL_ISTANTA, 'GET', undefined, undefined, undefined, { categoria: 'lettura', idempotente: true });

    expect(r.status).toBe(200);
    expect(fetchFinto).toHaveBeenCalledTimes(2);
  });

  it('una scrittura non viene ritentata su 503', async () => {
    fetchFinto.mockImplementation(async () => risposta(503, ''));

    const r = await ServerUtils.sendToFICOApi(req, URL_ISTANTA, 'PUT', { a: 1 }, undefined, undefined, { categoria: 'scrittura' });

    expect(r.status).toBe(503);
    expect(fetchFinto).toHaveBeenCalledTimes(1);
  });
});

describe('ServerUtils.sendToFICOApi: Authorization', () => {
  it('l\'Authorization in ingresso (bearer di integrazione) non viene inoltrato e non si chiede il passaporto', async () => {
    const findByPk = vi.spyOn(Utente, 'findByPk');
    fetchFinto.mockResolvedValue(risposta(200, '{"esito":true}'));

    await ServerUtils.sendToFICOApi(req, URL_ISTANTA, 'GET', undefined);

    expect(fetchFinto).toHaveBeenCalledTimes(1);
    expect(headerInviato(0, 'authorization')).toBeNull();
    expect(findByPk).not.toHaveBeenCalled();
  });

  it('un Authorization passato da chi chiama arriva al servizio; uno senza valore non parte come "undefined"', async () => {
    // Una Response nuova per chiamata: il corpo si legge una volta sola
    fetchFinto.mockImplementation(async () => risposta(200, '{"result":"ok"}'));

    await ServerUtils.sendToFICOApi(req, 'http://correggo.test/UploadVolFromFP.ashx', 'POST', {}, { Authorization: 'Bearer integrazione' });
    await ServerUtils.sendToFICOApi(req, 'http://correggo.test/UploadVolFromFP.ashx', 'POST', {}, { Authorization: undefined as any });

    expect(headerInviato(0, 'authorization')).toBe('Bearer integrazione');
    expect(headerInviato(1, 'authorization')).toBeNull();
  });

  it('utente outsider: niente passaporto, niente Authorization', async () => {
    vi.spyOn(Utente, 'findByPk').mockResolvedValue({ id_utenti: 'u2', outsider_utenti: true } as any);
    fetchFinto.mockResolvedValue(risposta(200, '{"esito":true}'));
    const outsider = { session: { id_utente: 'u2' }, headers: {} } as any;

    const r = await ServerUtils.sendToFICOApi(outsider, URL_ISTANTA, 'GET', undefined);

    expect(r.status).toBe(200);
    expect(fetchFinto).toHaveBeenCalledTimes(1);
    expect(headerInviato(0, 'authorization')).toBeNull();
  });
});
