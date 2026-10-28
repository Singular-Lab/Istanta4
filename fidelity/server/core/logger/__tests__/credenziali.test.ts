import { describe, expect, it } from 'vitest';
import { sanitizeValue } from '../index';

// Un body o una sessione finiti interi in un log non devono portarsi dietro le credenziali

describe('sanitizeValue', () => {
  it('oscura password, segreti, token e chiavi anche negli oggetti annidati', () => {
    expect(sanitizeValue({
      body: { email: 'mario@example.com', password: 'Segreta!1', nome: 'Mario' },
      session: { id_utente: 'u1', private_key: 'abc', csrfToken: 'x:y:z' },
      headers: { authorization: 'Bearer t', 'x-api-key': 'k' },
    })).toEqual({
      body: { email: 'mario@example.com', password: '[REDACTED]', nome: 'Mario' },
      session: { id_utente: 'u1', private_key: '[REDACTED]', csrfToken: '[REDACTED]' },
      headers: { authorization: '[REDACTED]', 'x-api-key': '[REDACTED]' },
    });
  });

  it('lascia i valori non testuali, come gli indicatori di presenza di un token', () => {
    expect(sanitizeValue({ hasHeaderToken: true, tokenLength: 32 })).toEqual({ hasHeaderToken: true, tokenLength: 32 });
  });
});
