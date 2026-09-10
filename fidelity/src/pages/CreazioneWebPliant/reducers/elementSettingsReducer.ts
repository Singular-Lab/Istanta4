import { PageLayoutItem } from "../../../../lib/types";

// Stato per ElementSettings
export interface ElementSettingsState {
  // Contenuto dell'elemento (base + override)
  baseContent: any;
  effectiveContent: any;

  // Stato del form
  formState: {
    selectedRicettaId: string;
    isLoading: boolean;
    hasUnsavedChanges: boolean;
  };

  // Stato delle sezioni collassabili
  sectionsState: {
    [sectionId: string]: boolean; // true = aperta, false = chiusa
  };

  // Stato dei file upload
  uploadState: {
    [fieldName: string]: {
      isUploading: boolean;
      progress: number;
      error?: string;
    };
  };

  // Cache per performance
  memoizedValues: {
    [key: string]: any;
  };
}

// Azioni per ElementSettings
export type ElementSettingsAction =
  | { type: 'INIT_ELEMENT'; payload: { element: PageLayoutItem; effectiveContent: any } }
  | { type: 'UPDATE_BASE_CONTENT'; payload: any }
  | { type: 'UPDATE_EFFECTIVE_CONTENT'; payload: any }
  | { type: 'MERGE_CONTENT_PATCH'; payload: any }
  | { type: 'SET_FORM_FIELD'; payload: { field: keyof ElementSettingsState['formState']; value: any } }
  | { type: 'TOGGLE_SECTION'; payload: { sectionId: string; open?: boolean } }
  | { type: 'SET_UPLOAD_STATE'; payload: { fieldName: string; state: Partial<ElementSettingsState['uploadState'][string]> } }
  | { type: 'CLEAR_UPLOAD_STATE'; payload: { fieldName: string } }
  | { type: 'SET_MEMOIZED_VALUE'; payload: { key: string; value: any } }
  | { type: 'CLEAR_MEMOIZED_VALUES' }
  | { type: 'RESET_STATE' };

// Stato iniziale
export const createElementSettingsInitialState = (): ElementSettingsState => ({
  baseContent: {},
  effectiveContent: {},
  formState: {
    selectedRicettaId: "",
    isLoading: false,
    hasUnsavedChanges: false,
  },
  sectionsState: {
    style: false, // Sezione stile chiusa di default
    policy: true, // Policy aperta di default
    duration: false, // Duration chiusa di default
  },
  uploadState: {},
  memoizedValues: {},
});

// Utility per deep merge ottimizzato
const deepMerge = (...objs: any[]): any => {
  const result = {} as any;

  for (const obj of objs) {
    if (!obj || typeof obj !== 'object') continue;

    for (const [key, value] of Object.entries(obj)) {
      if (Array.isArray(value)) {
        result[key] = value.slice();
      } else if (value && typeof value === 'object') {
        result[key] = deepMerge(result[key] || {}, value);
      } else {
        result[key] = value;
      }
    }
  }

  return result;
};

// Reducer per ElementSettings
export const elementSettingsReducer = (
  state: ElementSettingsState,
  action: ElementSettingsAction
): ElementSettingsState => {
  switch (action.type) {
    case 'INIT_ELEMENT':
      return {
        ...state,
        baseContent: action.payload.element.content || {},
        effectiveContent: action.payload.effectiveContent,
        formState: {
          ...state.formState,
          hasUnsavedChanges: false,
        },
        memoizedValues: {}, // Reset cache quando cambia elemento
      };

    case 'UPDATE_BASE_CONTENT':
      return {
        ...state,
        baseContent: action.payload,
        effectiveContent: deepMerge(state.baseContent, action.payload),
        formState: {
          ...state.formState,
          hasUnsavedChanges: true,
        },
      };

    case 'UPDATE_EFFECTIVE_CONTENT':
      return {
        ...state,
        effectiveContent: action.payload,
        formState: {
          ...state.formState,
          hasUnsavedChanges: true,
        },
      };

    case 'MERGE_CONTENT_PATCH':
      const newEffectiveContent = deepMerge(state.effectiveContent, action.payload);
      return {
        ...state,
        effectiveContent: newEffectiveContent,
        formState: {
          ...state.formState,
          hasUnsavedChanges: true,
        },
      };

    case 'SET_FORM_FIELD':
      return {
        ...state,
        formState: {
          ...state.formState,
          [action.payload.field]: action.payload.value,
        },
      };

    case 'TOGGLE_SECTION':
      return {
        ...state,
        sectionsState: {
          ...state.sectionsState,
          [action.payload.sectionId]: action.payload.open !== undefined
            ? action.payload.open
            : !state.sectionsState[action.payload.sectionId],
        },
      };

    case 'SET_UPLOAD_STATE':
      return {
        ...state,
        uploadState: {
          ...state.uploadState,
          [action.payload.fieldName]: {
            ...state.uploadState[action.payload.fieldName],
            ...action.payload.state,
          },
        },
      };

    case 'CLEAR_UPLOAD_STATE':
      const newUploadState = { ...state.uploadState };
      delete newUploadState[action.payload.fieldName];
      return {
        ...state,
        uploadState: newUploadState,
      };

    case 'SET_MEMOIZED_VALUE':
      return {
        ...state,
        memoizedValues: {
          ...state.memoizedValues,
          [action.payload.key]: action.payload.value,
        },
      };

    case 'CLEAR_MEMOIZED_VALUES':
      return {
        ...state,
        memoizedValues: {},
      };

    case 'RESET_STATE':
      return createElementSettingsInitialState();

    default:
      return state;
  }
};

// Hook per ElementSettings con logica ottimizzata
export const useElementSettingsReducer = () => {
  const [state, dispatch] = React.useReducer(elementSettingsReducer, createElementSettingsInitialState());

  // Azioni memoizzate
  const actions = React.useMemo(() => ({
    initElement: (element: PageLayoutItem, effectiveContent: any) =>
      dispatch({ type: 'INIT_ELEMENT', payload: { element, effectiveContent } }),

    updateBaseContent: (content: any) =>
      dispatch({ type: 'UPDATE_BASE_CONTENT', payload: content }),

    updateEffectiveContent: (content: any) =>
      dispatch({ type: 'UPDATE_EFFECTIVE_CONTENT', payload: content }),

    mergeContentPatch: (patch: any) =>
      dispatch({ type: 'MERGE_CONTENT_PATCH', payload: patch }),

    setFormField: (field: keyof ElementSettingsState['formState'], value: any) =>
      dispatch({ type: 'SET_FORM_FIELD', payload: { field, value } }),

    toggleSection: (sectionId: string, open?: boolean) =>
      dispatch({ type: 'TOGGLE_SECTION', payload: { sectionId, open } }),

    setUploadState: (fieldName: string, uploadState: Partial<ElementSettingsState['uploadState'][string]>) =>
      dispatch({ type: 'SET_UPLOAD_STATE', payload: { fieldName, state: uploadState } }),

    clearUploadState: (fieldName: string) =>
      dispatch({ type: 'CLEAR_UPLOAD_STATE', payload: { fieldName } }),

    setMemoizedValue: (key: string, value: any) =>
      dispatch({ type: 'SET_MEMOIZED_VALUE', payload: { key, value } }),

    clearMemoizedValues: () =>
      dispatch({ type: 'CLEAR_MEMOIZED_VALUES' }),

    resetState: () =>
      dispatch({ type: 'RESET_STATE' }),
  }), []);

  // Selettori memoizzati per performance
  const selectors = React.useMemo(() => ({
    getContentValue: (path: string, defaultValue: any = '') => {
      const keys = path.split('.');
      let value = state.effectiveContent;

      for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
          value = value[key];
        } else {
          return defaultValue;
        }
      }

      return value ?? defaultValue;
    },

    getStyleValue: (category: string, property: string, defaultValue: string = '') => {
      return state.effectiveContent?.style?.[category]?.[property] ?? defaultValue;
    },

    isSectionOpen: (sectionId: string) => {
      return state.sectionsState[sectionId] ?? true;
    },

    isUploading: (fieldName: string) => {
      return state.uploadState[fieldName]?.isUploading ?? false;
    },

    getUploadProgress: (fieldName: string) => {
      return state.uploadState[fieldName]?.progress ?? 0;
    },

    getUploadError: (fieldName: string) => {
      return state.uploadState[fieldName]?.error;
    },

    getMemoizedValue: (key: string) => {
      return state.memoizedValues[key];
    },
  }), [state]);

  // Callbacks ottimizzati
  const callbacks = React.useMemo(() => ({
    handleContentChange: React.useCallback((patch: any) => {
      actions.mergeContentPatch(patch);
    }, [actions]),

    handleStyleChange: React.useCallback((category: string, property: string, value: string) => {
      const stylePatch = {
        style: {
          [category]: {
            [property]: value
          }
        }
      };
      actions.mergeContentPatch(stylePatch);
    }, [actions]),

    handleFileUpload: React.useCallback((fieldName: string, file: File) => {
      actions.setUploadState(fieldName, { isUploading: true, progress: 0 });

      const reader = new FileReader();
      reader.onload = (e) => {
        actions.mergeContentPatch({ [fieldName]: e.target?.result });
        actions.clearUploadState(fieldName);
      };
      reader.onerror = () => {
        actions.setUploadState(fieldName, {
          isUploading: false,
          error: 'Errore durante il caricamento del file'
        });
      };
      reader.readAsDataURL(file);
    }, [actions]),

    handleSectionToggle: React.useCallback((sectionId: string) => {
      actions.toggleSection(sectionId);
    }, [actions]),
  }), [actions]);

  return {
    state,
    actions,
    selectors,
    callbacks,
    dispatch, // Per casi speciali
  };
};

// Importa React per usare hooks
import React from 'react';
