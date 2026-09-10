import { PageLayoutItem, SitemapType } from "../../../../lib/types";

// Tipi per lo stato dell'editor
export interface EditorState {
  // Stato delle pagine e contenuto
  pages: PageLayoutItem[][];
  sitemaps: SitemapType[];

  // Stato dell'interfaccia utente
  selectedPageIndex: number;
  selectedElementId: string | null;

  // Stato dei pannelli
  isPagesPanelOpen: boolean;
  isSitemapPanelOpen: boolean;
  isComponentsPanelOpen: boolean;
  isTimelineOpen: boolean;

  // Stato degli strumenti
  activeTool: string;
  canvasScale: number;

  // Stato dei dialog
  openDialogAggiuntaPagina: boolean;
  tipoDialogAggiuntaPagina?: string;
  nomeDialogAggiuntaPagina: string;
  dialogIsEditing: boolean;

  // Stato del workspace
  nomeWorkspaceCorrente: string;
  idWorkspace: string;
  logoHeader: string;

  // Stato delle dimensioni dei pannelli
  leftWidth: number;
  rightWidth: number;
  timelineHeight: number;

  // Stato di animazione
  isAnimating: boolean;
}

// Azioni del reducer
export type EditorAction =
  | { type: 'RESET_STATE'; payload: { pages: PageLayoutItem[][]; sitemaps: SitemapType[] } }
  | { type: 'SET_PAGES'; payload: PageLayoutItem[][] }
  | { type: 'SET_SITEMAPS'; payload: SitemapType[] | ((s: SitemapType[]) => SitemapType[]) }
  | { type: 'UPDATE_PAGE'; payload: { pageIndex: number; elements: PageLayoutItem[] } }
  | { type: 'SELECT_PAGE'; payload: number }
  | { type: 'SELECT_ELEMENT'; payload: string | null }
  | { type: 'TOGGLE_PANEL'; payload: { panel: keyof Pick<EditorState, 'isPagesPanelOpen' | 'isSitemapPanelOpen' | 'isComponentsPanelOpen' | 'isTimelineOpen'>; open?: boolean } }
  | { type: 'SET_ACTIVE_TOOL'; payload: string }
  | { type: 'SET_CANVAS_SCALE'; payload: number }
  | { type: 'OPEN_DIALOG_PAGINA'; payload: { isEditing: boolean; tipo?: string; nome?: string } }
  | { type: 'CLOSE_DIALOG_PAGINA' }
  | { type: 'SET_DIALOG_NOME'; payload: string }
  | { type: 'SET_DIALOG_TIPO'; payload: string }
  | { type: 'SET_WORKSPACE_INFO'; payload: { nome: string; id: string } }
  | { type: 'SET_LOGO_HEADER'; payload: string }
  | { type: 'SET_PANEL_DIMENSIONS'; payload: { leftWidth?: number; rightWidth?: number; timelineHeight?: number } }
  | { type: 'SET_ANIMATING'; payload: boolean }
  | { type: 'ADD_COMPONENT'; payload: { component: PageLayoutItem; insertIndex: number; pageIndex: number } }
  | { type: 'REMOVE_ELEMENT'; payload: { elementId: string; pageIndex: number } }
  | { type: 'UPDATE_ELEMENT_CONTENT'; payload: { elementId: string; content: any; pageIndex: number } }
  | { type: 'UPDATE_ELEMENT'; payload: { elementId: string; element: PageLayoutItem; pageIndex: number } }
  | { type: 'MOVE_ELEMENT'; payload: { dragId: string; hoverId: string; pageIndex: number } }
  | { type: 'ADD_PAGE'; payload: { pageData: any } };

// Stato iniziale
export const createInitialState = (): EditorState => ({
  pages: [],
  sitemaps: [],
  selectedPageIndex: 0,
  selectedElementId: null,
  isPagesPanelOpen: false,
  isSitemapPanelOpen: false,
  isComponentsPanelOpen: false,
  isTimelineOpen: false,
  activeTool: "select",
  canvasScale: 1,
  openDialogAggiuntaPagina: false,
  tipoDialogAggiuntaPagina: undefined,
  nomeDialogAggiuntaPagina: "",
  dialogIsEditing: false,
  nomeWorkspaceCorrente: "",
  idWorkspace: "",
  logoHeader: "",
  leftWidth: typeof window !== 'undefined' ? parseInt(localStorage.getItem("leftSidebarWidth") || "250", 10) : 250,
  rightWidth: typeof window !== 'undefined' ? parseInt(localStorage.getItem("rightSidebarWidth") || "320", 10) : 320,
  timelineHeight: typeof window !== 'undefined' ? parseInt(localStorage.getItem("timelineHeight") || "460", 10) : 460,
  isAnimating: false,
});

// Funzioni helper per manipolazione elementi (ottimizzate)
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

const removeElementById = (elements: PageLayoutItem[], id: string): PageLayoutItem[] => {
  const result: PageLayoutItem[] = [];
  let hasChanged = false;

  for (const el of elements) {
    if (el.id === id) {
      hasChanged = true;
      continue;
    }

    if (el.children) {
      const newChildren = removeElementById(el.children, id);
      if (newChildren !== el.children) {
        hasChanged = true;
        result.push({ ...el, children: newChildren });
      } else {
        result.push(el);
      }
    } else {
      result.push(el);
    }
  }

  return hasChanged ? result : elements;
};

const updateElementContentInChildren = (
  elements: PageLayoutItem[],
  id: string,
  newContent: any
): PageLayoutItem[] => {
  let hasChanged = false;
  const newElements = elements.map((el) => {
    if (el.id === id) {
      hasChanged = true;
      return { ...el, content: newContent };
    }
    if (el.children) {
      const newChildren = updateElementContentInChildren(el.children, id, newContent);
      if (newChildren !== el.children) {
        hasChanged = true;
        return { ...el, children: newChildren };
      }
    }
    return el;
  });
  return hasChanged ? newElements : elements;
};

const updateElementInChildren = (
  elements: PageLayoutItem[],
  id: string,
  newElement: PageLayoutItem
): PageLayoutItem[] => {
  let hasChanged = false;
  const newElements = elements.map((el) => {
    if (el.id === id) {
      hasChanged = true;
      return newElement;
    }
    if (el.children) {
      const newChildren = updateElementInChildren(el.children, id, newElement);
      if (newChildren !== el.children) {
        hasChanged = true;
        return { ...el, children: newChildren };
      }
    }
    return el;
  });
  return hasChanged ? newElements : elements;
};

const findAndMoveElement = (
  elements: PageLayoutItem[],
  dragId: string,
  hoverId: string,
): PageLayoutItem[] | null => {
  let dragItem: PageLayoutItem | null = null;

  const findAndRemove = (els: PageLayoutItem[], id: string): PageLayoutItem[] | null => {
    for (let i = 0; i < els.length; i++) {
      if (els[i].id === id) {
        dragItem = els[i];
        const newEls = [...els];
        newEls.splice(i, 1);
        return newEls;
      }
      if (els[i].children) {
        const newChildren = findAndRemove(els[i].children!, id);
        if (newChildren) {
          const newEls = [...els];
          newEls[i] = { ...newEls[i], children: newChildren };
          return newEls;
        }
      }
    }
    return null;
  };

  const initialPass = findAndRemove(elements, dragId);
  if (!dragItem || !initialPass) return null;

  const findAndInsert = (els: PageLayoutItem[], hId: string): PageLayoutItem[] | null => {
    for (let i = 0; i < els.length; i++) {
      if (els[i].id === hId) {
        const newEls = [...els];
        newEls.splice(i, 0, dragItem!);
        return newEls;
      }
      if (els[i].children) {
        const newChildren = findAndInsert(els[i].children!, hId);
        if (newChildren) {
          const newEls = [...els];
          newEls[i] = { ...newEls[i], children: newChildren };
          return newEls;
        }
      }
    }
    return null;
  };

  return findAndInsert(initialPass, hoverId);
};

// Reducer principale
export const editorReducer = (state: EditorState, action: EditorAction): EditorState => {
  switch (action.type) {
    case 'RESET_STATE':
      return {
        ...state,
        pages: action.payload.pages,
        sitemaps: action.payload.sitemaps,
      };

    case 'SET_PAGES':
      return {
        ...state,
        pages: action.payload,
      };

    case 'SET_SITEMAPS':
      return {
        ...state,
        sitemaps: typeof action.payload === 'function'
          ? action.payload(state.sitemaps)
          : action.payload,
      };

    case 'UPDATE_PAGE':
      return {
        ...state,
        pages: state.pages.map((page, index) =>
          index === action.payload.pageIndex ? action.payload.elements : page
        ),
      };

    case 'SELECT_PAGE':
      return {
        ...state,
        selectedPageIndex: action.payload,
        selectedElementId: null, // Reset selezione elemento quando cambia pagina
      };

    case 'SELECT_ELEMENT':
      return {
        ...state,
        selectedElementId: action.payload,
      };

    case 'TOGGLE_PANEL':
      return {
        ...state,
        [action.payload.panel]: action.payload.open !== undefined
          ? action.payload.open
          : !state[action.payload.panel],
      };

    case 'SET_ACTIVE_TOOL':
      return {
        ...state,
        activeTool: action.payload,
      };

    case 'SET_CANVAS_SCALE':
      return {
        ...state,
        canvasScale: Math.max(0.25, Math.min(2, action.payload)),
      };

    case 'OPEN_DIALOG_PAGINA':
      return {
        ...state,
        openDialogAggiuntaPagina: true,
        dialogIsEditing: action.payload.isEditing,
        tipoDialogAggiuntaPagina: action.payload.tipo,
        nomeDialogAggiuntaPagina: action.payload.nome || "",
      };

    case 'CLOSE_DIALOG_PAGINA':
      return {
        ...state,
        openDialogAggiuntaPagina: false,
        dialogIsEditing: false,
        tipoDialogAggiuntaPagina: undefined,
        nomeDialogAggiuntaPagina: "",
      };

    case 'SET_DIALOG_NOME':
      return {
        ...state,
        nomeDialogAggiuntaPagina: action.payload,
      };

    case 'SET_DIALOG_TIPO':
      return {
        ...state,
        tipoDialogAggiuntaPagina: action.payload,
      };

    case 'SET_WORKSPACE_INFO':
      return {
        ...state,
        nomeWorkspaceCorrente: action.payload.nome,
        idWorkspace: action.payload.id,
      };

    case 'SET_LOGO_HEADER':
      return {
        ...state,
        logoHeader: action.payload,
      };

    case 'SET_PANEL_DIMENSIONS':
      const newState = { ...state };
      if (action.payload.leftWidth !== undefined) {
        newState.leftWidth = action.payload.leftWidth;
        if (typeof window !== 'undefined') {
          localStorage.setItem("leftSidebarWidth", String(action.payload.leftWidth));
        }
      }
      if (action.payload.rightWidth !== undefined) {
        newState.rightWidth = action.payload.rightWidth;
        if (typeof window !== 'undefined') {
          localStorage.setItem("rightSidebarWidth", String(action.payload.rightWidth));
        }
      }
      if (action.payload.timelineHeight !== undefined) {
        newState.timelineHeight = action.payload.timelineHeight;
        if (typeof window !== 'undefined') {
          localStorage.setItem("timelineHeight", String(action.payload.timelineHeight));
        }
      }
      return newState;

    case 'SET_ANIMATING':
      return {
        ...state,
        isAnimating: action.payload,
      };

    case 'ADD_COMPONENT':
      const { component, insertIndex, pageIndex } = action.payload;
      return {
        ...state,
        pages: state.pages.map((page, index) => {
          if (index === pageIndex) {
            const newPage = [...page];
            newPage.splice(insertIndex + 1, 0, component);
            return newPage;
          }
          return page;
        }),
      };

    case 'REMOVE_ELEMENT':
      return {
        ...state,
        pages: state.pages.map((page, index) =>
          index === action.payload.pageIndex
            ? removeElementById(page, action.payload.elementId)
            : page
        ),
        selectedElementId: state.selectedElementId === action.payload.elementId
          ? null
          : state.selectedElementId,
      };

    case 'UPDATE_ELEMENT_CONTENT':
      return {
        ...state,
        pages: state.pages.map((page, index) =>
          index === action.payload.pageIndex
            ? updateElementContentInChildren(page, action.payload.elementId, action.payload.content)
            : page
        ),
      };

    case 'UPDATE_ELEMENT':
      return {
        ...state,
        pages: state.pages.map((page, index) =>
          index === action.payload.pageIndex
            ? updateElementInChildren(page, action.payload.elementId, action.payload.element)
            : page
        ),
      };

    case 'MOVE_ELEMENT':
      return {
        ...state,
        pages: state.pages.map((page, index) => {
          if (index === action.payload.pageIndex) {
            const newPage = findAndMoveElement(page, action.payload.dragId, action.payload.hoverId);
            return newPage || page;
          }
          return page;
        }),
      };

    case 'ADD_PAGE':
      return {
        ...state,
        pages: [...state.pages, []],
        selectedPageIndex: state.pages.length,
      };

    default:
      return state;
  }
};
