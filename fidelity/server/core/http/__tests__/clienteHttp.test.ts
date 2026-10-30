import { afterEach, describe, expect, it, vi } from 'vitest';

const agente = vi.hoisted(() => ({
  opzioni: undefined as { headersTimeout?: number; bodyTimeout?: number } | undefined,
}));

vi.mock('undici', () => ({
  Agent: class {
    constructor(opzioni: { headersTimeout?: number; bodyTimeout?: number }) {
      agente.opzioni = opzioni;
    }
  },
}));

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { chiamaHttp, erroreDiConnessionePrimaDellInvio, ErroreHttp, timeoutCategoria } from '../clienteHttp';

const fetchFinto = vi.fn();
vi.stubGlobal('fetch', fetchFinto);

const risposta = (status: number, headers: Record<string, string> = {}) => new Response('{}', { status, headers });
const erroreConnessione = (code: string) => Object.assign(new TypeError('fetch failed'), { cause: { code } });

afterEach(() => {
  fetchFinto.mockReset();
  vi.unstubAllEnvs();
});

describe('chiamaHttp', () => {
  it('lascia il tempo massimo all\'AbortSignal disabilitando i timeout interni di Undici', async () => {
    fetchFinto.mockResolvedValueOnce(risposta(200));

    await chiamaHttp('https://istanta.test/FicoProcess/x', { categoria: 'lunga' });

    const init = fetchFinto.mock.calls[0][1] as RequestInit & { dispatcher?: unknown };
    expect(agente.opzioni).toEqual({ headersTimeout: 0, bodyTimeout: 0 });
    expect(init.dispatcher).toBeDefined();
  });

  it('restituisce la risposta anche con uno stato di errore: l\'esito lo legge chi chiama', async () => {
    fetchFinto.mockResolvedValueOnce(risposta(500));

    const res = await chiamaHttp('https://istanta.test/FicoProcess/x', { categoria: 'lettura' });

    expect(res.status).toBe(500);
    expect(fetchFinto).toHaveBeenCalledTimes(1);
  });

  it('una chiamata non dichiarata idempotente non viene mai ritentata', async () => {
    fetchFinto.mockResolvedValueOnce(risposta(503));

    const res = await chiamaHttp('https://istanta.test/ACPV/salvaPV', { method: 'PUT', ritardoBaseMs: 0 });

    expect(res.status).toBe(503);
    expect(fetchFinto).toHaveBeenCalledTimes(1);
  });

  it('una lettura idempotente viene ritentata su 502/503/504/429 fino a 3 volte', async () => {
    fetchFinto
      .mockResolvedValueOnce(risposta(503))
      .mockResolvedValueOnce(risposta(429))
      .mockResolvedValueOnce(risposta(200));

    const res = await chiamaHttp('https://istanta.test/getFormContext', { categoria: 'lettura', idempotente: true, ritardoBaseMs: 0 });

    expect(res.status).toBe(200);
    expect(fetchFinto).toHaveBeenCalledTimes(3);
  });

  it('un 500 non viene ritentato neanche se la chiamata e\' idempotente', async () => {
    fetchFinto.mockResolvedValueOnce(risposta(500));

    await chiamaHttp('https://istanta.test/x', { idempotente: true, ritardoBaseMs: 0 });

    expect(fetchFinto).toHaveBeenCalledTimes(1);
  });

  it('servizio non raggiungibile: ErroreHttp "rete", con la fase della connessione', async () => {
    fetchFinto.mockRejectedValue(erroreConnessione('ECONNREFUSED'));

    const errore = await chiamaHttp('https://olimpo.test/auth/getPassport?token=segreto', { ritardoBaseMs: 0 }).catch(e => e);

    expect(errore).toBeInstanceOf(ErroreHttp);
    expect(errore.motivo).toBe('rete');
    expect(errore.primaDellInvio).toBe(true);
    expect(errore.destinazione).toBe('https://olimpo.test/auth/getPassport');
    expect(erroreDiConnessionePrimaDellInvio(errore)).toBe(true);
  });

  it('connessione caduta dopo l\'invio: non e\' "prima dell\'invio"', async () => {
    fetchFinto.mockRejectedValue(erroreConnessione('ECONNRESET'));

    const errore = await chiamaHttp('https://graph.test/messages', { ritardoBaseMs: 0 }).catch(e => e);

    expect(errore.motivo).toBe('rete');
    expect(errore.primaDellInvio).toBe(false);
  });

  it('una lettura idempotente ritenta un errore di rete e poi riesce', async () => {
    fetchFinto.mockRejectedValueOnce(erroreConnessione('ECONNRESET')).mockResolvedValueOnce(risposta(200));

    const res = await chiamaHttp('https://istanta.test/x', { idempotente: true, ritardoBaseMs: 0 });

    expect(res.status).toBe(200);
  });

  it('nessuna risposta entro il tempo massimo: ErroreHttp "timeout", senza nuovi tentativi', async () => {
    fetchFinto.mockImplementation((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
    }));

    const errore = await chiamaHttp('https://istanta.test/x', { timeoutMs: 20, idempotente: true, ritardoBaseMs: 0 }).catch(e => e);

    expect(errore).toBeInstanceOf(ErroreHttp);
    expect(errore.motivo).toBe('timeout');
    expect(fetchFinto).toHaveBeenCalledTimes(1);
  });

  it('il timeout interno delle intestazioni e\' un timeout leggibile e non viene ritentato', async () => {
    fetchFinto.mockRejectedValue(erroreConnessione('UND_ERR_HEADERS_TIMEOUT'));

    const errore = await chiamaHttp('https://db1.test/UploadVolStorico.ashx', {
      timeoutMs: 30 * 60_000,
      idempotente: true,
      ritardoBaseMs: 0,
    }).catch(e => e);

    expect(errore).toBeInstanceOf(ErroreHttp);
    expect(errore.motivo).toBe('timeout');
    expect(errore.destinazione).toBe('https://db1.test/UploadVolStorico.ashx');
    expect(fetchFinto).toHaveBeenCalledTimes(1);
  });

  it('un URL non valido non e\' un errore di rete', async () => {
    fetchFinto.mockRejectedValueOnce(Object.assign(new TypeError('Failed to parse URL'), { cause: { code: 'ERR_INVALID_URL' } }));

    const errore = await chiamaHttp('non-un-url').catch(e => e);

    expect(errore).not.toBeInstanceOf(ErroreHttp);
  });

  it('i tempi massimi per categoria; "lunga" segue FICO_API_TIMEOUT_MS', () => {
    expect(timeoutCategoria('passaporto')).toBe(10_000);
    expect(timeoutCategoria('lettura')).toBe(30_000);
    expect(timeoutCategoria('scrittura')).toBe(60_000);
    expect(timeoutCategoria('lunga')).toBe(600_000);
    vi.stubEnv('FICO_API_TIMEOUT_MS', '120000');
    expect(timeoutCategoria('lunga')).toBe(120_000);
  });
});
