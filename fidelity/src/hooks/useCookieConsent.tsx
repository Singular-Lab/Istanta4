import { useState, useEffect, useCallback } from 'react';

export interface CookiePreferences {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
  preferences: boolean;
}

export interface CookieConsentHook {
  preferences: CookiePreferences | null;
  hasConsent: boolean;
  updatePreferences: (newPreferences: CookiePreferences) => void;
  clearConsent: () => void;
  getConsentDate: () => Date | null;
}

const DEFAULT_PREFERENCES: CookiePreferences = {
  necessary: true,
  analytics: false,
  marketing: false,
  preferences: false,
};

/**
 * Hook per gestire le preferenze dei cookie
 * Fornisce funzioni per leggere, aggiornare e gestire il consenso ai cookie
 */
export const useCookieConsent = (): CookieConsentHook => {
  const [preferences, setPreferences] = useState<CookiePreferences | null>(null);
  const [hasConsent, setHasConsent] = useState<boolean>(false);

  // Carica le preferenze salvate al mount
  useEffect(() => {
    const loadSavedPreferences = () => {
      try {
        const savedPreferences = localStorage.getItem('cookie-consent');
        if (savedPreferences) {
          const parsed = JSON.parse(savedPreferences) as CookiePreferences;
          setPreferences(parsed);
          setHasConsent(true);
          
          // Log per debug
          console.log('Cookie preferences loaded:', parsed);
        } else {
          setPreferences(null);
          setHasConsent(false);
        }
      } catch (error) {
        console.error('Error loading cookie preferences:', error);
        setPreferences(null);
        setHasConsent(false);
      }
    };

    loadSavedPreferences();

    // Listener per cambiamenti nel localStorage (per sincronizzazione tra tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'cookie-consent') {
        loadSavedPreferences();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Aggiorna le preferenze
  const updatePreferences = useCallback((newPreferences: CookiePreferences) => {
    try {
      // Salva nel localStorage
      localStorage.setItem('cookie-consent', JSON.stringify(newPreferences));
      localStorage.setItem('cookie-consent-date', new Date().toISOString());
      
      // Aggiorna lo stato
      setPreferences(newPreferences);
      setHasConsent(true);

      // Qui potresti integrare con strumenti di analytics
      if (newPreferences.analytics) {
        // Esempio: inizializza Google Analytics
        console.log('Analytics cookies accepted - initialize tracking');
      } else {
        // Esempio: disabilita Google Analytics
        console.log('Analytics cookies rejected - disable tracking');
      }

      if (newPreferences.marketing) {
        // Esempio: inizializza pixel di marketing
        console.log('Marketing cookies accepted - initialize pixels');
      } else {
        // Esempio: disabilita pixel di marketing
        console.log('Marketing cookies rejected - disable pixels');
      }

      console.log('Cookie preferences updated:', newPreferences);
    } catch (error) {
      console.error('Error updating cookie preferences:', error);
    }
  }, []);

  // Cancella il consenso
  const clearConsent = useCallback(() => {
    try {
      localStorage.removeItem('cookie-consent');
      localStorage.removeItem('cookie-consent-date');
      setPreferences(null);
      setHasConsent(false);
      console.log('Cookie consent cleared');
    } catch (error) {
      console.error('Error clearing cookie consent:', error);
    }
  }, []);

  // Ottieni la data del consenso
  const getConsentDate = useCallback((): Date | null => {
    try {
      const dateString = localStorage.getItem('cookie-consent-date');
      return dateString ? new Date(dateString) : null;
    } catch (error) {
      console.error('Error getting consent date:', error);
      return null;
    }
  }, []);

  return {
    preferences,
    hasConsent,
    updatePreferences,
    clearConsent,
    getConsentDate,
  };
};

/**
 * Hook per verificare se un tipo specifico di cookie è consentito
 */
export const useCookiePermission = (cookieType: keyof CookiePreferences): boolean => {
  const { preferences, hasConsent } = useCookieConsent();
  
  // Se non c'è consenso, solo i cookie necessari sono permessi
  if (!hasConsent) {
    return cookieType === 'necessary';
  }
  
  // Se c'è consenso, controlla le preferenze
  return preferences?.[cookieType] ?? false;
};

export default useCookieConsent; 