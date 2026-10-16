#!/usr/bin/env node

import { program } from 'commander';
import { Colorize } from '../../../lib/Colorize';
import { calcolaPianoMigrazione, descriviPiano, preparaAccessiAllAvvio } from '../accessi/migrazioneAccessi';
import { initializeDatabase, sequelize } from '../db';

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
      if (options.dryRun) {
        console.log(Colorize.bgYellow('[DRY RUN] Nessuna modifica verra applicata'));
        // Nessuna scrittura: il piano si legge in una transazione annullata.
        const transaction = await sequelize.transaction();
        try {
          console.log(descriviPiano(await calcolaPianoMigrazione(transaction)));
        } finally {
          await transaction.rollback();
        }
      } else {
        await preparaAccessiAllAvvio();
        console.log(Colorize.bgGreen('Accessi preparati'));
      }
      await sequelize.close();
      process.exit(0);
    } catch (error) {
      console.error(Colorize.bgRed('Migrazione degli accessi non riuscita'), error);
      process.exit(1);
    }
  });

program.parse();
