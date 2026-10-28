#!/usr/bin/env node

import { initializeDatabase, sequelize } from '../db';
import { applicaMigrazioni, leggiImpostazioniAvvio } from '../db/migrazioni/applicaMigrazioni';
import { stampaStato, stampaVerifica } from '../db/migrazioni/cli';
import { TABELLA_STORICO } from '../db/migrazioni/fileMigrazioni';
import { preparaOggettiDerivati, rimuoviOggettiDerivati } from '../db/migrazioni/oggettiDerivati';
import { descriviSchemaModelli } from '../db/migrazioni/schemaModelli';
import { Colorize } from '../../../lib/Colorize';
import { program } from 'commander';
import fs from 'fs/promises';
import path from 'path';


// In ambiente ES Modules, __dirname non è definito come in CommonJS.
// Un modo corretto per ottenerlo è il seguente:
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Solo in sviluppo: elimina tabelle dei modelli, enum e storico delle migrazioni, cosi' la
 * sync successiva riparte dalla baseline. Le altre tabelle (sessions, accessi_stato) restano.
 */
const azzeraSchemaSviluppo = async (): Promise<void> => {
  const descrizione = descriviSchemaModelli();
  await rimuoviOggettiDerivati(sequelize);
  for (const tabella of [...Object.keys(descrizione.tabelle), TABELLA_STORICO]) {
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

program
  .command('migrate-lowercase')
  .description('Migra tutte le colonne da camelCase a lowercase')
  .option('-d, --dry-run', 'Simula la migrazione senza eseguirla')
  .option('-v, --verify', 'Verifica solo lo stato della migrazione')
  .option('-r, --rollback', 'Annulla la migrazione e ripristina le tabelle originali')
  .action(async (options) => {
    try {
      console.log(Colorize.bgBlue('🔄 Avvio migrazione camelCase -> lowercase...'));
      
      
      const migrationsDir = path.join(__dirname, '../db/definitions/migrations');
      
      if (options.rollback) {
        console.log(Colorize.bgYellow('🔄 Esecuzione rollback...'));
        const rollbackPath = path.join(migrationsDir, 'rollback_migration.sql');
        const rollbackSql = await fs.readFile(rollbackPath, 'utf-8');
        
        if (options.dryRun) {
          console.log(Colorize.cyan('🔍 DRY RUN - Contenuto script rollback:'));
          console.log(rollbackSql);
          return;
        }
        
        await sequelize.query(rollbackSql);
        console.log(Colorize.bgGreen('✅ Rollback completato con successo!'));
        process.exit(0);
      }
      
      if (options.verify) {
        console.log(Colorize.bgCyan('🔍 Verifica stato migrazione...'));
        const verifyPath = path.join(migrationsDir, 'verify_migration.sql');
        const verifySql = await fs.readFile(verifyPath, 'utf-8');
        
        const results = await sequelize.query(verifySql);
        console.log(Colorize.bgGreen('✅ Verifica completata!'));
        console.log('Risultati:', results);
        process.exit(0);
      }
      
      // Esegui la migrazione principale
      console.log(Colorize.bgYellow('⚠️  ATTENZIONE: Questa operazione modificherà la struttura del database!'));
      console.log(Colorize.yellow('   Assicurati di aver fatto un backup prima di procedere.'));
      
      if (options.dryRun) {
        console.log(Colorize.cyan('🔍 DRY RUN - Simulazione migrazione...'));
        const migrationPath = path.join(migrationsDir, 'migrate_to_lowercase_columns.sql');
        const migrationSql = await fs.readFile(migrationPath, 'utf-8');
        console.log('Script che verrebbe eseguito:');
        console.log(migrationSql.substring(0, 500) + '...');
        console.log(Colorize.cyan('(Script troncato per brevità)'));
        return;
      }
      
      // Conferma prima di procedere
      console.log(Colorize.bgRed('🚨 CONFERMA RICHIESTA'));
      console.log('Questa operazione:');
      console.log('  - Creerà nuove tabelle con colonne lowercase');
      console.log('  - Migrerà tutti i dati esistenti');
      console.log('  - Sostituirà le tabelle originali');
      console.log('  - Manterrà le tabelle originali come backup (_old)');
      console.log('');
      console.log('Sei sicuro di voler procedere? (y/N)');
      
      // Per ora procediamo automaticamente, ma in produzione potresti voler chiedere conferma
      console.log(Colorize.green('Procedo automaticamente...'));
      
      const migrationPath = path.join(migrationsDir, 'migrate_to_lowercase_columns.sql');
      const migrationSql = await fs.readFile(migrationPath, 'utf-8');
      
      console.log(Colorize.cyan('📝 Esecuzione migrazione...'));
      const startTime = Date.now();
      
      await sequelize.query(migrationSql);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log(Colorize.bgGreen(`✅ Migrazione completata in ${duration}ms!`));
      console.log(Colorize.green('📋 Prossimi passi:'));
      console.log('  1. Verifica che l\'applicazione funzioni correttamente');
      console.log('  2. Aggiorna i modelli Sequelize con i nuovi nomi delle colonne');
      console.log('  3. Esegui: npm run initialize-models verify-migration');
      console.log('  4. Se tutto ok, elimina le tabelle _old (opzionale)');
      
      process.exit(0);
      
    } catch (error) {
      console.error(Colorize.bgRed('💥 Errore durante la migrazione:'), error);
      console.log(Colorize.yellow('💡 Suggerimento: Usa --rollback per annullare la migrazione'));
      process.exit(1);
    }
  });

program
  .command('verify-migration')
  .description('Verifica lo stato della migrazione lowercase')
  .action(async () => {
    try {
      await initializeDatabase();
      
      const migrationsDir = path.join(__dirname, '../db/definitions/migrations');
      const verifyPath = path.join(migrationsDir, 'verify_migration.sql');
      const verifySql = await fs.readFile(verifyPath, 'utf-8');
      
      console.log(Colorize.bgCyan('🔍 Verifica stato migrazione...'));
      
      const results = await sequelize.query(verifySql);
      
      console.log(Colorize.bgGreen('✅ Verifica completata!'));
      console.log('Risultati della verifica:');
      console.log(results);
      
      process.exit(0);
      
    } catch (error) {
      console.error(Colorize.bgRed('💥 Errore durante la verifica:'), error);
      process.exit(1);
    }
  });

// Avvia il programma
program.parse(); 