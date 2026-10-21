import { describe, expect, it } from 'vitest';
import { encryptString } from '../../../lib/encryption';
import {
  PASSWORD_RESET_TOKEN_TTL_MS,
  createPasswordResetToken,
  readPasswordResetTokenEmail,
  verifyPasswordResetToken
} from './passwordResetToken';

const SECRET = 'test-secret';
const HASH = '$2b$10$hash-attuale';
const EMAIL = 'mario@example.com';
const NOW = Date.UTC(2026, 9, 8, 10, 0, 0);

describe('token del collegamento di reset password', () => {
  it('accetta un token appena emesso e ne legge l\'email', () => {
    const token = createPasswordResetToken(EMAIL, HASH, SECRET, NOW);

    expect(readPasswordResetTokenEmail(token)).toBe(EMAIL);
    expect(verifyPasswordResetToken(token, HASH, SECRET, NOW)).toBe('valid');
  });

  it('scade dopo 24 ore', () => {
    const token = createPasswordResetToken(EMAIL, HASH, SECRET, NOW);

    expect(verifyPasswordResetToken(token, HASH, SECRET, NOW + PASSWORD_RESET_TOKEN_TTL_MS - 1)).toBe('valid');
    expect(verifyPasswordResetToken(token, HASH, SECRET, NOW + PASSWORD_RESET_TOKEN_TTL_MS + 1)).toBe('expired');
  });

  it('smette di valere appena la password cambia: il collegamento vale una volta sola', () => {
    const token = createPasswordResetToken(EMAIL, HASH, SECRET, NOW);

    expect(verifyPasswordResetToken(token, '$2b$10$hash-nuovo', SECRET, NOW)).toBe('invalid');
  });

  it('rifiuta un payload alterato, per esempio email e scadenza cambiate', () => {
    const [, firma] = createPasswordResetToken(EMAIL, HASH, SECRET, NOW).split('.');
    const forgiato = Buffer.from(JSON.stringify({ email: 'admin@example.com', exp: NOW + 1000 })).toString('base64url');

    expect(verifyPasswordResetToken(`${forgiato}.${firma}`, HASH, SECRET, NOW)).toBe('invalid');
  });

  it('rifiuta una scadenza oltre la durata massima anche se firmata', () => {
    const token = createPasswordResetToken(EMAIL, HASH, SECRET, NOW + 2 * PASSWORD_RESET_TOKEN_TTL_MS);

    expect(verifyPasswordResetToken(token, HASH, SECRET, NOW)).toBe('invalid');
  });

  it('rifiuta un token del vecchio formato cifrato con lo stesso segreto', () => {
    const vecchio = encryptString(JSON.stringify({ email: EMAIL, timestamp: '2099-01-01T00:00:00Z' }), SECRET);

    expect(verifyPasswordResetToken(vecchio, HASH, SECRET, NOW)).toBe('invalid');
    expect(readPasswordResetTokenEmail(vecchio)).toBeNull();
  });

  it('rifiuta un token firmato con un altro segreto o vuoto', () => {
    const altro = createPasswordResetToken(EMAIL, HASH, 'altro-segreto', NOW);

    expect(verifyPasswordResetToken(altro, HASH, SECRET, NOW)).toBe('invalid');
    expect(verifyPasswordResetToken('', HASH, SECRET, NOW)).toBe('invalid');
  });
});
