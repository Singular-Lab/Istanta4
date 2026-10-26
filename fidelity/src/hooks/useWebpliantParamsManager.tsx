import { useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useWebpliantParams, WebpliantParams } from '@/stores/webpliantParamsStore';

/**
 * Hook per gestire automaticamente l'inizializzazione e sincronizzazione 
 * dei parametri webpliant da URL, stato di navigazione e server
 */
export const useWebpliantParamsManager = () => {
  const location = useLocation();
  const webpliantParams = useWebpliantParams();
  
  // Ref per tracciare inizializzazioni già eseguite e prevenire loop
  const hasInitializedFromURL = useRef(false);
  const hasInitializedFromState = useRef(false);
  const lastLocationSearch = useRef('');
  const lastLocationStateKey = useRef('');
  const isCreatingSession = useRef(false);
  const isCreatingWishlist = useRef(false);
  const hasInitializedFromServer = useRef(false);
  const lastWishlistIdProcessed = useRef('');
  const hasMountInitialized = useRef(false);
  const lastProcessedState = useRef({
    hasSession: false,
    hasWishlist: false,
    isLoading: false
  });

  // Inizializza parametri da URL al mount e ad ogni cambio di location
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const searchString = searchParams.toString();
    
    // Se ci sono parametri nell'URL e non abbiamo già inizializzato questi specifici parametri
    if (searchString && searchString !== lastLocationSearch.current) {
      webpliantParams.initializeFromURL(searchParams);
      hasInitializedFromURL.current = true;
      lastLocationSearch.current = searchString;
    } else if (searchString) {
    }
  }, [location.search]); // Rimossa dipendenza da webpliantParams

  // Inizializza parametri da location.state se disponibili
  useEffect(() => {
    if (location.state) {
      // Crea una chiave univoca per questo state per evitare re-inizializzazioni
      const stateKey = JSON.stringify(location.state);
      
      if (stateKey !== lastLocationStateKey.current) {
        const {
          idPV,
          idCanale,
          idArea,
          idGDO,
          idWorkspace,
          idPagina,
          guidIdWishlist,
        } = location.state as any;

        const stateParams = {
          ...(idPV && { idPV }),
          ...(idCanale && { idCanale }),
          ...(idArea && { idArea }),
          ...(idGDO && { idGDO }),
          ...(idWorkspace && { idWorkspace }),
          ...(idPagina && { idPagina }),
          ...(guidIdWishlist && { guidIdWishlist }),
        };

        if (Object.keys(stateParams).length > 0) {
          webpliantParams.setParams(stateParams);
          hasInitializedFromState.current = true;
          lastLocationStateKey.current = stateKey;
        }
      } else {
      }
    }
  }, [location.state]); // Rimossa dipendenza da webpliantParams

  // Inizializza da server se abbiamo guidIdWishlist ma mancano parametri essenziali
  useEffect(() => {
    const initializeFromServerIfNeeded = async () => {
      // Controlla se abbiamo già processato questa wishlist
      if (webpliantParams.sessionWishlistId === lastWishlistIdProcessed.current) {
        return;
      }

      // Controlla se abbiamo già inizializzato dal server
      if (hasInitializedFromServer.current && webpliantParams.sessionWishlistId === lastWishlistIdProcessed.current) {
        return;
      }

      const { hasEssentialParams } = webpliantParams.getCompletionStatus();
      
      if (webpliantParams.sessionWishlistId && !hasEssentialParams && !webpliantParams.isLoading) {
        try {
          hasInitializedFromServer.current = true;
          lastWishlistIdProcessed.current = webpliantParams.sessionWishlistId;
        } catch (error) {
          console.error('❌ Errore nell\'inizializzazione da server:', error);
          hasInitializedFromServer.current = false; // Resetta per permettere retry
        }
      }
    };

    // Esegui solo se non stiamo già caricando e abbiamo un sessionWishlistId
    if (webpliantParams.sessionWishlistId && !webpliantParams.isLoading) {
      initializeFromServerIfNeeded();
    }
  }, [
    webpliantParams.sessionWishlistId,
    webpliantParams.isLoading
    // Rimossa getCompletionStatus dalle dipendenze perché crea un nuovo oggetto ogni volta
  ]);

  // Funzione per creare una nuova sessione se non esiste
  const ensureSessionExists = useCallback(async () => {
    if (!webpliantParams.sessionIdWebpliant && !isCreatingSession.current) {
      isCreatingSession.current = true;
      try {
        await webpliantParams.ensureSessionExists();
        return true; // Sessione creata o tentativo effettuato
      } catch (error) {
        console.error('❌ Errore nella creazione della sessione webpliant:', error);
        return false;
      } finally {
        isCreatingSession.current = false;
      }
    }
    return false; // Nessuna azione necessaria
  }, [webpliantParams]);
  
  // Funzione per creare una nuova wishlist se non esiste
  const ensureWishlistExists = useCallback(async () => {
    if (!isCreatingWishlist.current) {
      isCreatingWishlist.current = true;
      try {
        const wishlistId = await webpliantParams.ensureWishlistExists();
        if (wishlistId) {
          return true;
        } else {
          return false;
        }
      } catch (error) {
        console.error('❌ Errore nella verifica/creazione della wishlist webpliant:', error);
        return false;
      } finally {
        isCreatingWishlist.current = false;
      }
    } else {
      return false;
    }
  }, [webpliantParams]);

  // Inizializzazione automatica al primo mount
  useEffect(() => {
    const initializeOnMount = async () => {
      if (hasMountInitialized.current) {
        return;
      }

      hasMountInitialized.current = true;
      
      // Se non abbiamo nemmeno una sessione, creala subito
      if (!webpliantParams.sessionIdWebpliant) {
        await ensureSessionExists();
      }
      
      // Se abbiamo una sessione ma non una wishlist, creala
      if (webpliantParams.sessionIdWebpliant && !webpliantParams.sessionWishlistId) {
        await ensureWishlistExists();
      }
    };

    // Esegui solo al primo mount e se non stiamo già caricando
    if (!webpliantParams.isLoading && !hasMountInitialized.current) {
      initializeOnMount();
    }
  }, []); // Dipendenze vuote = esegui solo al mount

  // Auto-creazione sessione e wishlist quando abbiamo tutti i parametri essenziali
  useEffect(() => {
    const autoCreateSessionAndWishlist = async () => {
      const status = webpliantParams.getCompletionStatus();
      
      // Controlla se lo stato è cambiato rispetto all'ultimo processato
      const currentState = {
        hasSession: status.hasSession,
        hasWishlist: status.hasWishlist,
        isLoading: webpliantParams.isLoading || false
      };

      const stateChanged = JSON.stringify(currentState) !== JSON.stringify(lastProcessedState.current);
      
      if (!stateChanged) {
        return;
      }


      
      // Aggiorna lo stato processato
      lastProcessedState.current = currentState;
      
      // Prima verifica se esiste una sessione, altrimenti creala
      if (!status.hasSession && !webpliantParams.isLoading && !isCreatingSession.current) {
        const sessionCreated = await ensureSessionExists();
        if (sessionCreated) return; // Aspetta il prossimo ciclo per creare la wishlist
      }
      
      // Se abbiamo una sessione ma non una wishlist, creala sempre
      if (status.hasSession && !status.hasWishlist && !webpliantParams.isLoading && !isCreatingWishlist.current) {
        await ensureWishlistExists();
      }
    };

    // Debounce più aggressivo: esegui solo se sono passati almeno 2000ms dall'ultimo cambio
    const timeoutId = setTimeout(() => {
      // Controlli più rigorosi per evitare chiamate inutili
      const status = webpliantParams.getCompletionStatus();
      
      const shouldRun = !webpliantParams.isLoading && 
                       (!status.hasSession || !status.hasWishlist) &&
                       !isCreatingSession.current &&
                       !isCreatingWishlist.current;

      
      if (shouldRun) {
        autoCreateSessionAndWishlist();
      }
    }, 2000); // Aumentato a 2 secondi

    return () => clearTimeout(timeoutId);
  }, [
    // Ridotte drasticamente le dipendenze - solo quelle essenziali
    webpliantParams.sessionIdWebpliant,
    webpliantParams.sessionWishlistId,
    webpliantParams.isLoading
    // Rimossi: idArea, idCanale, idGDO, idWorkspace, ensureSessionExists, ensureWishlistExists
  ]);

  // Reset del lastProcessedState quando i parametri essenziali cambiano significativamente
  useEffect(() => {
    const essentialParamsChanged = webpliantParams.idArea || webpliantParams.idCanale || webpliantParams.idGDO || webpliantParams.idWorkspace;
    if (essentialParamsChanged) {
      lastProcessedState.current = {
        hasSession: false,
        hasWishlist: false,
        isLoading: false
      };
    }
  }, [webpliantParams.idArea, webpliantParams.idCanale, webpliantParams.idGDO, webpliantParams.idWorkspace]);

  // Funzione di utilità per costruire URL con parametri attuali
  const buildUrlWithCurrentParams = useCallback((basePath: string) => {
    const params = new URLSearchParams();
    
    if (webpliantParams.idArea) params.set('idArea', webpliantParams.idArea);
    if (webpliantParams.idCanale) params.set('idCanale', webpliantParams.idCanale);
    if (webpliantParams.idGDO) params.set('idGDO', webpliantParams.idGDO);
    if (webpliantParams.idPV) params.set('idPV', webpliantParams.idPV);
    if (webpliantParams.idWorkspace) params.set('id', webpliantParams.idWorkspace);
    if (webpliantParams.idPagina) params.set('idPagina', webpliantParams.idPagina);
    if (webpliantParams.sessionWishlistId) params.set('sessionWishlistId', webpliantParams.sessionWishlistId);
    if (webpliantParams.isCondivisa) params.set('c', 'true');

    return `${basePath}?${params.toString()}`;
  }, [
    webpliantParams.idArea,
    webpliantParams.idCanale,
    webpliantParams.idGDO,
    webpliantParams.idPV,
    webpliantParams.idWorkspace,
    webpliantParams.idPagina,
    webpliantParams.sessionWishlistId,
    webpliantParams.isCondivisa
  ]);

  // Funzione di utilità per navigare mantenendo i parametri
  const navigateWithParams = useCallback((basePath: string) => {
    const url = buildUrlWithCurrentParams(basePath);
    window.location.href = url;
  }, [buildUrlWithCurrentParams]);

  // Funzione per forzare la creazione di una wishlist con parametri di default se necessario
  const forceCreateWishlist = useCallback(async () => {
    // Controlla se una creazione è già in corso
    if (isCreatingWishlist.current) {
      return;
    }

    // Prima assicuriamoci di avere una sessione
    if (!webpliantParams.sessionIdWebpliant) {
      await ensureSessionExists();
      return; // Lascia che il prossimo ciclo gestisca la wishlist
    }

    // Se non abbiamo i parametri essenziali, imposta valori di default temporanei
    const status = webpliantParams.getCompletionStatus();
    if (!status.hasEssentialParams) {
      
      // Imposta parametri temporanei per permettere la creazione della wishlist
      const defaultParams: Record<string, string> = {};
      
      if (!webpliantParams.idArea) defaultParams.idArea = 'default-area';
      if (!webpliantParams.idCanale) defaultParams.idCanale = 'default-canale';
      if (!webpliantParams.idGDO) defaultParams.idGDO = 'default-gdo';
      if (!webpliantParams.idWorkspace) defaultParams.idWorkspace = 'default-workspace';
      if (!webpliantParams.idPagina) defaultParams.idPagina = 'default-pagina';
      
      // Imposta i parametri temporanei
      webpliantParams.setParams(defaultParams);
    }
    
    // Ora crea la wishlist
    if (!webpliantParams.sessionWishlistId) {
      try {
        await webpliantParams.ensureWishlistExists();
      } catch (error) {
        console.error('❌ Errore nella forzatura della creazione della wishlist:', error);
      }
    }
  }, [webpliantParams, ensureSessionExists]);

  // Funzione per forzare l'inizializzazione completa
  const forceInitialization = useCallback(async () => {
    
    try {
      // Prima assicuriamoci di avere una sessione
      if (!webpliantParams.sessionIdWebpliant) {
        await webpliantParams.ensureSessionExists();
      }
      
      // Poi assicuriamoci di avere una wishlist
      if (!webpliantParams.sessionWishlistId) {
        await webpliantParams.ensureWishlistExists();
      }
      
    } catch (error) {
      console.error('❌ Errore nella forzatura inizializzazione:', error);
    }
  }, [webpliantParams]);

  // Calcola status una sola volta per evitare nuovi oggetti
  const completionStatus = webpliantParams.getCompletionStatus();

  // Ritorna oggetto con parametri e utility functions
  return {
    // Parametri attuali
    ...webpliantParams,
    
    // Utility functions
    buildUrlWithCurrentParams,
    navigateWithParams,
    ensureSessionExists,
    ensureWishlistExists,
    forceCreateWishlist,
    forceInitialization,
    
    // Shortcuts per status (pre-calcolati)
    isReady: completionStatus.isComplete,
    hasEssentialParams: completionStatus.hasEssentialParams,
    hasSession: completionStatus.hasSession,
    hasWishlist: completionStatus.hasWishlist,
  };
};

export default useWebpliantParamsManager; 