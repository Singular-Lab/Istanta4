import React, { createContext, useContext, useReducer, useEffect, ReactNode, useMemo, useCallback, useRef } from 'react';
import { ServerCall } from '../../lib/server_call';

// Interfaccia per i parametri webpliant
export interface WebpliantParams {
  // Parametri essenziali
  idArea?: string;
  idCanale?: string;
  idGDO?: string;
  idPV?: string;
  idWorkspace?: string;
  idPagina?: string;
  
  // Parametri di sessione
  sessionIdWebpliant?: string;
  sessionWishlistId?: string;
  URL_WEBPLIANT?: string;
  
  // Parametri condivisi/temporanei
  isCondivisa?: boolean;
  
  // Metadata
  lastUpdated?: number;
  isInitialized?: boolean;
  isLoading?: boolean;
  error?: string | null;
}

// Tipi di azioni per il reducer
type WebpliantParamsAction =
  | { type: 'SET_PARAMS'; payload: Partial<WebpliantParams> }
  | { type: 'UPDATE_PARAM'; payload: { key: keyof WebpliantParams; value: any } }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'RESET' }
  | { type: 'INITIALIZE_FROM_URL'; payload: URLSearchParams }
  | { type: 'INITIALIZE_FROM_SERVER_SUCCESS'; payload: { params: Partial<WebpliantParams>; wishlistId: string } }
  | { type: 'CREATE_SESSION_SUCCESS'; payload: string }
  | { type: 'CREATE_WISHLIST_SUCCESS'; payload: string };

// Interfaccia per le azioni del contesto
interface WebpliantParamsActions {
  // Azioni per settare i parametri
  setParams: (params: Partial<WebpliantParams>) => void;
  updateParam: <K extends keyof WebpliantParams>(key: K, value: WebpliantParams[K]) => void;
  
  // Azioni per gestire la sessione
  initializeFromURL: (searchParams: URLSearchParams) => void;
  createNewSession: () => Promise<string>;
  ensureSessionExists: () => Promise<string>;
  
  // Azioni per gestire la wishlist
  validateAndCreateWishlist: () => Promise<void>;
  ensureWishlistExists: () => Promise<string | null>;
  
  // Utility
  reset: () => void;
  getCompletionStatus: () => {
    hasEssentialParams: boolean;
    hasSession: boolean;
    hasWishlist: boolean;
    isComplete: boolean;
  };
}

// Context type completo
export type WebpliantParamsContextType = WebpliantParams & WebpliantParamsActions;

// Helper functions
const createSessionId = async (): Promise<string> => {
  try {
    const response = await ServerCall.put<string>('/generaNuovaSessioneWebpliant', {});
    
    if (!response) {
      throw new Error('Risposta vuota dal server');
    }
    
    return response;
  } catch (error) {
    console.error('Errore nella creazione del session ID:', error);
    
    // Fallback: genera un ID locale con prefisso che indica che è un fallback
    const fallbackId = `local_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.warn('Generato ID di sessione locale come fallback:', fallbackId);
    return fallbackId;
  }
};

const createWishlistId = async (params: Partial<WebpliantParams>): Promise<string> => {
  try {
    // Verifica che i parametri essenziali siano presenti
    if (!params.idCanale || !params.idArea || !params.idWorkspace || !params.idPagina) {
      throw new Error('Parametri essenziali mancanti per la creazione della wishlist');
    }

    // Prepara i dati per la richiesta
    const wishlistData = {
      idCanale: params.idCanale,
      idArea: params.idArea,
      idPv: params.idPV || '',
      idWorkspace: params.idWorkspace,
      idPagina: params.idPagina,
      meta: {
        sessionIdWebpliant: params.sessionIdWebpliant,
        URL_WEBPLIANT: params.URL_WEBPLIANT,
        timestamp: new Date().toISOString(),
        isCondivisa: params.isCondivisa
      }
    };

    console.log('Invio richiesta creazione wishlist:', wishlistData);
    const response = await ServerCall.put<string>('/generaNuovoInserimentoWishlistWebpliant', wishlistData);
    
    if (!response) {
      throw new Error('Risposta vuota dal server durante la creazione della wishlist');
    }
    
    console.log('Wishlist creata con successo, ID:', response);
    return response;
  } catch (error) {
    console.error('Errore nella creazione della wishlist:', error);
    throw error;
  }
};

const validateWishlistId = async (wishlistId: string, idCanale?: string, idArea?: string, idPV?: string): Promise<boolean> => {
  try {
    if (!idCanale || !idArea) return false;
    const params = new URLSearchParams({
      id: wishlistId,
      idArea,
      idCanale,
      idPv: idPV || '', // idPv è richiesto dall'endpoint anche se può essere vuoto
    });
    const isValid = await ServerCall.get<boolean>(`/checkWishlistId?${params.toString()}`);
    return isValid;
  } catch (error) {
    console.error('Errore nella validazione della wishlist:', error);
    return false;
  }
};

// Stato iniziale
const initialState: WebpliantParams = {
  lastUpdated: Date.now(),
  isInitialized: false,
  isLoading: false,
  error: null,
};

// Reducer per gestire gli stati
const webpliantParamsReducer = (state: WebpliantParams, action: WebpliantParamsAction): WebpliantParams => {
  switch (action.type) {
    case 'SET_PARAMS':
      return {
        ...state,
        ...action.payload,
        lastUpdated: Date.now(),
        isInitialized: true,
        error: null,
      };

    case 'UPDATE_PARAM':
      return {
        ...state,
        [action.payload.key]: action.payload.value,
        lastUpdated: Date.now(),
        error: null,
      };

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      };

    case 'RESET':
      return {
        ...initialState,
        lastUpdated: Date.now(),
      };

    case 'INITIALIZE_FROM_URL':
      const urlParams: Partial<WebpliantParams> = {
        idArea: action.payload.get('idArea') || undefined,
        idCanale: action.payload.get('idCanale') || undefined,
        idGDO: action.payload.get('idGDO') || undefined,
        idPV: action.payload.get('idPV') || undefined,
        idWorkspace: action.payload.get('id') || undefined,
        idPagina: action.payload.get('idPagina') || undefined,
        sessionWishlistId: action.payload.get('sessionWishlistId') || undefined,
        isCondivisa: action.payload.get('c') === 'true',
        URL_WEBPLIANT: window.location.href,
      };

      // Filtra parametri undefined
      const cleanParams = Object.fromEntries(
        Object.entries(urlParams).filter(([_, value]) => value !== undefined)
      ) as Partial<WebpliantParams>;

      return {
        ...state,
        ...cleanParams,
        lastUpdated: Date.now(),
        isInitialized: true,
        error: null,
      };

    case 'INITIALIZE_FROM_SERVER_SUCCESS':
      return {
        ...state,
        ...action.payload.params,
        sessionWishlistId: action.payload.wishlistId,
        lastUpdated: Date.now(),
        isInitialized: true,
        isLoading: false,
        error: null,
      };

    case 'CREATE_SESSION_SUCCESS':
      return {
        ...state,
        sessionIdWebpliant: action.payload,
        lastUpdated: Date.now(),
        isLoading: false,
        error: null,
      };

    case 'CREATE_WISHLIST_SUCCESS':
      return {
        ...state,
        sessionWishlistId: action.payload,
        lastUpdated: Date.now(),
        isLoading: false,
        error: null,
      };

    default:
      return state;
  }
};

// Context
const WebpliantParamsContext = createContext<WebpliantParamsContextType | undefined>(undefined);

// Provider component
export const WebpliantParamsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(webpliantParamsReducer, initialState);
  
  // Ref per prevenire chiamate multiple simultanee
  const isCreatingWishlist = useRef(false);
  const lastWishlistCreationAttempt = useRef<{
    sessionId: string;
    params: string;
    timestamp: number;
  } | null>(null);

  // Carica dati persistenti al mount
  useEffect(() => {
    const loadPersistedData = () => {
      try {
        const stored = localStorage.getItem('webpliant-params-storage');
        
        if (stored) {
          const parsedData = JSON.parse(stored);
          dispatch({ type: 'SET_PARAMS', payload: parsedData });
        } else {
        }
      } catch (error) {
        console.error('❌ WebpliantParamsStore: Errore nel caricamento dati persistenti:', error);
      }
    };

    loadPersistedData();
  }, []);

  // Salva dati nel localStorage ad ogni cambiamento significativo
  useEffect(() => {
    if (state.isInitialized) {
      try {
        const dataToStore = {
          idArea: state.idArea,
          idCanale: state.idCanale,
          idGDO: state.idGDO,
          idPV: state.idPV,
          idWorkspace: state.idWorkspace,
          idPagina: state.idPagina,
          sessionIdWebpliant: state.sessionIdWebpliant,
          sessionWishlistId: state.sessionWishlistId,
          isCondivisa: state.isCondivisa,
          URL_WEBPLIANT: state.URL_WEBPLIANT,
          lastUpdated: state.lastUpdated,
          isInitialized: state.isInitialized,
        };
        localStorage.setItem('webpliant-params-storage', JSON.stringify(dataToStore));
      } catch (error) {
        console.error('Errore nel salvataggio dati persistenti:', error);
      }
    }
  }, [
    state.idArea,
    state.idCanale,
    state.idGDO,
    state.idPV,
    state.idWorkspace,
    state.idPagina,
    state.sessionIdWebpliant,
    state.sessionWishlistId, // 🔧 FIX: Aggiungo sessionWishlistId alle dipendenze
    state.isCondivisa,
    state.URL_WEBPLIANT,
    state.lastUpdated,
    state.isInitialized,
  ]);

    // Implementazione delle azioni memoizzate
  const setParams = useCallback((params: Partial<WebpliantParams>) => {
    dispatch({ type: 'SET_PARAMS', payload: params });
  }, []);

  const updateParam = useCallback(<K extends keyof WebpliantParams>(key: K, value: WebpliantParams[K]) => {
    dispatch({ type: 'UPDATE_PARAM', payload: { key, value } });
  }, []);

  const initializeFromURL = useCallback((searchParams: URLSearchParams) => {
    dispatch({ type: 'INITIALIZE_FROM_URL', payload: searchParams });
  }, []);

  

  const createNewSession = useCallback(async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const sessionId = await createSessionId();
      dispatch({ type: 'CREATE_SESSION_SUCCESS', payload: sessionId });
      return sessionId;
    } catch (error) {
      console.error('Errore nella creazione della sessione:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Errore nella creazione della sessione' });
      throw error;
    }
  }, []);
  
  // Nuovo metodo per garantire che esista una sessione
  const ensureSessionExists = useCallback(async () => {
    if (state.sessionIdWebpliant) {
      return state.sessionIdWebpliant; // Sessione già esistente
    }
    
    try {
      return await createNewSession();
    } catch (error) {
      console.error('Errore nella creazione della sessione webpliant:', error);
      throw error;
    }
  }, [state.sessionIdWebpliant, createNewSession]);

  // Nuovo metodo per garantire che esista una wishlist
  const ensureWishlistExists = useCallback(async () => {


    // Controlla se una creazione è già in corso
    if (isCreatingWishlist.current) {
      return null;
    }

    // Controlla se abbiamo già una wishlist valida
    if (state.sessionWishlistId) {
      try {
        const isValid = await validateWishlistId(
          state.sessionWishlistId,
          state.idCanale || 'default-canale',
          state.idArea || 'default-area',
          state.idPV
        );

        if (isValid) {
          return state.sessionWishlistId;
        } else {
        }
      } catch (error) {
      }
    }

    // Prima verifica che esista una sessione
    if (!state.sessionIdWebpliant) {
      const sessionId = await ensureSessionExists();
      if (!sessionId) {
        return null;
      }
      // Dopo aver creato la sessione, termina e lascia che il prossimo ciclo gestisca la wishlist
      return null;
    }

    // Prepara i parametri per la creazione, usando valori di default se necessario
    const createParams = {
      sessionIdWebpliant: state.sessionIdWebpliant,
      idCanale: state.idCanale || 'default-canale',
      idArea: state.idArea || 'default-area',
      idGDO: state.idGDO || 'default-gdo',
      idPagina: state.idPagina || 'default-pagina',
      idWorkspace: state.idWorkspace || 'default-workspace',
      URL_WEBPLIANT: state.URL_WEBPLIANT || window.location.href,
      idPV: state.idPV,
      isCondivisa: state.isCondivisa
    };

    // Controlla se abbiamo già tentato di creare una wishlist con gli stessi parametri
    const paramsKey = JSON.stringify(createParams);
    const now = Date.now();
    const timeSinceLastAttempt = lastWishlistCreationAttempt.current 
      ? now - lastWishlistCreationAttempt.current.timestamp 
      : Infinity;

    if (lastWishlistCreationAttempt.current && 
        lastWishlistCreationAttempt.current.sessionId === state.sessionIdWebpliant &&
        lastWishlistCreationAttempt.current.params === paramsKey &&
        timeSinceLastAttempt < 5000) { // 5 secondi di cooldown

      return null;
    }

    // Crea una nuova wishlist
    try {
      
      // Marca che stiamo creando una wishlist
      isCreatingWishlist.current = true;
      lastWishlistCreationAttempt.current = {
        sessionId: state.sessionIdWebpliant,
        params: paramsKey,
        timestamp: now
      };
      
      dispatch({ type: 'SET_LOADING', payload: true });
      
      const wishlistId = await createWishlistId(createParams);

      dispatch({ type: 'CREATE_WISHLIST_SUCCESS', payload: wishlistId });
      dispatch({ type: 'SET_LOADING', payload: false });
      return wishlistId;
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: 'Errore nella creazione della wishlist' });
      dispatch({ type: 'SET_LOADING', payload: false });
      throw error;
    } finally {
      // Reset del flag di creazione
      isCreatingWishlist.current = false;
    }
  }, [
    state.sessionIdWebpliant,
    state.idArea,
    state.idCanale,
    state.idGDO,
    state.idWorkspace,
    state.idPagina,
    state.URL_WEBPLIANT,
    state.idPV,
    state.sessionWishlistId,
    state.isCondivisa,
    ensureSessionExists
  ]);

  const getCompletionStatus = useCallback(() => {
    const hasEssentialParams = !!(
      state.idArea &&
      state.idCanale &&
      state.idGDO &&
      state.idWorkspace
    );

    const hasSession = !!state.sessionIdWebpliant;
    const hasWishlist = !!state.sessionWishlistId;
    const isComplete = hasEssentialParams && hasSession && hasWishlist;

    return {
      hasEssentialParams,
      hasSession,
      hasWishlist,
      isComplete,
    };
  }, [state.idArea, state.idCanale, state.idGDO, state.idWorkspace, state.sessionIdWebpliant, state.sessionWishlistId]);

  const validateAndCreateWishlist = useCallback(async () => {
    // Controlla se una creazione è già in corso
    if (isCreatingWishlist.current) {
      return;
    }

    try {
      dispatch({ type: 'SET_LOADING', payload: true });

      // Calcola status all'interno della funzione per evitare dipendenze circolari
      const hasEssentialParams = !!(
        state.idArea &&
        state.idCanale &&
        state.idGDO &&
        state.idWorkspace
      );

      // Se non abbiamo session ID, crealo
      if (!state.sessionIdWebpliant) {
        const sessionId = await createSessionId();
        if (!sessionId) {
          throw new Error('Impossibile creare la sessione webpliant');
        }
        dispatch({ type: 'CREATE_SESSION_SUCCESS', payload: sessionId });
        
        // Termina qui e lascia che il prossimo ciclo di effetti gestisca la creazione della wishlist
        dispatch({ type: 'SET_LOADING', payload: false });
        return;
      }

      // Se non abbiamo tutti i parametri essenziali, non possiamo creare la wishlist
      if (!hasEssentialParams) {
        dispatch({ type: 'SET_ERROR', payload: 'Parametri essenziali mancanti per la wishlist' });
        dispatch({ type: 'SET_LOADING', payload: false });
        return;
      }

      // Se abbiamo già una wishlist, validala
      if (state.sessionWishlistId) {
        const isValid = await validateWishlistId(
          state.sessionWishlistId,
          state.idCanale,
          state.idArea,
          state.idPV
        );

        if (isValid) {
          dispatch({ type: 'SET_LOADING', payload: false });
          return;
        } else {
        }
      }

      // Usa ensureWishlistExists invece di duplicare la logica
      await ensureWishlistExists();
      
    } catch (error) {
      console.error('Errore nella creazione della wishlist:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Errore nella creazione della wishlist' });
      dispatch({ type: 'SET_LOADING', payload: false });
      throw error;
    }
  }, [state, ensureWishlistExists]);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
    localStorage.removeItem('webpliant-params-storage');
  }, []);

  // Memoizza il contextValue per evitare re-render infiniti
  const contextValue: WebpliantParamsContextType = useMemo(() => ({
    ...state,
    setParams,
    updateParam,
    initializeFromURL,
    createNewSession,
    ensureSessionExists,
    validateAndCreateWishlist,
    ensureWishlistExists,
    reset,
    getCompletionStatus,
  }), [
    state,
    setParams,
    updateParam,
    initializeFromURL,
    createNewSession,
    ensureSessionExists,
    validateAndCreateWishlist,
    ensureWishlistExists,
    reset,
    getCompletionStatus,
  ]);

  return (
    <WebpliantParamsContext.Provider value={contextValue}>
      {children}
    </WebpliantParamsContext.Provider>
  );
};

// Hook per utilizzare il context
export const useWebpliantParams = (): WebpliantParamsContextType => {
  const context = useContext(WebpliantParamsContext);
  if (context === undefined) {
    throw new Error('useWebpliantParams deve essere usato all\'interno di WebpliantParamsProvider');
  }
  return context;
}; 