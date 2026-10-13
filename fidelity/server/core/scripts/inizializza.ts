#!/usr/bin/env node
/**
 * Prima inizializzazione dell'installazione (server/core/inizializzazione/inizializzaInstallazione.ts).
 * La esegue il compose di docker/fidelity-olimpo dopo models:sync e prima del server; in locale:
 *   yarn inizializza
 * Legge FIDELITY_ADMIN_EMAIL, FIDELITY_ADMIN_PASSWORD, FIDELITY_ADMIN_NOME, FIDELITY_ADMIN_COGNOME
 * e CLIENT_ID. Esce con 1 se un passo e' fallito, dopo aver eseguito comunque gli altri.
 */
import config from '../config';
import { closeDatabase, initializeDatabase } from '../db';
import { amministratoreDaAmbiente, inizializzaInstallazione } from '../inizializzazione/inizializzaInstallazione';

const SIMBOLI = { creato: '+', invariato: '=', saltato: '-', errore: '!' } as const;

async function main(): Promise<number> {
  // Lo schema lo allinea models:sync: qui solo la connessione.
  await initializeDatabase(false);
  try {
    const esiti = await inizializzaInstallazione({
      amministratore: amministratoreDaAmbiente(),
      clientId: config.CLIENT_ID,
    });
    console.log('[inizializza] Inizializzazione dell\'installazione');
    for (const e of esiti)
      console.log(`[inizializza]   ${SIMBOLI[e.esito]} ${e.passo.padEnd(36)} ${e.esito}: ${e.dettaglio}`);
    return esiti.some(e => e.esito === 'errore') ? 1 : 0;
  } finally {
    await closeDatabase();
  }
}

main()
  .then(codice => process.exit(codice))
  .catch(errore => {
    console.error('[inizializza] Inizializzazione non riuscita:', errore);
    process.exit(1);
  });
