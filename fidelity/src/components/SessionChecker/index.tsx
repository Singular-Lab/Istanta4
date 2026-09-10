import { Dialog } from "@/components/Base/Headless";
import { SessionWarningModal } from "@/components/SessionWarningModal";
import { useUser } from "@/context/UserContext";
import { useSessionKeepAlive } from "@/hooks/useSessionKeepAlive";
import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { HttpStatusCode } from '../../../lib/enums';
import { ServerCall } from "../../../lib/server_call";
import { fetchSideMenu, selectSideMenuLoading } from "../../stores/sideMenuSlice_istanta";
import type { AppDispatch } from "../../stores/store";
import Button from "../Base/Button";
import Lucide from "../Base/Lucide";
// Callback globale per intercettare errori 401

//@ts-ignore
import lottieAnimation from "@/assets/animations/animazione_loading_session.lottie?url";

const DotLottieReact = lazy(() =>
  import("@lottiefiles/dotlottie-react").then((m) => ({ default: m.DotLottieReact }))
);

import { UtenteResponseDTO } from "../../../server/core/dto/UtenteDTO.ts";
// Singleton per gestire lo stato globale delle chiamate
class SessionCheckManager {
  private static instance: SessionCheckManager;
  private sessionCheckInProgress = false;
  private menuFetchInProgress = false;
  private sessionCacheTime = 30000; // 30 secondi di cache
  private cachedSessionData: {
    sessionResponse?: { is_authenticated: boolean; utente: UtenteResponseDTO };
    policyResponse?: { is_authenticated: boolean; can_go_to_page: boolean; utente: UtenteResponseDTO };
    timestamp: number;
    currentPage: string;
  } | null = null;

  private constructor() { }

  static getInstance(): SessionCheckManager {
    if (!SessionCheckManager.instance) {
      SessionCheckManager.instance = new SessionCheckManager();
    }
    return SessionCheckManager.instance;
  }

  isSessionCheckInProgress(): boolean {
    return this.sessionCheckInProgress;
  }

  setSessionCheckInProgress(status: boolean): void {
    this.sessionCheckInProgress = status;
  }

  isMenuFetchInProgress(): boolean {
    return this.menuFetchInProgress;
  }

  setMenuFetchInProgress(status: boolean): void {
    this.menuFetchInProgress = status;
  }

  canSkipSessionCheck(currentPage: string): boolean {
    if (!this.cachedSessionData) return false;

    const now = Date.now();
    const isValidCache = (now - this.cachedSessionData.timestamp) < this.sessionCacheTime;
    const isSamePage = this.cachedSessionData.currentPage === currentPage;

    return isValidCache && isSamePage && this.cachedSessionData.sessionResponse?.is_authenticated === true;
  }

  setCachedData(sessionResponse: any, policyResponse: any, currentPage: string): void {
    this.cachedSessionData = {
      sessionResponse,
      policyResponse,
      currentPage,
      timestamp: Date.now()
    };
  }

  getCachedData() {
    return this.cachedSessionData;
  }

  clearCache(): void {
    this.cachedSessionData = null;
  }
}

interface SessionCheckWrapperProps {
  WrappedComponent: React.ComponentType<any>;
  [key: string]: any;
}

const SessionCheckWrapper: React.FC<SessionCheckWrapperProps> = ({ WrappedComponent, ...otherProps }) => {
  const dispatch: AppDispatch = useDispatch();
  const isSideMenuLoading = useSelector(selectSideMenuLoading);
  const navigate = useNavigate();
  const { setUser } = useUser(); // DEVE essere dichiarato all'inizio

  // Stati principali - SEMPRE chiamati
  const [is_authenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [showSessionExpired, setShowSessionExpired] = useState(false);
  const [isIstantaRequired, setIsIstantaRequired] = useState(false);
  const [can_go_to_page, setCanGoToPage] = useState<boolean | null>(null);
  const [sessionResponse, setSessionResponse] = useState<{ is_authenticated: boolean; utente: UtenteResponseDTO }>();
  const [policyResponse, setPolicyResponse] = useState<{
    is_authenticated: boolean;
    can_go_to_page: boolean;
    utente: UtenteResponseDTO;
  }>();

  // Stati di loading
  const [showLoading, setShowLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [minLoaderTimeElapsed, setMinLoaderTimeElapsed] = useState(false);

  // Refs
  const mountedRef = useRef(true);
  const loaderTimerRef = useRef<NodeJS.Timeout | null>(null);
  const sessionManager = useRef(SessionCheckManager.getInstance());
  const initializedRef = useRef(false);

  // Memoizza la pagina corrente
  const currentPage = React.useMemo(() =>
    window.location.pathname.replace("/", ""),
    [window.location.pathname]
  );

  // ============================================================
  // COORDINAMENTO CON ServerCall per gestione 401
  // ============================================================
  const unauthorizedCallbackRef = useRef<((istantaRequired?: boolean) => void) | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Registra callback SOLO una volta al mount
      if (!unauthorizedCallbackRef.current) {
        unauthorizedCallbackRef.current = (istantaRequired?: boolean) => {
          // Questa callback viene chiamata da ServerCall.handleUnauthorized()
          // quando riceve un 401 da qualsiasi endpoint

          console.log('[SessionChecker] 401 ricevuto, aggiorno stati UI');

          // Aggiorna stati React per mostrare dialog
          setIsAuthenticated(false);
          setShowSessionExpired(true);
          setIsIstantaRequired(!!istantaRequired);
          setUser(null);

          // Pulisci cache sessioni
          sessionManager.current.clearCache();
        };

        // Registra callback in ServerCall
        ServerCall.setOnUnauthorizedCallback((istantaRequired?: boolean) => {
          if (unauthorizedCallbackRef.current) {
            unauthorizedCallbackRef.current(istantaRequired);
          }
        });

        console.log('[SessionChecker] Callback 401 registrata');
      }
    }

    // CLEANUP: rimuovi callback al unmount
    return () => {
      if (unauthorizedCallbackRef.current) {
        ServerCall.setOnUnauthorizedCallback(() => { });
        unauthorizedCallbackRef.current = null;
        console.log('[SessionChecker] Callback 401 rimossa');
      }
    };
  }, [setUser]);

  // ============================================================
  // KEEP-ALIVE AUTOMATICO: Ping periodico per prevenire scadenza
  // ============================================================
  useSessionKeepAlive(is_authenticated === true);

  // ============================================================
  // SINCRONIZZAZIONE TRA TAB via localStorage
  // ============================================================
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      // Ascolta eventi da altre tab
      if (e.key === 'session_expired' && e.newValue) {
        console.log('[SessionChecker] Altra tab ha rilevato scadenza sessione');

        // Controlla se la scadenza richiede login Istanta
        const istantaStored = localStorage.getItem('istanta_login_required') === '1';

        // Aggiorna stati localmente (senza duplicare la chiamata al server)
        setIsAuthenticated(false);
        setShowSessionExpired(true);
        setIsIstantaRequired(istantaStored);
        setUser(null);
        sessionManager.current.clearCache();
      }

      if (e.key === 'logout' && e.newValue) {
        console.log('[SessionChecker] Altra tab ha fatto logout');

        // Redirect diretto al login
        window.location.href = '/login';
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [setUser]);

  // Effetto per gestire il ref di montaggio - SEMPRE chiamato
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (loaderTimerRef.current) {
        clearTimeout(loaderTimerRef.current);
      }
    };
  }, []);

  // Fetch del menu laterale - SEMPRE chiamato
  useEffect(() => {
    const manager = sessionManager.current;

    if (!manager.isMenuFetchInProgress() && !initializedRef.current) {
      manager.setMenuFetchInProgress(true);
      dispatch(fetchSideMenu()).finally(() => {
        if (mountedRef.current) {
          manager.setMenuFetchInProgress(false);
        }
      });
    }
  }, [dispatch]);

  // Setup del timer di loading minimo - SEMPRE chiamato
  useEffect(() => {
    if (initializedRef.current) return;

    const minLoaderDelay = setTimeout(() => {
      if (mountedRef.current) {
        setMinLoaderTimeElapsed(true);
      }
    }, 800);

    return () => {
      clearTimeout(minLoaderDelay);
    };
  }, []);

  // Funzione per aggiornare gli stati - SEMPRE chiamata
  const updateStates = useCallback((sessionResp: any, policyResp: any) => {
    if (!mountedRef.current) return;

    setSessionResponse(sessionResp);
    setPolicyResponse(policyResp);
    setIsAuthenticated(sessionResp.is_authenticated);
    setCanGoToPage(policyResp.can_go_to_page);

    // Gestione utente
    if (sessionResp.is_authenticated && sessionResp.utente) {
      setUser(sessionResp.utente);
    } else {
      setUser(null);
    }

    if (!sessionResp.is_authenticated) {
      setShowSessionExpired(true);
    }
  }, [setUser]);

  // Logica principale di controllo sessione - SEMPRE chiamata
  useEffect(() => {
    if (initializedRef.current) return;

    const manager = sessionManager.current;

    // Se c'è già una chiamata in corso, aspetta
    if (manager.isSessionCheckInProgress()) {
      return;
    }

    // Controlla se possiamo usare la cache
    if (manager.canSkipSessionCheck(currentPage)) {
      const cachedData = manager.getCachedData();
      if (cachedData && cachedData.sessionResponse && cachedData.policyResponse) {
        updateStates(cachedData.sessionResponse, cachedData.policyResponse);
        setIsInitialized(true);
        setShowLoading(false);
        initializedRef.current = true;
        return;
      }
    }

    const checkSession = async () => {
      try {
        manager.setSessionCheckInProgress(true);

        if (mountedRef.current) {
          setShowLoading(true);
        }

        const startTime = Date.now();

        // Chiamate parallele
        const [sessionResp, policyResp] = await Promise.all([
          ServerCall.get<{ is_authenticated: boolean; utente: UtenteResponseDTO }>("/session/check"),
          ServerCall.get<{
            is_authenticated: boolean;
            can_go_to_page: boolean;
            utente: UtenteResponseDTO;
          }>(`/policy/check?rp=${currentPage}`),
        ]);

        // Salva nella cache
        manager.setCachedData(sessionResp, policyResp, currentPage);

        // Aggiorna gli stati
        updateStates(sessionResp, policyResp);

        // Gestione timing minimo del loader
        const elapsedTime = Date.now() - startTime;
        const minDisplayTime = 500;

        if (mountedRef.current) {
          const remainingTime = Math.max(0, minDisplayTime - elapsedTime);

          if (loaderTimerRef.current) {
            clearTimeout(loaderTimerRef.current);
          }

          loaderTimerRef.current = setTimeout(() => {
            if (mountedRef.current) {
              setIsInitialized(true);
              initializedRef.current = true;
              setTimeout(() => {
                if (mountedRef.current) {
                  setShowLoading(false);
                }
              }, 50);
            }
          }, remainingTime);
        }

      } catch (error: any) {
        if (!mountedRef.current) return;

        console.error("Session check error:", error);

        if (error && error.httpStatus === HttpStatusCode.UNAUTHORIZED) {
          setIsAuthenticated(false);
          setShowSessionExpired(true);
          setUser(null);
          manager.clearCache();
        }

        if (mountedRef.current) {
          if (loaderTimerRef.current) {
            clearTimeout(loaderTimerRef.current);
          }

          loaderTimerRef.current = setTimeout(() => {
            if (mountedRef.current) {
              setIsInitialized(true);
              initializedRef.current = true;
              setShowLoading(false);
            }
          }, 300);
        }
      } finally {
        manager.setSessionCheckInProgress(false);
      }
    };

    checkSession();

  }, [currentPage, updateStates]);

  // Funzione per il redirect al login - SEMPRE chiamata
  const handleLoginRedirect = useCallback(() => {
    console.log('[SessionChecker] Redirect al login');

    // Notifica altre tab del logout (se esplicito)
    if (typeof window !== 'undefined') {
      localStorage.setItem('logout', Date.now().toString());
    }

    // Reset del flag in ServerCall per permettere nuovo login
    ServerCall.resetSessionExpiredFlag();

    // Determina il reason per il redirect
    const istantaStored = typeof window !== 'undefined' && localStorage.getItem('istanta_login_required') === '1';
    const loginReason = (isIstantaRequired || istantaStored) ? 'istanta_required' : 'session_expired';
    if (typeof window !== 'undefined') {
      localStorage.removeItem('istanta_login_required');
    }

    // Reset degli stati React
    setIsAuthenticated(null);
    setCanGoToPage(null);
    setShowSessionExpired(false);
    setIsIstantaRequired(false);
    setSessionResponse(undefined);
    setPolicyResponse(undefined);
    setUser(null);

    // Reset del manager sessioni
    const manager = sessionManager.current;
    manager.setSessionCheckInProgress(false);
    manager.setMenuFetchInProgress(false);
    manager.clearCache();

    // Reset dei ref
    initializedRef.current = false;

    // Redirect al login
    navigate(`/login?reason=${loginReason}`, { replace: true });
  }, [navigate, setUser, isIstantaRequired]);

  // Rendering condizionale - ora tutti gli hooks sono stati chiamati
  // Dialogo sessione scaduta
  if (is_authenticated === false) {
    return (
      <>
        <Dialog
          open={showSessionExpired}
          onClose={() => setShowSessionExpired(false)}
          staticBackdrop={true}
        >
          <Dialog.Panel>
            <div className="p-5 text-center">
              <Lucide icon="TriangleAlert" className="w-16 h-16 mx-auto mt-3 text-warning" />
              <div className="mt-5 text-3xl">Oops...</div>
              {isIstantaRequired ? (
                <div className="mt-2 text-slate-500">
                  La tua sessione è scaduta. Per accedere nuovamente è necessario effettuare il login tramite <strong>Istanta</strong>.
                </div>
              ) : (
                <div className="mt-2 text-slate-500">
                  La tua sessione è scaduta. Per favore effettua nuovamente il login.
                </div>
              )}
            </div>
            <div className="px-5 pb-8 text-center">
              <Button
                type="button"
                variant="primary"
                onClick={handleLoginRedirect}
                className="w-32"
              >
                {isIstantaRequired ? 'Vai al login' : 'Torna al login'}
              </Button>
            </div>
          </Dialog.Panel>
        </Dialog>
      </>
    );
  }

  // Schermata accesso negato
  if (is_authenticated === true && can_go_to_page === false) {
    return (
      <>

        <PaginaPermessiNonValidi onClose={handleLoginRedirect} />
      </>
    );
  }

  // Render principale quando autenticato e autorizzato
  if (is_authenticated === true && can_go_to_page === true) {
    return (
      <>


        {/* WARNING MODAL: Mostra avviso 5 minuti prima della scadenza */}
        <SessionWarningModal
          isAuthenticated={true}
          userType={sessionResponse?.utente?.tipo || null}
        />

        <WrappedComponent {...otherProps} />
      </>
    );
  }

  // Loading state o fallback
  return (
    <>

    </>
  );
};

// HOC factory function con tipi corretti per TypeScript
const withSessionCheck = <P extends object = {}>(
  WrappedComponent: React.ComponentType<P>
): React.ComponentType<P> => {
  // Crea il componente wrapper
  const WithSessionCheckComponent: React.FC<P> = (props) => (
    <SessionCheckWrapper WrappedComponent={WrappedComponent} {...props} />
  );

  // Aggiunge un displayName per il debugging
  WithSessionCheckComponent.displayName = `withSessionCheck(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;

  return WithSessionCheckComponent;
};

// Memoizza il componente SessionCheckWrapper per evitare re-render inutili
const MemoizedSessionCheckWrapper = React.memo(SessionCheckWrapper);

// Versione ottimizzata dell'HOC che usa il componente memoizzato
export const withSessionCheckOptimized = <P extends object = {}>(
  WrappedComponent: React.ComponentType<P>
): React.ComponentType<P> => {
  const MemoizedWrappedComponent = React.memo(WrappedComponent);

  const WithSessionCheckComponent: React.FC<P> = (props) => (
    <MemoizedSessionCheckWrapper WrappedComponent={MemoizedWrappedComponent} {...props} />
  );

  WithSessionCheckComponent.displayName = `withSessionCheckOptimized(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;

  return React.memo(WithSessionCheckComponent);
};

export default withSessionCheck;

// Componente di loading separato



// Access denied component ottimizzata
const PaginaPermessiNonValidi: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [animationError, setAnimationError] = useState(false);

  const options = {
    animationData: lottieAnimation,
    loop: true,
    autoplay: true,
  };


  // Se vuoi reagire ad errori, puoi rilevare errori del JSON o simili
  // Ma nota: l’hook non fornisce onError nativamente — puoi gestire fallback tu.

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#03045e] bg-opacity-90 backdrop-blur-md z-[100000]">
      <div className="text-center flex flex-col items-center">
        <Lucide
          icon="TriangleAlert"
          className="w-20 h-20 text-warning animate-pulse"
        />
        <h1 className="mt-6 text-white text-2xl font-bold">
          Accesso Negato
        </h1>
        <p className="mt-2 text-gray-300 text-sm max-w-sm">
          Non hai i permessi per accedere a questa pagina. Se pensi che questo sia un errore, contatta l’amministratore o effettua nuovamente il login.
        </p>
        <Button
          type="button"
          variant="primary"
          onClick={onClose}
          className="mt-6 px-6 py-2 bg-white text-[#03045e] font-semibold rounded-full hover:bg-gray-100"
        >
          Torna al Login
        </Button>
        <div className="mt-10">
          <Suspense fallback={null}>
            <DotLottieReact
              autoplay
              loop
              src={lottieAnimation}
              style={{ height: '150px', width: '150px' }}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
};
