import { sequelize } from './server/core/db';
import { MenuItemRepository } from './server/core/repositories/MenuItemRepository';
import { MenuService } from './server/core/services/MenuService';

async function main() {
  await sequelize.authenticate();
  console.log('[runner] connesso');
  const svc = new MenuService(new MenuItemRepository());
  await svc.seedMenuDaJson();
  console.log('[runner] seed menu completato');
  const conf = await svc.getAllMenuConfigurations();
  for (const [k, v] of Object.entries(conf)) console.log(`[runner] ${k}: ${v.length} voci`);
  await sequelize.close();
  process.exit(0);
}
main().catch(e => { console.error('[runner] errore:', e?.message || e); process.exit(1); });
