import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import cron from 'node-cron';
import { Op } from 'sequelize';
import { Colorize } from '../../../lib/Colorize';
import { STATO_PROMO } from '../../../lib/enums';
import { wrapDatabaseError } from '../../../lib/errors';
import { startAttivitaCleanupJob } from '../cron/attivitaCleanupJob';
import { startAuditLogCleanupJob } from '../cron/auditLogCleanupJob';
import { PromoResponseDTO } from '../dto';
import { IChronService } from '../interfaces/IChronService';
import { log } from '../logger';
import { Promo } from '../models/promo';
import { PluginAnalyticsEvent } from '../models/plugin_analytics_event';
import { getWhatsappQueueWorker } from '../workers/WhatsappQueueWorker';
dayjs.extend(isBetween);
export class ChronService implements IChronService {

  /**
   * Avvia tutti i cron job definiti nel servizio.
   * Questo metodo dovrebbe essere chiamato una sola volta all'avvio del server.
   */
  startAllJobs(): void {
    log.info('⏰ Avvio di tutti i cron job...');
    this.startPromoCronJob();
    this.startControlloRicetteCronJob();
    this.startWhatsappQueueWorker();
    this.startAttivitaCleanupJob();
    this.startPluginAnalyticsCleanupJob();
    this.startAuditLogCleanupJob();
    log.info('✅ Tutti i cron job sono stati avviati.');
  }

  /**
   * Avvia il cron job per la pulizia delle attività/notifiche scadute
   */
  private startAttivitaCleanupJob(): void {
    try {
      startAttivitaCleanupJob();
      log.info('   -> Job per cleanup attività scadute schedulato (ogni giorno alle 4:00 AM)');
    } catch (error) {
      log.error(Colorize.bgRed('Errore avvio Attività Cleanup Job:'), error);
    }
  }

  /**
   * Avvia il cron job per la pulizia dei record audit_log (retention 90 giorni)
   */
  private startAuditLogCleanupJob(): void {
    try {
      startAuditLogCleanupJob();
      log.info('   -> Job per cleanup audit log schedulato (ogni giorno alle 2:30 AM)');
    } catch (error) {
      log.error(Colorize.bgRed('Errore avvio Audit Log Cleanup Job:'), error);
    }
  }

  startPromoCronJob(): void {
    // Esegue il task ogni 5 minuti
    cron.schedule('*/5 * * * *', async () => {
      log.debug(Colorize.bgBlue('Running job: Sincronizzazione stati promozioni...'));
      try {
        const promos = await this.getAllPromo();
        if (Array.isArray(promos)) {
          for (const promo of promos) {
            const nextState = this.determineAutomaticState(promo);
            if (!nextState || nextState === promo.stato) {
              continue;
            }

            const result = await this.updateStatoPromo(promo.id, nextState);
            if (result) {
              log.info(
                Colorize.green(
                  `Promo ${promo.id} sincronizzata: ${promo.stato} -> ${nextState}.`
                )
              );
            } else {
              log.warn(Colorize.yellow(`Stato invariato per la promo ${promo.id}.`));
            }
          }
        }
        log.debug(Colorize.bgGreen('Finished job: Sincronizzazione stati promozioni.'));
      } catch (error) {
        log.error(Colorize.bgRed('Error in startPromoCronJob:'), error);
        // Non rilanciare l'errore per non bloccare il processo del server
      }
    });
    log.info('   -> Job per sincronizzazione stati promo schedulato (ogni 5 minuti).');
  }

  private startControlloRicetteCronJob(): void {
    // Qui la logica per il controllo delle ricette
    log.info("   -> Job per controllo ricette (non implementato) schedulato.");
  }

  /**
   * Avvia il worker per la coda di messaggi WhatsApp
   * Il worker processa automaticamente i job PENDING ogni 6 secondi (10 messaggi al minuto)
   */
  private startWhatsappQueueWorker(): void {
    try {
      const worker = getWhatsappQueueWorker({
        concurrency: 10, // 10 messaggi alla volta
        pollIntervalMs: 6000, // Ogni 6 secondi = ~100 messaggi al minuto
        baseBackoffMs: 30000, // Retry dopo 30 secondi in caso di errore
        simulationMode: false, // 📡 MODALITÀ LIVE - Invio messaggi reali
      });

      worker.start();
      log.info('   -> WhatsApp Queue Worker avviato (modalità LIVE - ~100 messaggi/minuto)');
    } catch (error) {
      log.error(Colorize.bgRed('Errore avvio WhatsApp Queue Worker:'), error);
    }
  }

  async updateStatoPromo(guidId: string, stato: STATO_PROMO): Promise<boolean> {
    try {
      const result = await Promo.update(
        { stato: stato },
        {
          where: {
            id_promo: guidId,
            stato: { [Op.ne]: stato }
          }
        }
      );
      // `modifiedCount` è > 0 se un documento è stato effettivamente modificato.
      return result[0] > 0;
    } catch (error) {
      log.error(Colorize.bgRed(`Error updating promo status for ${guidId}:`), error);
      // Non rilanciare l'errore qui per permettere al job di continuare con le altre promo
      return false;
    }
  }

  private determineAutomaticState(promo: PromoResponseDTO): STATO_PROMO | null {
    const now = dayjs();
    const validitaDal = promo.validita_dal ? dayjs(promo.validita_dal) : null;
    const validitaAl = promo.validita_al ? dayjs(promo.validita_al) : null;
    const dataScadenza = promo.data_scadenza ? dayjs(promo.data_scadenza) : null;

    if (validitaAl && now.isAfter(validitaAl, 'day')) {
      return promo.stato !== STATO_PROMO.ARCHIVIATA ? STATO_PROMO.ARCHIVIATA : null;
    }

    if (validitaDal && validitaAl && now.isBetween(validitaDal, validitaAl, 'day', '[]')) {
      if (promo.stato === STATO_PROMO.VALIDA_CON_ERRORI) {
        return null;
      }
      return promo.stato !== STATO_PROMO.VALIDA ? STATO_PROMO.VALIDA : null;
    }

    if (dataScadenza && now.isAfter(dataScadenza, 'day')) {
      return promo.stato !== STATO_PROMO.IN_RITARDO ? STATO_PROMO.IN_RITARDO : null;
    }

    if (dataScadenza) {
      const daysUntilExpiry = dataScadenza.diff(now, 'day');
      if (daysUntilExpiry <= 7 && daysUntilExpiry >= 0) {
        return promo.stato !== STATO_PROMO.IN_SCADENZA ? STATO_PROMO.IN_SCADENZA : null;
      }
    }

    return null;
  }

  /**
   * Avvia il cron job per la pulizia degli eventi analytics del plugin
   * Esegue ogni giorno alle 4:30 AM (Europe/Rome), elimina eventi piu' vecchi di 90 giorni
   */
  private startPluginAnalyticsCleanupJob(): void {
    try {
      cron.schedule('30 4 * * *', async () => {
        log.debug(Colorize.bgBlue('Running job: Pulizia eventi plugin analytics...'));
        try {
          const retentionDays = 90;
          const cutoffDate = dayjs().subtract(retentionDays, 'day').toDate();

          const deleted = await PluginAnalyticsEvent.destroy({
            where: {
              timestamp_event: { [Op.lt]: cutoffDate },
            },
          });

          if (deleted > 0) {
            log.info(Colorize.green(`Plugin Analytics Cleanup: ${deleted} eventi eliminati (> ${retentionDays} giorni)`));
          }
          log.debug(Colorize.bgGreen('Finished job: Pulizia eventi plugin analytics.'));
        } catch (error) {
          log.error(Colorize.bgRed('Error in pluginAnalyticsCleanupJob:'), error);
        }
      }, { timezone: 'Europe/Rome' });

      log.info('   -> Job per cleanup plugin analytics schedulato (ogni giorno alle 4:30 AM)');
    } catch (error) {
      log.error(Colorize.bgRed('Errore avvio Plugin Analytics Cleanup Job:'), error);
    }
  }

  async getAllPromo(): Promise<PromoResponseDTO[]> {
    try {
      const result = await Promo.findAll({
        where: {
          stato: {
            [Op.ne]: STATO_PROMO.ELIMINATA,
          },
        },
      });
      // adesso facciamo in modo di controllare se la promo presenta dei kit collegati

      return result.map(promo => {
        const dataScadenza = promo.data_scadenza ? dayjs(promo.data_scadenza) : null;
        const validitaDal = promo.validita_dal ? dayjs(promo.validita_dal) : null;
        const validitaAl = promo.validita_al ? dayjs(promo.validita_al) : null;

        return {
          id: promo.id_promo,
          nome: promo.nome_promo,
          data_scadenza: promo.data_scadenza ?? null,
          data_registrazione: promo.data_registrazione ?? null,
          validita_dal: promo.validita_dal ?? null,
          validita_al: promo.validita_al ?? null,
          stato: promo.stato,
          offset_visibilita: promo.offset_visibilita,
          context: promo.context,
          gdo: promo.gdo,
          is_active: Boolean(validitaDal && validitaAl && dayjs().isBetween(validitaDal, validitaAl, null, '[]')),
          is_expired: Boolean(dataScadenza && dayjs().isAfter(dataScadenza)),
          days_until_expiry: dataScadenza ? dataScadenza.diff(dayjs(), 'day') : null,
          days_since_start: validitaDal ? dayjs().diff(validitaDal, 'day') : null
        } as PromoResponseDTO;
      });
    } catch (error) {
      log.error(Colorize.bgRed('Error getting all promos:'), error);
      throw wrapDatabaseError(error, {
        message: 'Error retrieving all promos',
        operation: 'find',
        entity: 'Promo',
      });
    }
  }
}
