import { createHash, timingSafeEqual } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';
import { ForbiddenError } from '../../../lib/errors/application/ForbiddenError';
import { log } from '../logger';

export const UXP_CLIENT_TOKEN_HEADER = 'X-UXP-Client-Token';

const UXP_CLIENT_TOKEN_PATTERN = /^[a-f0-9]{64}$/i;
const UXP_BOOTSTRAP_PATHS = new Set(['/api/csrf-token', '/api/login_user']);
const UXP_SESSION_INFO_PATH = '/api/session/info';

const forbidden = (req: Request, reason: 'missing_or_invalid' | 'unbound' | 'mismatch') => {
  log.warn('Richiesta UXP da origine opaca rifiutata', {
    method: req.method,
    path: req.path,
    reason,
    hasAuthenticatedSession: !!req.session?.id_utente,
    hasBoundClient: !!req.session?.uxpClientTokenHash,
    userAgent: req.get('User-Agent'),
  });

  return new ForbiddenError({
    message: 'Client UXP non autorizzato per questa sessione.',
    resource: req.path,
    action: req.method,
    details: { errorCode: 'UXP_CLIENT_NOT_AUTHORIZED', reason },
  });
};

const apiRequestPath = (req: Request): string =>
  (req.originalUrl?.split('?')[0] || req.path);

export const isOpaqueUxpRequest = (req: Request): boolean =>
  apiRequestPath(req).startsWith('/api/') && req.get('Origin') === 'null';

export const readUxpClientToken = (req: Request): string | undefined => {
  const token = req.get(UXP_CLIENT_TOKEN_HEADER)?.trim();
  return token && UXP_CLIENT_TOKEN_PATTERN.test(token) ? token.toLowerCase() : undefined;
};

export const hashUxpClientToken = (token: string): string =>
  createHash('sha256').update(token, 'utf8').digest('hex');

const sameHash = (actual: string, expected: string): boolean => {
  if (!/^[a-f0-9]{64}$/i.test(actual) || !/^[a-f0-9]{64}$/i.test(expected)) return false;
  return timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
};

/**
 * Restituisce l'impronta da associare alla nuova sessione dopo il login.
 * Le richieste normali, senza origine opaca, non ricevono alcun vincolo aggiuntivo.
 */
export const uxpClientTokenHashForLogin = (req: Request): string | undefined => {
  if (!isOpaqueUxpRequest(req)) return undefined;
  const token = readUxpClientToken(req);
  if (!token) throw forbidden(req, 'missing_or_invalid');
  return hashUxpClientToken(token);
};

/**
 * CORS abilita soltanto il trasporto dell'header: qui la prova dell'installazione
 * viene confrontata in constant time con l'impronta associata alla sessione.
 */
export const uxpOriginSessionProtection = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  if (req.method === 'OPTIONS' || !isOpaqueUxpRequest(req)) {
    next();
    return;
  }

  const token = readUxpClientToken(req);
  if (!token) {
    next(forbidden(req, 'missing_or_invalid'));
    return;
  }

  // CSRF e login sono il bootstrap controllato. Il login rigenera la sessione e
  // associa la nuova impronta; questo consente anche il recupero dopo la perdita
  // del secureStorage, ma richiede nuovamente le credenziali dell'operatore.
  if (UXP_BOOTSTRAP_PATHS.has(req.path)) {
    next();
    return;
  }

  if (!req.session?.id_utente) {
    // La route rispondera' 401: serve alla UI per decidere di mostrare il login.
    if (req.path === UXP_SESSION_INFO_PATH) {
      next();
      return;
    }
    next(forbidden(req, 'unbound'));
    return;
  }

  const boundHash = req.session.uxpClientTokenHash;
  if (!boundHash) {
    next(forbidden(req, 'unbound'));
    return;
  }

  const actualHash = hashUxpClientToken(token);
  if (!sameHash(actualHash, boundHash)) {
    next(forbidden(req, 'mismatch'));
    return;
  }

  next();
};
