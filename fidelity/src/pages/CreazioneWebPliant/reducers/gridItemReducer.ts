import dayjs from "dayjs";
import { PageLayoutItem } from "../../../../lib/types";

// Stato per GridItem
export interface GridItemState {
  // Stato drag & drop
  dragState: {
    isDragging: boolean;
    dragId: string | null;
    dragType: string | null;
    isOver: boolean;
    canDrop: boolean;
  };

  // Stato di visibilità e animazioni
  visibilityState: {
    isVisible: boolean;
    isAnimating: boolean;
    animationType: 'fadeIn' | 'fadeOut' | 'slideIn' | 'slideOut' | null;
  };

  // Stato dell'elemento
  elementState: {
    isSelected: boolean;
    isHovered: boolean;
    isLocked: boolean;
    isPolicyActive: boolean;
  };

  // Stato delle duration
  durationState: {
    hasActiveDuration: boolean;
    isDurationExpired: boolean;
    isDurationImminent: boolean;
    durationClasses: {
      border: string;
      badge: string;
      icon: string;
      tooltip: string;
      text: string;
    } | null;
  };

  // Stato del contenuto effettivo (con override keyframe)
  contentState: {
    baseContent: any;
    effectiveContent: any;
    hasKeyframeOverride: boolean;
    keyframeModifications: any[];
  };

  // Cache per performance
  memoizedProps: {
    [key: string]: any;
  };
}

// Azioni per GridItem
export type GridItemAction =
  | { type: 'INIT_ELEMENT'; payload: { element: PageLayoutItem; effectiveContent: any } }
  | { type: 'SET_DRAG_STATE'; payload: Partial<GridItemState['dragState']> }
  | { type: 'SET_VISIBILITY_STATE'; payload: Partial<GridItemState['visibilityState']> }
  | { type: 'SET_ELEMENT_STATE'; payload: Partial<GridItemState['elementState']> }
  | { type: 'UPDATE_DURATION_STATE'; payload: { element: PageLayoutItem } }
  | { type: 'UPDATE_CONTENT_STATE'; payload: { baseContent: any; effectiveContent: any; hasKeyframeOverride: boolean; modifications: any[] } }
  | { type: 'SET_MEMOIZED_PROP'; payload: { key: string; value: any } }
  | { type: 'CLEAR_MEMOIZED_PROPS' }
  | { type: 'RESET_DRAG_STATE' }
  | { type: 'RESET_STATE' };

// Stato iniziale
export const createGridItemInitialState = (): GridItemState => ({
  dragState: {
    isDragging: false,
    dragId: null,
    dragType: null,
    isOver: false,
    canDrop: false,
  },
  visibilityState: {
    isVisible: true,
    isAnimating: false,
    animationType: null,
  },
  elementState: {
    isSelected: false,
    isHovered: false,
    isLocked: false,
    isPolicyActive: false,
  },
  durationState: {
    hasActiveDuration: false,
    isDurationExpired: false,
    isDurationImminent: false,
    durationClasses: null,
  },
  contentState: {
    baseContent: {},
    effectiveContent: {},
    hasKeyframeOverride: false,
    keyframeModifications: [],
  },
  memoizedProps: {},
});

// Utility per calcolare stato duration
const calculateDurationState = (element: PageLayoutItem) => {
  const { duration } = element;

  if (!duration) {
    return {
      hasActiveDuration: false,
      isDurationExpired: false,
      isDurationImminent: false,
      durationClasses: null,
    };
  }

  try {
    const startDate = dayjs(duration.start_date);
    const endDate = dayjs(duration.end_date);

    if (!startDate.isValid() || !endDate.isValid()) {
      return {
        hasActiveDuration: false,
        isDurationExpired: false,
        isDurationImminent: false,
        durationClasses: null,
      };
    }

    const hasActiveDuration = Boolean(duration.start_date || duration.end_date);

    if (!hasActiveDuration) {
      return {
        hasActiveDuration: false,
        isDurationExpired: false,
        isDurationImminent: false,
        durationClasses: null,
      };
    }

    const now = dayjs();
    const isDurationExpired = endDate.isBefore(now, 'day');
    const daysUntilExpiry = endDate.diff(now, 'day');
    const isDurationImminent = daysUntilExpiry >= 0 && daysUntilExpiry <= 7;

    let durationClasses = null;

    if (isDurationExpired) {
      durationClasses = {
        border: "ring-2 ring-red-500 dark:ring-red-400",
        badge: "bg-red-500 text-white",
        icon: "CalendarX",
        tooltip: "Scaduto",
        text: "Scaduto"
      };
    } else if (isDurationImminent) {
      durationClasses = {
        border: "ring-2 ring-orange-500 dark:ring-orange-400",
        badge: "bg-orange-500 text-white",
        icon: "Clock",
        tooltip: "Scade presto",
        text: "Scade presto"
      };
    } else {
      durationClasses = {
        border: "ring-2 ring-green-500 dark:ring-green-400",
        badge: "bg-green-500 text-white",
        icon: "Calendar",
        tooltip: "Attivo",
        text: "Attivo"
      };
    }

    return {
      hasActiveDuration,
      isDurationExpired,
      isDurationImminent,
      durationClasses,
    };
  } catch (error) {
    console.error('Errore nel calcolo duration state:', error);
    return {
      hasActiveDuration: false,
      isDurationExpired: false,
      isDurationImminent: false,
      durationClasses: null,
    };
  }
};

// Reducer per GridItem
export const gridItemReducer = (
  state: GridItemState,
  action: GridItemAction
): GridItemState => {
  switch (action.type) {
    case 'INIT_ELEMENT':
      const durationState = calculateDurationState(action.payload.element);
      return {
        ...state,
        durationState,
        contentState: {
          ...state.contentState,
          baseContent: action.payload.element.content || {},
          effectiveContent: action.payload.effectiveContent,
        },
        elementState: {
          ...state.elementState,
          isLocked: action.payload.element.user_locked?.locked ?? false,
          isPolicyActive: action.payload.element.policy?.locked ?? false,
        },
        memoizedProps: {}, // Reset cache
      };

    case 'SET_DRAG_STATE':
      return {
        ...state,
        dragState: {
          ...state.dragState,
          ...action.payload,
        },
      };

    case 'SET_VISIBILITY_STATE':
      return {
        ...state,
        visibilityState: {
          ...state.visibilityState,
          ...action.payload,
        },
      };

    case 'SET_ELEMENT_STATE':
      return {
        ...state,
        elementState: {
          ...state.elementState,
          ...action.payload,
        },
      };

    case 'UPDATE_DURATION_STATE':
      return {
        ...state,
        durationState: calculateDurationState(action.payload.element),
      };

    case 'UPDATE_CONTENT_STATE':
      return {
        ...state,
        contentState: {
          baseContent: action.payload.baseContent,
          effectiveContent: action.payload.effectiveContent,
          hasKeyframeOverride: action.payload.hasKeyframeOverride,
          keyframeModifications: action.payload.modifications,
        },
      };

    case 'SET_MEMOIZED_PROP':
      return {
        ...state,
        memoizedProps: {
          ...state.memoizedProps,
          [action.payload.key]: action.payload.value,
        },
      };

    case 'CLEAR_MEMOIZED_PROPS':
      return {
        ...state,
        memoizedProps: {},
      };

    case 'RESET_DRAG_STATE':
      return {
        ...state,
        dragState: createGridItemInitialState().dragState,
      };

    case 'RESET_STATE':
      return createGridItemInitialState();

    default:
      return state;
  }
};

// Hook per GridItem ottimizzato
import { useCallback, useEffect, useMemo, useReducer } from 'react';

export const useGridItemReducer = (element: PageLayoutItem, selectedElementId: string | null) => {
  const [state, dispatch] = useReducer(gridItemReducer, createGridItemInitialState());

  // Inizializza stato quando cambia l'elemento
  useEffect(() => {
    dispatch({
      type: 'INIT_ELEMENT',
      payload: {
        element,
        effectiveContent: element.content || {}
      }
    });
  }, [element.id]);

  // Aggiorna stato selezione quando cambia selectedElementId
  useEffect(() => {
    dispatch({
      type: 'SET_ELEMENT_STATE',
      payload: { isSelected: selectedElementId === element.id }
    });
  }, [selectedElementId, element.id]);

  // Azioni memoizzate
  const actions = useMemo(() => ({
    setDragState: (dragState: Partial<GridItemState['dragState']>) =>
      dispatch({ type: 'SET_DRAG_STATE', payload: dragState }),

    setVisibilityState: (visibilityState: Partial<GridItemState['visibilityState']>) =>
      dispatch({ type: 'SET_VISIBILITY_STATE', payload: visibilityState }),

    setElementState: (elementState: Partial<GridItemState['elementState']>) =>
      dispatch({ type: 'SET_ELEMENT_STATE', payload: elementState }),

    updateDurationState: (element: PageLayoutItem) =>
      dispatch({ type: 'UPDATE_DURATION_STATE', payload: { element } }),

    updateContentState: (baseContent: any, effectiveContent: any, hasKeyframeOverride: boolean, modifications: any[] = []) =>
      dispatch({
        type: 'UPDATE_CONTENT_STATE',
        payload: { baseContent, effectiveContent, hasKeyframeOverride, modifications }
      }),

    setMemoizedProp: (key: string, value: any) =>
      dispatch({ type: 'SET_MEMOIZED_PROP', payload: { key, value } }),

    clearMemoizedProps: () =>
      dispatch({ type: 'CLEAR_MEMOIZED_PROPS' }),

    resetDragState: () =>
      dispatch({ type: 'RESET_DRAG_STATE' }),

    resetState: () =>
      dispatch({ type: 'RESET_STATE' }),
  }), []);

  // Selettori memoizzati
  const selectors = useMemo(() => ({
    isDragging: state.dragState.isDragging,
    isOver: state.dragState.isOver,
    canDrop: state.dragState.canDrop,
    isVisible: state.visibilityState.isVisible,
    isSelected: state.elementState.isSelected,
    isLocked: state.elementState.isLocked,
    isPolicyActive: state.elementState.isPolicyActive,
    hasActiveDuration: state.durationState.hasActiveDuration,
    isDurationExpired: state.durationState.isDurationExpired,
    isDurationImminent: state.durationState.isDurationImminent,
    durationClasses: state.durationState.durationClasses,
    effectiveContent: state.contentState.effectiveContent,
    hasKeyframeOverride: state.contentState.hasKeyframeOverride,
    getMemoizedProp: (key: string) => state.memoizedProps[key],
  }), [state]);

  // Callbacks ottimizzati
  const callbacks = useMemo(() => ({
    onDragStart: useCallback(() => {
      actions.setDragState({ isDragging: true, dragId: element.id, dragType: element.type });
    }, [actions, element.id, element.type]),

    onDragEnd: useCallback(() => {
      actions.resetDragState();
    }, [actions]),

    onDragOver: useCallback(() => {
      actions.setDragState({ isOver: true });
    }, [actions]),

    onDragLeave: useCallback(() => {
      actions.setDragState({ isOver: false });
    }, [actions]),

    onMouseEnter: useCallback(() => {
      actions.setElementState({ isHovered: true });
    }, [actions]),

    onMouseLeave: useCallback(() => {
      actions.setElementState({ isHovered: false });
    }, [actions]),

    onAnimationStart: useCallback((type: GridItemState['visibilityState']['animationType']) => {
      actions.setVisibilityState({ isAnimating: true, animationType: type });
    }, [actions]),

    onAnimationEnd: useCallback(() => {
      actions.setVisibilityState({ isAnimating: false, animationType: null });
    }, [actions]),
  }), [actions]);

  return {
    state,
    actions,
    selectors,
    callbacks,
    dispatch,
  };
};
