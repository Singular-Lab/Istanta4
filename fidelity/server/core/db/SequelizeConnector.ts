import { Sequelize } from 'sequelize';
import { Colorize } from '../../../lib/Colorize';
import config from '../config/index';
import { log } from '../logger';

const parsePositiveInt = (value: string | undefined, fallback: number): number => {
  const parsedValue = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallback;
};

const parseNonNegativeInt = (value: string | undefined, fallback: number): number => {
  const parsedValue = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : fallback;
};

const DB_POOL_MAX = parsePositiveInt(process.env.DB_POOL_MAX, 8);
const DB_POOL_MIN = Math.min(parseNonNegativeInt(process.env.DB_POOL_MIN, 0), DB_POOL_MAX);
const DB_POOL_ACQUIRE_MS = parsePositiveInt(process.env.DB_POOL_ACQUIRE_MS, 30000);
const DB_POOL_IDLE_MS = parsePositiveInt(process.env.DB_POOL_IDLE_MS, 10000);
const DB_POOL_EVICT_MS = parsePositiveInt(process.env.DB_POOL_EVICT_MS, 5000);

// Create a single Sequelize instance
export const sequelize = new Sequelize({
  dialect: "postgres",
  database: String(config.DB_POSTGRESQL_NAME),
  username: String(config.DB_POSTGRESQL_USER),
  password: String(config.DB_POSTGRESQL_PASSWORD),
  host: String(config.DB_POSTGRESQL_HOST),
  port: config.DB_POSTGRESQL_PORT,
  logging: false,
  pool: {
    max: DB_POOL_MAX,
    min: DB_POOL_MIN,
    acquire: DB_POOL_ACQUIRE_MS,
    idle: DB_POOL_IDLE_MS,
    evict: DB_POOL_EVICT_MS
  }
});

/**
 * Apre la connessione e configura le associazioni fra i modelli. Lo schema non si tocca piu' qui:
 * cambia solo con le migrazioni (db/migrazioni, applicate all'avvio del server o con
 * `yarn migrazioni:applica`). Il parametro resta per compatibilita' con i chiamanti ed e' ignorato,
 * come DB_AUTO_SYNC.
 */
export const initializeDatabase = async (_autoSync?: boolean) => {
  try {
    await sequelize.authenticate();
    log.info(Colorize.bgGreen("PostgreSQL connection established successfully"));
    log.info('PostgreSQL pool configuration', {
      max: DB_POOL_MAX,
      min: DB_POOL_MIN,
      acquireMs: DB_POOL_ACQUIRE_MS,
      idleMs: DB_POOL_IDLE_MS,
      evictMs: DB_POOL_EVICT_MS
    });

    if ((process.env.DB_AUTO_SYNC ?? '') !== '') {
      log.warn("DB_AUTO_SYNC e' ignorata: lo schema cambia solo con le migrazioni (server/core/db/migrazioni)");
    }

    // Configura sempre le associazioni tra modelli
    try {
      const relazioniModule = await import('../models/relazioni');
      const configuraRelazioni =
        relazioniModule.configuraRelazioni ??
        relazioniModule.default?.configuraRelazioni;

      if (typeof configuraRelazioni !== 'function') {
        throw new TypeError("Export 'configuraRelazioni' non trovato in ../models/relazioni");
      }

      configuraRelazioni();
    } catch (errore) {
      log.warn(Colorize.yellow('⚠️ Errore configurazione relazioni:', errore));
    }

    return true;
  } catch (error) {
    log.error("Unable to connect to PostgreSQL", { error });
    throw error;
  }
};

// Close database connection
export const closeDatabase = async () => {
  try {
    await sequelize.close();
    log.info(Colorize.bgGreen("PostgreSQL connection closed successfully"));
  } catch (error) {
    log.error("Error closing PostgreSQL connection", { error });
    throw error;
  }
};
