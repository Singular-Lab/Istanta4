#!/usr/bin/env node

import { initializeDatabase, sequelize } from '../db';
import { Utente, UtentiGDO, GDO } from '../models';
import { TIPO_UTENTI } from '../../../lib/enums';
import { Op } from 'sequelize';
import { program } from 'commander';
import { Colorize } from '../../../lib/Colorize';

program
  .name('migrate-utenti-gdo')
  .description('Migra tutti gli utenti non-SUPERADMIN esistenti per avere un record in utenti_gdo')
  .version('1.0.0')
  .option('--dry-run', 'Mostra le modifiche senza applicarle')
  .option('--gdo-id <id>', 'UUID specifico della GDO a cui associare gli utenti (default: prima GDO disponibile)')
  .action(async (options) => {
    try {
      console.log(Colorize.bgBlue('Avvio migrazione utenti_gdo...'));

      await initializeDatabase();

      // Trova la GDO target
      let targetGdoId = options.gdoId;
      if (!targetGdoId) {
        const defaultGdo = await GDO.findOne({ order: [['createdat', 'ASC']] });
        if (!defaultGdo) {
          console.error(Colorize.bgRed('Nessuna GDO trovata nel sistema. Impossibile procedere con la migrazione.'));
          process.exit(1);
        }
        targetGdoId = defaultGdo.id_gdo;
        console.log(`GDO di default selezionata: ${(defaultGdo as any).nome_gdo} (${targetGdoId})`);
      } else {
        const gdoExists = await GDO.findOne({ where: { id_gdo: targetGdoId } });
        if (!gdoExists) {
          console.error(Colorize.bgRed(`GDO con ID ${targetGdoId} non trovata.`));
          process.exit(1);
        }
        console.log(`GDO target specificata: ${(gdoExists as any).nome_gdo} (${targetGdoId})`);
      }

      // Trova tutti gli utenti non-SUPERADMIN senza record in utenti_gdo
      const utentiDaMigrare = await Utente.findAll({
        where: {
          tipo_utenti: { [Op.notIn]: [TIPO_UTENTI.SUPERADMIN] }
        },
        include: [{
          model: UtentiGDO,
          as: 'utenti_gdo',
          required: false
        }]
      });

      const utentiSenzaGDO = utentiDaMigrare.filter(
        (u: any) => !u.utenti_gdo || u.utenti_gdo.length === 0
      );

      console.log(`\nTrovati ${utentiSenzaGDO.length} utenti senza associazione GDO su ${utentiDaMigrare.length} totali\n`);

      if (utentiSenzaGDO.length === 0) {
        console.log(Colorize.bgGreen('Nessun utente da migrare. Tutti gli utenti hanno gia un record in utenti_gdo.'));
        process.exit(0);
      }

      if (options.dryRun) {
        console.log(Colorize.bgYellow('[DRY-RUN] Le seguenti modifiche verrebbero applicate:\n'));
        for (const utente of utentiSenzaGDO) {
          console.log(`  [DRY-RUN] Creazione utenti_gdo per: ${(utente as any).email_utenti} (${(utente as any).tipo_utenti})`);
        }
        console.log(`\n[DRY-RUN] Totale: ${utentiSenzaGDO.length} record da creare`);
        process.exit(0);
      }

      // Esegui migrazione in transazione
      const transaction = await sequelize.transaction();
      try {
        let migratiCount = 0;
        for (const utente of utentiSenzaGDO) {
          await UtentiGDO.create({
            id_utente_utentegdo: (utente as any).id_utenti,
            id_gdo_utentegdo: targetGdoId,
          }, { transaction });
          console.log(`  Creato utenti_gdo per: ${(utente as any).email_utenti} (${(utente as any).tipo_utenti})`);
          migratiCount++;
        }

        // Aggiorna la materialized view
        console.log('\nAggiornamento materialized view mv_utenti_completi...');
        await sequelize.query('REFRESH MATERIALIZED VIEW mv_utenti_completi;', { transaction });

        await transaction.commit();
        console.log(Colorize.bgGreen(`\nMigrazione completata con successo. ${migratiCount} utenti migrati.`));
      } catch (error) {
        await transaction.rollback();
        console.error(Colorize.bgRed('Migrazione fallita, transazione annullata:'), error);
        process.exit(1);
      }

      process.exit(0);
    } catch (error) {
      console.error(Colorize.bgRed('Errore durante la migrazione:'), error);
      process.exit(1);
    }
  });

program.parse();
