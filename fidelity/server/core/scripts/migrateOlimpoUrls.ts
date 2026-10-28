#!/usr/bin/env node

import { program } from 'commander';
import { Model, ModelStatic, Op } from 'sequelize';
import { Colorize } from '../../../lib/Colorize';
import { initializeDatabase, sequelize } from '../db';
import { eseguiScriptDati, SCRIPT_DATI } from '../db/migrazioni/scriptDati';
import { Config } from '../models/config';
import { FilesRuntime } from '../models/files_runtime';
import { HubService } from '../models/hub_service';
import { Ricette as RicetteModel } from '../models/ricette';
import { WorkspaceWebpliant } from '../models/workspace_webpliant';
import { riscriviUrlOlimpo } from '../utils/urlOlimpo';
import { pianificaUrlFilesRuntime, type RigaUrlFileRuntime } from './migrazioneUrlFilesRuntime';

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
    'nella forma relativa /olimpo/..., servita dal proxy di Fidelity e raggiungibile dal browser. ' +
    'In files_runtime azzera url dove c\'e\' id_olimpo_cloud: l\'URL si ricostruisce alla lettura.'
  )
  .option('--dry-run', 'Mostra le modifiche senza applicarle')
  .action(async (options) => {
    const isDryRun = !!options.dryRun;
    try {
      console.log(Colorize.bgBlue('Avvio migrazione URL Olimpo...'));
      if (isDryRun) console.log(Colorize.bgYellow('[DRY RUN] Nessuna modifica verra applicata'));

      // false: nessun sync dello schema, nemmeno in development. Il dry-run non deve scrivere nulla
      await initializeDatabase(false);

      // Ripetibile: tocca solo gli URL non ancora riscritti. Il registro annota ogni esecuzione reale
      const esito = await eseguiScriptDati({ ...SCRIPT_DATI.urlOlimpo, dryRun: isDryRun }, async () => {
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

        // files_runtime.url: azzerato dove c'e' l'id Olimpo, riscritto in forma relativa dove manca
        let totaleAzzerati = 0;
        await sequelize.transaction(async (transaction) => {
          const righe = await FilesRuntime.findAll({
            attributes: ['id', 'url', 'id_olimpo_cloud'],
            where: { url: { [Op.ne]: null } },
            raw: true,
            transaction
          }) as unknown as RigaUrlFileRuntime[];
          const piano = pianificaUrlFilesRuntime(righe);
          for (const { id, url } of piano.aggiornamenti) {
            if (url !== null) console.log(`  files_runtime ${id}.url: 1 URL`);
          }
          totaleRighe += piano.aggiornamenti.length;
          totaleUrl += piano.riscritti;
          totaleAzzerati += piano.azzerati;
          console.log(
            `files_runtime.url: ${piano.azzerati} da azzerare (con id Olimpo), ${piano.riscritti} da riscrivere ` +
            `su ${righe.length} righe con URL`
          );
          if (isDryRun) return;
          const idsDaAzzerare = piano.aggiornamenti.filter(a => a.url === null).map(a => a.id);
          if (idsDaAzzerare.length > 0) {
            await FilesRuntime.update({ url: null }, { where: { id: { [Op.in]: idsDaAzzerare } }, transaction });
          }
          for (const { id, url } of piano.aggiornamenti) {
            if (url !== null) await FilesRuntime.update({ url }, { where: { id }, transaction });
          }
        });
        return { righe: totaleRighe, urlRiscritti: totaleUrl, urlAzzerati: totaleAzzerati };
      });

      console.log(Colorize.bgGreen(
        `${isDryRun ? '[DRY RUN] ' : ''}Righe: ${esito?.righe ?? 0}, URL riscritti: ${esito?.urlRiscritti ?? 0}, URL azzerati: ${esito?.urlAzzerati ?? 0}`
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
