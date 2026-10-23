#!/usr/bin/env node

import { program } from 'commander';
import { Colorize } from '../../../lib/Colorize';
import { initializeDatabase, sequelize } from '../db';
import { AuthProviderRepository } from '../repositories/AuthProviderRepository';
import { AuthProviderService } from '../services/AuthProviderService';
import { CODICE_EMAIL_PASSWORD } from '../services/authProviders/configurazioneProvider';

/**
 * Passaggio dei segreti dei metodi di accesso (client_secret OIDC, chiave privata SAML)
 * da chiaro a cifrato con FICO_SECRET, e ritorno in chiaro per il rollback.
 * Idempotente: un segreto gia' nello stato richiesto non viene toccato.
 */
program
  .name('cifra-segreti-provider')
  .description('Cifra con FICO_SECRET i segreti dei metodi di accesso salvati in chiaro')
  .option('--dry-run', 'Mostra i segreti che cambierebbero senza modificarli')
  .option('--decifra', 'Riporta in chiaro i segreti cifrati (rollback)')
  .option('--riattiva-email-password', 'Riattiva il metodo email e password (se nessun altro metodo funziona)')
  .action(async (options) => {
    const simulazione = !!options.dryRun;
    try {
      // false: nessun sync dello schema. Il dry-run non deve scrivere nulla
      await initializeDatabase(false);
      const repository = new AuthProviderRepository();

      if (options.riattivaEmailPassword) {
        const provider = await repository.findByCode(CODICE_EMAIL_PASSWORD);
        if (!provider) {
          console.log(Colorize.bgYellow(`Metodo ${CODICE_EMAIL_PASSWORD} assente: viene creato al prossimo avvio`));
        } else if (provider.attivo) {
          console.log(`Metodo ${CODICE_EMAIL_PASSWORD} gia' attivo`);
        } else if (simulazione) {
          console.log(Colorize.bgYellow(`[DRY RUN] Il metodo ${CODICE_EMAIL_PASSWORD} verrebbe riattivato`));
        } else {
          await repository.update(provider.id, { attivo: true });
          console.log(Colorize.bgGreen(`Metodo ${CODICE_EMAIL_PASSWORD} riattivato`));
        }
      }

      const modalita = options.decifra ? 'decifra' : 'cifra';
      const esito = await new AuthProviderService(repository).migraSegreti(modalita, simulazione);
      for (const { codice, campi } of esito.provider) {
        console.log(`  ${codice}: ${campi.join(', ')}`);
      }
      const azione = modalita === 'cifra' ? 'cifrati' : 'riportati in chiaro';
      console.log(Colorize.bgGreen(
        `${simulazione ? '[DRY RUN] ' : ''}Segreti ${azione}: ${esito.totaleCampi} in ${esito.provider.length} metodi di accesso`
      ));
      await sequelize.close();
      process.exit(0);
    } catch (error) {
      console.error(Colorize.bgRed('Migrazione dei segreti non riuscita'), error instanceof Error ? error.message : error);
      await sequelize.close().catch(() => undefined);
      process.exit(1);
    }
  });

program.parse(process.argv);
