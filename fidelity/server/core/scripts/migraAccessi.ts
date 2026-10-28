#!/usr/bin/env node

import { program } from 'commander';
import { Colorize } from '../../../lib/Colorize';
import { calcolaPianoMigrazione, descriviPiano, preparaAccessiAllAvvio } from '../accessi/migrazioneAccessi';
import { initializeDatabase, sequelize } from '../db';
import { eseguiScriptDati, SCRIPT_DATI } from '../db/migrazioni/scriptDati';

program
  .name('migra-accessi')
  .description(
    'Porta i permessi al modello per aree: concede l\'accesso alle aree dove oggi le pagine ' +
    'compaiono nel menu dei ruoli, collega i menu ai sotto-ruoli GDO per id e toglie i vecchi ' +
    'permessi pagina.*. Gira anche da sola all\'avvio del server; qui serve a vedere prima cosa cambia.'
  )
  .option('--dry-run', 'Mostra il report senza applicare nulla')
  .action(async (options) => {
    try {
      await initializeDatabase(false);
      const dryRun = !!options.dryRun;
      // Ripetibile: preparaAccessiAllAvvio migra solo uno schema degli accessi vecchio, altrimenti
      // allinea il catalogo. Il registro annota le esecuzioni da riga di comando, non quelle all'avvio
      await eseguiScriptDati({ ...SCRIPT_DATI.accessi, dryRun }, async (transaction) => {
        if (dryRun) {
          console.log(Colorize.bgYellow('[DRY RUN] Nessuna modifica verra applicata'));
          // Nessuna scrittura: il piano si legge nella transazione del registro, annullata in dry-run.
          console.log(descriviPiano(await calcolaPianoMigrazione(transaction)));
          return { dryRun };
        }
        await preparaAccessiAllAvvio();
        console.log(Colorize.bgGreen('Accessi preparati'));
        return { accessiPreparati: true };
      });
      await sequelize.close();
      process.exit(0);
    } catch (error) {
      console.error(Colorize.bgRed('Migrazione degli accessi non riuscita'), error);
      process.exit(1);
    }
  });

program.parse();
