import React, { useCallback, useRef } from 'react';

/**
 * Hook per debouncing delle funzioni
 * @param callback Funzione da debouncificare
 * @param delay Ritardo in millisecondi (default: 300ms)
 * @returns Funzione debouncificata
 */
export function useDebounce<T extends (...args: any[]) => void>(
  callback: T,
  delay: number = 300
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      // Cancella il timeout precedente se esiste
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Imposta un nuovo timeout
      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay]
  ) as T;

  return debouncedCallback;
}

/**
 * Hook per gestire stato locale con sync debouncificato
 * @param initialValue Valore iniziale
 * @param onUpdate Funzione chiamata quando il valore cambia
 * @param delay Ritardo per il debouncing
 * @returns [valore locale, setter, forza sync immediato]
 */
export function useDebouncedState<T>(
  initialValue: T,
  onUpdate: (value: T) => void,
  delay: number = 300
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const [localValue, setLocalValue] = React.useState<T>(initialValue);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const latestValueRef = useRef<T>(initialValue);

  // Aggiorna il valore locale quando cambia l'initial value
  React.useEffect(() => {
    if (JSON.stringify(initialValue) !== JSON.stringify(localValue)) {
      setLocalValue(initialValue);
      latestValueRef.current = initialValue;
    }
  }, [initialValue]);

  const debouncedUpdate = useCallback(
    (value: T) => {
      // Cancella timeout precedente
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Imposta nuovo timeout
      timeoutRef.current = setTimeout(() => {
        onUpdate(value);
      }, delay);
    },
    [onUpdate, delay]
  );

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      const newValue = typeof value === 'function' 
        ? (value as (prev: T) => T)(latestValueRef.current)
        : value;
      
      latestValueRef.current = newValue;
      setLocalValue(newValue);
      debouncedUpdate(newValue);
    },
    [debouncedUpdate]
  );

  const forceSync = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    onUpdate(latestValueRef.current);
  }, [onUpdate]);

  return [localValue, setValue, forceSync];
}

export default useDebounce; 