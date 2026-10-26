import cron from 'node-cron';
import { cleanupLogs } from '../scripts/cleanupLogs.js';
import { log } from '../logger/index.js';

// ============================================================================
// CRON JOB PER CLEANUP AUTOMATICO DEI LOG
// ============================================================================

/**
 * Configurazione job di cleanup automatico
 *
 * Schedule: Ogni giorno alle 3:00 AM
 * Retention:
 * - Combined: 7 giorni
 * - Error: 30 giorni
 * - HTTP: 3 giorni
 */
export const startLogCleanupJob = () => {
  // Esegue ogni giorno alle 3:00 AM
  const job = cron.schedule('0 3 * * *', () => {
    log.info('🧹 Avvio cleanup automatico log...');

    try {
      const stats = cleanupLogs({
        dryRun: false,
        maxAgeDays: {
          combined: 7,
          error: 30,
          http: 3
        },
        maxSizeMB: 500
      });

      log.info('✓ Cleanup log completato', {
        totalFiles: stats.totalFiles,
        deletedFiles: stats.deletedFiles,
        freedSpaceMB: (stats.freedSpace / (1024 * 1024)).toFixed(2),
        errors: stats.errors.length
      });

      if (stats.errors.length > 0) {
        log.warn('⚠️ Cleanup completato con errori', {
          errorCount: stats.errors.length,
          errors: stats.errors
        });
      }
    } catch (error) {
      log.error('❌ Errore durante cleanup log automatico', error instanceof Error ? error : new Error(String(error)));
    }
  }, {
    timezone: 'Europe/Rome'
  });

  log.info('📅 Cron job cleanup log configurato', {
    schedule: '0 3 * * * (ogni giorno alle 3:00 AM)',
    timezone: 'Europe/Rome',
    retention: {
      combined: '7 giorni',
      error: '30 giorni',
      http: '3 giorni'
    },
    maxTotalSize: '500 MB'
  });

  return job;
};

/**
 * Cleanup manuale da eseguire all'avvio del server (opzionale)
 * Solo se i log superano una certa dimensione
 */
export const cleanupOnStartup = async () => {
  try {
    log.info('🔍 Verifica necessità cleanup log all\'avvio...');

    const stats = cleanupLogs({
      dryRun: true, // Prima verifica cosa verrebbe eliminato
      maxAgeDays: {
        combined: 7,
        error: 30,
        http: 3
      },
      maxSizeMB: 500
    });

    // Se ci sono file da eliminare, esegui cleanup reale
    if (stats.deletedFiles > 0 || stats.totalSize > 500 * 1024 * 1024) {
      log.info('🧹 Cleanup necessario, esecuzione...', {
        filesToDelete: stats.deletedFiles,
        totalSizeMB: (stats.totalSize / (1024 * 1024)).toFixed(2)
      });

      cleanupLogs({
        dryRun: false,
        maxAgeDays: {
          combined: 7,
          error: 30,
          http: 3
        },
        maxSizeMB: 500
      });
    } else {
      log.info('✓ Log directory in buone condizioni, cleanup non necessario');
    }
  } catch (error) {
    log.error('❌ Errore durante cleanup all\'avvio', error instanceof Error ? error : new Error(String(error)));
  }
};
