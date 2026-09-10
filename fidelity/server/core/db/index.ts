import { sequelize, initializeDatabase as initializeSequelize, closeDatabase as closeSequelize } from './SequelizeConnector';
import { MongoDBConnection } from './MongoDBConnector';

// Initialize both databases
export async function initializeDatabase() {
    await initializeSequelize();
    await MongoDBConnection.connect();
}

// Close both databases
export async function closeDatabase() {
    await closeSequelize();
    await MongoDBConnection.disconnect();
}

// Export the database instances
export {
    sequelize,
    MongoDBConnection
}; 