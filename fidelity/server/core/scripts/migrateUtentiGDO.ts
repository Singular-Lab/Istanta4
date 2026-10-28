#!/usr/bin/env node

import { program } from 'commander';
import { Op, Transaction } from 'sequelize';
import { TIPO_UTENTI } from '../../../lib/enums';
import { Colorize } from '../../../lib/Colorize';
import { initializeDatabase, sequelize } from '../db';
import { eseguiScriptDati, SCRIPT_DATI } from '../db/migrazioni/scriptDati';
import { GDO, Utente, UtentiGDO } from '../models';

interface RiepilogoUtentiGdo {
  gdo: string;
  utentiTotali: number;
  utentiSenzaGdo: number;
  creati: number;
}

/**
 * Non ripetibile: rilanciato assegnerebbe alla GDO scelta anche gli utenti creati da allora senza
 * GDO, che potrebbero appartenere a un'altra. Le scritture e il refresh della materialized view
 * stanno nella transazione del registro: si confermano solo insieme alla registrazione.
 */
const migraUtentiGdo = async (
  transaction: Transaction,
  opzioni: { dryRun: boolean; gdoId?: string }
): Promise<RiepilogoUtentiGdo> => {
  // Trova la GDO target
  let targetGdoId = opzioni.gdoId;
  if (!targetGdoId) {
    const defaultGdo = await GDO.findOne({ order: [['createdat', 'ASC']], transaction });
    if (!defaultGdo) throw new Error('Nessuna GDO trovata nel sistema. Impossibile procedere con la migrazione.');
    targetGdoId = defaultGdo.id_gdo;
    console.log(`GDO di default selezionata: ${(defaultGdo as any).nome_gdo} (${targetGdoId})`);
  } else {
    const gdoExists = await GDO.findOne({ where: { id_gdo: targetGdoId }, transaction });
    if (!gdoExists) throw new Error(`GDO con ID ${targetGdoId} non trovata.`);
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
    }],
    transaction
  });

  const utentiSenzaGDO = utentiDaMigrare.filter(
    (u: any) => !u.utenti_gdo || u.utenti_gdo.length === 0
  );
  const riepilogo: RiepilogoUtentiGdo = {
    gdo: targetGdoId,
    utentiTotali: utentiDaMigrare.length,
    utentiSenzaGdo: utentiSenzaGDO.length,
    creati: 0,
  };

  console.log(`\nTrovati ${utentiSenzaGDO.length} utenti senza associazione GDO su ${utentiDaMigrare.length} totali\n`);

  if (utentiSenzaGDO.length === 0) {
    console.log(Colorize.bgGreen('Nessun utente da migrare. Tutti gli utenti hanno gia un record in utenti_gdo.'));
    return riepilogo;
  }

  if (opzioni.dryRun) {
    console.log(Colorize.bgYellow('[DRY-RUN] Le seguenti modifiche verrebbero applicate:\n'));
    for (const utente of utentiSenzaGDO) {
      console.log(`  [DRY-RUN] Creazione utenti_gdo per: ${(utente as any).email_utenti} (${(utente as any).tipo_utenti})`);
    }
    console.log(`\n[DRY-RUN] Totale: ${utentiSenzaGDO.length} record da creare`);
    return riepilogo;
  }

  for (const utente of utentiSenzaGDO) {
    await UtentiGDO.create({
      id_utente_utentegdo: (utente as any).id_utenti,
      id_gdo_utentegdo: targetGdoId,
    }, { transaction });
    console.log(`  Creato utenti_gdo per: ${(utente as any).email_utenti} (${(utente as any).tipo_utenti})`);
    riepilogo.creati++;
  }

  // Aggiorna la materialized view
  console.log('\nAggiornamento materialized view mv_utenti_completi...');
  await sequelize.query('REFRESH MATERIALIZED VIEW mv_utenti_completi;', { transaction });

  return riepilogo;
};

program
  .name('migrate-utenti-gdo')
  .description(
    'Migra tutti gli utenti non-SUPERADMIN esistenti per avere un record in utenti_gdo. ' +
    'Una volta sola: una seconda esecuzione viene rifiutata, salvo --forza.'
  )
  .version('1.0.0')
  .option('--dry-run', 'Mostra le modifiche senza applicarle')
  .option('--gdo-id <id>', 'UUID specifico della GDO a cui associare gli utenti (default: prima GDO disponibile)')
  .option('--forza', 'Riesegue anche se il registro dice che e\' gia\' stato eseguito')
  .action(async (options) => {
    const dryRun = !!options.dryRun;
    try {
      console.log(Colorize.bgBlue('Avvio migrazione utenti_gdo...'));

      await initializeDatabase(false);

      const riepilogo = await eseguiScriptDati(
        { ...SCRIPT_DATI.utentiGdo, dryRun, forza: !!options.forza },
        transaction => migraUtentiGdo(transaction, { dryRun, gdoId: options.gdoId })
      );

      if (!riepilogo) {
        console.log(Colorize.bgYellow('Migrazione gia\' eseguita: nessuna modifica (yarn script-dati:stato)'));
      } else if (!dryRun && riepilogo.creati > 0) {
        console.log(Colorize.bgGreen(`\nMigrazione completata con successo. ${riepilogo.creati} utenti migrati.`));
      }
      await sequelize.close();
      process.exit(0);
    } catch (error) {
      // Tutto in una transazione: annullata, nessun utente associato
      console.error(Colorize.bgRed('Migrazione fallita, transazione annullata:'), error);
      await sequelize.close().catch(() => undefined);
      process.exit(1);
    }
  });

program.parse();
