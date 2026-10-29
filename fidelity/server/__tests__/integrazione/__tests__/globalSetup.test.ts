import { describe, expect, it } from 'vitest';
import { databaseDaUrl } from '../globalSetup';

// Il database di FIDELITY_TEST_DB_URL viene cancellato a ogni esecuzione: la guardia impedisce di
// puntare per errore a un database vero.
describe('databaseDaUrl', () => {
  it('accetta un database che finisce in _test e decodifica le credenziali', () => {
    expect(databaseDaUrl('postgres://utente%40dominio:p%40ss@localhost:5433/fidelity_test', 'fidelity_promotion_edro21')).toEqual({
      host: 'localhost',
      port: 5433,
      user: 'utente@dominio',
      password: 'p@ss',
      database: 'fidelity_test',
    });
  });

  it('senza porta usa la 5432', () => {
    expect(databaseDaUrl('postgres://u:p@db/ci_test').port).toBe(5432);
  });

  it('rifiuta un database il cui nome non finisce in _test', () => {
    expect(() => databaseDaUrl('postgres://u:p@localhost:5433/fidelity_promotion_edro21')).toThrow(/_test/);
  });

  it('rifiuta il database di sviluppo anche se finisse in _test', () => {
    expect(() => databaseDaUrl('postgres://u:p@localhost/sviluppo_test', 'sviluppo_test')).toThrow(/DB_POSTGRESQL_NAME/);
  });
});
