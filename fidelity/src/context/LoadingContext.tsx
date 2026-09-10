import React, { createContext, useState, ReactNode, useCallback, useRef, useContext } from 'react';
import LoadingOverlay from '@/components/LoadingOverlay';

interface LoadingContextType {
  showLoader: (message?: string) => void;
  hideLoader: () => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export const useLoading = () => {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
};

interface LoadingProviderProps {
  children: ReactNode;
}

export const LoadingProvider: React.FC<LoadingProviderProps> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | undefined>(undefined);
  const LOADER_DELAY_MS = 50; // 0 = subito; 50‒100ms evita flicker su navigazioni istantanee
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const showLoader = useCallback((msg?: string) => {
    // Cancella eventuale timer precedente
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Partenza quasi immediata, ma lasciamo un piccolo delay per evitare flash
    timerRef.current = setTimeout(() => {
      setMessage(msg);
      setIsLoading(true);
    }, LOADER_DELAY_MS);
  }, []);

  const hideLoader = useCallback(() => {
    if (timerRef.current) {
        clearTimeout(timerRef.current);
    }
    setIsLoading(false);
  }, []);

  return (
    <LoadingContext.Provider value={{ showLoader, hideLoader }}>
      {children}
      <LoadingOverlay isVisible={isLoading} title={message} />
    </LoadingContext.Provider>
  );
}; 