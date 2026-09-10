import { sequelize } from './server/core/db/SequelizeConnector';
import './server/core/models/index';
import { configuraRelazioni } from './server/core/models/relazioni';

async function main() {
  await sequelize.authenticate();
  console.log('[bootstrap] connesso a PostgreSQL');
  try { configuraRelazioni(); console.log('[bootstrap] relazioni configurate'); }
  catch (e) { console.log('[bootstrap] relazioni: ' + (e as Error).message); }

  const modelli = Object.keys(sequelize.models);
  console.log('[bootstrap] modelli registrati: ' + modelli.length);

  let ok = 0, ko = 0;
  // due passate: la seconda risolve le dipendenze fra chiavi esterne
  for (const passata of [1, 2]) {
    for (const nome of modelli) {
      try { await sequelize.models[nome].sync({ alter: false, logging: false }); if (passata === 2) ok++; }
      catch (e) { if (passata === 2) { ko++; console.log('[ko] ' + nome + ': ' + (e as Error).message.slice(0, 110)); } }
    }
  }
  console.log(`[bootstrap] passata finale: ${ok} riusciti, ${ko} falliti`);
  await sequelize.close();
  process.exit(0);
}
main().catch(e => { console.error('[fatale]', e); process.exit(1); });
