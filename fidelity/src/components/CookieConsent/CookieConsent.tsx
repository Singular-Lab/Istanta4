import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import Lucide from '@/components/Base/Lucide';
import stylesWP from "@/assets/css/webpliant/stylewp.module.scss";
import { useCookieConsent, type CookiePreferences } from '@/hooks/useCookieConsent';

interface CookieConsentProps {
  className?: string;
}

const CookieConsent: React.FC<CookieConsentProps> = ({ className }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const { hasConsent, preferences, updatePreferences } = useCookieConsent();
  
  const [cookiePreferences, setCookiePreferences] = useState<CookiePreferences>({
    necessary: true, // Always true, cannot be disabled
    analytics: false,
    marketing: false,
    preferences: false,
  });

  // Check if consent has already been given
  useEffect(() => {
    if (!hasConsent) {
      // Show banner after a small delay for better UX
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [hasConsent]);

  // Update local state when preferences change
  useEffect(() => {
    if (preferences) {
      setCookiePreferences(preferences);
    }
  }, [preferences]);

  const handleAcceptAll = () => {
    const allAccepted = {
      necessary: true,
      analytics: true,
      marketing: true,
      preferences: true,
    };
    updatePreferences(allAccepted);
    setIsVisible(false);
  };

  const handleAcceptSelected = () => {
    updatePreferences(cookiePreferences);
    setIsVisible(false);
  };

  const handleRejectAll = () => {
    const minimal = {
      necessary: true,
      analytics: false,
      marketing: false,
      preferences: false,
    };
    updatePreferences(minimal);
    setIsVisible(false);
  };

  const handleTogglePreference = (key: keyof CookiePreferences) => {
    if (key === 'necessary') return; // Cannot toggle necessary cookies
    
    setCookiePreferences(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 100, scale: 0.8 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 100, scale: 0.8 }}
        transition={{ 
          type: "spring", 
          stiffness: 300, 
          damping: 30,
          duration: 0.4 
        }}
        className={clsx(
          "fixed bottom-4 right-4 z-[99999]",
          "max-w-sm w-full",
          stylesWP["wp-bg-white"],
          stylesWP["wp-border"],
          stylesWP["wp-border-primary"],
          stylesWP["wp-rounded"],
          stylesWP["wp-shadow-lg"],
          className
        )}
        style={{
          maxHeight: showDetails ? '70vh' : 'auto',
          overflowY: showDetails ? 'auto' : 'visible'
        }}
      >
        {/* Header */}
        <div className={clsx(
          stylesWP["wp-d-flex"],
          stylesWP["wp-align-items-center"],
          stylesWP["wp-justify-content-between"],
          stylesWP["wp-p-3"],
          stylesWP["wp-border-bottom"],
          stylesWP["wp-bg-light"]
        )}>
          <h5 className={clsx(
            stylesWP["wp-mb-0"],
            stylesWP["wp-fw-bold"],
            stylesWP["wp-text-dark"]
          )}>
            <Lucide icon="Cookie" className="wp-me-2" width={18} height={18} />
            Gestione Cookie
          </h5>
          <button
            onClick={() => setIsVisible(false)}
            className={clsx(
              stylesWP["wp-btn-close"],
              stylesWP["wp-btn"],
              stylesWP["wp-btn-sm"],
              stylesWP["wp-p-1"]
            )}
            aria-label="Chiudi"
          >
            <Lucide icon="X" width={16} height={16} />
          </button>
        </div>

        {/* Content */}
        <div className={stylesWP["wp-p-3"]}>
          {!showDetails ? (
            // Simple view
            <>
              <p className={clsx(stylesWP["wp-text-muted"], stylesWP["wp-small"], stylesWP["wp-mb-3"])}>
                Utilizziamo i cookie per migliorare la tua esperienza di navigazione e analizzare il traffico del sito.
              </p>
              
              <div className={clsx(stylesWP["wp-d-flex"], stylesWP["wp-flex-column"], stylesWP["wp-gap-2"])}>
                <button
                  onClick={handleAcceptAll}
                  className={clsx(
                    stylesWP["wp-btn"],
                    stylesWP["wp-btn-primary"],
                    stylesWP["wp-btn-sm"],
                    stylesWP["wp-w-100"]
                  )}
                >
                  Accetta Tutti
                </button>
                
                <div className={clsx(stylesWP["wp-d-flex"], stylesWP["wp-gap-2"])}>
                  <button
                    onClick={handleRejectAll}
                    className={clsx(
                      stylesWP["wp-btn"],
                      stylesWP["wp-btn-outline-secondary"],
                      stylesWP["wp-btn-sm"],
                      stylesWP["wp-flex-fill"]
                    )}
                  >
                    Solo Necessari
                  </button>
                  
                  <button
                    onClick={() => setShowDetails(true)}
                    className={clsx(
                      stylesWP["wp-btn"],
                      stylesWP["wp-btn-outline-primary"],
                      stylesWP["wp-btn-sm"],
                      stylesWP["wp-flex-fill"]
                    )}
                  >
                    Personalizza
                  </button>
                </div>
              </div>
            </>
          ) : (
            // Detailed view
            <>
              <p className={clsx(stylesWP["wp-text-muted"], stylesWP["wp-small"], stylesWP["wp-mb-3"])}>
                Scegli quali tipi di cookie consentire. Puoi modificare queste impostazioni in qualsiasi momento.
              </p>

              {/* Cookie Categories */}
              <div className={clsx(stylesWP["wp-mb-3"])}>
                {/* Necessary Cookies */}
                <div className={clsx(stylesWP["wp-d-flex"], stylesWP["wp-justify-content-between"], stylesWP["wp-align-items-center"], stylesWP["wp-mb-2"])}>
                  <div>
                    <strong className={stylesWP["wp-text-dark"]}>Cookie Necessari</strong>
                    <br />
                    <small className={stylesWP["wp-text-muted"]}>
                      Essenziali per il funzionamento del sito
                    </small>
                  </div>
                  <div className={clsx(stylesWP["wp-form-check"], stylesWP["wp-form-switch"])}>
                    <input
                      className={stylesWP["wp-form-check-input"]}
                      type="checkbox"
                      checked={cookiePreferences.necessary}
                      disabled
                      id="necessary-cookies"
                    />
                    <label className={stylesWP["wp-form-check-label"]} htmlFor="necessary-cookies">
                      <span className={stylesWP["wp-visually-hidden"]}>Cookie necessari</span>
                    </label>
                  </div>
                </div>

                {/* Analytics Cookies */}
                <div className={clsx(stylesWP["wp-d-flex"], stylesWP["wp-justify-content-between"], stylesWP["wp-align-items-center"], stylesWP["wp-mb-2"])}>
                  <div>
                    <strong className={stylesWP["wp-text-dark"]}>Cookie Analitici</strong>
                    <br />
                    <small className={stylesWP["wp-text-muted"]}>
                      Per analizzare l'utilizzo del sito
                    </small>
                  </div>
                  <div className={clsx(stylesWP["wp-form-check"], stylesWP["wp-form-switch"])}>
                    <input
                      className={stylesWP["wp-form-check-input"]}
                      type="checkbox"
                      checked={cookiePreferences.analytics}
                      onChange={() => handleTogglePreference('analytics')}
                      id="analytics-cookies"
                    />
                    <label className={stylesWP["wp-form-check-label"]} htmlFor="analytics-cookies">
                      <span className={stylesWP["wp-visually-hidden"]}>Cookie analitici</span>
                    </label>
                  </div>
                </div>

                {/* Marketing Cookies */}
                <div className={clsx(stylesWP["wp-d-flex"], stylesWP["wp-justify-content-between"], stylesWP["wp-align-items-center"], stylesWP["wp-mb-2"])}>
                  <div>
                    <strong className={stylesWP["wp-text-dark"]}>Cookie Marketing</strong>
                    <br />
                    <small className={stylesWP["wp-text-muted"]}>
                      Per pubblicità personalizzata
                    </small>
                  </div>
                  <div className={clsx(stylesWP["wp-form-check"], stylesWP["wp-form-switch"])}>
                    <input
                      className={stylesWP["wp-form-check-input"]}
                      type="checkbox"
                      checked={cookiePreferences.marketing}
                      onChange={() => handleTogglePreference('marketing')}
                      id="marketing-cookies"
                    />
                    <label className={stylesWP["wp-form-check-label"]} htmlFor="marketing-cookies">
                      <span className={stylesWP["wp-visually-hidden"]}>Cookie marketing</span>
                    </label>
                  </div>
                </div>

                {/* Preferences Cookies */}
                <div className={clsx(stylesWP["wp-d-flex"], stylesWP["wp-justify-content-between"], stylesWP["wp-align-items-center"], stylesWP["wp-mb-2"])}>
                  <div>
                    <strong className={stylesWP["wp-text-dark"]}>Cookie Preferenze</strong>
                    <br />
                    <small className={stylesWP["wp-text-muted"]}>
                      Per ricordare le tue preferenze
                    </small>
                  </div>
                  <div className={clsx(stylesWP["wp-form-check"], stylesWP["wp-form-switch"])}>
                    <input
                      className={stylesWP["wp-form-check-input"]}
                      type="checkbox"
                      checked={cookiePreferences.preferences}
                      onChange={() => handleTogglePreference('preferences')}
                      id="preferences-cookies"
                    />
                    <label className={stylesWP["wp-form-check-label"]} htmlFor="preferences-cookies">
                      <span className={stylesWP["wp-visually-hidden"]}>Cookie preferenze</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className={clsx(stylesWP["wp-d-flex"], stylesWP["wp-flex-column"], stylesWP["wp-gap-2"])}>
                <button
                  onClick={handleAcceptSelected}
                  className={clsx(
                    stylesWP["wp-btn"],
                    stylesWP["wp-btn-primary"],
                    stylesWP["wp-btn-sm"],
                    stylesWP["wp-w-100"]
                  )}
                >
                  Salva Preferenze
                </button>
                
                <div className={clsx(stylesWP["wp-d-flex"], stylesWP["wp-gap-2"])}>
                  <button
                    onClick={() => setShowDetails(false)}
                    className={clsx(
                      stylesWP["wp-btn"],
                      stylesWP["wp-btn-outline-secondary"],
                      stylesWP["wp-btn-sm"],
                      stylesWP["wp-flex-fill"]
                    )}
                  >
                    Indietro
                  </button>
                  
                  <button
                    onClick={handleAcceptAll}
                    className={clsx(
                      stylesWP["wp-btn"],
                      stylesWP["wp-btn-outline-primary"],
                      stylesWP["wp-btn-sm"],
                      stylesWP["wp-flex-fill"]
                    )}
                  >
                    Accetta Tutti
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className={clsx(
          stylesWP["wp-px-3"],
          stylesWP["wp-pb-3"]
        )}>
          <small className={clsx(stylesWP["wp-text-muted"], stylesWP["wp-d-block"])}>
            Per maggiori informazioni consulta la nostra{' '}
            <a href="/privacy" className={stylesWP["wp-text-primary"]}>
              Privacy Policy
            </a>
          </small>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CookieConsent; 