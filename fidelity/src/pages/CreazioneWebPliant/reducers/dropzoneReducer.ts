import { PageLayoutItem } from "../../../../lib/types";

// Stato per Dropzone
export interface DropzoneState {
  // Stato drop
  dropState: {
    isOver: boolean;
    canDrop: boolean;
    draggedItemType: string | null;
    dropIndex: number | null;
    isValidDrop: boolean;
  };

  // Stato degli elementi
  elementsState: {
    elements: PageLayoutItem[];
    filteredElements: PageLayoutItem[];
    selectedElementId: string | null;
    hoveredElementId: string | null;
  };

  // Stato del layout
  layoutState: {
    type: 'row' | 'column' | 'default';
    parentId: string;
    isNested: boolean;
    depth: number;
  };

  // Stato delle performance
  performanceState: {
    shouldRerender: boolean;
    lastUpdateTime: number;
    renderCount: number;
  };

  // Stato delle animazioni
  animationState: {
    isAnimating: boolean;
    animationType: 'drop' | 'remove' | 'reorder' | null;
    animatingElementId: string | null;
  };

  // Cache per ottimizzazioni
  memoizedData: {
    [key: string]: any;
  };
}

// Azioni per Dropzone
export type DropzoneAction =
  | { type: 'INIT_DROPZONE'; payload: { elements: PageLayoutItem[]; type: string; parentId: string } }
  | { type: 'SET_DROP_STATE'; payload: Partial<DropzoneState['dropState']> }
  | { type: 'SET_ELEMENTS'; payload: PageLayoutItem[] }
  | { type: 'ADD_ELEMENT'; payload: { element: PageLayoutItem; index?: number } }
  | { type: 'REMOVE_ELEMENT'; payload: { elementId: string } }
  | { type: 'UPDATE_ELEMENT'; payload: { elementId: string; updates: Partial<PageLayoutItem> } }
  | { type: 'REORDER_ELEMENTS'; payload: { fromIndex: number; toIndex: number } }
  | { type: 'SET_SELECTED_ELEMENT'; payload: string | null }
  | { type: 'SET_HOVERED_ELEMENT'; payload: string | null }
  | { type: 'SET_ANIMATION_STATE'; payload: Partial<DropzoneState['animationState']> }
  | { type: 'SET_MEMOIZED_DATA'; payload: { key: string; value: any } }
  | { type: 'CLEAR_MEMOIZED_DATA' }
  | { type: 'UPDATE_PERFORMANCE_STATE'; payload: Partial<DropzoneState['performanceState']> }
  | { type: 'RESET_DROP_STATE' }
  | { type: 'RESET_STATE' };

// Stato iniziale
export const createDropzoneInitialState = (): DropzoneState => ({
  dropState: {
    isOver: false,
    canDrop: false,
    draggedItemType: null,
    dropIndex: null,
    isValidDrop: false,
  },
  elementsState: {
    elements: [],
    filteredElements: [],
    selectedElementId: null,
    hoveredElementId: null,
  },
  layoutState: {
    type: 'default',
    parentId: '',
    isNested: false,
    depth: 0,
  },
  performanceState: {
    shouldRerender: true,
    lastUpdateTime: Date.now(),
    renderCount: 0,
  },
  animationState: {
    isAnimating: false,
    animationType: null,
    animatingElementId: null,
  },
  memoizedData: {},
});

// Utility per determinare se il drop è valido
const isValidDrop = (
  draggedItemType: string | null,
  targetType: string,
  parentId: string,
  elements: PageLayoutItem[]
): boolean => {
  if (!draggedItemType) return false;

  // Regole specifiche per i tipi di elementi
  switch (targetType) {
    case 'row':
      // Le righe possono contenere solo colonne
      return draggedItemType === 'col' || draggedItemType === 'column';

    case 'column':
      // Le colonne possono contenere qualsiasi elemento tranne altre colonne
      return draggedItemType !== 'col' && draggedItemType !== 'column';

    case 'default':
      // Il root può contenere qualsiasi elemento
      return true;

    default:
      return false;
  }
};

// Utility per filtrare elementi in base alla visibilità
const filterVisibleElements = (elements: PageLayoutItem[]): PageLayoutItem[] => {
  // Implementa logica di filtraggio basata su policy, duration, etc.
  return elements.filter(element => {
    // Per ora restituisci tutti gli elementi
    // In futuro implementare logica di filtraggio più sofisticata
    return true;
  }) as PageLayoutItem[];
};

// Reducer per Dropzone
export const dropzoneReducer = (
  state: DropzoneState,
  action: DropzoneAction
): DropzoneState => {
  switch (action.type) {
    case 'INIT_DROPZONE':
      const isNested = action.payload.parentId !== '';
      const depth = isNested ? 1 : 0; // Calcolo semplificato della profondità

      return {
        ...state,
        elementsState: {
          ...state.elementsState,
          elements: action.payload.elements,
          filteredElements: filterVisibleElements(action.payload.elements),
        },
        layoutState: {
          type: action.payload.type as 'row' | 'column' | 'default',
          parentId: action.payload.parentId,
          isNested,
          depth,
        },
        performanceState: {
          ...state.performanceState,
          lastUpdateTime: Date.now(),
        },
        memoizedData: {}, // Reset cache
      };

    case 'SET_DROP_STATE':
      const newDropState = {
        ...state.dropState,
        ...action.payload,
      };

      // Calcola se il drop è valido
      if (action.payload.draggedItemType !== undefined) {
        newDropState.isValidDrop = isValidDrop(
          newDropState.draggedItemType,
          state.layoutState.type,
          state.layoutState.parentId,
          state.elementsState.elements
        );
      }

      return {
        ...state,
        dropState: newDropState,
      };

    case 'SET_ELEMENTS':
      return {
        ...state,
        elementsState: {
          ...state.elementsState,
          elements: action.payload,
          filteredElements: filterVisibleElements(action.payload),
        },
        performanceState: {
          ...state.performanceState,
          shouldRerender: true,
          lastUpdateTime: Date.now(),
          renderCount: state.performanceState.renderCount + 1,
        },
      };

    case 'ADD_ELEMENT':
      const newElements = [...state.elementsState.elements];
      const insertIndex = action.payload.index ?? newElements.length;
      newElements.splice(insertIndex, 0, action.payload.element);

      return {
        ...state,
        elementsState: {
          ...state.elementsState,
          elements: newElements,
          filteredElements: filterVisibleElements(newElements),
        },
        animationState: {
          isAnimating: true,
          animationType: 'drop',
          animatingElementId: action.payload.element.id,
        },
        performanceState: {
          ...state.performanceState,
          shouldRerender: true,
          lastUpdateTime: Date.now(),
        },
      };

    case 'REMOVE_ELEMENT':
      const elementsAfterRemove = state.elementsState.elements.filter(
        el => el.id !== action.payload.elementId
      );

      return {
        ...state,
        elementsState: {
          ...state.elementsState,
          elements: elementsAfterRemove,
          filteredElements: filterVisibleElements(elementsAfterRemove),
          selectedElementId: state.elementsState.selectedElementId === action.payload.elementId
            ? null
            : state.elementsState.selectedElementId,
        },
        animationState: {
          isAnimating: true,
          animationType: 'remove',
          animatingElementId: action.payload.elementId,
        },
        performanceState: {
          ...state.performanceState,
          shouldRerender: true,
          lastUpdateTime: Date.now(),
        },
      };

    case 'UPDATE_ELEMENT':
      const updatedElements = state.elementsState.elements.map(el =>
        el.id === action.payload.elementId
          ? { ...el, ...action.payload.updates } as PageLayoutItem
          : el
      );

      return {
        ...state,
        elementsState: {
          ...state.elementsState,
          elements: updatedElements,
          filteredElements: filterVisibleElements(updatedElements),
        },
        performanceState: {
          ...state.performanceState,
          shouldRerender: true,
          lastUpdateTime: Date.now(),
        },
      };

    case 'REORDER_ELEMENTS':
      const { fromIndex, toIndex } = action.payload;
      const elementsToReorder = [...state.elementsState.elements];
      const [movedElement] = elementsToReorder.splice(fromIndex, 1);
      elementsToReorder.splice(toIndex, 0, movedElement);

      return {
        ...state,
        elementsState: {
          ...state.elementsState,
          elements: elementsToReorder,
          filteredElements: filterVisibleElements(elementsToReorder),
        },
        animationState: {
          isAnimating: true,
          animationType: 'reorder',
          animatingElementId: movedElement.id,
        },
        performanceState: {
          ...state.performanceState,
          shouldRerender: true,
          lastUpdateTime: Date.now(),
        },
      };

    case 'SET_SELECTED_ELEMENT':
      return {
        ...state,
        elementsState: {
          ...state.elementsState,
          selectedElementId: action.payload,
        },
      };

    case 'SET_HOVERED_ELEMENT':
      return {
        ...state,
        elementsState: {
          ...state.elementsState,
          hoveredElementId: action.payload,
        },
      };

    case 'SET_ANIMATION_STATE':
      return {
        ...state,
        animationState: {
          ...state.animationState,
          ...action.payload,
        },
      };

    case 'SET_MEMOIZED_DATA':
      return {
        ...state,
        memoizedData: {
          ...state.memoizedData,
          [action.payload.key]: action.payload.value,
        },
      };

    case 'CLEAR_MEMOIZED_DATA':
      return {
        ...state,
        memoizedData: {},
      };

    case 'UPDATE_PERFORMANCE_STATE':
      return {
        ...state,
        performanceState: {
          ...state.performanceState,
          ...action.payload,
        },
      };

    case 'RESET_DROP_STATE':
      return {
        ...state,
        dropState: createDropzoneInitialState().dropState,
      };

    case 'RESET_STATE':
      return createDropzoneInitialState();

    default:
      return state;
  }
};

// Hook per Dropzone ottimizzato
import { useCallback, useEffect, useMemo, useReducer } from 'react';

export const useDropzoneReducer = (
  initialElements: PageLayoutItem[],
  type: string,
  parentId: string
) => {
  const [state, dispatch] = useReducer(dropzoneReducer, createDropzoneInitialState());

  // Inizializza dropzone quando cambiano i parametri
  useEffect(() => {
    dispatch({
      type: 'INIT_DROPZONE',
      payload: { elements: initialElements, type, parentId }
    });
  }, [initialElements, type, parentId]);

  // Azioni memoizzate
  const actions = useMemo(() => ({
    setDropState: (dropState: Partial<DropzoneState['dropState']>) =>
      dispatch({ type: 'SET_DROP_STATE', payload: dropState }),

    setElements: (elements: PageLayoutItem[]) =>
      dispatch({ type: 'SET_ELEMENTS', payload: elements }),

    addElement: (element: PageLayoutItem, index?: number) =>
      dispatch({ type: 'ADD_ELEMENT', payload: { element, index } }),

    removeElement: (elementId: string) =>
      dispatch({ type: 'REMOVE_ELEMENT', payload: { elementId } }),

    updateElement: (elementId: string, updates: Partial<PageLayoutItem>) =>
      dispatch({ type: 'UPDATE_ELEMENT', payload: { elementId, updates } }),

    reorderElements: (fromIndex: number, toIndex: number) =>
      dispatch({ type: 'REORDER_ELEMENTS', payload: { fromIndex, toIndex } }),

    setSelectedElement: (elementId: string | null) =>
      dispatch({ type: 'SET_SELECTED_ELEMENT', payload: elementId }),

    setHoveredElement: (elementId: string | null) =>
      dispatch({ type: 'SET_HOVERED_ELEMENT', payload: elementId }),

    setAnimationState: (animationState: Partial<DropzoneState['animationState']>) =>
      dispatch({ type: 'SET_ANIMATION_STATE', payload: animationState }),

    setMemoizedData: (key: string, value: any) =>
      dispatch({ type: 'SET_MEMOIZED_DATA', payload: { key, value } }),

    clearMemoizedData: () =>
      dispatch({ type: 'CLEAR_MEMOIZED_DATA' }),

    updatePerformanceState: (performanceState: Partial<DropzoneState['performanceState']>) =>
      dispatch({ type: 'UPDATE_PERFORMANCE_STATE', payload: performanceState }),

    resetDropState: () =>
      dispatch({ type: 'RESET_DROP_STATE' }),

    resetState: () =>
      dispatch({ type: 'RESET_STATE' }),
  }), []);

  // Selettori memoizzati
  const selectors = useMemo(() => ({
    isOver: state.dropState.isOver,
    canDrop: state.dropState.canDrop,
    isValidDrop: state.dropState.isValidDrop,
    elements: state.elementsState.filteredElements,
    selectedElementId: state.elementsState.selectedElementId,
    hoveredElementId: state.elementsState.hoveredElementId,
    isAnimating: state.animationState.isAnimating,
    animationType: state.animationState.animationType,
    shouldRerender: state.performanceState.shouldRerender,
    renderCount: state.performanceState.renderCount,
    getMemoizedData: (key: string) => state.memoizedData[key],
    isNested: state.layoutState.isNested,
    depth: state.layoutState.depth,
  }), [state]);

  // Callbacks ottimizzati
  const callbacks = useMemo(() => ({
    onDragEnter: useCallback((draggedItemType: string) => {
      actions.setDropState({
        isOver: true,
        draggedItemType,
        canDrop: isValidDrop(draggedItemType, state.layoutState.type, state.layoutState.parentId, state.elementsState.elements)
      });
    }, [actions, state.layoutState, state.elementsState.elements]),

    onDragLeave: useCallback(() => {
      actions.setDropState({ isOver: false, draggedItemType: null, canDrop: false });
    }, [actions]),

    onDrop: useCallback((item: any, index?: number) => {
      if (state.dropState.isValidDrop) {
        const baseElement = {
          id: `element-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          parentId: state.layoutState.parentId,
          user_locked: { locked: false, user_id: "" },
          policy: {
            locked: false,
            visualizzazione: [],
            filtri_contenuto: [],
          },
        };

        // Crea l'elemento con il tipo corretto usando casting appropriato
        const newElement: PageLayoutItem = {
          ...baseElement,
          type: item.type,
          content: item.content || {},
          ...(item.type === "row" || item.type === "col" ? { children: [] } : {}),
        } as PageLayoutItem;

        actions.addElement(newElement, index);
        actions.resetDropState();
        return true;
      }
      return false;
    }, [actions, state.dropState.isValidDrop, state.layoutState.parentId]),

    onElementSelect: useCallback((elementId: string) => {
      actions.setSelectedElement(elementId);
    }, [actions]),

    onElementHover: useCallback((elementId: string | null) => {
      actions.setHoveredElement(elementId);
    }, [actions]),

    onAnimationComplete: useCallback(() => {
      actions.setAnimationState({ isAnimating: false, animationType: null, animatingElementId: null });
    }, [actions]),
  }), [actions, state]);

  return {
    state,
    actions,
    selectors,
    callbacks,
    dispatch,
  };
};
