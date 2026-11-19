import { beforeEach, expect, it, vi } from 'vitest';
import { describeConDatabase, svuotaTabelle, usaDatabase } from '../../../__tests__/integrazione/database';
import { sequelize } from '../../db/SequelizeConnector';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { CacheRichiesteSaml, depositoRichiesteSamlNelDatabase } from '../SamlService';

// Richieste di accesso SAML in attesa su PostgreSQL vero (migrazione 0024): due istanze della cache
// sono due worker, e la risposta dell'IdP puo' arrivare a quello che non ha avviato l'accesso
// (spec gestione-metodi-accesso, "Accesso tramite fornitore SAML"; processi-in-produzione).

const DIECI_MINUTI = 10 * 60 * 1000;

describeConDatabase('richieste SAML in attesa nel database', () => {
  usaDatabase();

  beforeEach(async () => {
    await svuotaTabelle('saml_richieste_in_attesa');
  });

  const worker = (adesso = Date.now) => new CacheRichiesteSaml(depositoRichiesteSamlNelDatabase, DIECI_MINUTI, adesso);

  it('la richiesta salvata da un worker la legge l\'altro', async () => {
    const worker1 = worker();
    const worker2 = worker();

    expect(await worker1.saveAsync('_richiesta-1', '2026-11-19T10:00:00Z')).toMatchObject({ value: '2026-11-19T10:00:00Z' });

    expect(await worker2.getAsync('_richiesta-1')).toBe('2026-11-19T10:00:00Z');
  });

  it('la stessa richiesta non si salva due volte', async () => {
    await worker().saveAsync('_richiesta-1', 'a');

    expect(await worker().saveAsync('_richiesta-1', 'b')).toBeNull();
    expect(await worker().getAsync('_richiesta-1')).toBe('a');
  });

  it('tolta da un worker alla prima risposta, l\'altro non la trova piu\'', async () => {
    const worker1 = worker();
    const worker2 = worker();
    await worker1.saveAsync('_richiesta-1', 'a');

    expect(await worker2.removeAsync('_richiesta-1')).toBe('a');

    expect(await worker1.getAsync('_richiesta-1')).toBeNull();
    expect(await worker1.removeAsync('_richiesta-1')).toBeNull();
  });

  it('una richiesta scaduta non vale piu\' e si toglie al salvataggio successivo', async () => {
    const adesso = Date.now();
    await worker(() => adesso).saveAsync('_vecchia', 'a');
    const piuTardi = worker(() => adesso + DIECI_MINUTI + 1000);

    expect(await piuTardi.getAsync('_vecchia')).toBeNull();
    await piuTardi.saveAsync('_nuova', 'b');

    const [righe] = await sequelize.query('SELECT chiave FROM saml_richieste_in_attesa ORDER BY chiave');
    expect(righe).toEqual([{ chiave: '_nuova' }]);
  });
});
