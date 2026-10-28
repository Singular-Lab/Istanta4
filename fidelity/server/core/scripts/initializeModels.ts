#!/usr/bin/env node

import { initializeDatabase, sequelize } from '../db';
import { applicaMigrazioni, leggiImpostazioniAvvio } from '../db/migrazioni/applicaMigrazioni';
import { stampaStato, stampaVerifica } from '../db/migrazioni/cli';
import { TABELLA_STORICO } from '../db/migrazioni/fileMigrazioni';
import { preparaOggettiDerivati, rimuoviOggettiDerivati } from '../db/migrazioni/oggettiDerivati';
import { descriviSchemaModelli } from '../db/migrazioni/schemaModelli';
import { TABELLA_SCRIPT_DATI } from '../db/migrazioni/scriptDati';
import { Colorize } from '../../../lib/Colorize';
import { program } from 'commander';

/**
 * Solo in sviluppo: elimina tabelle dei modelli, enum e storico delle migrazioni, cosi' la
 * sync successiva riparte dalla baseline. Anche il registro degli script di dati: i dati che
 * descrive non ci sono piu'. Le altre tabelle (sessions, accessi_stato) restano.
 */
const azzeraSchemaSviluppo = async (): Promise<void> => {
  const descrizione = descriviSchemaModelli();
  await rimuoviOggettiDerivati(sequelize);
  for (const tabella of [...Object.keys(descrizione.tabelle), TABELLA_STORICO, TABELLA_SCRIPT_DATI]) {
    await sequelize.query(`DROP TABLE IF EXISTS "${tabella}" CASCADE`);
  }
  for (const nome of Object.keys(descrizione.enum)) {
    await sequelize.query(`DROP TYPE IF EXISTS "${nome}" CASCADE`);
  }
};

// Configurazione CLI
program
  .name('initialize-models')
  .description('Schema del database di Fidelity: migrazioni versionate (server/core/db/migrazioni)')
  .version('2.0.0');

program
  .command('sync')
  .description('Applica le migrazioni pendenti (come all\'avvio del server, con lo stesso lock e lo stesso storico)')
  .option('-f, --force', 'Solo in sviluppo: elimina tabelle e storico e riparte dalla baseline (CANCELLA I DATI!)')
  .option('-a, --alter', 'Ignorata: lo schema cambia solo con le migrazioni')
  .option('-l, --logging', 'Ignorata')
  .option('-d, --drop', 'Come --force')
  .action(async (options) => {
    try {
      const azzera = Boolean(options.force || options.drop);
      // NODE_ENV esplicito: senza, config vale development e il force passerebbe in produzione
      if (azzera && process.env.NODE_ENV !== 'development') {
        console.error(Colorize.bgRed('--force e --drop sono ammessi solo con NODE_ENV=development'));
        process.exit(1);
      }

      // Nel container questo comando gira a ogni avvio: vale lo stesso interruttore del server
      const impostazioni = leggiImpostazioniAvvio();
      for (const avviso of impostazioni.avvisi) console.warn(Colorize.yellow(avviso));
      if (!impostazioni.applica && !azzera) {
        console.warn(Colorize.yellow(`Migrazioni non applicate: ${impostazioni.variabile}=false (yarn migrazioni:applica per applicarle a mano)`));
        process.exit(0);
      }

      await initializeDatabase(false);

      if (azzera) {
        console.log(Colorize.bgRed('⚠️  MODALITÀ FORCE ATTIVA - I DATI VERRANNO PERSI!'));
        await new Promise(resolve => setTimeout(resolve, 3000)); // Pausa di sicurezza
        await azzeraSchemaSviluppo();
      }

      const esito = await applicaMigrazioni();
      console.log(esito.applicate.length > 0
        ? Colorize.green(`✅ Migrazioni applicate: ${esito.applicate.join(', ')}`)
        : Colorize.green('✅ Nessuna migrazione da applicare'));
      process.exit(0);

    } catch (error) {
      console.error(Colorize.bgRed('💥 Errore durante le migrazioni:'), error);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Migrazioni applicate e da applicare (come yarn migrazioni:stato)')
  .action(async () => {
    try {
      await initializeDatabase(false);
      await stampaStato();
      process.exit(0);
    } catch (error) {
      console.error(Colorize.bgRed('💥 Errore:'), error);
      process.exit(1);
    }
  });

program
  .command('check')
  .description('Confronta il database con i modelli, in sola lettura (come yarn migrazioni:verifica)')
  .action(async () => {
    try {
      await initializeDatabase(false);
      await stampaVerifica();
      process.exit(0);
    } catch (error) {
      console.error(Colorize.bgRed('💥 Errore:'), error);
      process.exit(1);
    }
  });

program
  .command('sync-db-objects')
  .description('Ricrea view e materialized view (oggetti derivati)')
  .action(async () => {
    try {
      await initializeDatabase(false);
      const { ricreati } = await preparaOggettiDerivati(sequelize, { forza: true });
      console.log(Colorize.green(`✅ Oggetti derivati ricreati: ${ricreati.join(', ') || 'nessuno'}`));
      process.exit(0);
    } catch (error) {
      console.error(Colorize.bgRed('💥 Errore durante la creazione degli oggetti DB:'), error);
      process.exit(1);
    }
  });

// Avvia il programma
program.parse(); 