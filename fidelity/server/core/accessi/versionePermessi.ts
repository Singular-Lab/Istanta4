import { QueryTypes, Transaction } from 'sequelize';
import { sequelize } from '../db/SequelizeConnector';

/**
 * Versione dei permessi, condivisa da tutti i processi tramite il database.
 *
 * Ogni modifica a permessi, override o menu la incrementa nella stessa transazione;
 * le cache (per processo e per sessione) la confrontano a ogni richiesta e si
 * ricalcolano quando cambia. Così una modifica vale dalla richiesta successiva su
 * qualunque worker del cluster, senza chiedere un nuovo accesso.
 *
 * La riga contiene anche la versione dello schema degli accessi, usata dalla
 * migrazione per non ripetersi.
 */

export const TABELLA_STATO_ACCESSI = 'accessi_stato';

export const creaTabellaStatoAccessi = async (transaction?: Transaction): Promise<void> => {
  await sequelize.query(
    `CREATE TABLE IF NOT EXISTS ${TABELLA_STATO_ACCESSI} (
       id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
       versione BIGINT NOT NULL DEFAULT 1,
       schema_accessi INTEGER NOT NULL DEFAULT 0,
       aggiornato_il TIMESTAMPTZ NOT NULL DEFAULT now()
     )`,
    { transaction }
  );
  await sequelize.query(
    `INSERT INTO ${TABELLA_STATO_ACCESSI} (id) VALUES (1) ON CONFLICT (id) DO NOTHING`,
    { transaction }
  );
};

export const leggiVersionePermessi = async (): Promise<number> => {
  const righe = await sequelize.query<{ versione: string | number }>(
    `SELECT versione FROM ${TABELLA_STATO_ACCESSI} WHERE id = 1`,
    { type: QueryTypes.SELECT }
  );
  return righe.length > 0 ? Number(righe[0].versione) : 0;
};

export const incrementaVersionePermessi = async (transaction?: Transaction): Promise<number> => {
  const righe = await sequelize.query<{ versione: string | number }>(
    `UPDATE ${TABELLA_STATO_ACCESSI} SET versione = versione + 1, aggiornato_il = now() WHERE id = 1 RETURNING versione`,
    { type: QueryTypes.SELECT, transaction }
  );
  return righe.length > 0 ? Number(righe[0].versione) : 0;
};

export const leggiSchemaAccessi = async (transaction?: Transaction): Promise<number> => {
  const righe = await sequelize.query<{ schema_accessi: number }>(
    `SELECT schema_accessi FROM ${TABELLA_STATO_ACCESSI} WHERE id = 1`,
    { type: QueryTypes.SELECT, transaction }
  );
  return righe.length > 0 ? Number(righe[0].schema_accessi) : 0;
};

export const scriviSchemaAccessi = async (schema: number, transaction?: Transaction): Promise<void> => {
  await sequelize.query(
    `UPDATE ${TABELLA_STATO_ACCESSI} SET schema_accessi = :schema, versione = versione + 1, aggiornato_il = now() WHERE id = 1`,
    { replacements: { schema }, transaction }
  );
};
