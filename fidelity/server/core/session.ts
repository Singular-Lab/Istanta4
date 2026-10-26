import connectPgSimple from 'connect-pg-simple';
import session from 'express-session';
import { randomBytes } from 'node:crypto';
import pkg from 'pg';
import config from './config/index';

const { Pool } = pkg;
const PgSession = connectPgSimple(session);

const pgPool = new Pool({
  host: config.DB_POSTGRESQL_HOST,
  port: config.DB_POSTGRESQL_PORT,
  database: config.DB_POSTGRESQL_NAME,
  user: config.DB_POSTGRESQL_USER,
  password: String(config.DB_POSTGRESQL_PASSWORD),
});

/**
 * Calcola il timeout dinamico basato sul tipo di utente e attività
 */
function calculateSessionTimeout(userType?: string, lastActivity?: Date): number {
  const now = Date.now();
  const baseTimeout = {
    'Superadmin': 4 * 60 * 60 * 1000,    // 4 ore per superadmin
    'Agenzia': 2 * 60 * 60 * 1000,       // 2 ore per agenzia
    'GDO': 2 * 60 * 60 * 1000,           // 2 ore per GDO
    'PuntoVendita': 1 * 60 * 60 * 1000,  // 1 ora per punto vendita
    'Guest': 30 * 60 * 1000,              // 30 minuti per guest
    'Category': 2 * 60 * 60 * 1000,      // 2 ore per category
  };

  const timeout = baseTimeout[userType as keyof typeof baseTimeout] || 1 * 60 * 60 * 1000; // Default 1 ora

  // Se c'è stata attività recente (< 15 minuti), estendi la sessione
  if (lastActivity) {
    const timeSinceActivity = now - lastActivity.getTime();
    if (timeSinceActivity < 15 * 60 * 1000) { // 15 minuti
      return Math.max(timeout, 30 * 60 * 1000); // Minimo 30 minuti
    }
  }

  return timeout;
}

export const sessionMiddleware = session({
  name: 'sid_fidelity_promo',    // nome personalizzato per il cookie
  secret: config.SESSION_SECRET, // stringa lunga presa da .env
  resave: false,
  saveUninitialized: false,
  proxy: config.NODE_ENV === 'production' || config.NODE_ENV === 'test',
  rolling: true,                 // Rinnova automaticamente la sessione su ogni richiesta
  store: new PgSession({
    pool: pgPool,
    tableName: 'sessions',
    ttl: 4 * 60 * 60,           // 4 ore massime nel database
    createTableIfMissing: true,
  }),
  cookie: {
    httpOnly: true,
    sameSite: config.NODE_ENV === 'production' && config.CLIENT_URL?.startsWith('https') ? 'none' : 'strict',
    secure: config.NODE_ENV === 'production' && config.CLIENT_URL?.startsWith('https'),
    maxAge: 4 * 60 * 60 * 1000   // 4 ore massime (sarà sovrascritto dinamicamente)
  },
  // Callback per gestire il timeout dinamico
  genid: () => {
    // Utilizza import statico per crypto, perché require non è disponibile in ambienti ESM
    return randomBytes(32).toString('hex');
  }
});

export { calculateSessionTimeout };
