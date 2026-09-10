import cron from 'node-cron';
import { log } from '../logger/index.js';
import { AuditLogRepository } from '../repositories/AuditLogRepository.js';

// ============================================================================
// CRON JOB PER CLEANUP AUTOMATICO DELL'AUDIT LOG
// ============================================================================

const RETENTION_DAYS = 90;

/**
 * Avvia il cron job per la pulizia automatica dei record audit_log.
 *
 * Schedule: Ogni giorno alle 2:30 AM (Europe/Rome)
 * Retention: 90 giorni
 */
export const startAuditLogCleanupJob = () => {
  const job = cron.schedule('30 2 * * *', async () => {
    log.info('Avvio cleanup automatico audit log...');

    try {
      const repo = new AuditLogRepository();
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

      const deleted = await repo.deleteOlderThan(cutoff);

      log.info('Cleanup audit log completato', {
        deletedRecords: deleted,
        retentionDays: RETENTION_DAYS,
        cutoffDate: cutoff.toISOString(),
      });
    } catch (error) {
      log.error('Errore durante cleanup audit log', error instanceof Error ? error : new Error(String(error)));
    }
  }, {
    timezone: 'Europe/Rome'
  });

  log.info('Cron job cleanup audit log configurato', {
    schedule: '30 2 * * * (ogni giorno alle 2:30 AM)',
    timezone: 'Europe/Rome',
    retention: `${RETENTION_DAYS} giorni`,
  });

  return job;
};
