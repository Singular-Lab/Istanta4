import { afterAll, beforeAll, describe, inject } from 'vitest';
import { closeDatabase, initializeDatabase } from '../../core/db';
import { sequelize } from '../../core/db/SequelizeConnector';

/**
 * Per i file *.integrazione.test.ts: il database lo prepara globalSetup.ts. Senza database (in
 * locale, senza FIDELITY_TEST_DB_URL ne' Docker) i describe si saltano; in CI non succede mai,
 * perche' globalSetup fallisce prima.
 */
export const databaseDisponibile = inject('databaseIntegrazione') !== null;

export const describeConDatabase = describe.skipIf(!databaseDisponibile);

/** Connessione e relazioni fra i modelli per tutto il file, chiusa alla fine. */
export function usaDatabase(): void {
  beforeAll(async () => {
    await initializeDatabase();
  });
  afterAll(async () => {
    await closeDatabase();
  });
}

/** Svuota le tabelle indicate (e quelle che le referenziano): ogni test parte dai propri dati. */
export async function svuotaTabelle(...tabelle: string[]): Promise<void> {
  const elenco = tabelle.map(t => `"${t}"`).join(', ');
  await sequelize.query(`TRUNCATE ${elenco} RESTART IDENTITY CASCADE`);
}
