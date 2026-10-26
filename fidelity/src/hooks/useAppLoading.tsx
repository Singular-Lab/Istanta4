import { useEffect, useState } from 'react';

export function useAppLoading() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let observer: PerformanceObserver | null = null;

    const timeoutId = setTimeout(() => {
      setIsLoading(false);
      observer?.disconnect();
    }, 3000); // Timeout massimo di 3 secondi

    const handleCLS = (entries: PerformanceObserverEntryList) => {
      for (const entry of entries.getEntries()) {
        if (entry.name === 'layout-shift' && (entry as any).value > 0) {
          setIsLoading(false);
          clearTimeout(timeoutId);
          observer?.disconnect();
          break;
        }
      }
    };

    if ('PerformanceObserver' in window) {
      observer = new PerformanceObserver(handleCLS);
      observer.observe({ type: 'layout-shift', buffered: true });
    } else {
      clearTimeout(timeoutId);
      setIsLoading(false); // Fallback immediato
    }

    return () => {
      observer?.disconnect();
      clearTimeout(timeoutId);
    };
  }, []);

  return isLoading;
}
