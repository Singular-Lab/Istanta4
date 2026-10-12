import { sequelize, initializeDatabase as initializeSequelize, closeDatabase as closeSequelize } from './SequelizeConnector';

export async function initializeDatabase() {
    await initializeSequelize();
}

export async function closeDatabase() {
    await closeSequelize();
}

export {
    sequelize
};
