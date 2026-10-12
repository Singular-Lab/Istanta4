import { sequelize, initializeDatabase as initializeSequelize, closeDatabase as closeSequelize } from './SequelizeConnector';

// autoSync omesso: decide SequelizeConnector (DB_AUTO_SYNC, o development)
export async function initializeDatabase(autoSync?: boolean) {
    await initializeSequelize(autoSync);
}

export async function closeDatabase() {
    await closeSequelize();
}

export {
    sequelize
};
