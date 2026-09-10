import { useEffect, useRef } from 'react';
import { ServerCall } from '../../lib/server_call';

const PING_INTERVAL = 5 * 60 * 1000; // 5 minuti
const ACTIVITY_THRESHOLD = 10 * 60 * 1000; // 10 minuti

/**
 * Hook per mantenere attiva la sessione tramite ping automatico
 * Traccia l'attività utente e invia ping periodici solo se l'utente è attivo
 *
 * @param isAuthenticated - Indica se l'utente è autenticato
 */
export const useSessionKeepAlive = (isAuthenticated: boolean) => {
  const lastUserActivityRef = useRef<number>(Date.now());
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Traccia l'attività utente
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const updateActivity = () => {
      lastUserActivityRef.current = Date.now();
    };

    // Eventi che indicano attività utente
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];

    events.forEach(event => {
      window.addEventListener(event, updateActivity);
    });

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, updateActivity);
      });
    };
  }, [isAuthenticated]);

  // Ping periodico
  useEffect(() => {
    if (!isAuthenticated) {
      // Pulisci l'intervallo se l'utente non è più autenticato
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      return;
    }

    const doPing = async () => {
      const timeSinceActivity = Date.now() - lastUserActivityRef.current;

      // Invia ping solo se l'utente è stato attivo recentemente
      if (timeSinceActivity < ACTIVITY_THRESHOLD) {
        try {
          await ServerCall.get('/promo/ping');
          console.log('[useSessionKeepAlive] Ping sent successfully');
        } catch (error) {
          // Se ricevi 401, la sessione è scaduta e verrà gestita da handleUnauthorized
          // Non serve fare altro qui
          if (error && typeof error === 'object' && 'status' in error && error.status === 401) {
            console.log('[useSessionKeepAlive] Session expired, stopping keep-alive');
            if (pingIntervalRef.current) {
              clearInterval(pingIntervalRef.current);
              pingIntervalRef.current = null;
            }
          } else {
            console.error('[useSessionKeepAlive] Ping failed:', error);
          }
        }
      } else {
        console.log('[useSessionKeepAlive] Skipping ping, user inactive for', Math.round(timeSinceActivity / 60000), 'minutes');
      }
    };

    // Invia il primo ping immediatamente (se l'utente è attivo)
    doPing();

    // Configura l'intervallo per i ping successivi
    pingIntervalRef.current = setInterval(doPing, PING_INTERVAL);

    return () => {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
    };
  }, [isAuthenticated]);
};
