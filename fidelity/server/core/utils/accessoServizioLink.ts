import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Link dell'accesso di servizio OIDC (/auth/oidc/fake-callback).
 *
 * Parametri in query: email, oid, exp (millisecondi) e sig, cioe' HMAC-SHA256 di
 * email, oid ed exp. La chiave e' derivata dal segreto con un'etichetta propria,
 * come in passwordResetToken. Un link vale al massimo 15 minuti: una scadenza
 * piu' lontana non puo' essere stata emessa da noi.
 */
export const ACCESSO_SERVIZIO_TTL_MS = 5 * 60 * 1000;
export const ACCESSO_SERVIZIO_TTL_MAX_MS = 15 * 60 * 1000;

export type AccessoServizioCheck = 'valid' | 'invalid' | 'expired';

export interface AccessoServizioParams {
  email: string;
  oid: string;
  exp: string;
  sig: string;
}

function sign(email: string, oid: string, exp: string, secret: string): string {
  const key = createHmac('sha256', secret).update('fidelity:oidc-fake-callback').digest();
  return createHmac('sha256', key).update(`${email}\n${oid}\n${exp}`).digest('base64url');
}

export function createAccessoServizioParams(
  email: string,
  oid: string,
  secret: string,
  now = Date.now(),
  ttlMs = ACCESSO_SERVIZIO_TTL_MS
): AccessoServizioParams {
  const exp = String(now + Math.min(ttlMs, ACCESSO_SERVIZIO_TTL_MAX_MS));
  return { email, oid, exp, sig: sign(email, oid, exp, secret) };
}

export function verifyAccessoServizioParams(
  query: Record<string, unknown>,
  secret: string,
  now = Date.now()
): AccessoServizioCheck {
  const { email, oid = '', exp, sig } = query;
  if (typeof email !== 'string' || typeof oid !== 'string' || typeof exp !== 'string' || typeof sig !== 'string') {
    return 'invalid';
  }

  const expected = Buffer.from(sign(email, oid, exp, secret));
  const received = Buffer.from(sig);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return 'invalid';
  }

  const expMs = Number(exp);
  if (!Number.isFinite(expMs) || expMs > now + ACCESSO_SERVIZIO_TTL_MAX_MS) {
    return 'invalid';
  }

  return now > expMs ? 'expired' : 'valid';
}
