import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { databaseDaUrl } from '../globalSetup';

// Il database di FIDELITY_TEST_DB_URL viene cancellato a ogni esecuzione: la guardia impedisce di
// puntare per errore a un database vero.
describe('databaseDaUrl', () => {
  it('accetta un database che finisce in _test e decodifica le credenziali', () => {
    // Credenziali generate qui: nel codice non ce ne sono di scritte
    const credenziale = `${randomBytes(8).toString('hex')}@`;
    const url = new URL('postgres://localhost:5433/fidelity_test');
    url.username = encodeURIComponent('utente@dominio');
    url.password = encodeURIComponent(credenziale);

    expect(databaseDaUrl(url.toString(), 'fidelity_promotion_edro21')).toEqual({
      host: 'localhost',
      port: 5433,
      user: 'utente@dominio',
      password: credenziale,
      database: 'fidelity_test',
    });
  });

  it('senza porta usa la 5432', () => {
    expect(databaseDaUrl('postgres://db/ci_test').port).toBe(5432);
  });

  it('rifiuta un database il cui nome non finisce in _test', () => {
    expect(() => databaseDaUrl('postgres://localhost:5433/fidelity_promotion_edro21')).toThrow(/_test/);
  });

  it('rifiuta il database di sviluppo anche se finisse in _test', () => {
    expect(() => databaseDaUrl('postgres://localhost/sviluppo_test', 'sviluppo_test')).toThrow(/DB_POSTGRESQL_NAME/);
  });
});
