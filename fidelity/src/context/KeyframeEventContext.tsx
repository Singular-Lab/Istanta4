// ============================================================================
// Context per la gestione degli eventi dei keyframe
// ============================================================================

import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import React, { createContext, useCallback, useContext, useRef } from 'react';
import { Keyframe } from '../../lib/types';

dayjs.extend(isBetween);

// ============================================================================
// INTERFACCE
// ============================================================================

interface KeyframeEventContextType {
  // Data selezionata nella timeline
  selectedDate: dayjs.Dayjs | null;
  setSelectedDate: (date: dayjs.Dayjs | null) => void;

  // Keyframe attivo per la data selezionata
  activeKeyframe: Keyframe | null;

  // Funzioni per registrare modifiche
  recordModification: (componentId: string, modificationType: 'content' | 'position', data: any) => void;

  // Funzioni per verificare se un componente è visibile
  isComponentVisible: (componentId: string) => boolean;

  // Funzioni per ottenere le modifiche di un componente
  getComponentModifications: (componentId: string) => any[];

  // Funzione per verificare se c'è un keyframe attivo per un componente
  hasActiveKeyframeFor: (componentId: string) => boolean;
}

// ============================================================================
// CONTEXT
// ============================================================================

const KeyframeEventContext = createContext<KeyframeEventContextType | null>(null);

// ============================================================================
// PROVIDER
// ============================================================================

interface KeyframeEventProviderProps {
  children: React.ReactNode;
  keyframes: Keyframe[];
  availableComponents: any[];
  onRecordModification: (componentId: string, modificationType: 'content' | 'position', data: any, elementType?: string, selectedDate?: dayjs.Dayjs) => void;
}

export const KeyframeEventProvider: React.FC<KeyframeEventProviderProps> = ({
  children,
  keyframes,
  availableComponents,
  onRecordModification,
}) => {
  const selectedDateRef = useRef<dayjs.Dayjs | null>(null);
  const [, forceUpdate] = React.useReducer(x => x + 1, 0);

  // Funzione per impostare la data selezionata
  const setSelectedDate = useCallback((date: dayjs.Dayjs | null) => {
    selectedDateRef.current = date;
    forceUpdate();
    console.log('KeyframeEventContext: Data selezionata cambiata:', date?.format('DD/MM/YYYY'));
  }, []);

  // Calcola il keyframe attivo per la data selezionata
  const activeKeyframe = React.useMemo(() => {
    if (!selectedDateRef.current) return null;

    return keyframes.find(kf => {
      if (!kf.isActive) return false;

      const startDate = dayjs(kf.startDate);
      const endDate = dayjs(kf.endDate);

      return selectedDateRef.current!.isBetween(startDate, endDate, 'day', '[]');
    }) || null;
  }, [keyframes, selectedDateRef.current]);

  // Funzione per registrare modifiche
  const recordModification = useCallback((componentId: string, modificationType: 'content' | 'position', data: any) => {
    console.log(`🎭 KeyframeEventContext.recordModification chiamato:`, {
      componentId,
      modificationType,
      data,
      selectedDate: selectedDateRef.current?.format('DD/MM/YYYY'),
      hasSelectedDate: !!selectedDateRef.current
    });

    // Trova il keyframe attivo per la data selezionata (solo per logging)
    const keyframeForDate = selectedDateRef.current ? keyframes.find(kf => {
      if (!kf.isActive) return false;
      const startDate = dayjs(kf.startDate);
      const endDate = dayjs(kf.endDate);
      return selectedDateRef.current!.isBetween(startDate, endDate, 'day', '[]');
    }) : null;

    if (keyframeForDate) {
      console.log('🎭 KeyframeEventContext: Registrando modifica per keyframe attivo:', {
        keyframeId: keyframeForDate.id,
        componentId,
        modificationType,
        data,
        selectedDate: selectedDateRef.current?.format('DD/MM/YYYY')
      });
    } else {
      console.log('🎭 KeyframeEventContext: Nessun keyframe attivo per la data selezionata, ma inoltro comunque al manager');
    }

    // Inoltra sempre la richiesta al manager, che gestirà la logica
    console.log(`🎭 Inoltro al manager con selectedDate: ${selectedDateRef.current?.format('DD/MM/YYYY')}`);
    onRecordModification(componentId, modificationType, data, 'component', selectedDateRef.current || undefined);
  }, [keyframes, onRecordModification]);

  // Funzione per verificare se un componente è visibile
  const isComponentVisible = useCallback((componentId: string) => {
    // Se non c'è data selezionata, tutti i componenti sono visibili
    if (!selectedDateRef.current) return true;

    // Trova il componente per verificare se è ibrido
    const component = availableComponents.find(comp => comp.id === componentId);
    if (!component) return true; // Se non trova il componente, è sempre visibile

    // Se il componente non è ibrido, è sempre visibile
    if (!component.is_hybrid) return true;

    // Per i componenti ibridi, verifica se hanno un keyframe attivo per la data selezionata
    const componentKeyframes = keyframes.filter(kf => kf.targetComponentId === componentId);

    // Se il componente ibrido non ha keyframes, non è visibile
    if (componentKeyframes.length === 0) return false;

    // Per i componenti ibridi, verifica se c'è un keyframe attivo per questa data
    const hasActiveKeyframe = componentKeyframes.some(kf => {
      if (!kf.isActive) return false;
      const startDate = dayjs(kf.startDate);
      const endDate = dayjs(kf.endDate);
      return selectedDateRef.current!.isBetween(startDate, endDate, 'day', '[]');
    });

    // I componenti ibridi sono visibili solo se hanno un keyframe attivo per la data selezionata
    return hasActiveKeyframe;
  }, [availableComponents, keyframes]);

  // Funzione per ottenere le modifiche di un componente
  const getComponentModifications = useCallback((componentId: string) => {
    if (!selectedDateRef.current) return [];

    // Filtra per quel componente specifico e raccogli TUTTE le modifiche in range
    const inRangeForComponent = keyframes.filter(kf => {
      if (!kf.isActive) return false;
      if (kf.targetComponentId !== componentId) return false;
      const start = dayjs(kf.startDate);
      const end = dayjs(kf.endDate);
      return selectedDateRef.current!.isBetween(start, end, 'day', '[]');
    });
    return inRangeForComponent
      .filter(kf => kf.modification && kf.modification.elementId === componentId)
      .map(kf => kf.modification!)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [keyframes]);

  // Funzione per verificare se c'è un keyframe attivo per un componente
  const hasActiveKeyframeFor = useCallback((componentId: string) => {
    if (!selectedDateRef.current) {
      return false;
    }

    const result = keyframes.some(kf => {
      if (!kf.isActive) return false;
      if (kf.targetComponentId !== componentId) return false;
      const start = dayjs(kf.startDate);
      const end = dayjs(kf.endDate);
      const isInRange = selectedDateRef.current!.isBetween(start, end, 'day', '[]');
      return isInRange;
    });

    return result;
  }, [keyframes]);

  const contextValue: KeyframeEventContextType = {
    selectedDate: selectedDateRef.current,
    setSelectedDate,
    activeKeyframe,
    recordModification,
    isComponentVisible,
    getComponentModifications,
    hasActiveKeyframeFor,
  };

  return (
    <KeyframeEventContext.Provider value={contextValue}>
      {children}
    </KeyframeEventContext.Provider>
  );
};

// ============================================================================
// HOOK
// ============================================================================

export const useKeyframeEvents = (): KeyframeEventContextType => {
  const context = useContext(KeyframeEventContext);
  if (!context) {
    throw new Error('useKeyframeEvents deve essere usato all\'interno di KeyframeEventProvider');
  }
  return context;
};

export default KeyframeEventContext;
