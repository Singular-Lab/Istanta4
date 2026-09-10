import { useCallback, useMemo, useReducer } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { PageLayoutItem, SitemapType } from '../../../../lib/types';
import {
  createInitialState,
  editorReducer,
  EditorState
} from '../reducers/editorReducer';

export const useEditorReducer = () => {
  const [state, dispatch] = useReducer(editorReducer, createInitialState());

  // Azioni memoizzate per ottimizzare le performance
  const actions = useMemo(() => ({
    // Gestione stato generale
    resetState: (pages: PageLayoutItem[][], sitemaps: SitemapType[]) =>
      dispatch({ type: 'RESET_STATE', payload: { pages, sitemaps } }),

    setPages: (pages: PageLayoutItem[][]) =>
      dispatch({ type: 'SET_PAGES', payload: pages }),

    setSitemaps: (sitemaps: SitemapType[] | ((s: SitemapType[]) => SitemapType[])) =>
      dispatch({ type: 'SET_SITEMAPS', payload: sitemaps }),

    // Gestione pagine
    selectPage: (pageIndex: number) =>
      dispatch({ type: 'SELECT_PAGE', payload: pageIndex }),

    updatePage: (pageIndex: number, elements: PageLayoutItem[]) =>
      dispatch({ type: 'UPDATE_PAGE', payload: { pageIndex, elements } }),

    // Gestione elementi
    selectElement: (elementId: string | null) =>
      dispatch({ type: 'SELECT_ELEMENT', payload: elementId }),

    addComponent: (component: PageLayoutItem, insertIndex: number, pageIndex: number) =>
      dispatch({ type: 'ADD_COMPONENT', payload: { component, insertIndex, pageIndex } }),

    removeElement: (elementId: string, pageIndex: number) =>
      dispatch({ type: 'REMOVE_ELEMENT', payload: { elementId, pageIndex } }),

    updateElementContent: (elementId: string, content: any, pageIndex: number) =>
      dispatch({ type: 'UPDATE_ELEMENT_CONTENT', payload: { elementId, content, pageIndex } }),

    updateElement: (elementId: string, element: PageLayoutItem, pageIndex: number) =>
      dispatch({ type: 'UPDATE_ELEMENT', payload: { elementId, element, pageIndex } }),

    moveElement: (dragId: string, hoverId: string, pageIndex: number) =>
      dispatch({ type: 'MOVE_ELEMENT', payload: { dragId, hoverId, pageIndex } }),

    // Gestione pannelli
    togglePanel: (panel: keyof Pick<EditorState, 'isPagesPanelOpen' | 'isSitemapPanelOpen' | 'isComponentsPanelOpen' | 'isTimelineOpen'>, open?: boolean) =>
      dispatch({ type: 'TOGGLE_PANEL', payload: { panel, open } }),

    // Gestione strumenti
    setActiveTool: (tool: string) =>
      dispatch({ type: 'SET_ACTIVE_TOOL', payload: tool }),

    setCanvasScale: (scale: number) =>
      dispatch({ type: 'SET_CANVAS_SCALE', payload: scale }),

    // Gestione dialog
    openDialogPagina: (isEditing: boolean, tipo?: string, nome?: string) =>
      dispatch({ type: 'OPEN_DIALOG_PAGINA', payload: { isEditing, tipo, nome } }),

    closeDialogPagina: () =>
      dispatch({ type: 'CLOSE_DIALOG_PAGINA' }),

    setDialogNome: (nome: string) =>
      dispatch({ type: 'SET_DIALOG_NOME', payload: nome }),

    setDialogTipo: (tipo: string) =>
      dispatch({ type: 'SET_DIALOG_TIPO', payload: tipo }),

    // Gestione workspace
    setWorkspaceInfo: (nome: string, id: string) =>
      dispatch({ type: 'SET_WORKSPACE_INFO', payload: { nome, id } }),

    setLogoHeader: (logo: string) =>
      dispatch({ type: 'SET_LOGO_HEADER', payload: logo }),

    // Gestione dimensioni pannelli
    setPanelDimensions: (dimensions: { leftWidth?: number; rightWidth?: number; timelineHeight?: number }) =>
      dispatch({ type: 'SET_PANEL_DIMENSIONS', payload: dimensions }),

    // Gestione animazioni
    setAnimating: (isAnimating: boolean) =>
      dispatch({ type: 'SET_ANIMATING', payload: isAnimating }),

    addPage: (pageData: any) =>
      dispatch({ type: 'ADD_PAGE', payload: { pageData } }),
  }), []);

  // Funzioni helper memoizzate
  const helpers = useMemo(() => ({
    // Ottieni elementi della pagina corrente
    getCurrentPageElements: (): PageLayoutItem[] =>
      state.pages[state.selectedPageIndex] || [],

    // Ottieni elemento selezionato
    getSelectedElement: (): PageLayoutItem | null => {
      if (!state.selectedElementId) return null;
      const elements = state.pages[state.selectedPageIndex] || [];
      return findElementById(elements, state.selectedElementId);
    },

    // Verifica se ci sono modifiche non salvate
    hasUnsavedChanges: (): boolean => {
      // Logica per determinare se ci sono modifiche non salvate
      return state.pages.length > 0;
    },

    // Ottieni informazioni sulla pagina corrente
    getCurrentPageInfo: () => {
      const pageIndex = state.selectedPageIndex;
      const elements = state.pages[pageIndex] || [];
      return {
        index: pageIndex,
        elementsCount: elements.length,
        hasElements: elements.length > 0,
      };
    },
  }), [state.selectedPageIndex, state.selectedElementId, state.pages]);

  // Funzioni callback ottimizzate
  const callbacks = {
    // Handler per drop di componenti
    handleDrop: useCallback((item: any, parentId: string, index?: number) => {
      const newElement: PageLayoutItem = {
        id: uuidv4(),
        user_locked: { locked: false, user_id: "" },
        type: item.type,
        content: {},
        parentId,
        children: item.type === "row" || item.type === "col" ? [] : undefined,
        policy: {
          locked: false,
          visualizzazione: [],
          filtri_contenuto: [],
        },
      };

      if (parentId === "") {
        // A livello root
        const currentElements = state.pages[state.selectedPageIndex] || [];
        const newElements = [...currentElements];
        if (typeof index === "number") {
          newElements.splice(index, 0, newElement);
        } else {
          newElements.push(newElement);
        }
        actions.updatePage(state.selectedPageIndex, newElements);
      } else {
        // Annidato - implementare logica per elementi annidati
        console.log("Drop annidato non ancora implementato nel reducer");
      }
    }, [state.selectedPageIndex, state.pages, actions]),

    // Handler per rimozione elementi
    handleRemove: useCallback((elementId: string) => {
      actions.removeElement(elementId, state.selectedPageIndex);
    }, [state.selectedPageIndex, actions]),

    // Handler per aggiornamento contenuto
    handleUpdateElementContent: useCallback((elementId: string, content: any) => {
      actions.updateElementContent(elementId, content, state.selectedPageIndex);
    }, [state.selectedPageIndex, actions]),

    // Handler per movimento elementi
    handleMoveElement: useCallback((dragId: string, hoverId: string) => {
      actions.moveElement(dragId, hoverId, state.selectedPageIndex);
    }, [state.selectedPageIndex, actions]),
  };

  return {
    state,
    actions,
    helpers,
    callbacks,
    dispatch, // Per casi speciali
  };
};

// Funzione helper per trovare elemento per ID (ottimizzata)
const findElementById = (elements: PageLayoutItem[], id: string): PageLayoutItem | null => {
  for (const el of elements) {
    if (el.id === id) return el;
    if (el.children) {
      const found = findElementById(el.children, id);
      if (found) return found;
    }
  }
  return null;
};
