// ============================================================================
// Esempio completo di "Main.tsx" che usa "PolicyDiVisualizzazione"
// ============================================================================

import "@/assets/css/app.css";
import imageLogo from "@/assets/images/logo.svg";
import Button from "@/components/Base/Button";
import {
  FormInput,
  FormLabel,
  FormSelect
} from "@/components/Base/Form";
import { Dialog } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import { PermissionGate } from "@/components/PermissionGate";
import withSessionCheck from "@/components/SessionChecker";
import { PERMISSIONS } from "@/constants/permissions";
import { useNotification } from "@/context/NotificationContext";
import { useHistory } from "@/hooks/useHistory";
import { useMutation } from "@tanstack/react-query";
import clsx from "clsx";
import * as lucideIcons from "lucide-react";
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { useHotkeys } from "react-hotkeys-hook";
import { useLoaderData, useNavigate, useParams } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { ServerCall } from "../../../lib/server_call";
import { FloatingPanelContainer } from "./FloatingPanelContainer";
import { useEditorReducer } from "./hooks/useEditorReducer";

// Import del componente e dei relativi enum/tipi
import LoadingIcon from "@/components/Base/LoadingIcon";
import { GestioneReferenzeProvider } from "@/context/GestioneReferenzeContext";
import { useUser } from "@/context/UserContext";
import { TIPO_PAGINA } from "../../../lib/enums";
import { Config, PageLayoutItem, SitemapType, UtenteAttributes } from "../../../lib/types";
import DraggableItem from "./DraggableItem";
import Dropzone from "./Dropzone";
import SitemapList from "./sub-components/SitemapTab";
// Rimosso ReadOnlyWebpliantProvider - ora si usa WebpliantParamsProvider dal main.tsx
import { KeyframeEventProvider } from "@/context/KeyframeEventContext";
import { useKeyframeManager } from "@/hooks/useKeyframeManager";
import { useFetchKitDesign, useFetchRicetteWorkspaceSettings, useFetchTipiExport } from "@/query/query";
import dayjs from "dayjs";
import { AnimatePresence, motion } from "framer-motion";
import { PromoResponseDTO } from "../../../server/core/dto";
const ElementSettings = React.lazy(() => import("./sub-components/Setting")); // <--- le impostazioni di un singolo elemento
const PromotionTimeline = React.lazy(() => import("./sub-components/PromotionTimeline"));
// ----------------------------------------------
// ICONS
// ----------------------------------------------
export const { icons } = lucideIcons;

// ----------------------------------------------
// ENUMS & COSTANTI
// ----------------------------------------------

// Animazioni coerenti per tutto il sistema
const ANIMATION_CONFIG = {
  // Transizioni principali
  main: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 20 },
    transition: { duration: 0.4, ease: "easeInOut" }
  },

  // Timeline
  timeline: {
    initial: { height: 0, y: 50, opacity: 0, scaleY: 0 },
    animate: (height: number) => ({ height: `${height}px`, y: 0, opacity: 1, scaleY: 1 }),
    exit: { height: 0, y: 50, opacity: 0, scaleY: 0 },
    transition: { type: "spring", damping: 25, stiffness: 120 }
  },

  // Panels
  panel: {
    initial: { opacity: 0, scale: 0.95, y: 10 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.95, y: 10 },
    transition: { duration: 0.2, ease: "easeOut" }
  }
};

// Hook personalizzato per gestire le animazioni
const useAnimationController = () => {
  const [isAnimating, setIsAnimating] = useState(false);

  const triggerAnimation = useCallback((callback: () => void, delay = 0) => {
    setIsAnimating(true);
    setTimeout(() => {
      callback();
      setIsAnimating(false);
    }, delay);
  }, []);

  return { isAnimating, triggerAnimation };
};

// ----------------------------------------------
// INTERFACCE
// ----------------------------------------------

interface EditorState {
  pages: PageLayoutItem[][];
  sitemaps: SitemapType[];
}

// ----------------------------------------------
// HELPER: Ricerca e mutazione annidata
// ----------------------------------------------
const findElementById = (elements: PageLayoutItem[], id: string): PageLayoutItem | null => {
  for (const el of elements) {
    if (el.id === id) {
      return el;
    } else if (el.children) {
      const found = findElementById(el.children, id);
      if (found) {
        return found;
      }
    }
  }
  return null;
};

const addNestedElement = (
  elements: PageLayoutItem[],
  parentId: string,
  newElement: PageLayoutItem,
  index?: number
): PageLayoutItem[] => {
  let hasChanged = false;
  const newElements = elements.map((el) => {
    if (el.id === parentId && (el.type === "row" || el.type === "col")) {
      hasChanged = true;
      const newChildren = el.children ? [...el.children] : [];
      if (typeof index === "number") {
        newChildren.splice(index, 0, newElement);
      } else {
        newChildren.push(newElement);
      }
      return { ...el, children: newChildren };
    }
    if (el.children) {
      const newChildren = addNestedElement(el.children, parentId, newElement, index);
      if (newChildren !== el.children) {
        hasChanged = true;
        return { ...el, children: newChildren };
      }
    }
    return el;
  });

  return hasChanged ? newElements : elements;
};

const removeElementById = (elements: PageLayoutItem[], id: string): PageLayoutItem[] => {
  const resultingElements: PageLayoutItem[] = [];
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
        resultingElements.push({ ...el, children: newChildren });
      } else {
        resultingElements.push(el);
      }
    } else {
      resultingElements.push(el);
    }
  }

  return hasChanged ? resultingElements : elements;
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

  // Funzione per trovare e rimuovere l'elemento trascinato
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

  if (!dragItem || !initialPass) {
    return null; // Elemento non trovato o nessun cambiamento
  }

  // Funzione per trovare l'hover item e inserire il drag item
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

// ----------------------------------------------
// DROPZONE
// ----------------------------------------------


// ----------------------------------------------
// COMPONENTE PRINCIPALE
// ----------------------------------------------
const CreazioneWebPliant: React.FC = () => {
  // Utilizzo del nuovo reducer per gestire tutto lo stato
  const { state: editorState, actions: editorActions, helpers, callbacks } = useEditorReducer();
  // I keyframes ora sono gestiti direttamente nei componenti

  const addComponent = useCallback((component: PageLayoutItem, insertIndex: number) => {
    const targetPageIndex = editorState.selectedPageIndex;

    // Verifica che l'indice della pagina sia valido
    if (targetPageIndex < 0 || targetPageIndex >= editorState.pages.length) {
      console.warn("Indice di pagina selezionato non valido per l'aggiunta del componente. Componente non aggiunto.");
      return;
    }

    editorActions.addComponent(component, insertIndex, targetPageIndex);
    console.log("SCATTATO");
  }, [editorState.selectedPageIndex, editorState.pages.length, editorActions]);
  // Controller per le animazioni (ora gestito dal reducer)
  const triggerAnimation = useCallback((callback: () => void, delay = 0) => {
    editorActions.setAnimating(true);
    setTimeout(() => {
      callback();
      editorActions.setAnimating(false);
    }, delay);
  }, []);

  const { user } = useUser();
  const [objectForEditSiteMap, setObjectForEditSiteMap] = useState<{
    id: string;
    index: number;
    titolo: string;
    active: boolean;
    pagine_collegate: Array<{
      id: string;
      titolo: string;
    }>;
  }>();

  const { showNotification } = useNotification();
  const navigate = useNavigate();
  const params = useParams();

  // Dati caricati via loader
  const { dataWorkspace, linkWorkspaces, config, listaUtentiOperatori, promos } = useLoaderData() as {
    dataWorkspace: {
      nomeWorkspace: string;
      idWorkspace: string;
      idGDO: string;
      idCanale: string;
      idArea: string;
      webpliant: Array<{
        id: string;
        nome: string;
        struttura: PageLayoutItem[];
        tipo: TIPO_PAGINA;
      }>;
      sitemap: Array<{
        id: string;
        titolo: string;
        pagine_collegate: Array<{
          id: string;
          titolo: string;
        }>;
        impostazioni_avanzate?: any;
      }>;
    };
    linkWorkspaces: {
      id: string;
      nome: string;
    }[];
    config: Config;
    listaUtentiOperatori: UtenteAttributes[];
    promos: PromoResponseDTO[];
  };

  // Hook per gestire history (mantenuto per compatibilità con undo/redo)
  const {
    state: historyState,
    set: setHistoryState,
    undo,
    redo,
    reset: resetHistory,
    canUndo,
    canRedo,
  } = useHistory<{ pages: PageLayoutItem[][]; sitemaps: SitemapType[] }>({ pages: [], sitemaps: [] });

  const { pages, sitemaps } = editorState;


  useEffect(() => {
    console.log
  }, [config]);

  useEffect(() => {
    if (dataWorkspace) {
      const initialSitemaps = dataWorkspace.sitemap?.map((s) => ({
        ...s,
        impostazioni_avanzate: s.impostazioni_avanzate || {},
      })) || [];

      const initialPages = dataWorkspace.webpliant?.length > 0
        ? dataWorkspace.webpliant.map((item) => item.struttura || [])
        : [];

      // Aggiorna il reducer con i nuovi dati
      editorActions.resetState(initialPages, initialSitemaps);
      editorActions.setWorkspaceInfo(dataWorkspace?.nomeWorkspace || "", dataWorkspace?.idWorkspace || "");

      // Mantieni anche l'history per undo/redo
      resetHistory({ pages: initialPages, sitemaps: initialSitemaps });
    }
  }, [dataWorkspace, resetHistory, editorActions]);

  useEffect(() => {
    const logoUrl = config.webpliant.logo_header.find((logo) => {
      return (logo.idArea === dataWorkspace.idArea) || (logo.idCanale === dataWorkspace.idCanale);
    })?.url || '';
    editorActions.setLogoHeader(logoUrl || imageLogo);
  }, [config, dataWorkspace, editorActions]);

  useEffect(() => {
    console.log("logoHeader", editorState.logoHeader);
  }, [editorState.logoHeader]);

  // Restituisce la struttura attuale della pagina selezionata (ora dal reducer)
  const elements = useMemo(() => {
    return helpers.getCurrentPageElements();
  }, [helpers]);



  // Debug: log dei componenti quando cambiano (per vedere i keyframes)
  useEffect(() => {
    const allKeyframes = elements.flatMap(el => el.keyframes || []);
    console.log("Keyframes nei componenti:", allKeyframes);

    // Test: verifica che i keyframes siano associati ai componenti corretti
    elements.forEach(element => {
      if (element.keyframes && element.keyframes.length > 0) {
        console.log(`Componente ${element.id} (${element.type}) ha ${element.keyframes.length} keyframes:`, element.keyframes);
      }
    });
  }, [elements]);

  // Funzione di test per creare un keyframe di esempio (da rimuovere in produzione)


  // Funzione per manipolare la pagina corrente (ora usa il reducer)
  const setCurrentPage = useCallback((updater: (old: PageLayoutItem[]) => PageLayoutItem[]) => {
    const currentElements = helpers.getCurrentPageElements();
    const newElements = updater(currentElements);
    editorActions.updatePage(editorState.selectedPageIndex, newElements);

    // Aggiorna anche l'history per undo/redo
    setHistoryState({ pages: [...pages], sitemaps: [...sitemaps] });
  }, [helpers, editorActions, editorState.selectedPageIndex, setHistoryState, pages, sitemaps]);

  // Gestione Drop di un nuovo elemento
  const handleDrop = useCallback((item: any, parentId: string, index?: number) => {
    console.log("item", item);
    const newElement: PageLayoutItem = {
      id: uuidv4(),
      user_locked: {
        locked: false,
        user_id: "",
      },
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
    console.log("newElement", newElement);
    setCurrentPage((prevElements) => {
      if (parentId === "") {
        // A livello root
        const newList = [...prevElements];
        if (typeof index === "number") {
          newList.splice(index, 0, newElement);
        } else {
          newList.push(newElement);
        }
        return newList;
      } else {
        // Annidato
        return addNestedElement(prevElements, parentId, newElement, index);
      }
    });
  }, [setCurrentPage]);

  // Rimuovere un elemento (ora usa il reducer)
  const handleRemove = useCallback((id: string) => {
    editorActions.removeElement(id, editorState.selectedPageIndex);

    // Aggiorna anche l'history per undo/redo
    setHistoryState({ pages: [...pages], sitemaps: [...sitemaps] });
  }, [editorActions, editorState.selectedPageIndex, setHistoryState, pages, sitemaps]);

  // Bloccare/sbloccare un elemento per la policy
  const handlePolicy = useCallback((id: string) => {
    setCurrentPage((prevElements) => {
      const lockInChildren = (elements: PageLayoutItem[], targetId: string): PageLayoutItem[] => {
        return elements.map((el) => {
          if (el.id === targetId) {
            return {
              ...el,
              policy: {
                ...el.policy,
                locked: !el.policy.locked,
                visualizzazione: el.policy.visualizzazione || [],
                filtri_contenuto: el.policy.filtri_contenuto || [],
              },
            };
          }
          if (el.children) {
            return { ...el, children: lockInChildren(el.children, targetId) };
          }
          return el;
        });
      };
      return lockInChildren(prevElements, id);
    });
  }, [setCurrentPage]);

  // Bloccare/sbloccare un elemento per l'editing
  const handleLock = useCallback((id: string) => {
    const userId = user?.id;
    if (!userId) {
      console.error("User ID not found for lock action");
      return;
    }

    setCurrentPage((prevElements) => {
      const lockRecursive = (elements: PageLayoutItem[], targetId: string): PageLayoutItem[] => {
        return elements.map((el) => {
          if (el.id === targetId) {
            return {
              ...el,
              user_locked: {
                locked: !el.user_locked?.locked || false,
                user_id: !el.user_locked?.locked || false ? userId : "",
              },
            };
          }
          if (el.children) {
            return { ...el, children: lockRecursive(el.children, targetId) };
          }
          return el;
        });
      };
      return lockRecursive(prevElements, id);
    });
  }, [user?.id, setCurrentPage]);

  // Riordinare (ora usa il reducer)
  const moveElement = useCallback(
    (dragId: string, hoverId: string, parentId?: string) => {
      editorActions.moveElement(dragId, hoverId, editorState.selectedPageIndex);

      // Aggiorna anche l'history per undo/redo
      setHistoryState({ pages: [...pages], sitemaps: [...sitemaps] });
    },
    [editorActions, editorState.selectedPageIndex, setHistoryState, pages, sitemaps]
  );

  // Aggiornare il contenuto di un elemento (ora usa il reducer)
  const updateElementContent = useCallback((id: string, newContent: any) => {
    editorActions.updateElementContent(id, newContent, editorState.selectedPageIndex);

    // Aggiorna anche l'history per undo/redo
    setHistoryState({ pages: [...pages], sitemaps: [...sitemaps] });
  }, [editorActions, editorState.selectedPageIndex, setHistoryState, pages, sitemaps]);

  // Traccia l'elemento selezionato (ora usa il reducer)
  const selectedElement = useMemo(() => {
    return helpers.getSelectedElement();
  }, [helpers]);

  // Se serve aggiornare tutto l'oggetto PageLayoutItem (ora usa il reducer)
  const updateElement = useCallback((id: string, newElement: PageLayoutItem) => {
    editorActions.updateElement(id, newElement, editorState.selectedPageIndex);

    // Aggiorna anche l'history per undo/redo
    setHistoryState({ pages: [...pages], sitemaps: [...sitemaps] });
  }, [editorActions, editorState.selectedPageIndex, setHistoryState, pages, sitemaps]);

  // Keyframe manager per la pagina corrente
  const {
    keyframes,
    recordContentModification,
    recordPositionModification,
    recordModification: recordModificationBase,
  } = useKeyframeManager(elements, updateElement);

  // Wrapper per recordModification che include la data selezionata
  const recordModification = useCallback((componentId: string, modificationType: 'content' | 'position', data: any, elementType?: string, selectedDate?: dayjs.Dayjs) => {
    console.log("🎪 index.tsx.recordModification wrapper chiamato:", {
      componentId,
      modificationType,
      data,
      elementType,
      selectedDate: selectedDate?.format('DD/MM/YYYY'),
      hasSelectedDate: !!selectedDate
    });
    recordModificationBase(componentId, modificationType, data, elementType, selectedDate);
  }, [recordModificationBase]);

  // Mutazione per salvare
  const mutationCreazioneWebpliantWorkspace = useMutation({
    mutationKey: ["salva_workspace_webpliant"],
    mutationFn: async () => {
      const webpliant = pages.map((struttura: PageLayoutItem[], idx: number) => {
        const pagina = dataWorkspace.webpliant[idx];

        // Debug: verifica che i keyframes siano inclusi nei componenti
        const componentsWithKeyframes = struttura.filter(comp => comp.keyframes && comp.keyframes.length > 0);
        if (componentsWithKeyframes.length > 0) {
          console.log(`Pagina ${pagina.nome} ha ${componentsWithKeyframes.length} componenti con keyframes:`, componentsWithKeyframes);
        }

        return {
          ...pagina,
          struttura,
        };
      });

      const result = await ServerCall.post("/salva_workspace_webpliant", {
        nomeWorkspace: dataWorkspace?.nomeWorkspace,
        idWorkspace: dataWorkspace?.idWorkspace,
        idGDO: dataWorkspace?.idGDO,
        idCanale: dataWorkspace?.idCanale,
        idArea: dataWorkspace?.idArea,
        sitemap: sitemaps,
        webpliant,
      });
      return result;
    },
    onSuccess: () => {
      resetHistory({ pages, sitemaps }); // Resetta la cronologia dopo il salvataggio
      showNotification(
        <div className="flex flex-row items-center ">
          <Lucide icon="CircleCheck" className="text-success w-8 h-8" />
          <div className="ml-4 mr-4">
            <div className="font-bold">Workspace salvato</div>
          </div>
        </div>
      );
    },
    onError: (error: any) => {
      console.error(error);
      showNotification(
        <div className="flex flex-row items-center">
          <Lucide is_color_theme icon="CircleAlert" className="text-danger w-8 h-8" />
          <div className="ml-4 mr-4">
            <div className="font-bold">Errore nel salvataggio</div>
            <div className="mt-1 text-slate-500">{error.message}</div>
          </div>
        </div>
      );
    },
  });

  // Salvataggio con Ctrl+S
  useHotkeys("mod+s", (e) => {
    e.preventDefault();
    mutationCreazioneWebpliantWorkspace.mutate();
  });

  // Funzione helper per simulare l'effetto visuale del click
  const simulateButtonClick = (buttonRef: React.RefObject<HTMLButtonElement | null>, action: () => void) => {
    if (buttonRef.current && !buttonRef.current.disabled) {
      // Aggiungi le classi per l'effetto visuale
      buttonRef.current.classList.add('scale-95', 'bg-primary/20', 'border-primary/50');

      // Esegui l'azione
      action();

      // Rimuovi le classi dopo un breve delay
      setTimeout(() => {
        if (buttonRef.current) {
          buttonRef.current.classList.remove('scale-95', 'bg-primary/20', 'border-primary/50');
        }
      }, 150);
    }
  };

  // Hotkeys for Undo/Redo
  useHotkeys("mod+z", (e) => {
    e.preventDefault();
    simulateButtonClick(undoButtonRef, undo);
  });
  useHotkeys("mod+shift+z, mod+y", (e) => {
    e.preventDefault();
    simulateButtonClick(redoButtonRef, redo);
  });

  useHotkeys(["mod+c"], () => {
    if (selectedElement) {
      const copiedElement = { ...selectedElement, id: uuidv4() };
      //usa la clipboard per copiare
      if (navigator.clipboard) {
        navigator.clipboard.writeText(JSON.stringify(copiedElement));
      } else {
        console.error("Clipboard API non disponibile");
      }
      showNotification(
        <div className="flex flex-row items-center">
          <Lucide is_color_theme icon="CircleCheck" className="text-success w-8 h-8" />
          <div className="ml-4 mr-4">
            <div className="font-bold">Elemento copiato correttamente</div>
          </div>
        </div>
      );
    }
  });
  useHotkeys(["delete"], () => {
    if (selectedElement) {
      handleRemove(selectedElement.id);
    }
  });


  useHotkeys(["ctrl+v", "cmd+v"], async () => {
    const clipboardText = await navigator.clipboard.readText();
    try {
      const copiedElement = JSON.parse(clipboardText);
      if (copiedElement && copiedElement.id) {
        const newElement = { ...copiedElement, id: uuidv4() };
        setCurrentPage((prevElements) => [...prevElements, newElement]);
      }
    } catch (error: any) {
      showNotification(
        <div className="flex flex-row items-center">
          <Lucide is_color_theme icon="CircleAlert" className="text-danger w-8 h-8" />
          <div className="ml-4 mr-4">
            <div className="font-bold">Errore, elemento incollato non valido</div>
          </div>
        </div>
      );
    }
  });
  // Prima di chiudere il browser, se ci sono modifiche non salvate:
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (canUndo) { // Usa canUndo per determinare se ci sono modifiche
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [canUndo]);

  // Stati per il resize (mantenuti localmente per performance)
  const [isResizing, setIsResizing] = useState<"left" | "right" | "timeline" | null>(null);
  const [startX, setStartX] = useState<number>(0);
  const [startY, setStartY] = useState<number>(0);
  const [startWidthLeft, setStartWidthLeft] = useState<number>(0);
  const [startWidthRight, setStartWidthRight] = useState<number>(0);
  const [startHeightTimeline, setStartHeightTimeline] = useState<number>(0);
  const [showResizeIndicator, setShowResizeIndicator] = useState(false);

  const handleMouseDownLeft = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsResizing("left");
    setStartX(e.clientX);
    setStartWidthLeft(editorState.leftWidth);
  };

  const handleMouseDownRight = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsResizing("right");
    setStartX(e.clientX);
    setStartWidthRight(editorState.rightWidth);
    setShowResizeIndicator(true);
  };

  const handleMouseDownTimeline = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsResizing("timeline");
    setStartY(e.clientY);
    setStartHeightTimeline(editorState.timelineHeight);
    setShowResizeIndicator(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      // Previeni la selezione del testo durante il resize
      e.preventDefault();

      if (isResizing === "left") {
        const delta = e.clientX - startX;
        const newWidth = startWidthLeft + delta;
        if (newWidth >= 150 && newWidth <= 600) {
          editorActions.setPanelDimensions({ leftWidth: newWidth });
        }
      } else if (isResizing === "right") {
        const delta = startX - e.clientX;
        const newWidth = startWidthRight + delta;
        if (newWidth >= 200 && newWidth <= 600) {
          editorActions.setPanelDimensions({ rightWidth: newWidth });
        }
      } else if (isResizing === "timeline") {
        const delta = startY - e.clientY;
        const newHeight = startHeightTimeline + delta;
        if (newHeight >= 300 && newHeight <= 800) {
          editorActions.setPanelDimensions({ timelineHeight: newHeight });
        }
      }
    };

    const handleMouseUp = () => {
      // Il salvataggio nel localStorage è già gestito dal reducer
      setIsResizing(null);
      setShowResizeIndicator(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    isResizing,
    editorActions,
    startX,
    startY,
    startWidthLeft,
    startWidthRight,
    startHeightTimeline,
  ]);

  // Funzione che aggiorna i settings di una pagina (ad esempio la policy).
  const updatePageSettings = useCallback((id: string, settings: any) => {
    console.log("Updating page settings per la pagina:", id, settings);
  }, []);

  // Stati ora gestiti dal reducer - mantengo solo activePageId per compatibilità
  const [activePageId, setActivePageId] = useState<string | null>(null);

  const mainCanvasRef = useRef<HTMLElement>(null);
  const undoButtonRef = useRef<HTMLButtonElement>(null);
  const redoButtonRef = useRef<HTMLButtonElement>(null);
  const dataPerKitDesign = useFetchKitDesign();
  const dataPerSelezioneRicette = useFetchRicetteWorkspaceSettings();
  const dataPerTipiExport = useFetchTipiExport();

  // Funzione per aggiornare solo la sitemap nello stato dell'editor (ora usa il reducer)
  const handleSetSitemaps = (newSitemaps: SitemapType[] | ((s: SitemapType[]) => SitemapType[])) => {
    editorActions.setSitemaps(newSitemaps);

    // Aggiorna anche l'history per undo/redo
    const sitemapsToSet = typeof newSitemaps === 'function' ? newSitemaps(sitemaps) : newSitemaps;
    setHistoryState({ pages: [...pages], sitemaps: sitemapsToSet });
  };

  const user_list = useMemo(() => {
    return listaUtentiOperatori.map((utente) => ({
      id: utente.id_utenti || "",
      name: `${utente.nome_utenti} ${utente.cognome_utenti}`,
    }));
  }, [listaUtentiOperatori]);

  return (
    <>
      {/* Dialog per aggiungere pagina */}

      <GestioneReferenzeProvider>
        <KeyframeEventProvider
          keyframes={keyframes}
          availableComponents={elements}
          onRecordModification={recordModification}
        >
          <Dialog
            open={editorState.openDialogAggiuntaPagina}
            onClose={() => editorActions.closeDialogPagina()}
            className="relative z-50"
          >
            <Dialog.Panel>
              <Dialog.Title className="mb-6">
                {editorState.dialogIsEditing ? "Modifica pagina" : "Nuova pagina"}

              </Dialog.Title>

              <Dialog.Description>
                <div>
                  <FormLabel className="text-sm font-semibold text-slate-700 mb-2 block">Nome della pagina</FormLabel>
                  <FormInput
                    placeholder="Inserisci il nome della pagina"
                    className="w-full px-4 py-3"
                    value={editorState.nomeDialogAggiuntaPagina}
                    onChange={(e) =>
                      editorActions.setDialogNome(e.target.value as string)
                    }
                  />
                </div>
                <div>
                  <FormLabel className="text-sm font-semibold text-slate-700 mb-2 block">Tipo di pagina</FormLabel>
                  <FormSelect
                    className="w-full px-4 py-3"
                    value={editorState.tipoDialogAggiuntaPagina}
                    onChange={(e) =>
                      editorActions.setDialogTipo(e.target.value as string)
                    }
                  >
                    <option value="">Seleziona un tipo di pagina</option>
                    {Object.values(TIPO_PAGINA)
                      .filter((tipo) => tipo !== TIPO_PAGINA.HOMEPAGE)
                      .map((tipo) => (
                        <option key={tipo} value={tipo}>
                          {tipo}
                        </option>
                      ))}
                  </FormSelect>
                </div>
              </Dialog.Description>

              <Dialog.Footer className="flex justify-end gap-3 mt-8 pt-6 border-t border-slate-200">
                <Button
                  variant="secondary"
                  className="px-6 py-2.5 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-50 hover:border-slate-400 transition-all duration-200"
                  onClick={() => editorActions.closeDialogPagina()}
                >
                  Annulla
                </Button>
                <Button
                  variant="primary"
                  className="px-6 py-2.5 bg-gradient-to-r from-primary to-theme-2 hover:from-primary/90 hover:to-theme-2/90 text-white font-medium rounded-xl transition-all duration-300 border-0"
                  onClick={() => {
                    if (editorState.tipoDialogAggiuntaPagina && editorState.nomeDialogAggiuntaPagina) {
                      if (editorState.dialogIsEditing) {
                        // Logica di editing
                        const idPagina = objectForEditSiteMap?.id;
                        const pagina = dataWorkspace.webpliant.find(
                          (item) => item.id === idPagina
                        );
                        if (pagina) {
                          const newPages = pages.map((p: PageLayoutItem[], index: number) => {
                            const wpPage = dataWorkspace.webpliant[index];
                            if (wpPage.id === idPagina) {
                              wpPage.nome = editorState.nomeDialogAggiuntaPagina;
                              wpPage.tipo = editorState.tipoDialogAggiuntaPagina as TIPO_PAGINA;
                            }
                            return p;
                          });

                          const newSitemaps = sitemaps.map((s: SitemapType) => {
                            if (s) {
                              s.pagine_collegate = s.pagine_collegate.map((pc) => {
                                if (pc.id === idPagina) {
                                  pc.titolo = editorState.nomeDialogAggiuntaPagina;
                                }
                                return pc;
                              });
                            }
                            return s;
                          });

                          editorActions.setPages(newPages);
                          editorActions.setSitemaps(newSitemaps);
                          editorActions.closeDialogPagina();
                        }
                      } else {
                        // Logica di creazione
                        const newPageData = {
                          id: uuidv4(),
                          nome: editorState.nomeDialogAggiuntaPagina,
                          tipo: editorState.tipoDialogAggiuntaPagina as TIPO_PAGINA,
                          struttura: [],
                        };
                        dataWorkspace.webpliant.push(newPageData);

                        editorActions.addPage(newPageData);
                        editorActions.closeDialogPagina();
                      }
                    }
                  }}
                >
                  {editorState.dialogIsEditing ? "Salva modifiche" : "Crea pagina"}
                </Button>
              </Dialog.Footer>
            </Dialog.Panel>
          </Dialog>

          <DndProvider backend={HTML5Backend} options={{
            enableMouseEvents: true,
          }}>
            <div className="h-screen flex flex-col overflow-hidden bg-slate-100 dark:bg-darkmode-900">
              {/* COMPACT HEADER */}
              <header className="h-16 flex-shrink-0 bg-white dark:bg-darkmode-700 border-b border-slate-200 dark:border-darkmode-600 z-30">
                <div className="flex items-center justify-between h-full px-4">
                  {/* Left side */}
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      <img src={editorState.logoHeader} alt="Logo" className="h-8 w-auto object-contain" />
                      <span className="font-semibold text-md text-slate-800 dark:text-slate-200">{editorState.nomeWorkspaceCorrente}</span>
                      {/* <span className="font-bold text-lg text-slate-800 dark:text-slate-200">Webpliant builder</span> */}
                    </div>

                    <div className="h-6 w-px bg-slate-200 dark:bg-darkmode-600"></div>

                    <div className="flex items-center space-x-1">
                      <Button
                        variant={editorState.isPagesPanelOpen ? "primary" : "outline-secondary"}
                        className="h-9"
                        onClick={() => editorActions.togglePanel('isPagesPanelOpen')}
                      >
                        <Lucide is_color_theme={!editorState.isPagesPanelOpen} icon="LayoutDashboard" className="w-4 h-4 mr-2" />
                        Pagine
                      </Button>
                      <Button
                        variant={editorState.isComponentsPanelOpen ? "primary" : "outline-secondary"}
                        className="h-9"
                        onClick={() => editorActions.togglePanel('isComponentsPanelOpen')}
                      >
                        <Lucide is_color_theme={!editorState.isComponentsPanelOpen} icon="Plus" className="w-4 h-4 mr-2" />
                        Componenti
                      </Button>
                      <Button
                        variant={editorState.isSitemapPanelOpen ? "primary" : "outline-secondary"}
                        className="h-9"
                        onClick={() => editorActions.togglePanel('isSitemapPanelOpen')}
                      >
                        <Lucide is_color_theme={!editorState.isSitemapPanelOpen} icon="Network" className="w-4 h-4 mr-2" />
                        Sitemap
                      </Button>
                      <Button
                        variant={editorState.isTimelineOpen ? "primary" : "outline-secondary"}
                        className={clsx(
                          "h-9 relative",
                          editorState.isTimelineOpen && "shadow-lg"
                        )}
                        onClick={() => editorActions.togglePanel('isTimelineOpen')}
                      >
                        <Lucide is_color_theme={!editorState.isTimelineOpen} icon="Clock" className="w-4 h-4 mr-2" />
                        Timeline
                      </Button>
                    </div>
                  </div>

                  {/* Center */}
                  <div className="flex items-center space-x-1 bg-slate-100 dark:bg-darkmode-600 p-1 rounded-lg">
                    <Button
                      variant={editorState.activeTool === "select" ? "primary" : "outline-secondary"}
                      className="p-2 h-8 w-8"
                      onClick={() => editorActions.setActiveTool("select")}
                    >
                      <Lucide is_color_theme={editorState.activeTool !== "select"} icon="MousePointer" className="w-4 h-4" />
                      <span className="sr-only">Seleziona (V)</span>
                    </Button>
                    <Button
                      variant={editorState.activeTool === "move" ? "primary" : "outline-secondary"}
                      className="p-2 h-8 w-8"
                      onClick={() => editorActions.setActiveTool("move")}
                    >
                      <Lucide is_color_theme={editorState.activeTool !== "move"} icon="Move" className="w-4 h-4" />
                      <span className="sr-only">Sposta (M)</span>
                    </Button>
                  </div>

                  {/* Right side */}
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline-secondary"
                        className="p-2 h-9 w-9"
                        onClick={() => editorActions.setCanvasScale(Math.max(0.25, editorState.canvasScale - 0.1))}
                      >
                        <Lucide is_color_theme icon="Minus" className="w-4 h-4" />
                      </Button>
                      <div className="text-sm text-slate-500 w-12 text-center" onClick={() => editorActions.setCanvasScale(1)}>
                        {Math.round(editorState.canvasScale * 100)}%
                      </div>
                      <Button
                        variant="outline-secondary"
                        className="p-2 h-9 w-9"
                        onClick={() => editorActions.setCanvasScale(Math.min(2, editorState.canvasScale + 0.1))}
                      >
                        <Lucide is_color_theme icon="Plus" className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="h-6 w-px bg-slate-200 dark:bg-darkmode-600"></div>

                    <div className="flex items-center space-x-1">
                      <Button ref={undoButtonRef} variant="outline-secondary" className="p-2 h-9 w-9" onClick={undo} disabled={!canUndo}>
                        <Lucide is_color_theme icon="Undo2" className="w-4 h-4" />
                      </Button>
                      <Button ref={redoButtonRef} variant="outline-secondary" className="p-2 h-9 w-9" onClick={redo} disabled={!canRedo}>
                        <Lucide is_color_theme icon="Redo2" className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="h-6 w-px bg-slate-200 dark:bg-darkmode-600"></div>

                    <PermissionGate permission={PERMISSIONS.WEBPLIANT.CONFIGURA} mode="disable">
                      <Button
                        variant="primary"
                        className="h-9"
                        onClick={() => mutationCreazioneWebpliantWorkspace.mutate()}
                        disabled={mutationCreazioneWebpliantWorkspace.isPending}
                      >
                        {mutationCreazioneWebpliantWorkspace.isPending ? (
                          <LoadingIcon icon="tail-spin" className="w-4 h-4 mr-2" />
                        ) : (
                          <Lucide icon="Save" className="w-4 h-4 mr-2" />
                        )}
                        {mutationCreazioneWebpliantWorkspace.isPending ? "Salvataggio..." : "Salva"}
                      </Button>
                    </PermissionGate>
                  </div>
                </div>
              </header>

              {/* MAIN WORKSPACE */}
              <motion.div
                className="flex overflow-hidden relative border-b-2 border-slate-300"
                style={{
                  height: editorState.isTimelineOpen
                    ? `calc(100vh - ${editorState.timelineHeight + 70}px)`
                    : "calc(100vh - 70px)"
                }}
                {...ANIMATION_CONFIG.main}
              >
                {/* CENTER CANVAS - Focused editing area */}
                <main
                  className="flex-grow overflow-auto"
                  ref={mainCanvasRef}
                >
                  <div className="w-full h-full flex justify-center items-start pt-8 pb-8">
                    <div
                      className="bg-white dark:bg-darkmode-700 p-4 rounded-sm border "
                      style={{
                        width: "min(100%, 1280px)",
                        minHeight: "calc(100vh - 100px)",
                        transform: `scale(${editorState.canvasScale})`,
                        transformOrigin: 'top center',
                        transition: 'transform 0.2s ease-in-out'
                      }}
                    >
                      <Dropzone
                        scrollContainerRef={mainCanvasRef}
                        updatePageSettings={updatePageSettings}
                        type="default"
                        parentId=""
                        idWorkspace={dataWorkspace?.idWorkspace}
                        idArea={dataWorkspace?.idArea}
                        idCanale={dataWorkspace?.idCanale}
                        pages={dataWorkspace?.webpliant}
                        selectedPageIndex={editorState.selectedPageIndex}
                        setSelectedPageIndex={editorActions.selectPage}
                        elements={elements}
                        onRemove={handleRemove}
                        onPolicy={handlePolicy}
                        onLock={handleLock}
                        updateElementContent={updateElementContent}
                        onDropItem={handleDrop}
                        moveElement={moveElement}
                        selectedElementId={editorState.selectedElementId}
                        setSelectedElementId={editorActions.selectElement}
                        user_list={user_list}
                        activeTool={editorState.activeTool}
                      />
                    </div>
                  </div>

                  {/* Floating component panel */}
                  {editorState.isComponentsPanelOpen && (
                    <FloatingPanelContainer
                      title="Componenti"
                      onClose={() => editorActions.togglePanel('isComponentsPanelOpen', false)}
                      initialPosition={{ x: 80, y: 120 }}
                    >
                      <div className="grid grid-cols-2 gap-3 p-3">
                        <DraggableItem
                          content="Riga"
                          type="row"
                          icon="Rows2" />
                        <DraggableItem
                          content="Colonna"
                          type="col"
                          icon="Columns2" />
                        <DraggableItem
                          content="Testo"
                          type="text"
                          icon="Type" />
                        <DraggableItem
                          content="Immagine"
                          type="image"
                          icon="Image" />
                        <DraggableItem
                          content="Griglia Ref."
                          type="griglia_referenze"
                          icon="LayoutGrid"
                        />
                        <DraggableItem
                          content="Carosello"
                          type="carousel"
                          icon="GalleryHorizontal"
                        />
                        <DraggableItem
                          content="Video"
                          type="video"
                          icon="Video" />
                        <DraggableItem
                          content="Ricetta AI"
                          type="ricetta_ai"
                          icon="BrainCircuit"
                        />
                        <DraggableItem
                          content="Spazio"
                          type="space"
                          icon="RectangleHorizontal"
                        />
                        <DraggableItem
                          content="Ruota Fortuna"
                          type="ruota_della_fortuna"
                          icon="CircleDashed"
                        />
                        <DraggableItem
                          content="HTML"
                          type="html"
                          icon="Code" />
                        <DraggableItem
                          content="Banner"
                          type="banner"
                          icon="PictureInPicture"
                        />
                        <DraggableItem
                          content="PDF Volantino"
                          type="pdf_volantino"
                          icon="FileText" />
                      </div>
                    </FloatingPanelContainer>
                  )}

                  {/* Floating left panel for Pages & Sitemap */}
                  {editorState.isPagesPanelOpen && (
                    <FloatingPanelContainer
                      title={'Pagine e Navigazione'}
                      onClose={() => editorActions.togglePanel('isPagesPanelOpen', false)}
                      initialPosition={{ x: 40, y: 100 }}
                    >
                      <div className="p-4">
                        <div className="space-y-1.5">
                          {dataWorkspace?.webpliant?.map((pagina, index) => (
                            <div
                              key={pagina.id}
                              className={clsx(
                                "flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors duration-150",
                                editorState.selectedPageIndex === index
                                  ? "bg-primary/10 text-primary font-semibold"
                                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-darkmode-600"
                              )}
                              onClick={() => editorActions.selectPage(index)}
                            >
                              <div className="flex items-center space-x-2.5">
                                <Lucide
                                  icon={pagina.tipo === TIPO_PAGINA.HOMEPAGE ? "LayoutDashboard" : "FileText"}
                                  className="w-4 h-4"
                                />
                                <span className="truncate max-w-[140px] text-sm">{pagina.nome}</span>
                              </div>
                              <span className="text-xs font-medium px-2 py-1 bg-slate-100 dark:bg-darkmode-600 text-slate-500 dark:text-slate-400 rounded-md">
                                {pagina.tipo}
                              </span>
                            </div>
                          ))}
                        </div>

                        <Button
                          variant="outline-secondary"
                          className="w-full mt-4"
                          onClick={() => {
                            editorActions.openDialogPagina(false);
                          }}
                        >
                          <Lucide is_color_theme icon="Plus" className="w-4 h-4 mr-2" />
                          Nuova pagina
                        </Button>
                      </div>
                    </FloatingPanelContainer>
                  )}

                  {editorState.isSitemapPanelOpen && (
                    <FloatingPanelContainer
                      title={'Sitemap'}
                      onClose={() => editorActions.togglePanel('isSitemapPanelOpen', false)}
                      initialPosition={{ x: 120, y: 140 }}
                    >
                      <div className="p-4">
                        <SitemapList
                          sitemaps={sitemaps}
                          setSitemaps={handleSetSitemaps}
                          dataWorkspace={dataWorkspace}
                          compactMode={true}
                        />
                      </div>
                    </FloatingPanelContainer>
                  )}

                </main>

                {/* Timeline delle Promozioni - Ora posizionata correttamente */}


                {/* RIGHT PANEL - Contextual settings */}
                <div
                  className="bg-white dark:bg-darkmode-700 border-l border-slate-200 dark:border-darkmode-600 h-full flex-shrink-0 scrollbar-thin relative"
                  style={{ width: `${editorState.rightWidth}px` }}
                >
                  {/* Resize handle per il pannello destro */}
                  <div
                    className={clsx(
                      "absolute left-0 top-0 bottom-0 w-1 transition-all duration-200 z-10",
                      isResizing === "right"
                        ? "bg-primary cursor-col-resize"
                        : "cursor-col-resize hover:bg-primary/50"
                    )}
                    onMouseDown={handleMouseDownRight}
                  />
                  {isResizing === "right" && (
                    <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary/20" />
                  )}
                  <div className="pt-4 pl-4 h-full">
                    {selectedElement ? (
                      <>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">Impostazioni Elemento</h3>
                          <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={() => handleRemove(selectedElement.id)}
                          >
                            <span className="sr-only">Elimina Elemento</span>
                            <Lucide icon="Trash" className="w-4 h-4" />
                          </Button>
                        </div>
                        <Suspense fallback={
                          <div className="flex flex-col items-center justify-center h-full text-slate-500 dark:text-slate-400">
                            <Lucide icon="Loader" className="w-6 h-6 mx-auto animate-spin text-gray-400 mb-2" />
                            <p className="text-gray-500 text-sm">Caricamento impostazioni elemento...</p>
                          </div>
                        }>
                          <ElementSettings
                            element={selectedElement}
                            updateElementContent={updateElementContent}
                            updateElement={updateElement}
                            pages={dataWorkspace.webpliant}
                            promos={promos}
                            dataPerSelezioneRicette={dataPerSelezioneRicette.data ?? []}
                            dataPerTipiExport={dataPerTipiExport.data ?? []}
                            dataPerKitDesign={dataPerKitDesign.data?.filter((kit) => {
                              if (kit.guidCanale === dataWorkspace?.idCanale && kit.guidArea === dataWorkspace?.idArea) {
                                return kit;
                              } else {
                                return null;
                              }
                            }) || []}
                          />
                        </Suspense>
                      </>
                    ) : (
                      <div className="text-center flex flex-col items-center justify-center h-full text-slate-500 dark:text-slate-400">
                        <div className="w-20 h-20 bg-slate-100 dark:bg-darkmode-600 rounded-full flex items-center justify-center mb-4">
                          <Lucide is_color_theme icon="SquareMousePointer" className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                        </div>
                        <h4 className="font-semibold text-lg text-slate-600 dark:text-slate-300">Nessun elemento selezionato</h4>
                        <p className="text-sm mt-1 mb-6">Clicca su un elemento nella canvas per vederne le proprietà.</p>
                        <Button
                          variant="outline-primary"
                          onClick={() => editorActions.togglePanel('isComponentsPanelOpen', true)}
                        >
                          <Lucide is_color_theme icon="Plus" className="w-4 h-4 mr-2" />
                          Aggiungi Componente
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Timeline Footer - Integrato nel layout */}
            <AnimatePresence>
              {editorState.isTimelineOpen && (
                <Suspense fallback={
                  <div
                    className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border border-slate-300 overflow-hidden transform-gpu"
                    style={{ height: "460px" }}
                  >
                    <div className="h-full flex flex-col items-center justify-center">
                      {/* Spinner principale */}
                      <div className="relative mb-6">
                        <div className="w-12 h-12 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div>
                        <div className="absolute inset-0 w-12 h-12 border-4 border-transparent border-r-primary/30 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
                      </div>

                      {/* Testo principale */}
                      <h3 className="text-lg font-semibold text-slate-800 mb-2">Caricamento Timeline</h3>
                      <p className="text-slate-600 text-sm mb-4">Preparazione componenti e keyframes...</p>

                      {/* Barra di progresso animata */}
                      <div className="w-64 h-1 bg-slate-200 rounded-full overflow-hidden mb-4">
                        <div className="h-full bg-gradient-to-r from-primary to-blue-500 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                      </div>

                      {/* Indicatori di caricamento */}
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                        <span>Inizializzazione componenti</span>
                      </div>
                    </div>
                  </div>
                }>
                  <PromotionTimeline
                    addComponent={addComponent}
                    updateComponent={updateElement}
                    promos={promos}
                    isVisible={editorState.isTimelineOpen}
                    onToggle={() => editorActions.togglePanel('isTimelineOpen', false)}
                    selectedComponent={selectedElement}
                    availableComponents={pages[editorState.selectedPageIndex] || []}
                    timelineHeight={editorState.timelineHeight + 6}
                    onResize={handleMouseDownTimeline}
                    isResizing={isResizing === "timeline"}
                  />
                </Suspense>
              )}
            </AnimatePresence>

          </DndProvider>

          {/* Indicatore di resize */}
          {showResizeIndicator && isResizing && (
            <div className="fixed top-4 right-4 bg-slate-800 text-white px-3 py-2 rounded-lg shadow-lg z-[100] text-sm font-mono">
              {isResizing === "right" && `Larghezza: ${editorState.rightWidth}px`}
              {isResizing === "timeline" && `Altezza: ${editorState.timelineHeight}px`}
            </div>
          )}
        </KeyframeEventProvider>
      </GestioneReferenzeProvider>
    </>
  );
};

export default withSessionCheck(CreazioneWebPliant);
