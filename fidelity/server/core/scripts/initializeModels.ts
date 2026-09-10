#!/usr/bin/env node

import { modelliManager, ModelSyncOptions } from '../models';
import { initializeDatabase, sequelize } from '../db';
import { log } from '../logger';
import { Colorize } from '../../../lib/Colorize';
import { program } from 'commander';
import fs from 'fs/promises';
import path from 'path';


// In ambiente ES Modules, __dirname non è definito come in CommonJS.
// Un modo corretto per ottenerlo è il seguente:
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configurazione CLI
program
  .name('initialize-models')
  .description('Sistema di auto-generazione modelli Sequelize')
  .version('1.0.0');

program
  .command('sync')
  .description('Sincronizza tutti i modelli con il database')
  .option('-f, --force', 'Forza la ricreazione delle tabelle (CANCELLA I DATI!)')
  .option('-a, --alter', 'Permetti modifiche alla struttura delle tabelle', true)
  .option('-l, --logging', 'Abilita logging SQL dettagliato')
  .option('-d, --drop', 'Elimina tabelle prima di ricrearle')
  .action(async (options) => {
    try {
      console.log(Colorize.bgBlue('🚀 Avvio sincronizzazione modelli...'));
      
      // Inizializza database
      await initializeDatabase();
      
      // Opzioni di sincronizzazione
      const syncOptions: ModelSyncOptions = {
        force: options.force,
        alter: options.alter,
        logging: options.logging,
        drop: options.drop
      };

      if (options.force) {
        console.log(Colorize.bgRed('⚠️  MODALITÀ FORCE ATTIVA - I DATI VERRANNO PERSI!'));
        await new Promise(resolve => setTimeout(resolve, 3000)); // Pausa di sicurezza
      }
      
      // Sincronizza modelli
      const risultati = await modelliManager.sincronizzaTuttiIModelli(syncOptions);
      
      // Mostra riepilogo
      console.log('\n' + Colorize.bgGreen('📊 RIEPILOGO SINCRONIZZAZIONE'));
      console.log('='.repeat(50));
      
      risultati.forEach(risultato => {
        const status = risultato.successo ? '✅' : '❌';
        const tempo = `${risultato.tempo_ms}ms`;
        console.log(`${status} ${risultato.modello.padEnd(25)} ${tempo.padStart(8)} ${risultato.errore ? '- ' + risultato.errore : ''}`);
      });
      
      const successi = risultati.filter(r => r.successo).length;
      const errori = risultati.filter(r => !r.successo).length;
      
      console.log('='.repeat(50));
      console.log(Colorize.green(`✅ Successi: ${successi}`));
      if (errori > 0) {
        console.log(Colorize.red(`❌ Errori: ${errori}`));
      }
      
      process.exit(errori > 0 ? 1 : 0);
      
    } catch (error) {
      console.error(Colorize.bgRed('💥 Errore durante la sincronizzazione:'), error);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Mostra lo stato di sincronizzazione dei modelli')
  .action(async () => {
    try {
      await initializeDatabase();
      
      const stato = modelliManager.getStatoSincronizzazione();
      
      console.log(Colorize.bgBlue('📊 STATO MODELLI SEQUELIZE'));
      console.log('='.repeat(60));
      console.log(`Modelli totali: ${stato.modelli_totali}`);
      console.log(`Modelli sincronizzati: ${stato.modelli_sincronizzati}`);
      console.log(`Ultima sincronizzazione: ${stato.ultima_sincronizzazione || 'Mai'}`);
      console.log('='.repeat(60));
      
      stato.modelli.forEach(modello => {
        const status = modello.sincronizzato ? '✅' : '⏳';
        console.log(`${status} ${modello.nome.padEnd(25)} -> ${modello.tabella}`);
      });
      
      process.exit(0);
      
    } catch (error) {
      console.error(Colorize.bgRed('💥 Errore:'), error);
      process.exit(1);
    }
  });

program
  .command('check')
  .description('Verifica la connessione al database')
  .action(async () => {
    try {
      await initializeDatabase();
      
      const connessioneOk = await modelliManager.verificaConnessione();
      
      if (connessioneOk) {
        console.log(Colorize.bgGreen('✅ Database connesso correttamente!'));
        process.exit(0);
      } else {
        console.log(Colorize.bgRed('❌ Errore connessione database'));
        process.exit(1);
      }
      
    } catch (error) {
      console.error(Colorize.bgRed('💥 Errore:'), error);
      process.exit(1);
    }
  });

program
  .command('sync-db-objects')
  .description('Sincronizza oggetti DB custom (views, enums, etc) da file SQL')
  .action(async () => {
    try {

      const baseDir = path.join(__dirname, '../db/definitions');
      console.log(baseDir);
      const objectTypes = ['enums', 'views'];
      let totalSuccess = 0;
      let totalFailed = 0;

      for (const type of objectTypes) {
        const dirPath = path.join(baseDir, type);
        console.log(Colorize.cyan(`\nProcessing ${type} from ${dirPath}...`));
        try {
            const files = await fs.readdir(dirPath);
            for (const file of files) {
                if (file.endsWith('.sql')) {
                    const filePath = path.join(dirPath, file);
                    const sql = await fs.readFile(filePath, 'utf-8');
                    try {
                        await sequelize.query(sql);
                        console.log(`  ✅ ${file}`);
                        totalSuccess++;
                    } catch (error: any) {
                        console.error(`  ❌ ${file} - ${Colorize.red(error.message)}`);
                        totalFailed++;
                    }
                }
            }
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                console.log(Colorize.yellow(`  ⚠️ Directory non trovata: ${dirPath}, la salto.`));
            } else {
                throw error;
            }
        }
      }

      console.log('\n' + Colorize.bgGreen('📊 RIEPILOGO SINCRONIZZAZIONE OGGETTI DB'));
      console.log('='.repeat(50));
      console.log(Colorize.green(`✅ Successi: ${totalSuccess}`));
      if (totalFailed > 0) {
        console.log(Colorize.red(`❌ Errori: ${totalFailed}`));
      }
      console.log('='.repeat(50));

      process.exit(totalFailed > 0 ? 1 : 0);

    } catch (error) {
      console.error(Colorize.bgRed('💥 Errore durante la sincronizzazione degli oggetti DB:'), error);
      process.exit(1);
    }
  });

program
  .command('model <nome>')
  .description('Sincronizza un singolo modello')
  .option('-f, --force', 'Forza la ricreazione della tabella')
  .option('-a, --alter', 'Permetti modifiche alla struttura', true)
  .option('-l, --logging', 'Abilita logging SQL')
  .action(async (nome, options) => {
    try {
      await initializeDatabase();
      
      const risultato = await modelliManager.sincronizzaModello(nome, {
        force: options.force,
        alter: options.alter,
        logging: options.logging
      });
      
      if (risultato.successo) {
        console.log(Colorize.green(`✅ Modello ${nome} sincronizzato in ${risultato.tempo_ms}ms`));
        process.exit(0);
      } else {
        console.log(Colorize.red(`❌ Errore: ${risultato.errore}`));
        process.exit(1);
      }
      
    } catch (error) {
      console.error(Colorize.bgRed('💥 Errore:'), error);
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