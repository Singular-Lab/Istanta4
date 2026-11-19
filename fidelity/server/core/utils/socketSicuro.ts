import { log } from '../logger';

/**
 * Strumenti per i gestori del canale in tempo reale (ws-server.ts), che girano nel primary: un errore
 * che sfugge li' non deve fermare Fidelity (spec processi-in-produzione, "Richieste e messaggi
 * malformati non fermano Fidelity"). I dati che arrivano da un client sono qualunque cosa il client
 * abbia mandato: si leggono solo dopo averli controllati.
 */

const MASSIMO_TESTO = 200;

/**
 * Il campo `campo` del messaggio, cosi' com'e', se e' un testo non vuoto e non troppo lungo;
 * altrimenti null.
 */
export function campoTesto(messaggio: unknown, campo: string, massimo: number = MASSIMO_TESTO): string | null {
  if (typeof messaggio !== 'object' || messaggio === null) return null;
  const valore = (messaggio as Record<string, unknown>)[campo];
  if (typeof valore !== 'string') return null;
  return valore.trim() && valore.length <= massimo ? valore : null;
}

/**
 * Percorso e parametri di una richiesta di upgrade. La base e' fissa: l'intestazione Host la decide
 * il client e un valore come "x:99999" farebbe lanciare `new URL`. Null se l'indirizzo non si legge.
 */
export function leggiIndirizzoUpgrade(url: string | undefined): { percorso: string; parametri: URLSearchParams } | null {
  try {
    const letto = new URL(url || '/', 'http://fidelity.invalid');
    return { percorso: letto.pathname, parametri: letto.searchParams };
  } catch {
    return null;
  }
}

/**
 * Avvolge un gestore di evento del socket: un errore, anche di una promise, finisce nel log con il
 * nome dell'evento invece di diventare un'eccezione non gestita del processo.
 */
export function gestoreProtetto<A extends unknown[]>(evento: string, gestore: (...argomenti: A) => unknown): (...argomenti: A) => void {
  return (...argomenti: A) => {
    try {
      const esito = gestore(...argomenti);
      if (esito && typeof (esito as Promise<unknown>).then === 'function') {
        (esito as Promise<unknown>).catch((errore: unknown) => {
          log.warn(`WebSocket: gestore "${evento}" non riuscito`, { errore: errore instanceof Error ? errore.message : String(errore) });
        });
      }
    } catch (errore) {
      log.warn(`WebSocket: gestore "${evento}" non riuscito`, { errore: errore instanceof Error ? errore.message : String(errore) });
    }
  };
}
