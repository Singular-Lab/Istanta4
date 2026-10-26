import { useCallback, useEffect, useRef, useState } from "react";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { STATO_LAVORAZIONE_KIT_RUNTIME } from "../../lib/enums";

dayjs.extend(duration);

// Stati in cui la lavorazione è "aperta" (timer live)
const OPEN_STATES: STATO_LAVORAZIONE_KIT_RUNTIME[] = [
  STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE,
  STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE_CON_ERRORI,
  STATO_LAVORAZIONE_KIT_RUNTIME.IN_REVISIONE,
];

interface UseProductionTimerOptions {
  createdAt: Date | string | undefined;
  updatedAt: Date | string | undefined;
  statoLavorazione: STATO_LAVORAZIONE_KIT_RUNTIME;
  updateIntervalMs?: number;
}

interface UseProductionTimerReturn {
  formattedDuration: string | null;
  isLive: boolean;
  elapsedMs: number;
}

/**
 * Hook per calcolare e visualizzare il tempo di produzione.
 * - Quando la lavorazione è "aperta": aggiorna ogni secondo con tempo trascorso live
 * - Quando la lavorazione è "chiusa": mostra il tempo finale statico
 */
export function useProductionTimer(options: UseProductionTimerOptions): UseProductionTimerReturn {
  const {
    createdAt,
    updatedAt,
    statoLavorazione,
    updateIntervalMs = 1000
  } = options;

  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Determina se la lavorazione è "aperta" (timer deve scorrere)
  const isLive = OPEN_STATES.includes(statoLavorazione);

  // Helper per pulire l'intervallo
  const clearIntervalIfExists = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Calcola il tempo trascorso
  const calculateElapsed = useCallback((startDate: Date | string, endDate?: Date | string): number => {
    const start = dayjs(startDate);
    const end = endDate ? dayjs(endDate) : dayjs();
    return Math.max(0, end.diff(start));
  }, []);

  // Formatta la durata in base a se il timer è live o statico
  const formatDuration = useCallback((ms: number, showSeconds: boolean): string | null => {
    if (ms <= 0) return null;

    const dur = dayjs.duration(ms);
    const days = Math.floor(dur.asDays());
    const hours = dur.hours();
    const minutes = dur.minutes();
    const seconds = dur.seconds();

    if (showSeconds) {
      // Formato live con secondi: "Xg Xh Xm Xs" o "Xh Xm Xs" o "Xm Xs" o "Xs"
      if (days > 0) {
        return `${days}g ${hours}h ${minutes}m ${seconds}s`;
      } else if (hours > 0) {
        return `${hours}h ${minutes}m ${seconds}s`;
      } else if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
      } else {
        return `${seconds}s`;
      }
    } else {
      // Formato statico senza secondi: "Xg Xh Xm" o "Xh Xm" o "X minuti"
      if (days > 0) {
        return `${days}g ${hours}h ${minutes}m`;
      } else if (hours > 0) {
        return `${hours}h ${minutes}m`;
      } else {
        return `${minutes} minuti`;
      }
    }
  }, []);

  // Effect principale: gestisce l'intervallo e calcola il tempo trascorso
  useEffect(() => {
    // Early return se non c'è data di inizio
    if (!createdAt) {
      setElapsedMs(0);
      return clearIntervalIfExists;
    }

    if (isLive) {
      // Modalità live: aggiorna ogni secondo
      const updateElapsed = () => {
        const newElapsed = calculateElapsed(createdAt);
        setElapsedMs(newElapsed);
      };

      // Calcola immediatamente
      updateElapsed();

      // Avvia l'intervallo
      intervalRef.current = setInterval(updateElapsed, updateIntervalMs);
    } else {
      // Modalità statica: calcola una volta da createdAt a updatedAt
      clearIntervalIfExists();

      if (updatedAt) {
        const finalElapsed = calculateElapsed(createdAt, updatedAt);
        setElapsedMs(finalElapsed);
      } else {
        setElapsedMs(0);
      }
    }

    // Cleanup su unmount o cambio dipendenze
    return clearIntervalIfExists;
  }, [createdAt, updatedAt, isLive, updateIntervalMs, calculateElapsed, clearIntervalIfExists]);

  // Formatta la durata in base allo stato corrente
  const formattedDuration = formatDuration(elapsedMs, isLive);

  return {
    formattedDuration,
    isLive,
    elapsedMs
  };
}

export default useProductionTimer;
