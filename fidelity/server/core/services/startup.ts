import { log } from '../logger';
import { ChronService } from './ChronService';

/**
 * Modulo per l'inizializzazione automatica dei servizi al boot del server
 */

/**
 * Avvia automaticamente tutti i cron job necessari
 */
export const initializeScheduledJobs = (): void => {
  try {
    log.info('🔄 Inizializzazione servizi schedulati...');

    const chronService = new ChronService();
    chronService.startAllJobs(); // Chiama il metodo unificato

  } catch (error) {
    log.error('❌ Errore durante l\'avvio automatico dei cron job:', error);
    throw error; // Rilancia per bloccare l'avvio del server in caso di errore critico qui
  }
};

/**
 * In cluster cron e coda WhatsApp girano solo nel worker 1 (cluster.ts lo riforka con lo stesso indice);
 * senza cluster (sviluppo) WORKER_INDEX manca e partono come sempre.
 */
export const deveAvviareServiziBackground = (workerIndex = process.env.WORKER_INDEX): boolean =>
  (workerIndex ?? '1') === '1';

/**
 * Inizializza tutti i servizi di background necessari
 */
export const initializeBackgroundServices = (): void => {
  if (!deveAvviareServiziBackground()) {
    log.info(`Worker ${process.env.WORKER_INDEX}: servizi di background non avviati (girano solo nel worker 1)`);
    return;
  }
  initializeScheduledJobs();
  // Seed dati di default per Hub (auth providers e servizi)
  //seedHubData().catch(err => log.error('Errore seed hub data:', err));
};
