import Lucide from "@/components/Base/Lucide";
import { useKeyframeEvents } from "@/context/KeyframeEventContext";
import { useUser } from "@/context/UserContext";
import clsx from "clsx";
import dayjs from "dayjs";
import parse from "html-react-parser";
import { lazy, memo, Suspense, useCallback, useMemo, useRef } from "react";
import { useDrag, useDrop, XYCoord } from "react-dnd";
import { Config, PageLayoutItem } from "../../../lib/types";
import ActionButtons from "./ActionButtons";
import Dropzone from "./Dropzone";
import GrigliaReferenze from "./sub-components/GrigliaReferenze";

// Preview Components from WebPliant - DYNAMICALLY IMPORTED
const CarouselContainer = lazy(() => import("@/pages/WebPliant/CarouselContainer"));
const VideoBanner = lazy(() => import("@/pages/WebPliant/VideoBanner"));
const RicetteContent = lazy(() => import("@/pages/WebPliant/RicetteContent"));

interface GridItemProps {
  element: PageLayoutItem;
  idWorkspace: string;
  idCanale: string;
  idArea: string;
  onRemove: (id: string) => void;
  onPolicy: (id: string) => void;
  onLock: (id: string) => void;
  policyAttiva: boolean;
  user_locked: { locked: boolean; user_id: string };
  updateElementContent: (id: string, content: any) => void;
  onDropItem: (item: any, parentId: string, index?: number) => void;
  moveElement: (dragId: string, hoverId: string, parentId?: string) => void;
  index: number;
  parentId: string;
  selectedElementId: string | null;
  setSelectedElementId: (id: string) => void;
  user_list: Array<{ id: string; name: string }>;
  config: Config | undefined;
  scrollContainerRef: React.RefObject<HTMLElement | null>;
  activeTool: string;
}
const ItemTypes = {
  ELEMENT: "element",
};


const GridItem: React.FC<GridItemProps> = ({
  element,
  onRemove,
  idWorkspace,
  idCanale,
  idArea,
  onPolicy,
  onLock,
  policyAttiva,
  user_locked,
  updateElementContent,
  onDropItem,
  moveElement,
  index,
  parentId,
  selectedElementId,
  setSelectedElementId,
  user_list,
  config,
  scrollContainerRef,
  activeTool
}) => {

  const { id, content, children, type, duration, alias } = element; // Rinominato 'alias' in 'elementAlias' per risolvere l'errore di ridichiarazione
  const user = useUser();
  const { isComponentVisible, recordModification, hasActiveKeyframeFor, getComponentModifications } = useKeyframeEvents();
  const combinedRef = useRef<HTMLDivElement>(null);

  // Verifica se il componente è visibile in base alla data selezionata
  const isVisible = useMemo(() => {
    return isComponentVisible(id);
  }, [isComponentVisible, id]);

  // Calcola il contenuto effettivo (base + override dal keyframe)
  const effectiveContent = useMemo(() => {
    let result = content || {};
    const mods = getComponentModifications(id);

    // Applica le modifiche di contenuto in ordine cronologico
    mods
      .filter(m => m.modificationType === 'content' && m.content)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .forEach(m => {
        result = { ...result, ...m.content };
      });

    return result;
  }, [id, content, getComponentModifications]);

  // Propaga gli overrides anche ai child dinamici creando una versione "patchata" dell'elemento
  const elementWithOverrides = useMemo(() => ({
    ...element,
    content: effectiveContent
  }), [element, effectiveContent]);

  // Determina se l'elemento ha una duration attiva
  const hasActiveDuration = useMemo(() => {
    if (!duration) return false;

    try {
      const startDate = dayjs(duration.start_date);
      const endDate = dayjs(duration.end_date);

      // Verifica se entrambe le date sono valide
      if (!startDate.isValid() || !endDate.isValid()) return false;

      // Verifica se c'è almeno una data impostata
      return duration.start_date || duration.end_date;
    } catch (error) {
      console.error('Errore nella verifica della duration:', error);
      return false;
    }
  }, [duration]);

  // Determina se la duration è scaduta
  const isDurationExpired = useMemo(() => {
    if (!hasActiveDuration || !duration?.end_date) return false;

    try {
      const endDate = dayjs(duration.end_date);
      return endDate.isValid() && endDate.isBefore(dayjs(), 'day');
    } catch (error) {
      console.error('Errore nella verifica della scadenza:', error);
      return false;
    }
  }, [hasActiveDuration, duration]);

  // Determina se la duration è imminente (entro 7 giorni)
  const isDurationImminent = useMemo(() => {
    if (!hasActiveDuration || !duration?.end_date) return false;

    try {
      const endDate = dayjs(duration.end_date);
      const now = dayjs();
      const daysUntilExpiry = endDate.diff(now, 'day');

      return endDate.isValid() && daysUntilExpiry >= 0 && daysUntilExpiry <= 7;
    } catch (error) {
      console.error('Errore nella verifica della scadenza imminente:', error);
      return false;
    }
  }, [hasActiveDuration, duration]);

  // Memorizziamo i props per evitare rerendering non necessari e flickering
  const stableCarouselProps = useMemo(() => {
    if (!config) return null;
    return {
      item: elementWithOverrides,   // <— usa l'elemento patchato
      config,
      refsWishlist: [],
      pagine: [],
      isEditor: true,
      idAreaProps: idArea ?? "",
      idCanaleProps: idCanale ?? ""
    };
  }, [elementWithOverrides, config, idArea, idCanale]);

  // Props stabilizzati per BoxRef
  const stableBoxRefProps = useMemo(() => {
    if (!config) return null;
    return { config };
  }, [config]);

  // Props stabilizzati per RicetteContent
  const stableRicetteProps = useMemo(() => ({
    item: elementWithOverrides
  }), [elementWithOverrides]);

  // Props stabilizzati per VideoBanner
  const stableVideoProps = useMemo(() => ({
    src: effectiveContent?.src,     // <— usa effectiveContent
    item: elementWithOverrides
  }), [effectiveContent?.src, elementWithOverrides]);

  const [{ handlerId, isOverCurrent }, drop] = useDrop({
    accept: ItemTypes.ELEMENT,
    hover(item: any, monitor) {
      if (!combinedRef.current) return;
      const hoverBoundingRect = combinedRef.current.getBoundingClientRect();
      const hoverMiddleY =
        (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      const clientOffset = monitor.getClientOffset() as XYCoord;
      const hoverClientY = clientOffset.y - hoverBoundingRect.top;
      if (item.isNew) {
        if (monitor.isOver({ shallow: true })) {
          item.hoverIndex = index;
          item.hoverParentId = parentId;
          console.log('[GridItem] hover - new item', { hoverIndex: index, hoverParentId: parentId });
        }
      } else {
        if (item.id === id) return;
        // Permettiamo spostamento tra contenitori diversi rimuovendo questa restrizione
        // if (item.parentId !== parentId) return;

        // Solo per elementi nello stesso contenitore, usiamo la logica di ordinamento precisa
        if (item.parentId === parentId) {
          if (item.index < index && hoverClientY < hoverMiddleY) return;
          if (item.index > index && hoverClientY > hoverMiddleY) return;
        }

        moveElementSmart(item.id, id, parentId, item.index, index);
        item.index = index;
      }
    },
    drop(item: any, monitor) {
      console.log('[GridItem] drop attempt', {
        itemIsNew: item.isNew,
        didDrop: monitor.didDrop(),
        isOverCurrent,
        parentId,
        hoverIndex: item.hoverIndex
      });

      // Per elementi nuovi, accettiamo solo se siamo la zona di drop più specifica
      if (item.isNew && !monitor.didDrop() && isOverCurrent) {
        console.log('[GridItem] executing drop for new item');
        onDropItem(item, parentId, item.hoverIndex);
        return { dropped: true };
      }
    },
    collect: (monitor) => ({
      handlerId: monitor.getHandlerId(),
      isOverCurrent: monitor.isOver({ shallow: true }),
    }),
    canDrop: (item: any) => {
      console.log('[GridItem] canDrop check', {
        itemIsNew: item.isNew,
        activeTool,
        parentId,
        elementType: type
      });

      // Per elementi nuovi (dal DraggableItem), sempre permetti drop
      if (item.isNew) {
        console.log('[GridItem] allowing drop for new item - always allowed');
        return true;
      }

      // Per elementi esistenti, permettiamo movimento anche tra contenitori diversi
      if (!item.isNew) {
        if (user_locked.locked && user?.user?.id !== user_locked.user_id) {
          console.log('[GridItem] blocking drop - user locked');
          return false;
        }
        console.log('[GridItem] allowing move for existing item (cross-container allowed)');
        return true; // Permettiamo movimento tra tutti i contenitori
      }

      console.log('[GridItem] blocking drop - conditions not met');
      return false;
    },
  });

  const [{ isDragging }, drag] = useDrag({
    type: ItemTypes.ELEMENT,
    item: { id, index, parentId, isNew: false },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    canDrag: (item: any) => {
      console.log('[GridItem] canDrag check', { activeTool, elementId: id, elementType: type });
      // Permettiamo sempre il drag degli elementi esistenti per migliorare l'UX
      // L'activeTool influenzerà solo l'aspetto visivo (cursore) e altri comportamenti
      if (activeTool === "select" && !item.isNew) {
        console.log('[GridItem] blocking drag - select tool active');
        return false;
      }
      if (user_locked.locked && user?.user?.id !== user_locked.user_id) {
        console.log('[GridItem] blocking drag - user locked');
        return false;
      }
      console.log('[GridItem] allowing drag');
      return true;
    },
  });

  drag(drop(combinedRef));

  const renderPreview = (
    type: string,
    content: any,
    config: Config | undefined,
    activeTool: string,
    isHybrid: boolean,
  ) => {
    // Definisci classi comuni per il bordo degli elementi ibridi e predefiniti

    // Componente di fallback comune per gli stati di caricamento con bordo condizionale
    const suspenseFallback = (
      <div className={clsx(
        "text-center p-4",

      )}>
        <Lucide icon="Loader" className="w-6 h-6 mx-auto animate-spin text-gray-400 mb-2" />
        <p className="text-gray-500">In attesa della configurazione...</p>
      </div>
    );

    if (!config) {
      return (
        <div className={clsx(
          "text-center p-4",

        )}>
          <Lucide icon="Loader" className="w-6 h-6 mx-auto animate-spin text-gray-400 mb-2" />
          <p className="text-gray-500">In attesa della configurazione...</p>
        </div>
      );
    }

    switch (type) {
      case "carousel":
        return (
          <div className={clsx(
            "pointer-events-none scale-90",

          )}>
            <Suspense fallback={suspenseFallback}>
              {stableCarouselProps ? (
                <CarouselContainer {...stableCarouselProps} />
              ) : (
                <div className={clsx(
                  "text-center p-4",
                  // Fallback per assenza di props
                )}>
                  <Lucide icon="Loader" className="w-6 h-6 mx-auto animate-spin text-gray-400 mb-2" />
                  <p className="text-gray-500">In attesa della configurazione...</p>
                </div>
              )}
            </Suspense>
          </div>
        );
      case "video":
        return (
          <div className={clsx(
            "pointer-events-none scale-90",

          )}>
            <Suspense fallback={suspenseFallback}>
              <VideoBanner {...stableVideoProps} />
            </Suspense>
          </div>
        );
      case "text":
        return (
          <div
            className={clsx(
              "p-4",

            )}
            dangerouslySetInnerHTML={{ __html: content?.text || "Testo di esempio" }}
          ></div>
        );
      case "image":
        return (
          <div className={clsx(
            "relative flex items-center justify-center", // Aggiunto flex per centrare se l'immagine è più piccola
            // Aggiunto p-1 per spaziatura interna al bordo
          )}>
            {content?.src ? (
              <img src={content.src} alt="preview" className="max-w-full h-auto" />
            ) : (
              <div className="p-4 bg-gray-200 text-center text-gray-500 w-full h-full">
                Immagine
              </div>
            )}
          </div>
        );
      case "griglia_referenze":
        return (
          <div className={clsx(
            "grid grid-cols-4 gap-4 p-4 pointer-events-none scale-90",

          )}>
            <Suspense fallback={suspenseFallback}>
              <GrigliaReferenze id={id} updateElementContent={handleUpdateElementContent} locked={user_locked.locked} item={element} />
            </Suspense>
          </div>
        );
      case "ricetta_ai":
        return (
          <div className={clsx(
            "p-4 pointer-events-none scale-90",

          )}>
            <Suspense fallback={suspenseFallback}>
              <RicetteContent {...stableRicetteProps} />
            </Suspense>
          </div>
        );
      case "ruota_della_fortuna":
        return (
          <div className={clsx(
            "p-4 bg-gray-200 text-center text-gray-500",

          )}>
            <Lucide icon="CircleDashed" className="mx-auto mb-2" />
            Ruota della Fortuna
          </div>
        );
      case "space":
        return (
          <div className={clsx(
            "p-4 bg-gray-100 text-center text-gray-400 italic",

          )}>
            Spazio Vuoto
          </div>
        );
      case "html":
        return (
          <div className={clsx(
            "p-4 rounded-lg",
            // Usa bordo predefinito se non ibrido
          )}>
            <div className="text-gray-500 font-mono text-xs">
              {parse(content?.html || "<div>Codice HTML personalizzato</div>")}
            </div>
          </div>
        );
      case "banner":
        return (
          <div className={clsx(
            "p-4 bg-blue-100 text-center text-blue-800",

          )}>
            <Lucide icon="PictureInPicture" className="mx-auto mb-2" />
            Banner
          </div>
        );
      case "row":
      case "col":
        const dropzoneType = type === "row" ? "row" : "column";
        return (
          <div className={clsx(
            "relative", // Assicura posizionamento relativo per potenziali figli assoluti o overlay
            isHybrid && "border-2 border-dashed border-pink-500 rounded-lg p-1" // Aggiungi padding per rendere il bordo visibile attorno al Dropzone
          )}>
            <Dropzone
              type={dropzoneType}
              parentId={id}
              elements={children || []}
              onRemove={onRemove}
              onPolicy={onPolicy}
              onLock={onLock}
              updateElementContent={handleUpdateElementContent}
              onDropItem={onDropItem}
              moveElement={moveElementSmart}
              selectedElementId={selectedElementId}
              setSelectedElementId={setSelectedElementId}
              user_list={user_list}
              scrollContainerRef={scrollContainerRef}
              updatePageSettings={() => { }}
              idWorkspace=""
              idArea=""
              idCanale=""
              activeTool={activeTool}
            />
          </div>
        );
      case "pdf_volantino":
        return (
          <div className={clsx(
            "p-4 bg-gray-100 text-center text-gray-500",

          )}>
            <Lucide icon="FileText" className="mx-auto mb-2" />
            PDF Volantino
          </div>
        );
      default:
        return (
          <div className={clsx(
            "p-4 text-center",

          )}>
            <p className="font-semibold capitalize">{type}</p>
          </div>
        );
    }
  };

  const isSelected = selectedElementId === id;
  const isHybrid = element.is_hybrid || false;

  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedElementId(id);
  };

  // Wrapper per updateElementContent che gestisce override vs contenuto base
  const handleUpdateElementContent = useCallback((newContent: any) => {
    if (hasActiveKeyframeFor(id)) {
      // Durante il range del keyframe: modifica SOLO nel keyframe (override)
      console.log(`🎯 Override keyframe per componente ${id}:`, newContent);
      recordModification(id, 'content', newContent);
    } else {
      // Fuori dal range: modifica contenuto base
      console.log(`📝 Modifica contenuto base per componente ${id}:`, newContent);
      updateElementContent(id, newContent);
    }
  }, [id, hasActiveKeyframeFor, recordModification, updateElementContent]);

  // Scrittura keyframe-aware per ordinamento (drag & drop)
  const moveElementSmart = useCallback((
    dragId: string,
    hoverId: string,
    parentId?: string,
    oldIndex?: number,
    newIndex?: number
  ) => {
    if (hasActiveKeyframeFor(dragId)) {
      // IN RANGE → registra override di posizione
      if (typeof oldIndex === 'number' && typeof newIndex === 'number') {
        recordModification(dragId, 'position', { oldIndex, newIndex });
      }
    } else {
      // FUORI RANGE → applica al base
      moveElement(dragId, hoverId, parentId);
    }
  }, [hasActiveKeyframeFor, moveElement, recordModification]);

  // Determina le classi CSS in base allo stato della duration
  const getDurationClasses = () => {
    if (!hasActiveDuration) return {};

    if (isDurationExpired) {
      return {
        border: "ring-2 ring-red-500 dark:ring-red-400",
        badge: "bg-red-500 text-white",
        icon: "CalendarX" as const,
        tooltip: "Scaduto",
        text: "Scaduto"
      };
    }

    if (isDurationImminent) {
      return {
        border: "ring-2 ring-orange-500 dark:ring-orange-400",
        badge: "bg-orange-500 text-white",
        icon: "Clock" as const,
        tooltip: "Scade presto",
        text: "Scade presto"
      };
    }

    return {
      border: "ring-2 ring-green-500 dark:ring-green-400",
      badge: "bg-green-500 text-white",
      icon: "Calendar" as const,
      tooltip: "Attivo",
      text: "Attivo"
    };
  };

  const durationClasses = getDurationClasses();

  if (!element) return null;

  // Se il componente non è visibile, non renderizzarlo
  if (!isVisible) return null;

  return (
    <div
      ref={combinedRef}
      data-handler-id={handlerId}
      className={clsx(
        "relative mb-4 cursor-pointer rounded-sm bg-white transition-all duration-200 dark:bg-darkmode-700 overflow-hidden",
        "transform-gpu",
        {
          "opacity-50": isDragging,
        },
        isSelected
          ? isHybrid
            ? "ring-2 ring-pink-500 shadow-lg shadow-pink-500/25 dark:ring-pink-400 dark:shadow-pink-500/20"
            : "ring-2 ring-primary shadow-lg shadow-primary/25 dark:ring-primary dark:shadow-primary/20"
          : hasActiveDuration
            ? durationClasses.border
            : isHybrid
              ? "ring-1 ring-pink-200 hover:ring-2 hover:ring-pink-400 dark:ring-pink-800"
              : "ring-1 ring-slate-200 hover:ring-2 hover:ring-primary/50 dark:ring-slate-800"
      )}
      onClick={onClick}
    >
      {/* Header con badge e ActionButtons */}
      <div className="relative bg-slate-50 dark:bg-darkmode-800 border-b border-slate-200 dark:border-darkmode-600 p-2 min-h-[48px] flex items-center">
        <div className="flex justify-between items-center gap-2 w-full">
          {/* Badge a sinistra */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Badge indicatore duration */}
            {hasActiveDuration && durationClasses.icon && (
              <div
                className={clsx(
                  "px-2 py-1 rounded-full text-xs font-medium shadow-sm flex items-center gap-1",
                  durationClasses.badge
                )}
                title={durationClasses.tooltip}
              >
                <Lucide icon={durationClasses.icon} className="w-3 h-3" />
                <span className="text-xs">{durationClasses.text}</span>
              </div>
            )}

            {/* Badge ibrido */}
            {isHybrid && (
              <div
                className="px-2 py-1 rounded-full text-xs font-medium shadow-sm flex items-center gap-1 bg-pink-500 text-white"
                title="Componente Ibrido"
              >
                <Lucide icon="Zap" className="w-3 h-3" />
                <span className="text-xs">Ibrido</span>
              </div>
            )}

            {/* Badge alias */}
            {alias && (
              <div
                className="px-2 py-1 rounded-full text-xs font-medium shadow-sm flex items-center gap-1 bg-blue-500 text-white"
                title="Alias Personalizzato"
              >
                <Lucide icon="Tag" className="w-3 h-3" />
                <span className="text-xs">{alias}</span>
              </div>
            )}

            {/* Badge override */}
            {hasActiveKeyframeFor(id) && (
              <div className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full shadow-sm flex items-center gap-1">
                <Lucide icon="Clock" className="w-3 h-3" />
                <span>Override</span>
                {(() => {
                  const mods = getComponentModifications(id);
                  return mods.length > 0 ? (
                    <span className="bg-blue-600 text-white text-xs px-1 py-0.5 rounded-full ml-1">
                      {mods.length}
                    </span>
                  ) : null;
                })()}
              </div>
            )}
          </div>

          {/* ActionButtons a destra */}
          <div className="flex-shrink-0">
            <ActionButtons
              onRemove={() => onRemove(id)}
              onPolicy={() => onPolicy(id)}
              onLock={() => onLock(id)}
              policyAttiva={policyAttiva}
              locked={user_locked.locked}
            />
          </div>
        </div>
      </div>

      {/* Contenuto principale */}
      <div className="relative">
        {renderPreview(type, effectiveContent, config, activeTool, element.is_hybrid || false)}
      </div>
    </div>
  );
};
export default memo(GridItem);
