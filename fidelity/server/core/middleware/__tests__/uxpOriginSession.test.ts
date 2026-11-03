import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../logger', () => ({ log: { warn: vi.fn() } }));

import {
  hashUxpClientToken,
  isOpaqueUxpOrigin,
  UXP_CLIENT_TOKEN_HEADER,
  uxpClientTokenHashForLogin,
  uxpOriginSessionProtection,
} from '../uxpOriginSession';

const TOKEN = 'ab'.repeat(32);
const ALTRO_TOKEN = 'cd'.repeat(32);
type MiddlewareError = { httpStatus: number; details: { reason: string } };

function run(options: {
  path?: string;
  origin?: string;
  token?: string;
  idUtente?: string;
  boundHash?: string;
  method?: string;
} = {}) {
  const req = buildReq(options);
  const next = vi.fn<(error?: unknown) => void>();

  uxpOriginSessionProtection(req, {} as Response, next);
  return next;
}

function buildReq(options: {
  path?: string;
  origin?: string;
  token?: string;
  idUtente?: string;
  boundHash?: string;
  method?: string;
}) {
  const headers: Record<string, string | undefined> = {
    origin: options.origin,
    [UXP_CLIENT_TOKEN_HEADER.toLowerCase()]: options.token,
    'user-agent': 'vitest',
  };
  return {
    method: options.method || 'GET',
    path: options.path || '/api/session/info',
    session: {
      id_utente: options.idUtente,
      uxpClientTokenHash: options.boundHash,
    },
    get: (name: string) => headers[name.toLowerCase()],
  } as unknown as Request;
}

describe('associazione fra origine UXP opaca e sessione', () => {
  it('non modifica le richieste provenienti da origin normali', () => {
    const next = run({ origin: 'https://www.istantacno.it' });
    expect(next).toHaveBeenCalledWith();
  });

  it('permette il bootstrap CSRF con una prova valida', () => {
    const next = run({ path: '/api/csrf-token', origin: 'null', token: TOKEN });
    expect(next).toHaveBeenCalledWith();
  });

  it('lascia che session info anonima risponda con il normale 401', () => {
    const next = run({ origin: 'null', token: TOKEN });
    expect(next).toHaveBeenCalledWith();
  });

  it('accetta la stessa installazione associata alla sessione', () => {
    const next = run({
      origin: 'null',
      token: TOKEN,
      idUtente: 'u1',
      boundHash: hashUxpClientToken(TOKEN),
    });
    expect(next).toHaveBeenCalledWith();
  });

  it('rifiuta un altra origine opaca che riusa il cookie con una prova diversa', () => {
    const next = run({
      origin: 'null',
      token: ALTRO_TOKEN,
      idUtente: 'u1',
      boundHash: hashUxpClientToken(TOKEN),
    });
    const error = next.mock.calls[0][0] as MiddlewareError;
    expect(error.httpStatus).toBe(403);
    expect(error.details.reason).toBe('mismatch');
  });

  it('rifiuta una sessione autenticata precedente ma non associata', () => {
    const next = run({ origin: 'null', token: TOKEN, idUtente: 'u1' });
    const error = next.mock.calls[0][0] as MiddlewareError;
    expect(error.httpStatus).toBe(403);
    expect(error.details.reason).toBe('unbound');
  });

  it('rifiuta una prova assente o non valida', () => {
    const next = run({ origin: 'null', token: 'breve', idUtente: 'u1' });
    const error = next.mock.calls[0][0] as MiddlewareError;
    expect(error.httpStatus).toBe(403);
    expect(error.details.reason).toBe('missing_or_invalid');
  });
});

describe('origine file:// della webview WebKit (macOS)', () => {
  it('riconosce come opache solo null e file://', () => {
    expect(isOpaqueUxpOrigin('null')).toBe(true);
    expect(isOpaqueUxpOrigin('file://')).toBe(true);
    expect(isOpaqueUxpOrigin(undefined)).toBe(false);
    expect(isOpaqueUxpOrigin('')).toBe(false);
    expect(isOpaqueUxpOrigin('file:///Users/x/main.html')).toBe(false);
    expect(isOpaqueUxpOrigin('https://www.istantacno.it')).toBe(false);
  });

  it('permette il bootstrap CSRF con una prova valida', () => {
    const next = run({ path: '/api/csrf-token', origin: 'file://', token: TOKEN });
    expect(next).toHaveBeenCalledWith();
  });

  it('accetta la stessa installazione associata alla sessione', () => {
    const next = run({
      origin: 'file://',
      token: TOKEN,
      idUtente: 'u1',
      boundHash: hashUxpClientToken(TOKEN),
    });
    expect(next).toHaveBeenCalledWith();
  });

  it('rifiuta una prova diversa da quella associata', () => {
    const next = run({
      origin: 'file://',
      token: ALTRO_TOKEN,
      idUtente: 'u1',
      boundHash: hashUxpClientToken(TOKEN),
    });
    const error = next.mock.calls[0][0] as MiddlewareError;
    expect(error.httpStatus).toBe(403);
    expect(error.details.reason).toBe('mismatch');
  });

  it('rifiuta una sessione autenticata non associata', () => {
    const next = run({ origin: 'file://', token: TOKEN, idUtente: 'u1' });
    const error = next.mock.calls[0][0] as MiddlewareError;
    expect(error.httpStatus).toBe(403);
    expect(error.details.reason).toBe('unbound');
  });

  it('rifiuta una prova assente o non valida', () => {
    for (const token of [undefined, 'breve']) {
      const next = run({ origin: 'file://', token, idUtente: 'u1' });
      const error = next.mock.calls[0][0] as MiddlewareError;
      expect(error.httpStatus).toBe(403);
      expect(error.details.reason).toBe('missing_or_invalid');
    }
  });

  it('al login associa l impronta del token anche per file://', () => {
    const req = buildReq({ path: '/api/login_user', origin: 'file://', token: TOKEN, method: 'POST' });
    expect(uxpClientTokenHashForLogin(req)).toBe(hashUxpClientToken(TOKEN));
  });

  it('al login da file:// senza token rifiuta con 403', () => {
    const req = buildReq({ path: '/api/login_user', origin: 'file://', method: 'POST' });
    expect(() => uxpClientTokenHashForLogin(req)).toThrow(expect.objectContaining({ httpStatus: 403 }));
  });

  it('al login da un origin normale non associa alcuna impronta', () => {
    const req = buildReq({ path: '/api/login_user', origin: 'https://www.istantacno.it', token: TOKEN, method: 'POST' });
    expect(uxpClientTokenHashForLogin(req)).toBeUndefined();
  });
});
