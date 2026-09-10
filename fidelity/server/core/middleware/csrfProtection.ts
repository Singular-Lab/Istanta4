import { NextFunction, Request, Response } from 'express';
import { createHmac, randomBytes } from 'node:crypto';
import { ErrorCodes } from '../../../lib/errors/ErrorCodes';
import { ForbiddenError } from '../../../lib/errors/application/ForbiddenError';
import { log } from '../logger';
import { AuditLogService } from '../services/AuditLogService';

/**
 * Interfaccia per le opzioni di configurazione CSRF
 */
interface CSRFOptions {
  secret: string;
  tokenLength: number;
  cookieName: string;
  headerName: string;
  ignoreMethods: string[];
  maxAge: number;
}

/**
 * Configurazione di default per CSRF
 */
const defaultOptions: CSRFOptions = {
  secret: process.env.CSRF_SECRET || 'default-csrf-secret-change-in-production',
  tokenLength: 32,
  cookieName: 'csrf-token',
  headerName: 'x-csrf-token',
  ignoreMethods: ['GET', 'HEAD', 'OPTIONS'],
  maxAge: 60 * 60 * 1000 // 1 ora
};

/**
 * Genera un token CSRF sicuro
 */
function generateCSRFToken(secret: string, tokenLength: number): string {
  const randomToken = randomBytes(tokenLength).toString('hex');
  const timestamp = Date.now().toString();
  const data = `${randomToken}:${timestamp}`;

  const hmac = createHmac('sha256', secret);
  hmac.update(data);
  const signature = hmac.digest('hex');

  return `${data}:${signature}`;
}

function setCSRFCookie(res: Response, config: CSRFOptions, token: string): void {
  res.cookie(config.cookieName, token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: config.maxAge
  });
}

/**
 * Verifica la validità di un token CSRF
 */
function verifyCSRFToken(token: string, secret: string, maxAge: number): boolean {
  try {
    const parts = token.split(':');
    if (parts.length !== 3) return false;

    const [randomToken, timestamp, signature] = parts;
    const data = `${randomToken}:${timestamp}`;

    // Verifica la firma
    const hmac = createHmac('sha256', secret);
    hmac.update(data);
    const expectedSignature = hmac.digest('hex');

    if (signature !== expectedSignature) return false;

    // Verifica la scadenza
    const tokenAge = Date.now() - parseInt(timestamp);
    if (tokenAge > maxAge) return false;

    return true;
  } catch (error) {
    return false;
  }
}

function normalizeTokenValue(token: unknown): string | undefined {
  if (typeof token !== 'string' || token.length === 0) {
    return undefined;
  }

  try {
    return decodeURIComponent(token);
  } catch {
    return token;
  }
}

/**
 * Estende l'interfaccia Request per includere il token CSRF
 */
declare global {
  namespace Express {
    interface Request {
      csrfToken?: () => string;
    }
  }
}

/**
 * Middleware per la protezione CSRF
 */
export function csrfProtection(options: Partial<CSRFOptions> = {}) {
  const config = { ...defaultOptions, ...options };

  return (req: Request, res: Response, next: NextFunction) => {
    // Genera un nuovo token per ogni richiesta
    const token = generateCSRFToken(config.secret, config.tokenLength);

    // Aggiunge il metodo per ottenere il token alla richiesta
    req.csrfToken = () => token;

    // Imposta il token nel cookie
    setCSRFCookie(res, config, token);

    // Se il metodo è tra quelli ignorati, passa oltre
    if (config.ignoreMethods.includes(req.method)) {
      return next();
    }

    // Per i metodi che modificano lo stato, verifica il token
    const tokenFromHeader = normalizeTokenValue(req.get(config.headerName));
    const tokenFromBody = normalizeTokenValue(req.body?._csrf);
    const tokenFromQuery = normalizeTokenValue(req.query._csrf);
    const tokenFromCookie = normalizeTokenValue(req.cookies[config.cookieName]);

    const submittedToken = tokenFromHeader || tokenFromBody || tokenFromQuery;

    if (!submittedToken) {
      log.warn('CSRF token missing', {
        ip: req.ip,
        method: req.method,
        path: req.path,
        userAgent: req.get('User-Agent')
      });
      AuditLogService.getInstance().csrfTokenInvalid(req, 'missing');

      return next(new ForbiddenError({
        message: 'Token CSRF mancante. Ricarica la pagina e riprova.',
        resource: req.path,
        action: req.method,
        details: { errorCode: ErrorCodes.CSRF_TOKEN_MISSING }
      }));
    }

    // Verifica che il token inviato corrisponda a quello nel cookie
    if (!tokenFromCookie || submittedToken !== tokenFromCookie) {
      log.warn('CSRF token mismatch', {
        ip: req.ip,
        method: req.method,
        path: req.path,
        userAgent: req.get('User-Agent'),
        hasHeaderToken: !!tokenFromHeader,
        hasBodyToken: !!tokenFromBody,
        hasCookieToken: !!tokenFromCookie
      });
      AuditLogService.getInstance().csrfTokenInvalid(req, 'mismatch');

      return next(new ForbiddenError({
        message: 'Token CSRF non valido. Ricarica la pagina e riprova.',
        resource: req.path,
        action: req.method,
        details: { errorCode: ErrorCodes.CSRF_TOKEN_INVALID }
      }));
    }

    // Verifica la validità del token
    if (!verifyCSRFToken(submittedToken, config.secret, config.maxAge)) {
      log.warn('CSRF token invalid or expired', {
        ip: req.ip,
        method: req.method,
        path: req.path,
        userAgent: req.get('User-Agent')
      });
      AuditLogService.getInstance().csrfTokenInvalid(req, 'expired');

      return next(new ForbiddenError({
        message: 'Token CSRF scaduto o non valido. Ricarica la pagina e riprova.',
        resource: req.path,
        action: req.method,
        details: { errorCode: ErrorCodes.CSRF_TOKEN_EXPIRED }
      }));
    }

    log.debug('CSRF token validated successfully', {
      ip: req.ip,
      method: req.method,
      path: req.path
    });

    next();
  };
}

/**
 * Middleware per generare solo il token CSRF senza validazione
 * Utile per endpoint che devono fornire il token iniziale
 */
export function csrfTokenGenerator(options: Partial<CSRFOptions> = {}) {
  const config = { ...defaultOptions, ...options };

  return (req: Request, res: Response, next: NextFunction) => {
    const token = generateCSRFToken(config.secret, config.tokenLength);

    req.csrfToken = () => token;

    setCSRFCookie(res, config, token);

    next();
  };
}

/**
 * Endpoint per ottenere un token CSRF
 */
export const csrfTokenEndpoint = (req: Request, res: Response) => {
  let token = req.csrfToken?.();

  if (!token) {
    token = generateCSRFToken(defaultOptions.secret, defaultOptions.tokenLength);
    setCSRFCookie(res, defaultOptions, token);

    log.warn('CSRF token generated by endpoint fallback', {
      method: req.method,
      path: req.path
    });
  }

  res.json({
    success: true,
    csrfToken: token,
    message: 'Token CSRF generato con successo'
  });
};

/**
 * Utility per verificare se una richiesta ha bisogno di protezione CSRF
 */
export function requiresCSRFProtection(method: string, path: string): boolean {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  const publicPaths = ['/api/csrf-token', '/api/health'];
  const publicPathPrefixes = ['/api/external'];

  return !safeMethods.includes(method)
    && !publicPaths.includes(path)
    && !publicPathPrefixes.some(prefix => path.startsWith(prefix));
}
