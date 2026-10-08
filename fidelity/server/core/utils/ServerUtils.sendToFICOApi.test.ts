import { afterEach, describe, expect, it, vi } from 'vitest';

// fetch simulato: niente rete, il cookie jar passa il fetch cosi com'e
const fetchMock = vi.hoisted(() => vi.fn());
vi.mock('node-fetch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node-fetch')>()),
  default: fetchMock,
}));
vi.mock('fetch-cookie', () => ({ default: (f: unknown) => f }));

import { ServerUtils } from './ServerUtils';

const risposta = (status: number, corpo: string, contentType = 'application/json') => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: 'HTTP',
  headers: new Map([['content-type', contentType]]),
  text: async () => corpo,
});

// Con Authorization gia presente sendToFICOApi non chiede il passaporto a Olimpo
const req = { session: {}, headers: { authorization: 'Bearer test' } } as any;

afterEach(() => {
  fetchMock.mockReset();
});

describe('ServerUtils.sendToFICOApi su risposta non OK', () => {
  it('conserva lo stato reale e il corpo JSON di Istanta', async () => {
    fetchMock.mockResolvedValue(risposta(401, '{"esito":false,"errorCode":0,"error":"no_login"}'));

    const r = await ServerUtils.sendToFICOApi(req, 'http://127.0.0.1:5000/FicoProcess/x', 'GET', undefined);

    expect(r.status).toBe(401);
    expect(r.data).toEqual({ esito: false, errorCode: 0, error: 'no_login' });
  });

  it('corpo vuoto o non JSON: data null e testo in statusText', async () => {
    fetchMock.mockResolvedValue(risposta(500, '<html>Error</html>', 'text/html'));

    const r = await ServerUtils.sendToFICOApi(req, 'http://127.0.0.1:5000/FicoProcess/x', 'GET', undefined);

    expect(r.status).toBe(500);
    expect(r.data).toBeNull();
    expect(r.statusText).toBe('<html>Error</html>');
  });

  it('nessuna risposta HTTP: status 0', async () => {
    fetchMock.mockRejectedValue(new Error('connect ECONNREFUSED'));

    const r = await ServerUtils.sendToFICOApi(req, 'http://127.0.0.1:5000/FicoProcess/x', 'GET', undefined);

    expect(r.status).toBe(0);
    expect(r.data).toBeNull();
  });
});
