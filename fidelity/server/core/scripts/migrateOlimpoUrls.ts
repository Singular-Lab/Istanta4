#!/usr/bin/env node

import { program } from 'commander';
import { Model, ModelStatic } from 'sequelize';
import { Colorize } from '../../../lib/Colorize';
import { initializeDatabase, sequelize } from '../db';
import { Config } from '../models/config';
import { HubService } from '../models/hub_service';
import { Ricette as RicetteModel } from '../models/ricette';
import { WorkspaceWebpliant } from '../models/workspace_webpliant';
import { riscriviUrlOlimpo } from '../utils/urlOlimpo';

/** Colonne JSON che contengono URL Olimpo mostrati nel browser. */
const COLONNE: Array<{ modello: ModelStatic<Model>; colonna: string }> = [
  { modello: HubService as unknown as ModelStatic<Model>, colonna: 'meta' },
  { modello: Config as unknown as ModelStatic<Model>, colonna: 'webpliant' },
  { modello: WorkspaceWebpliant as unknown as ModelStatic<Model>, colonna: 'webpliant' },
  { modello: RicetteModel as unknown as ModelStatic<Model>, colonna: 'foto_ricetta' },
];

program
  .name('migrate-olimpo-urls')
  .description(
    'Riscrive gli URL assoluti di Olimpo salvati nel DB (http://host/foto/..., /materiali/...) ' +
    'nella forma relativa /olimpo/..., servita dal proxy di Fidelity e raggiungibile dal browser.'
  )
  .option('--dry-run', 'Mostra le modifiche senza applicarle')
  .action(async (options) => {
    const isDryRun = !!options.dryRun;
    try {
      console.log(Colorize.bgBlue('Avvio migrazione URL Olimpo...'));
      if (isDryRun) console.log(Colorize.bgYellow('[DRY RUN] Nessuna modifica verra applicata'));

      await initializeDatabase();

      let totaleRighe = 0;
      let totaleUrl = 0;
      for (const { modello, colonna } of COLONNE) {
        await sequelize.transaction(async (transaction) => {
          const righe = await modello.findAll({ transaction });
          let righeCambiate = 0;
          for (const riga of righe) {
            const { valore, modifiche } = riscriviUrlOlimpo(riga.get(colonna));
            if (modifiche === 0) continue;
            righeCambiate++;
            totaleUrl += modifiche;
            console.log(`  ${modello.tableName} ${String(riga.get('id'))}.${colonna}: ${modifiche} URL`);
            if (!isDryRun) {
              await modello.update({ [colonna]: valore }, { where: { id: riga.get('id') }, transaction });
            }
          }
          totaleRighe += righeCambiate;
          console.log(`${modello.tableName}.${colonna}: ${righeCambiate} righe da aggiornare su ${righe.length}`);
        });
      }

      console.log(Colorize.bgGreen(
        `${isDryRun ? '[DRY RUN] ' : ''}Righe: ${totaleRighe}, URL riscritti: ${totaleUrl}`
      ));
      await sequelize.close();
      process.exit(0);
    } catch (error) {
      console.error(Colorize.bgRed('Migrazione URL Olimpo fallita'), error);
      await sequelize.close().catch(() => undefined);
      process.exit(1);
    }
  });

program.parse(process.argv);
