import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Token del collegamento "reimposta password".
 *
 * Formato: base64url({ email, exp }) + "." + HMAC-SHA256. La firma copre anche
 * l'hash della password attuale: appena la password cambia il token smette di
 * valere, quindi e' monouso senza tabelle di appoggio. La chiave e' derivata dal
 * segreto con un'etichetta propria, cosi' nessun'altra cifratura basata sullo
 * stesso segreto puo' produrre un token valido.
 */
export const PASSWORD_RESET_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export type PasswordResetTokenCheck = 'valid' | 'invalid' | 'expired';

interface PasswordResetPayload {
  email: string;
  exp: number;
}

function sign(payload: string, passwordHash: string, secret: string): string {
  const key = createHmac('sha256', secret).update('fidelity:password-reset').digest();
  return createHmac('sha256', key).update(`${payload}.${passwordHash}`).digest('base64url');
}

function decodePayload(payload: string): PasswordResetPayload | null {
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof data?.email !== 'string' || !Number.isFinite(data?.exp)) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function createPasswordResetToken(email: string, passwordHash: string, secret: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ email, exp: now + PASSWORD_RESET_TOKEN_TTL_MS })).toString('base64url');
  return `${payload}.${sign(payload, passwordHash, secret)}`;
}

/**
 * Email contenuta nel token, letta senza verificarlo: serve solo a recuperare
 * l'hash della password con cui poi verificarlo.
 */
export function readPasswordResetTokenEmail(token: string): string | null {
  return decodePayload(token.split('.')[0] ?? '')?.email ?? null;
}

export function verifyPasswordResetToken(token: string, passwordHash: string, secret: string, now = Date.now()): PasswordResetTokenCheck {
  const parts = token.split('.');
  if (parts.length !== 2) {
    return 'invalid';
  }

  const [payload, signature] = parts;
  const expected = Buffer.from(sign(payload, passwordHash, secret));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return 'invalid';
  }

  const data = decodePayload(payload);
  // Una scadenza oltre la durata massima non puo' essere stata emessa da noi.
  if (!data || data.exp > now + PASSWORD_RESET_TOKEN_TTL_MS) {
    return 'invalid';
  }

  return now > data.exp ? 'expired' : 'valid';
}
