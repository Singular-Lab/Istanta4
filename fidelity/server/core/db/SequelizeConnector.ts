import * as dotenv from 'dotenv';
import { Sequelize } from 'sequelize';
import { Colorize } from '../../../lib/Colorize';
import config from '../config/index';
import { log } from '../logger';
dotenv.config();

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

// Initialize database connection WITH auto-sync
const DEFAULT_AUTO_SYNC = process.env.DB_AUTO_SYNC
  ? process.env.DB_AUTO_SYNC === 'true'
  : config.NODE_ENV === 'development';

export const initializeDatabase = async (autoSync: boolean = DEFAULT_AUTO_SYNC) => {
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

    // Configura sempre le associazioni tra modelli, indipendentemente dall'auto-sync
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

    if (autoSync) {
      // Importa e usa il modelliManager per la sincronizzazione automatica
      const { modelliManager } = await import('../models');

      log.info(Colorize.bgBlue("🔄 Avvio sincronizzazione automatica modelli..."));
      const risultati = await modelliManager.sincronizzaTuttiIModelli({
        alter: true,
        force: false,
        logging: false
      });

      const successi = risultati.filter(r => r.successo).length;
      const errori = risultati.filter(r => !r.successo).length;

      if (errori === 0) {
        log.info(Colorize.bgGreen(`✅ Tutti i ${successi} modelli sincronizzati automaticamente`));
      } else {
        log.warn(Colorize.bgYellow(`⚠️  ${successi} modelli sincronizzati, ${errori} errori`));
      }
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
