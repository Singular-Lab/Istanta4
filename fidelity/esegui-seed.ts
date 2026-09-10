import { seedHubData } from './server/core/scripts/seedHubData';
import { sequelize } from './server/core/db';

async function main() {
  await sequelize.authenticate();
  console.log('[runner] connesso, avvio seed');
  await seedHubData();
  console.log('[runner] seed terminato');
  await sequelize.close();
  process.exit(0);
}
main().catch(e => { console.error('[runner] errore:', e); process.exit(1); });
