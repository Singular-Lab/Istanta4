import { inject } from 'vitest';

// Prima di setup.ts e di ogni import di config: il singleton di Sequelize nasce sul database di test
const db = inject('databaseIntegrazione');
if (db) {
  process.env.NODE_ENV = 'test';
  process.env.DB_POSTGRESQL_HOST = db.host;
  process.env.DB_POSTGRESQL_PORT = String(db.port);
  process.env.DB_POSTGRESQL_USER = db.user;
  process.env.DB_POSTGRESQL_PASSWORD = db.password;
  process.env.DB_POSTGRESQL_NAME = db.database;
}
