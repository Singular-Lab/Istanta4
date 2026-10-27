import { describe, expect, it } from 'vitest';
import { mapOidcUserClaims } from '../OidcService';

describe('mapOidcUserClaims', () => {
  it('mantiene le App Roles restituite da Microsoft Entra ID', () => {
    expect(mapOidcUserClaims({
      sub: 'subject-1',
      email: 'utente@example.test',
      roles: ['GDO', 'Marketing'],
    })).toMatchObject({
      sub: 'subject-1',
      email: 'utente@example.test',
      roles: ['GDO', 'Marketing'],
    });
  });

  it.each([
    ['una stringa singola', 'GDO'],
    ['un array con valori non stringa', ['GDO', 1]],
  ])('considera assente il claim roles se e\' %s', (_description, roles) => {
    expect(mapOidcUserClaims({ sub: 'subject-1', roles }).roles).toBeUndefined();
  });
});
