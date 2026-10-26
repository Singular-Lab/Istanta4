import cron from 'node-cron';
import { log } from '../logger/index.js';
import { AttivitaService } from '../services/AttivitaService.js';

// ============================================================================
// CRON JOB PER CLEANUP AUTOMATICO DELLE ATTIVITÀ/NOTIFICHE SCADUTE
// ============================================================================

/**
 * Configurazione job di cleanup automatico per attività
 *
 * Schedule: Ogni giorno alle 4:00 AM
 * Retention basata su priorità:
 * - ALTA: 90 giorni
 * - MEDIA: 30 giorni
 * - BASSA: 7 giorni
 */
export const startAttivitaCleanupJob = () => {
  const attivitaService = new AttivitaService();

  // Esegue ogni giorno alle 4:00 AM
  const job = cron.schedule('0 4 * * *', async () => {
    log.info('🧹 Avvio cleanup automatico attività scadute...');

    try {
      const deletedCount = await attivitaService.cleanupExpiredAttivita();

      if (deletedCount > 0) {
        log.info('✓ Cleanup attività completato', {
          deletedCount,
          timestamp: new Date().toISOString()
        });
      } else {
        log.debug('✓ Nessuna attività scaduta da eliminare');
      }
    } catch (error) {
      log.error('❌ Errore durante cleanup attività automatico', error instanceof Error ? error : new Error(String(error)));
    }
  }, {
    timezone: 'Europe/Rome'
  });

  log.info('📅 Cron job cleanup attività configurato', {
    schedule: '0 4 * * * (ogni giorno alle 4:00 AM)',
    timezone: 'Europe/Rome',
    retention: {
      prioritaAlta: '90 giorni',
      prioritaMedia: '30 giorni',
      prioritaBassa: '7 giorni'
    }
  });

  return job;
};

/**
 * Cleanup manuale da eseguire on-demand
 */
export const cleanupAttivitaNow = async (): Promise<number> => {
  const attivitaService = new AttivitaService();

  try {
    log.info('🧹 Esecuzione cleanup attività manuale...');
    const deletedCount = await attivitaService.cleanupExpiredAttivita();
    log.info('✓ Cleanup attività manuale completato', { deletedCount });
    return deletedCount;
  } catch (error) {
    log.error('❌ Errore durante cleanup attività manuale', error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
};
