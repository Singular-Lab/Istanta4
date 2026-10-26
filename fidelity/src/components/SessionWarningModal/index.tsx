import Button from '@/components/Base/Button';
import { Dialog } from '@/components/Base/Headless';
import Lucide from '@/components/Base/Lucide';
import { useEffect, useRef, useState } from 'react';
import { ServerCall } from '../../../lib/server_call';

const WARNING_THRESHOLD = 5 * 60 * 1000; // 5 minuti
const CHECK_INTERVAL = 10 * 1000; // 10 secondi
const COUNTDOWN_INTERVAL = 1000; // 1 secondo

interface SessionWarningModalProps {
  isAuthenticated: boolean;
  userType?: string | null;
}

/**
 * Modal che avvisa l'utente 5 minuti prima della scadenza della sessione
 * con countdown live e possibilità di estendere la sessione o fare logout
 */
export const SessionWarningModal: React.FC<SessionWarningModalProps> = ({
  isAuthenticated,
  userType
}) => {
  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const logoutTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Formatta il tempo rimanente in mm:ss
  const formatTime = (milliseconds: number): string => {
    const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Pulisce tutti gli intervalli e timeout
  const cleanupTimers = () => {
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
      checkIntervalRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (logoutTimeoutRef.current) {
      clearTimeout(logoutTimeoutRef.current);
      logoutTimeoutRef.current = null;
    }
  };

  // Gestisce il logout automatico
  const handleLogout = () => {
    console.log('[SessionWarningModal] Auto-logout triggered');
    cleanupTimers();
    setShowWarning(false);

    // Notifica le altre tab
    localStorage.setItem('logout', Date.now().toString());

    // Redirect al login
    window.location.href = '/login?reason=session_expired';
  };

  // Gestisce l'estensione della sessione
  const handleExtend = async () => {
    try {
      console.log('[SessionWarningModal] Extending session');

      // Il ping estende automaticamente la sessione (rolling session)
      await ServerCall.get('/promo/ping');

      // Notifica le altre tab che la sessione è stata estesa
      localStorage.setItem('session_extended', Date.now().toString());

      // Nascondi il modal
      setShowWarning(false);
      cleanupTimers();

      console.log('[SessionWarningModal] Session extended successfully');
    } catch (error) {
      console.error('[SessionWarningModal] Failed to extend session:', error);

      // Se ricevi 401, la sessione è già scaduta
      if (error && typeof error === 'object' && 'status' in error && error.status === 401) {
        handleLogout();
      }
    }
  };

  // Avvia il countdown
  const startCountdown = (initialTime: number) => {
    setTimeRemaining(initialTime);

    // Pulisci countdown precedente se esiste
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }

    // Countdown che si aggiorna ogni secondo
    countdownIntervalRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        const next = prev - COUNTDOWN_INTERVAL;

        if (next <= 0) {
          // Tempo scaduto, esegui logout
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
          handleLogout();
          return 0;
        }

        return next;
      });
    }, COUNTDOWN_INTERVAL);
  };

  // Check periodico del tempo rimanente
  useEffect(() => {
    if (!isAuthenticated) {
      cleanupTimers();
      setShowWarning(false);
      return;
    }

    const checkSessionInfo = async () => {
      try {
        const response = await ServerCall.get<any>('/session/info');

        if (response.success && response.timeRemaining !== undefined) {
          // Se il tempo rimanente è <= 5 minuti, mostra il modal
          if (response.timeRemaining <= WARNING_THRESHOLD && response.timeRemaining > 0) {
            if (!showWarning) {
              console.log('[SessionWarningModal] Warning threshold reached, showing modal');
              setShowWarning(true);
              startCountdown(response.timeRemaining);
            }
          } else if (showWarning && response.timeRemaining > WARNING_THRESHOLD) {
            // Se il modal è visibile ma il tempo è tornato sopra la soglia
            // (es. l'utente ha esteso in un'altra tab), nascondi il modal
            console.log('[SessionWarningModal] Session extended in another tab, hiding modal');
            setShowWarning(false);
            cleanupTimers();
          }
        }
      } catch (error) {
        // Se ricevi 401, la sessione è scaduta
        if (error && typeof error === 'object' && 'status' in error && error.status === 401) {
          console.log('[SessionWarningModal] Session expired during check');
          handleLogout();
        } else {
          console.error('[SessionWarningModal] Failed to check session info:', error);
        }
      }
    };

    // Check iniziale
    checkSessionInfo();

    // Check periodico ogni 10 secondi
    checkIntervalRef.current = setInterval(checkSessionInfo, CHECK_INTERVAL);

    return () => {
      cleanupTimers();
    };
  }, [isAuthenticated, showWarning]);

  // Ascolta eventi di sincronizzazione cross-tab
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const handleStorageChange = (e: StorageEvent) => {
      // Se la sessione è stata estesa in un'altra tab, nascondi il modal
      if (e.key === 'session_extended' && e.newValue) {
        console.log('[SessionWarningModal] Session extended event from another tab');
        setShowWarning(false);
        cleanupTimers();
      }

      // Se è stato fatto logout in un'altra tab, nascondi il modal e redirect
      if (e.key === 'logout' && e.newValue) {
        console.log('[SessionWarningModal] Logout event from another tab');
        setShowWarning(false);
        cleanupTimers();
        window.location.href = '/login';
      }

      // Se la sessione è scaduta in un'altra tab
      if (e.key === 'session_expired' && e.newValue) {
        console.log('[SessionWarningModal] Session expired event from another tab');
        handleLogout();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [isAuthenticated]);

  if (!showWarning) {
    return null;
  }

  return (
    <Dialog open={showWarning} onClose={() => { }} staticBackdrop>
      <Dialog.Panel>
        <div className="p-8 text-center">
          {/* Icona warning */}
          <div className="flex justify-center mb-4">
            <Lucide icon="Clock" className="w-16 h-16 text-warning" />
          </div>

          {/* Titolo */}
          <h2 className="text-2xl font-bold mb-3">
            La tua sessione sta per scadere
          </h2>

          {/* Descrizione */}
          <p className="text-slate-600 mb-6">
            Per motivi di sicurezza, la tua sessione scadrà tra:
          </p>

          {/* Countdown */}
          <div className="mb-8">
            <div className="text-6xl font-bold text-primary">
              {formatTime(timeRemaining)}
            </div>
            <div className="text-sm text-slate-500 mt-2">
              minuti : secondi
            </div>
          </div>

          {/* Messaggio */}
          <p className="text-slate-600 mb-6">
            Vuoi continuare a lavorare o preferisci uscire?
          </p>

          {/* Pulsanti */}
          <div className="flex gap-3 justify-center">
            <Button
              variant="outline-secondary"
              onClick={handleLogout}
              className="w-32"
            >
              Esci
            </Button>
            <Button
              variant="primary"
              onClick={handleExtend}
              className="w-48"
            >
              Continua sessione
            </Button>
          </div>
        </div>
      </Dialog.Panel>
    </Dialog>
  );
};
