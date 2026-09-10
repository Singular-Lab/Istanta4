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
 * Inizializza tutti i servizi di background necessari
 */
export const initializeBackgroundServices = (): void => {
  initializeScheduledJobs();
  // Seed dati di default per Hub (auth providers e servizi)
  //seedHubData().catch(err => log.error('Errore seed hub data:', err));
};
