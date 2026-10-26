// ============================================================================
// Hook per la gestione dei Keyframe nella Timeline Webpliant
// ============================================================================

import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { useCallback, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Keyframe, KeyframeModification, PageLayoutItem } from '../../lib/types';

dayjs.extend(isBetween);

// ============================================================================
// INTERFACCE
// ============================================================================





// ============================================================================
// HOOK PRINCIPALE
// ============================================================================

export const useKeyframeManager = (
  originalComponents: PageLayoutItem[],
  updateComponent: (componentId: string, updatedComponent: PageLayoutItem) => void
) => {
  const [activeKeyframeId, setActiveKeyframeId] = useState<string | null>(null);

  // Estrae tutti i keyframes da tutti i componenti
  const allKeyframes = useMemo(() => {
    return originalComponents.flatMap(component => component.keyframes || []);
  }, [originalComponents]);

  // Calcola i componenti modificati in base ai keyframe attivi
  const modifiedComponents = useMemo(() => {
    if (!activeKeyframeId) return originalComponents;

    const activeKeyframe = allKeyframes.find(kf => kf.id === activeKeyframeId);
    if (!activeKeyframe || !activeKeyframe.isActive) return originalComponents;

    // Verifica se il keyframe è attivo nel range temporale corrente
    const now = dayjs();
    const startDate = dayjs(activeKeyframe.startDate);
    const endDate = dayjs(activeKeyframe.endDate);

    if (!now.isBetween(startDate, endDate, 'day', '[]')) {
      return originalComponents;
    }

    // Applica le modifiche del keyframe
    let result = [...originalComponents];

    // Override dei componenti esistenti
    if (activeKeyframe.targetComponentId) {
      result = result.map(comp => {
        if (comp.id === activeKeyframe.targetComponentId) {
          // Applica la modifica per questo componente
          let modifiedComponent = { ...comp };

          if (activeKeyframe.modification && activeKeyframe.modification.elementId === comp.id) {
            const mod = activeKeyframe.modification;
            switch (mod.modificationType) {
              case 'content':
                // Applica modifiche di contenuto
                if ('content' in mod && mod.content) {
                  modifiedComponent = {
                    ...modifiedComponent,
                    content: { ...modifiedComponent.content, ...mod.content }
                  };
                }
                break;
              case 'position':
                // Per le modifiche di posizione, potremmo dover riordinare i componenti
                // Questo verrà gestito a livello superiore se necessario
                if ('oldIndex' in mod && 'newIndex' in mod) {
                  console.log(`Modifica di posizione per ${comp.id}: da ${mod.oldIndex} a ${mod.newIndex}`);
                }
                break;
            }
          }

          return modifiedComponent;
        }
        return comp;
      });

      // Gestisci le modifiche di posizione a livello di array
      // Applica le modifiche di posizione se presenti
      if (activeKeyframe.modification && activeKeyframe.modification.modificationType === 'position') {
        const mod = activeKeyframe.modification;
        // Trova il componente da spostare
        const componentIndex = result.findIndex(comp => comp.id === mod.elementId);
        if (componentIndex !== -1 && 'newIndex' in mod && mod.newIndex !== undefined) {
          // Rimuovi il componente dalla posizione corrente
          const [movedComponent] = result.splice(componentIndex, 1);
          // Inseriscilo nella nuova posizione
          result.splice(mod.newIndex, 0, movedComponent);
        }
      }
    }

    return result;
  }, [originalComponents, allKeyframes, activeKeyframeId]);

  // Aggiunge un nuovo keyframe a un componente specifico
  const addKeyframe = useCallback((componentId: string, keyframe: Omit<Keyframe, 'id' | 'targetComponentId' | 'modification'> & Partial<Pick<Keyframe, 'targetComponentId' | 'modification'>>) => {
    const component = originalComponents.find(comp => comp.id === componentId);
    if (!component) {
      console.error(`❌ Componente ${componentId} non trovato`);
      return null;
    }

    // VINCOLO: I componenti ibridi non possono avere più di un keyframe
    if (component.is_hybrid && (component.keyframes || []).length > 0) {
      console.warn(`⚠️ Impossibile creare keyframe: il componente ibrido ${componentId} ha già un keyframe`);
      return null;
    }

    const newKeyframe: Keyframe = {
      ...keyframe,
      id: `keyframe-${uuidv4()}`,
      targetComponentId: keyframe.targetComponentId ?? componentId,
      modification: keyframe.modification ?? {
        id: `mod_${componentId}_${Date.now()}`,
        elementId: componentId,
        elementType: 'component',
        modificationType: 'content',
        content: null as any, // Non creiamo un oggetto PageLayoutItem generico
        timestamp: new Date().toISOString()
      },
    };

    console.log(`✅ Creando keyframe per componente ${componentId}:`, {
      id: newKeyframe.id,
      targetComponentId: newKeyframe.targetComponentId,
      modification: newKeyframe.modification,
      startDate: newKeyframe.startDate,
      endDate: newKeyframe.endDate,
      isActive: newKeyframe.isActive,
      isHybrid: component.is_hybrid,
      existingKeyframesCount: (component.keyframes || []).length
    });

    const updatedComponent = {
      ...component,
      keyframes: [...(component.keyframes || []), newKeyframe]
    };
    updateComponent(componentId, updatedComponent);
    return newKeyframe.id;
  }, [originalComponents, updateComponent]);

  // Aggiorna un keyframe esistente
  const updateKeyframe = useCallback((keyframeId: string, updates: Partial<Keyframe>) => {
    // Trova il componente che contiene questo keyframe
    const componentWithKeyframe = originalComponents.find(comp =>
      comp.keyframes?.some(kf => kf.id === keyframeId)
    );

    if (componentWithKeyframe) {
      const updatedComponent = {
        ...componentWithKeyframe,
        keyframes: componentWithKeyframe.keyframes?.map(kf =>
          kf.id === keyframeId ? { ...kf, ...updates } : kf
        ) || []
      };
      updateComponent(componentWithKeyframe.id, updatedComponent);
    }
  }, [originalComponents, updateComponent]);

  // Elimina un keyframe
  const deleteKeyframe = useCallback((keyframeId: string) => {
    // Trova il componente che contiene questo keyframe
    const componentWithKeyframe = originalComponents.find(comp =>
      comp.keyframes?.some(kf => kf.id === keyframeId)
    );

    if (componentWithKeyframe) {
      const updatedComponent = {
        ...componentWithKeyframe,
        keyframes: componentWithKeyframe.keyframes?.filter(kf => kf.id !== keyframeId) || []
      };
      updateComponent(componentWithKeyframe.id, updatedComponent);
    }

    if (activeKeyframeId === keyframeId) {
      setActiveKeyframeId(null);
    }
  }, [originalComponents, updateComponent, activeKeyframeId]);

  // Aggiunge una modifica a un keyframe
  const addModification = useCallback((
    keyframeId: string,
    modification: Omit<KeyframeModification, 'id' | 'timestamp'>
  ) => {
    const newModification: KeyframeModification = {
      ...modification,
      id: `mod-${dayjs().valueOf()}`,
      timestamp: dayjs().toISOString(),
    } as KeyframeModification;

    console.log(`🔧 Aggiungendo modifica al keyframe ${keyframeId}:`, newModification);

    // Trova il componente che contiene questo keyframe
    const componentWithKeyframe = originalComponents.find(comp =>
      comp.keyframes?.some(kf => kf.id === keyframeId)
    );

    if (componentWithKeyframe) {
      const keyframe = componentWithKeyframe.keyframes?.find(kf => kf.id === keyframeId);
      console.log(`📋 Keyframe trovato:`, {
        id: keyframe?.id,
        targetComponentId: keyframe?.targetComponentId,
        modificationsCount: keyframe?.modification ? 1 : 0
      });

      const updatedComponent = {
        ...componentWithKeyframe,
        keyframes: componentWithKeyframe.keyframes?.map(kf =>
          kf.id === keyframeId
            ? {
              ...kf,
              modification: newModification
            }
            : kf
        ) || []
      };

      console.log(`💾 Aggiornando componente ${componentWithKeyframe.id} con nuova modifica`);
      updateComponent(componentWithKeyframe.id, updatedComponent);
    } else {
      console.log(`❌ Componente con keyframe ${keyframeId} non trovato`);
    }
  }, [originalComponents, updateComponent]);

  // Registra una modifica di contenuto per un keyframe attivo
  const recordContentModification = useCallback((
    componentId: string,
    newContent: any,
    elementType: string = 'component',
    selectedDate?: dayjs.Dayjs
  ) => {
    // Usa la data selezionata o la data corrente
    const targetDate = selectedDate || dayjs();

    console.log(`Tentativo di registrare modifica per componente ${componentId} nella data ${targetDate.format('DD/MM/YYYY')}`);
    console.log('Keyframes disponibili:', allKeyframes.map(kf => ({
      id: kf.id,
      targetComponentId: kf.targetComponentId,
      isActive: kf.isActive,
      startDate: kf.startDate,
      endDate: kf.endDate
    })));

    // Trova il keyframe attivo per questo componente nella data specificata
    const activeKeyframe = allKeyframes.find(kf => {
      const isActive = kf.isActive;
      const isForComponent = kf.targetComponentId === componentId;
      const isInDateRange = targetDate.isBetween(dayjs(kf.startDate), dayjs(kf.endDate), 'day', '[]');

      console.log(`Keyframe ${kf.id}: isActive=${isActive}, isForComponent=${isForComponent}, isInDateRange=${isInDateRange}`);

      return isActive && isForComponent && isInDateRange;
    });

    if (activeKeyframe) {
      // Crea la modifica di contenuto
      const contentModification: Omit<KeyframeModification, 'id' | 'timestamp'> = {
        elementId: componentId,
        elementType,
        modificationType: 'content',
        content: newContent
      } as Omit<KeyframeModification, 'id' | 'timestamp'>;

      addModification(activeKeyframe.id, contentModification);
      console.log(`✅ Modifica registrata per keyframe ${activeKeyframe.id} (data: ${targetDate.format('DD/MM/YYYY')}):`, contentModification);
    } else {
      console.log(`❌ Nessun keyframe attivo trovato per componente ${componentId} nella data ${targetDate.format('DD/MM/YYYY')}`);
    }
  }, [allKeyframes, addModification]);

  // Registra una modifica di posizione per un keyframe attivo
  const recordPositionModification = useCallback((
    componentId: string,
    oldIndex: number,
    newIndex: number,
    elementType: string = 'component',
    selectedDate?: dayjs.Dayjs
  ) => {
    // Usa la data selezionata o la data corrente
    const targetDate = selectedDate || dayjs();

    console.log(`Tentativo di registrare modifica di posizione per componente ${componentId} nella data ${targetDate.format('DD/MM/YYYY')}`);

    // Trova il keyframe attivo per questo componente nella data specificata
    const activeKeyframe = allKeyframes.find(kf => {
      const isActive = kf.isActive;
      const isForComponent = kf.targetComponentId === componentId;
      const isInDateRange = targetDate.isBetween(dayjs(kf.startDate), dayjs(kf.endDate), 'day', '[]');

      return isActive && isForComponent && isInDateRange;
    });

    if (activeKeyframe) {
      // Crea la modifica di posizione
      const positionModification: Omit<KeyframeModification, 'id' | 'timestamp'> = {
        elementId: componentId,
        elementType,
        modificationType: 'position',
        oldIndex,
        newIndex
      } as Omit<KeyframeModification, 'id' | 'timestamp'>;

      addModification(activeKeyframe.id, positionModification);
      console.log(`✅ Modifica di posizione registrata per keyframe ${activeKeyframe.id} (data: ${targetDate.format('DD/MM/YYYY')}):`, positionModification);
    } else {
      console.log(`❌ Nessun keyframe attivo trovato per componente ${componentId} nella data ${targetDate.format('DD/MM/YYYY')}`);
    }
  }, [allKeyframes, addModification]);

  // Registra una modifica generica (per compatibilità)
  const recordModification = useCallback((
    componentId: string,
    modificationType: 'content' | 'position',
    data: any,
    elementType: string = 'component',
    selectedDate?: dayjs.Dayjs
  ) => {
    console.log(`🎬 useKeyframeManager.recordModification chiamato:`, {
      componentId,
      modificationType,
      data,
      elementType,
      selectedDate: selectedDate?.format('DD/MM/YYYY'),
      hasSelectedDate: !!selectedDate
    });

    if (modificationType === 'content') {
      console.log(`🎬 Chiamando recordContentModification per componente ${componentId}`);
      recordContentModification(componentId, data, elementType, selectedDate);
    } else if (modificationType === 'position') {
      console.log(`🎬 Chiamando recordPositionModification per componente ${componentId}`);
      recordPositionModification(componentId, data.oldIndex, data.newIndex, elementType, selectedDate);
    }
  }, [recordContentModification, recordPositionModification]);

  // Ottiene le modifiche per un keyframe specifico
  const getKeyframeModifications = useCallback((keyframeId: string) => {
    const keyframe = allKeyframes.find(kf => kf.id === keyframeId);
    return keyframe?.modification ? [keyframe.modification] : [];
  }, [allKeyframes]);

  // Applica le modifiche di un keyframe a una data specifica
  const applyKeyframeModifications = useCallback((
    keyframeId: string,
    components: PageLayoutItem[],
    targetDate?: dayjs.Dayjs
  ) => {
    const keyframe = allKeyframes.find(kf => kf.id === keyframeId);
    if (!keyframe || !keyframe.isActive) return components;

    const date = targetDate || dayjs();
    const startDate = dayjs(keyframe.startDate);
    const endDate = dayjs(keyframe.endDate);

    // Verifica se la data è nel range del keyframe
    if (!date.isBetween(startDate, endDate, 'day', '[]')) {
      return components;
    }

    const result = [...components];

    // Applica le modifiche di contenuto
    if (keyframe.modification && keyframe.modification.modificationType === 'content') {
      const mod = keyframe.modification;
      const componentIndex = result.findIndex(comp => comp.id === mod.elementId);
      if (componentIndex !== -1 && 'content' in mod && mod.content) {
        result[componentIndex] = {
          ...result[componentIndex],
          content: { ...result[componentIndex].content, ...mod.content }
        };
      }
    }

    // Applica le modifiche di posizione
    if (keyframe.modification && keyframe.modification.modificationType === 'position') {
      const mod = keyframe.modification;
      const componentIndex = result.findIndex(comp => comp.id === mod.elementId);
      if (componentIndex !== -1 && 'newIndex' in mod && mod.newIndex !== undefined) {
        const [movedComponent] = result.splice(componentIndex, 1);
        result.splice(mod.newIndex, 0, movedComponent);
      }
    }

    return result;
  }, [allKeyframes]);

  // Rimuove una modifica da un keyframe
  const removeModification = useCallback((keyframeId: string, modificationId: string) => {
    // Trova il componente che contiene questo keyframe
    const componentWithKeyframe = originalComponents.find(comp =>
      comp.keyframes?.some(kf => kf.id === keyframeId)
    );

    if (componentWithKeyframe) {
      const updatedComponent = {
        ...componentWithKeyframe,
        keyframes: componentWithKeyframe.keyframes?.filter(kf =>
          kf.id !== keyframeId || kf.modification.id !== modificationId
        ) || []
      };
      updateComponent(componentWithKeyframe.id, updatedComponent);
    }
  }, [originalComponents, updateComponent]);

  // Attiva/disattiva un keyframe
  const toggleKeyframeActive = useCallback((keyframeId: string) => {
    // Trova il componente che contiene questo keyframe
    const componentWithKeyframe = originalComponents.find(comp =>
      comp.keyframes?.some(kf => kf.id === keyframeId)
    );

    if (componentWithKeyframe) {
      const updatedComponent = {
        ...componentWithKeyframe,
        keyframes: componentWithKeyframe.keyframes?.map(kf =>
          kf.id === keyframeId ? { ...kf, isActive: !kf.isActive } : kf
        ) || []
      };
      updateComponent(componentWithKeyframe.id, updatedComponent);
    }
  }, [originalComponents, updateComponent]);

  // Imposta il keyframe attivo per la data corrente
  const setActiveKeyframeForDate = useCallback((date: dayjs.Dayjs) => {
    const activeKeyframe = allKeyframes.find(kf => {
      if (!kf.isActive) return false;

      const startDate = dayjs(kf.startDate);
      const endDate = dayjs(kf.endDate);

      return date.isBetween(startDate, endDate, 'day', '[]');
    });

    setActiveKeyframeId(activeKeyframe?.id || null);
  }, [allKeyframes]);

  // Ottiene i keyframe attivi per una data specifica
  const getActiveKeyframesForDate = useCallback((date: dayjs.Dayjs) => {
    return allKeyframes.filter(kf => {
      if (!kf.isActive) return false;

      const startDate = dayjs(kf.startDate);
      const endDate = dayjs(kf.endDate);

      return date.isBetween(startDate, endDate, 'day', '[]');
    });
  }, [allKeyframes]);

  // Duplica un keyframe
  const duplicateKeyframe = useCallback((keyframeId: string) => {
    const originalKeyframe = allKeyframes.find(kf => kf.id === keyframeId);
    if (!originalKeyframe) return null;

    // Trova il componente che contiene il keyframe originale
    const componentWithKeyframe = originalComponents.find(comp =>
      comp.keyframes?.some(kf => kf.id === keyframeId)
    );

    if (!componentWithKeyframe) return null;

    // VINCOLO: I componenti ibridi non possono avere più di un keyframe
    if (componentWithKeyframe.is_hybrid && (componentWithKeyframe.keyframes || []).length > 0) {
      console.warn(`⚠️ Impossibile duplicare keyframe: il componente ibrido ${componentWithKeyframe.id} può avere solo un keyframe`);
      return null;
    }

    const duplicatedKeyframe: Keyframe = {
      ...originalKeyframe,
      id: `keyframe-${uuidv4()}`,
      name: `${originalKeyframe.name} (Copia)`,
      startDate: dayjs(originalKeyframe.startDate).add(7, 'days').format('YYYY-MM-DD'),
      endDate: dayjs(originalKeyframe.endDate).add(7, 'days').format('YYYY-MM-DD'),
    };

    const updatedComponent = {
      ...componentWithKeyframe,
      keyframes: [...(componentWithKeyframe.keyframes || []), duplicatedKeyframe]
    };
    updateComponent(componentWithKeyframe.id, updatedComponent);

    return duplicatedKeyframe.id;
  }, [allKeyframes, originalComponents, updateComponent]);

  return {
    // Stato
    keyframes: allKeyframes,
    activeKeyframeId,
    modifiedComponents,

    // Azioni
    addKeyframe,
    updateKeyframe,
    deleteKeyframe,
    addModification,
    removeModification,
    toggleKeyframeActive,
    setActiveKeyframeForDate,
    getActiveKeyframesForDate,
    duplicateKeyframe,

    // Registrazione modifiche
    recordContentModification,
    recordPositionModification,
    recordModification,

    // Gestione modifiche
    getKeyframeModifications,
    applyKeyframeModifications,

    // Utility
    setActiveKeyframeId,
  };
};
