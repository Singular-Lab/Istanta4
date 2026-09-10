import axios from 'axios';
import { NextFunction, Request, Response } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { TIPO_UTENTI } from '../../../lib/enums';
import { BadRequestError, UnauthorizedError } from '../../../lib/errors';
import config from '../config';
import { log } from '../logger';
import { AuditLogService } from '../services/AuditLogService';
import { calculateSessionTimeout } from '../session';

/**
 * Middleware di autenticazione migliorato
 * Verifica sia i token JWT (tramite header Authorization) che le sessioni utente
 * Supporta anche le risposte personalizzate in base al formato richiesto (JSON/HTML)
 */
const INTERNAL_REQUEST_TS_HEADER = 'x-internal-request-ts';
const INTERNAL_REQUEST_SIGNATURE_HEADER = 'x-internal-request-signature';

function safeCompareSignatures(received: string, expected: string): boolean {
  const receivedBuffer = Buffer.from(received, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');

  if (receivedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(receivedBuffer, expectedBuffer);
}

function buildInternalRequestSignature(secret: string, method: string, originalUrl: string, timestamp: string): string {
  const payload = `${method}\n${originalUrl}\n${timestamp}`;
  return createHmac('sha256', secret).update(payload).digest('hex');
}

function isValidSignedInternalRequest(req: Request): boolean {
  const secret = config.INTERNAL_REQUEST_SECRET;

  if (!secret) {
    return false;
  }

  const timestampHeader = req.get(INTERNAL_REQUEST_TS_HEADER);
  const signatureHeader = req.get(INTERNAL_REQUEST_SIGNATURE_HEADER);

  if (!timestampHeader || !signatureHeader) {
    return false;
  }

  const timestampMs = Number(timestampHeader);
  if (!Number.isFinite(timestampMs)) {
    log.warn('Internal signed request rejected: invalid timestamp format', {
      path: req.originalUrl,
      method: req.method
    });
    return false;
  }

  const allowedWindowMs = config.INTERNAL_REQUEST_WINDOW_MS || 60_000;
  if (Math.abs(Date.now() - timestampMs) > allowedWindowMs) {
    log.warn('Internal signed request rejected: timestamp out of window', {
      path: req.originalUrl,
      method: req.method,
      windowMs: allowedWindowMs
    });
    return false;
  }

  const expectedSignature = buildInternalRequestSignature(
    secret,
    req.method.toUpperCase(),
    req.originalUrl,
    String(timestampMs)
  );

  const isValid = safeCompareSignatures(signatureHeader, expectedSignature);
  if (!isValid) {
    log.warn('Internal signed request rejected: signature mismatch', {
      path: req.originalUrl,
      method: req.method
    });
  }

  return isValid;
}

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (isValidSignedInternalRequest(req)) {
      log.info('Autenticazione interna firmata riuscita', {
        method: req.method,
        path: req.originalUrl
      });
      return next();
    }

    // Verifica del token JWT in header Authorization
    if (req.headers['authorization']) {
      const authHeader = req.headers['authorization'];
      // Formato standard: "Bearer TOKEN"
      log.debug('JWT token authentication attempt', { hasToken: !!authHeader });
      if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        try {
          // In un sistema completo qui andrebbe verificata la validità del token
          log.info('Autenticazione con token JWT');
          const token = authHeader.split(' ')[1];
          const result = await axios.get(`${config.OLYMPUS_IP_ADDRESS}/auth/checkIdentity`, {
            headers: {
              'fico-secret': config.FICO_SECRET as string,
              'Authorization': `Bearer ${token}`
            }
          });
          if (!result.data || result.data.error) {
            throw new UnauthorizedError({
              message: 'Token non valido o scaduto',
              details: { tokenError: result.data?.error }
            });
          }
          return next();
        } catch (error) {
          throw new UnauthorizedError({
            message: 'Errore durante la verifica del token',
            cause: error instanceof Error ? error : new Error('Unknown error')
          });
        }
      } else {
        log.warn('Header Authorization presente ma formato non valido', { authHeader: String(authHeader) });
        throw new BadRequestError({
          message: 'Formato del token non valido',
          details: { authorization: 'Deve essere nel formato "Bearer TOKEN"' }
        });
      }
    }
    // Verifica dell'autenticazione tramite sessione
    if (!req.session.id_utente) {
      log.warn('Autenticazione fallita: Nessuna sessione utente valida trovata', {
        sessionId: req.sessionID,
        ip: req.ip,
        path: req.path
      });
      throw new UnauthorizedError({
        message: 'Non autenticato',
        i18nKey: 'error.auth.session_expired'
      });
    }

    // Verifica scadenza sessione con timeout dinamico per ruolo
    const userType = req.session.tipo_utente;
    const lastActivity = req.session.lastActivity ? new Date(req.session.lastActivity) : new Date();
    const now = new Date();
    const timeout = calculateSessionTimeout(userType, lastActivity);
    const timeSinceActivity = now.getTime() - lastActivity.getTime();

    if (timeSinceActivity > timeout) {
      const isGdoIstanta = userType === TIPO_UTENTI.GDO && config.AD_TENANT_ID != null;
      const userId = req.session.id_utente;

      AuditLogService.getInstance().sessionExpired(req, userId);

      req.session.destroy((err) => {
        if (err) log.error('Error destroying expired session:', { error: err, userId });
      });
      res.clearCookie('sid_fidelity_promo');

      // Richieste AJAX/API: risposta JSON differenziata per tipo di scadenza
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(401).json({
          success: false,
          error: isGdoIstanta ? 'ISTANTA_LOGIN_REQUIRED' : 'SESSION_EXPIRED',
          message: isGdoIstanta
            ? 'Sessione scaduta. Effettua il login tramite Istanta.'
            : 'Sessione scaduta per inattività',
          expired: true,
          istantaRequired: isGdoIstanta
        });
      }

      // Richieste browser: redirect al login differenziato per GDO Istanta
      return res.redirect(isGdoIstanta ? '/login?reason=istanta_required' : '/login?reason=session_expired');
    }

    // Aggiorna lastActivity e maxAge del cookie
    req.session.lastActivity = now;
    req.session.cookie.maxAge = timeout;

    if (timeSinceActivity > 5 * 60 * 1000) {
      log.info('Session activity update', {
        userId: req.session.id_utente,
        inactiveMinutes: Math.round(timeSinceActivity / 60000),
        timeoutMinutes: Math.round(timeout / 60000),
        userType
      });
    }

    return next();
  } catch (error) {
    // Gestione centralizzata degli errori
    log.error('Auth middleware error:', error);

    // Determina il formato di risposta in base all'header Accept
    const wantsJSON = req.xhr || req.headers.accept?.includes('application/json');

    if (error instanceof UnauthorizedError) {
      if (wantsJSON) {
        res.status(401).json({
          success: false,
          message: error.message,
          error: 'authentication_required',
          details: error.details
        });
      } else {
        // Per richieste non-JSON si potrebbe reindirizzare alla pagina di login
        // res.redirect('/login?redirect=' + encodeURIComponent(req.originalUrl));
        res.status(401).json({ message: error.message });
      }
    } else if (error instanceof BadRequestError) {
      res.status(400).json({
        success: false,
        message: error.message,
        error: 'bad_request',
        details: error.details
      });
    } else {
      // Errore generico
      res.status(500).json({
        success: false,
        message: 'Errore interno durante l\'autenticazione',
        error: 'internal_server_error'
      });
    }
  }
};
