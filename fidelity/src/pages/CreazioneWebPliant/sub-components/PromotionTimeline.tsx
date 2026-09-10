// ============================================================================
// Timeline Promozioni – Modalità Data / Keyframes (promo come corsie sopra)
// Allineamento senza variabili magiche + click su keyframe avvia creazione nuova timeline
// ============================================================================

import Button from "@/components/Base/Button";
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger
} from "@/components/Base/ContextMenu";
import Lucide from "@/components/Base/Lucide";
import { useKeyframeEvents } from "@/context/KeyframeEventContext";
import { useNotification } from "@/context/NotificationContext";
import { useKeyframeManager } from "@/hooks/useKeyframeManager";
import clsx from "clsx";
import dayjs from "dayjs";
import { AnimatePresence } from "framer-motion";
import * as lucideIcons from "lucide-react";
import React, { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { STATO_PROMO } from "../../../../lib/enums";
import { Keyframe, KeyframeModification, PageLayoutItem, PolicyDiVisualizzazioneType } from "../../../../lib/types";
import { PromoResponseDTO } from "../../../../server/core/dto";
import { FormInput, FormSelect } from "../../../components/Base/Form";
import { Popover } from "../../../components/Base/Headless";
dayjs.locale("it");
export const { icons } = lucideIcons;

interface PromotionTimelineProps {
  promos: PromoResponseDTO[];
  isVisible: boolean;
  onToggle: () => void;
  onKeyframeSelect?: (keyframe: Keyframe) => void;
  onModificationApply?: (keyframeId: string, modification: KeyframeModification) => void;
  addComponent?: (component: PageLayoutItem, index: number) => void;
  updateComponent?: (componentId: string, updatedComponent: PageLayoutItem) => void;
  availableComponents?: PageLayoutItem[];
  selectedComponent?: PageLayoutItem | null;
  timelineHeight?: number;
  onResize?: (e: React.MouseEvent<HTMLDivElement>) => void;
  isResizing?: boolean;
}

// =====================
// COSTANTI / UTILITY
// =====================

const DEFAULT_TIMELINE_HEIGHT = 460;
const DAY_WIDTH = 40;
const TIMELINE_PADDING = 20;
const DIAMOND_SIZE = 14;

const LANE_LABEL_WIDTH = 260;
const HEADER_HEIGHT = 40;
const LANE_HEIGHT = 40;
const LANE_CENTER = LANE_HEIGHT / 2;

const HITBOX_HEIGHT = 24;
const SELECT_TOLERANCE_PX = 20;

const COLORS: Record<STATO_PROMO, string> = {
  [STATO_PROMO.PIANIFICATA]: "#6366f1",
  [STATO_PROMO.IN_LAVORAZIONE]: "#3b82f6",
  [STATO_PROMO.IN_SCADENZA]: "#f59e0b",
  [STATO_PROMO.IN_ATTESA_DI_VALIDITA]: "#06b6d4",
  [STATO_PROMO.VALIDA]: "#10b981",
  [STATO_PROMO.VALIDA_CON_ERRORI]: "#eab308",
  [STATO_PROMO.ARCHIVIATA]: "#94a3b8",
  [STATO_PROMO.IN_RITARDO]: "#f97316",
  [STATO_PROMO.ELIMINATA]: "#ef4444",
};

const KEYFRAME_COLORS = ["#8b5cf6", "#06b6d4", "#f97316", "#ec4899", "#84cc16", "#6366f1"];
const OVERRIDE_TYPE_COLORS = { components: "#3b82f6", structure: "#f97316" };
// Altezza barra visiva interna alle righe (promo card / linea keyframe)
const V_MARGIN = Math.max(2, Math.floor(LANE_HEIGHT * 0.15));
const innerHeight = (h: number) => Math.max(8, h - V_MARGIN * 2);

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const laneColorFor = (laneId: string) => {
  let hash = 0;
  for (let i = 0; i < laneId.length; i++) hash = (hash * 31 + laneId.charCodeAt(i)) | 0;
  const idx = Math.abs(hash) % KEYFRAME_COLORS.length;
  return KEYFRAME_COLORS[idx];
};

const iconForType = (type?: string) => {
  switch ((type || "").toLowerCase()) {
    case "text": return "Type";
    case "image": return "Image";
    case "banner": return "RectangleHorizontal";
    case "product": return "Package";
    case "carousel": return "PanelsTopLeft";
    case "hybrid": return "Zap";
    default: return "Shapes";
  }
};

// Tipi di componenti disponibili per i componenti ibridi
const HYBRID_COMPONENT_TYPES = [
  { type: "text", label: "Testo", icon: "Type", description: "Blocco di testo personalizzabile" },
  { type: "image", label: "Immagine", icon: "Image", description: "Immagine singola o galleria" },
  { type: "banner", label: "Banner", icon: "RectangleHorizontal", description: "Banner promozionale o informativo" },
  { type: "carousel", label: "Carosello", icon: "PanelsTopLeft", description: "Carosello di immagini o prodotti" },
  { type: "video", label: "Video", icon: "Video", description: "Video incorporato o caricato" },
  { type: "ricetta_ai", label: "Ricetta AI", icon: "BookText", description: "Contenuto generato da AI per ricette" },
  { type: "griglia_referenze", label: "Griglia Referenze", icon: "LayoutGrid", description: "Griglia di prodotti o referenze" },
  { type: "ruota_della_fortuna", label: "Ruota della Fortuna", icon: "Award", description: "Componente interattivo 'Ruota della Fortuna'" },
  { type: "html", label: "HTML Personalizzato", icon: "Code", description: "Blocco HTML/CSS personalizzato" },
  { type: "pdf_volantino", label: "PDF Volantino", icon: "FileText", description: "Visualizzatore di volantini PDF" },
];

// =====================
// REDUCER
// =====================

type Mode = "date" | "keyframes";

type State = {
  selectedKeyframe: Keyframe | null;
  promoDuration: { start: dayjs.Dayjs; end: dayjs.Dayjs } | null;
  inspectorOpen: boolean;
  mode: Mode;
  contextDate: dayjs.Dayjs | null;
  contextLaneIndex: number;
  openPopoverId: string | null;
  editingAliasId: string | null;
  editingAliasValue: string;
  ghostCreate: { start: dayjs.Dayjs; end: dayjs.Dayjs } | null;
  currentDate: dayjs.Dayjs;
  selectedDate: dayjs.Dayjs | null;
  contextMenuOpen: boolean;
};

type Action =
  | { type: "SET_SELECTED_KEYFRAME"; payload: Keyframe | null }
  | { type: "SET_PROMO_DURATION"; payload: { start: dayjs.Dayjs; end: dayjs.Dayjs } }
  | { type: "SET_INSPECTOR_OPEN"; payload: boolean }
  | { type: "SET_MODE"; payload: Mode }
  | { type: "SET_CONTEXT"; payload: { date: dayjs.Dayjs | null; laneIndex: number } }
  | { type: "SET_OPEN_POPOVER"; payload: string | null }
  | { type: "START_EDIT_ALIAS"; payload: { id: string; value: string } }
  | { type: "SET_EDITING_ALIAS_VALUE"; payload: string }
  | { type: "END_EDIT_ALIAS" }
  | { type: "SET_GHOST_CREATE"; payload: { start: dayjs.Dayjs; end: dayjs.Dayjs } | null }
  | { type: "TICK_TODAY"; payload: dayjs.Dayjs }
  | { type: "SET_SELECTED_DATE"; payload: dayjs.Dayjs | null }
  | { type: "SET_CONTEXT_MENU_OPEN"; payload: boolean };

const initState: State = {
  selectedKeyframe: null,
  promoDuration: null,
  inspectorOpen: false,
  mode: "keyframes",
  contextDate: null,
  contextLaneIndex: 0,
  openPopoverId: null,
  editingAliasId: null,
  editingAliasValue: "",
  ghostCreate: null,
  currentDate: dayjs().startOf("day"),
  selectedDate: null,
  contextMenuOpen: false,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_SELECTED_KEYFRAME":
      return { ...state, selectedKeyframe: action.payload };
    case "SET_PROMO_DURATION":
      return { ...state, promoDuration: action.payload };
    case "SET_INSPECTOR_OPEN":
      return { ...state, inspectorOpen: action.payload };
    case "SET_MODE":
      return { ...state, mode: action.payload };
    case "SET_CONTEXT":
      return { ...state, contextDate: action.payload.date, contextLaneIndex: action.payload.laneIndex };
    case "SET_OPEN_POPOVER":
      return { ...state, openPopoverId: action.payload };
    case "START_EDIT_ALIAS":
      return { ...state, editingAliasId: action.payload.id, editingAliasValue: action.payload.value };
    case "SET_EDITING_ALIAS_VALUE":
      return { ...state, editingAliasValue: action.payload };
    case "END_EDIT_ALIAS":
      return { ...state, editingAliasId: null, editingAliasValue: "" };
    case "SET_GHOST_CREATE":
      return { ...state, ghostCreate: action.payload };
    case "TICK_TODAY":
      return { ...state, currentDate: action.payload };
    case "SET_SELECTED_DATE":
      console.log("SET_SELECTED_DATE:", action.payload?.format("DD/MM/YYYY"));
      return { ...state, selectedDate: action.payload };
    case "SET_CONTEXT_MENU_OPEN":
      return { ...state, contextMenuOpen: action.payload };
    default:
      return state;
  }
}

// ============================================================================
// COMPONENTE
// ============================================================================

const PromotionTimeline: React.FC<PromotionTimelineProps> = ({
  promos,
  isVisible,
  onToggle,
  onKeyframeSelect,
  onModificationApply,
  addComponent,
  updateComponent,
  availableComponents = [],
  selectedComponent,
  timelineHeight = DEFAULT_TIMELINE_HEIGHT,
  onResize,
  isResizing = false,
}) => {
  const { showNotification } = useNotification();
  const { setSelectedDate } = useKeyframeEvents();

  const {
    keyframes,
    addKeyframe,
    updateKeyframe,
    deleteKeyframe,
    duplicateKeyframe,
    toggleKeyframeActive,
    setActiveKeyframeId,
  } = useKeyframeManager(availableComponents, updateComponent || (() => { }));

  const [state, dispatch] = useReducer(reducer, initState);

  const {
    selectedKeyframe,
    promoDuration,
    inspectorOpen,
    mode,
    contextDate,
    contextLaneIndex,
    openPopoverId,
    editingAliasId,
    editingAliasValue,
    ghostCreate,
    currentDate,
    selectedDate,
    contextMenuOpen,
  } = state;

  const timelineRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isInteractingWithKeyframe = useRef(false);
  const isDraggingToCreate = useRef(false);
  const dragAnchorRef = useRef<dayjs.Dayjs | null>(null);
  const ghostLaneRef = useRef<number | null>(null);
  const isDoubleClicking = useRef(false);

  const resizeStateRef = useRef<{ kfId: string; edge: 'start' | 'end' } | null>(null);
  const resizeListenersRef = useRef<{ onMove: (ev: MouseEvent) => void; onUp: () => void } | null>(null);
  const pendingSelectRef = useRef<{ startISO: string; endISO: string; target?: string } | null>(null);

  useEffect(() => {
    const tick = () => dispatch({ type: "TICK_TODAY", payload: dayjs().startOf("day") });
    tick();
    const t = setInterval(tick, 60000);
    return () => clearInterval(t);
  }, []);

  // Gestisce la chiusura del popover quando si clicca fuori
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openPopoverId) {
        const target = event.target as Element;
        if (!target.closest('[data-popover]')) {
          dispatch({ type: "SET_OPEN_POPOVER", payload: null });
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openPopoverId]);

  // ======================
  // TIME RANGE
  // ======================

  const timeRange = useMemo(() => {
    const today = dayjs().startOf('day');
    let baseEnd = today.add(90, 'days');
    if (promos.length > 0) {
      const promoDates = promos.flatMap(p => [dayjs(p.validita_dal, "DD/MM/YYYY"), dayjs(p.validita_al, "DD/MM/YYYY"), dayjs(p.data_scadenza, "DD/MM/YYYY")]);
      const maxPromo = promoDates.reduce((max, d) => d.isAfter(max) ? d : max, today);
      baseEnd = maxPromo.isAfter(baseEnd) ? maxPromo : baseEnd;
    }
    return { start: today, end: baseEnd };
  }, [promos]);

  const timelineDates = useMemo(() => {
    const arr: dayjs.Dayjs[] = [];
    let d = timeRange.start.clone();
    while (d.isBefore(timeRange.end) || d.isSame(timeRange.end, "day")) {
      arr.push(d.clone());
      d = d.add(1, "day");
    }
    return arr;
  }, [timeRange]);

  const timelineWidth = timelineDates.length * DAY_WIDTH;
  const getDatePosition = useCallback((date: dayjs.Dayjs) => {
    const diffInDays = date.diff(timeRange.start, "days");
    return diffInDays * DAY_WIDTH;
  }, [timeRange.start]);

  const getDateFromClientX = useCallback((clientX: number) => {
    const scroll = scrollContainerRef.current;
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect || !scroll) return null;

    // Calcola la posizione X considerando lo scroll orizzontale
    const x = clientX + scroll.scrollLeft - LANE_LABEL_WIDTH - TIMELINE_PADDING;
    const idx = clamp(Math.floor(x / DAY_WIDTH), 0, timelineDates.length - 1);
    const result = timelineDates[idx] || null;

    console.log("getDateFromClientX:", {
      clientX,
      rectLeft: rect.left,
      scrollLeft: scroll.scrollLeft,
      calculatedX: x,
      dayWidth: DAY_WIDTH,
      calculatedIdx: idx,
      result: result?.format("DD/MM/YYYY")
    });

    return result;
  }, [timelineDates]);

  // ======================
  // LANE MODEL
  // ======================

  const componentLaneIds = useMemo(() => {
    return availableComponents.map(c => c.id);
  }, [availableComponents]);
  const promoLaneIds = useMemo(() => promos.map(p => p.id), [promos]);

  const allLaneItems = useMemo(
    () => [
      ...promoLaneIds.map(id => ({ kind: "promo" as const, id })),
      ...componentLaneIds.map(id => ({ kind: "component" as const, id })),
    ],
    [promoLaneIds, componentLaneIds]
  );

  const promoById = useCallback((id: string) => promos.find(p => p.id === id)!, [promos]);

  const laneLabelComponent = useCallback((laneId: string) => {
    const comp = availableComponents.find(c => c.id === laneId);
    if (!comp) return "Componente";

    if (comp.alias) {
      return comp.alias;
    }

    if (comp.is_hybrid) {
      return `${HYBRID_COMPONENT_TYPES.find(c => c.type === comp.type)?.label} Ibrido`;
    }

    return `${comp.type}`;
  }, [availableComponents]);

  const laneMetaComponent = useCallback((laneId: string) => {
    const comp = availableComponents.find(c => c.id === laneId);
    if (!comp) return { type: "component", id: laneId };

    if (comp.is_hybrid) {
      return { type: "hybrid", id: laneId };
    }

    return { type: comp.type ?? "component", id: comp.id ?? laneId };
  }, [availableComponents]);

  const laneIndexOf = useCallback((kf: Keyframe) => {
    const id = kf.targetComponentId;
    if (!id) return 0;
    const idx = componentLaneIds.indexOf(id);
    return idx >= 0 ? idx : 0;
  }, [componentLaneIds]);

  // Coordinate verticali unificate (nessun header aggiuntivo)
  const lanesTop = HEADER_HEIGHT;
  const totalLanesCount = allLaneItems.length;
  const promoCount = promoLaneIds.length;

  const laneTopY = (visualIndex: number, is_promo: boolean = false) => {
    if (is_promo) return + (visualIndex * (LANE_HEIGHT)) + V_MARGIN;
    else return lanesTop + (visualIndex * (LANE_HEIGHT));
  };
  const laneCenterY = (visualIndex: number) => laneTopY(visualIndex) + LANE_CENTER;

  const getLaneFromClientY = useCallback((clientY: number) => {
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const y = clientY - rect.top - lanesTop;
    const visualIdx = clamp(Math.floor(y / LANE_HEIGHT), 0, totalLanesCount - 1);
    const componentBaseIdx = Math.max(visualIdx - promoCount, 0);
    return clamp(componentBaseIdx, 0, componentLaneIds.length - 1);
  }, [lanesTop, totalLanesCount, promoCount, componentLaneIds.length]);

  // ======================
  // NOTIFICHE
  // ======================

  const notify = (icon: keyof typeof icons, text: string, color = "text-slate-700") => {
    showNotification(
      <div className="flex items-center">
        <Lucide icon={icon} className={`w-5 h-5 mr-2 ${color}`} />
        <span>{text}</span>
      </div>
    );
  };

  // ======================
  // CREAZIONE/SELEZIONE
  // ======================

  const createKeyframeInstant = useCallback(
    (start: dayjs.Dayjs, end: dayjs.Dayjs, targetOverride?: string) => {
      const startISO = start.format("YYYY-MM-DD");
      const endISO = end.format("YYYY-MM-DD");
      const targetComponentId = targetOverride;

      if (!targetComponentId) {
        notify("CircleAlert", "Errore: componente target non specificato", "text-red-600");
        return;
      }

      // Controlla se il componente è ibrido e ha già un keyframe
      const targetComponent = availableComponents.find(comp => comp.id === targetComponentId);
      if (targetComponent?.is_hybrid && (targetComponent.keyframes || []).length > 0) {
        notify("CircleAlert", "Impossibile creare keyframe: i componenti ibridi possono avere solo un keyframe", "text-red-600");
        return;
      }

      const keyframeId = addKeyframe(targetComponentId, {
        name: "",
        startDate: startISO,
        endDate: endISO,
        color: KEYFRAME_COLORS[0],
        isActive: true,
        targetComponentId,
        modification: {
          id: `mod_${targetComponentId}_${Date.now()}`,
          elementId: targetComponentId,
          elementType: 'component',
          modificationType: 'content',
          content: null as any, // Il contenuto verrà aggiunto quando l'utente modifica
          timestamp: new Date().toISOString()
        }
      });

      if (keyframeId) {
        console.log("Keyframe creato per componente:", targetComponentId);
        pendingSelectRef.current = { startISO, endISO, target: targetComponentId };
        notify("CircleCheck", "Keyframe creato", "text-green-600");
      } else {
        notify("CircleAlert", "Errore nella creazione del keyframe", "text-red-600");
      }
    },
    [addKeyframe, notify, availableComponents]
  );

  // Funzione per creare componenti ibridi
  const createHybridComponent = useCallback((prev_index: number, componentType: string, customAlias?: string) => {
    const hybridId = `hybrid_${prev_index}`;

    const newItem: PageLayoutItem = {
      id: hybridId,
      parentId: "",
      user_locked: {
        locked: false,
        user_id: ""
      },
      type: componentType as any,
      content: componentType === "carousel" ? {
        filtroContesto: [],
        images: []
      } : {},
      policy: {} as PolicyDiVisualizzazioneType,
      children: [],
      is_hybrid: true,
      alias: customAlias || `${HYBRID_COMPONENT_TYPES.find(c => c.type === componentType)?.label} Ibrido`
    };

    const actualInsertIndex = Math.max(0, prev_index - promos.length);

    const today = dayjs().startOf('day');
    const endDate = today.add(7, 'days');

    addKeyframe(hybridId, {
      name: `Componente Ibrido ${componentType}`,
      startDate: today.format("YYYY-MM-DD"),
      endDate: endDate.format("YYYY-MM-DD"),
      color: "#ec4899",
      isActive: true,
      targetComponentId: hybridId,
      modification: {
        id: `mod_${hybridId}_${Date.now()}`,
        elementId: hybridId,
        elementType: 'component',
        modificationType: 'content',
        content: null as any, // Il contenuto verrà aggiunto quando l'utente modifica
        timestamp: new Date().toISOString()
      }
    });

    addComponent?.(newItem, actualInsertIndex);
    notify("Plus", `Componente ibrido ${componentType} creato e inserito in posizione ${actualInsertIndex + 1}`, "text-pink-600");
  }, [addComponent, addKeyframe, notify, promos]);

  // Funzione per aggiornare l'alias di un componente
  const updateComponentAlias = useCallback((componentId: string, newAlias: string) => {
    const component = availableComponents.find(c => c.id === componentId);
    if (!component) return;

    const updatedComponent = { ...component, alias: newAlias };
    updateComponent?.(componentId, updatedComponent);
  }, [availableComponents, updateComponent]);

  useEffect(() => {
    const p = pendingSelectRef.current;
    if (!p) return;
    const { startISO, endISO, target } = p;
    const m = keyframes.filter(k => k.startDate === startISO && k.endDate === endISO && (k.targetComponentId ?? undefined) === (target ?? undefined));
    if (m.length > 0) {
      const created = m[m.length - 1];
      dispatch({ type: "SET_SELECTED_KEYFRAME", payload: created });
      setActiveKeyframeId?.(created.id);
      onKeyframeSelect?.(created);
      dispatch({ type: "SET_INSPECTOR_OPEN", payload: true });
      pendingSelectRef.current = null;
    }
  }, [keyframes, onKeyframeSelect, setActiveKeyframeId]);

  const findNearestKeyframeAt = useCallback((clientX: number, clientY: number) => {
    const date = getDateFromClientX(clientX);
    if (!date) return null;
    const scroll = scrollContainerRef.current;
    if (!scroll) return null;

    const scrollLeft = scroll.scrollLeft;
    const x = getDatePosition(date) + LANE_LABEL_WIDTH + TIMELINE_PADDING - scrollLeft;
    const laneIdx = getLaneFromClientY(clientY);

    const candidates = keyframes.filter(k => k.isActive && laneIndexOf(k) === laneIdx);
    let best: { kf: Keyframe; dist: number } | null = null;

    for (const kf of candidates) {
      const sx = getDatePosition(dayjs(kf.startDate)) + LANE_LABEL_WIDTH + TIMELINE_PADDING - scrollLeft;
      const ex = getDatePosition(dayjs(kf.endDate)) + LANE_LABEL_WIDTH + TIMELINE_PADDING - scrollLeft;
      const left = Math.min(sx, ex);
      const right = Math.max(sx, ex);

      // Verifica se il click è dentro i bounds del keyframe (inclusi i diamanti)
      const expandedLeft = left - DIAMOND_SIZE / 2;
      const expandedRight = right + DIAMOND_SIZE / 2;

      let dist = 0;
      if (x < expandedLeft) {
        dist = expandedLeft - x;
      } else if (x > expandedRight) {
        dist = x - expandedRight;
      } else {
        dist = 0; // Il click è dentro al keyframe
      }

      if (dist <= SELECT_TOLERANCE_PX) {
        if (!best || dist < best.dist) {
          best = { kf, dist };
        }
      }
    }
    return best?.kf ?? null;
  }, [getDateFromClientX, getDatePosition, getLaneFromClientY, keyframes, laneIndexOf]);

  const handleTimelineClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    console.log("Timeline click - mode:", mode, "isInteractingWithKeyframe:", isInteractingWithKeyframe.current);

    // Se stiamo interagendo con un keyframe, ignora il click sulla timeline
    if (isInteractingWithKeyframe.current) {
      isInteractingWithKeyframe.current = false;
      return;
    }

    // Solo in modalità date imposta la data selezionata
    if (mode === "date") {
      const date = getDateFromClientX(e.clientX);
      if (date) {
        const selectedDate = date.startOf("day");
        dispatch({ type: "SET_SELECTED_DATE", payload: selectedDate });
        setSelectedDate(selectedDate); // Comunica la data al context
        console.log("📅 Data selezionata nella timeline:", selectedDate.format("DD/MM/YYYY"));
      }
      return;
    }

    // Modalità keyframes - solo se il click è direttamente sul container
    if (mode === "keyframes" && e.target === e.currentTarget) {
      const near = findNearestKeyframeAt(e.clientX, e.clientY);
      if (near) {
        dispatch({ type: "SET_SELECTED_KEYFRAME", payload: near });
        dispatch({ type: "SET_INSPECTOR_OPEN", payload: true });
        setActiveKeyframeId?.(near.id);
        onKeyframeSelect?.(near);
        return;
      }
    }
  }, [mode, findNearestKeyframeAt, getDateFromClientX, notify, onKeyframeSelect, setActiveKeyframeId, setSelectedDate]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (mode !== "keyframes") return;
    if (e.button !== 0) return;

    // CONTROLLO PREVENTIVO: Se c'è un context menu aperto, non iniziare il drag
    if (contextMenuOpen) {
      console.log("Context menu aperto, non avviare drag creation");
      return; // Blocca l'avvio del drag
    }

    // CONTROLLO PREVENTIVO: Se c'è un doppio click in corso, non iniziare il drag
    if (isDoubleClicking.current) {
      console.log("Doppio click in corso, non avviare drag creation");
      return; // Blocca l'avvio del drag
    }

    // CONTROLLO PREVENTIVO: Se c'è un keyframe sotto il mouse, non iniziare il drag
    const nearKeyframe = findNearestKeyframeAt(e.clientX, e.clientY);
    if (nearKeyframe) {
      console.log("Keyframe trovato sotto il mouse, non avviare drag creation");
      return; // Blocca l'avvio del drag
    }

    const d = getDateFromClientX(e.clientX);
    if (!d) return;
    const laneIdx = getLaneFromClientY(e.clientY);

    isDraggingToCreate.current = true;
    dragAnchorRef.current = d;
    ghostLaneRef.current = laneIdx;
    dispatch({ type: "SET_GHOST_CREATE", payload: { start: d, end: d } });
  }, [mode, getDateFromClientX, getLaneFromClientY, findNearestKeyframeAt, contextMenuOpen]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (mode !== "keyframes") return;
    if (!isDraggingToCreate.current || !dragAnchorRef.current) return;
    const d = getDateFromClientX(e.clientX);
    if (!d) return;
    const s = dragAnchorRef.current;
    dispatch({ type: "SET_GHOST_CREATE", payload: { start: d.isBefore(s) ? d : s, end: d.isAfter(s) ? d : s } });
  }, [mode, getDateFromClientX]);

  const endDragCreate = useCallback(() => {
    if (mode !== "keyframes") return;
    if (!isDraggingToCreate.current) return;
    const { start, end } = ghostCreate ?? { start: dayjs(), end: dayjs().add(1, "day") };

    console.log("endDragCreate - Validazione date:", {
      start: start.format('DD/MM/YYYY'),
      end: end.format('DD/MM/YYYY'),
      diff: start.diff(end, "days"),
      duration: end.diff(start, "days")
    });

    if (start.diff(end, "days") >= 0) {
      notify("CircleAlert", "Errore: la data di inizio deve essere precedente alla data di fine", "text-red-600");
      // Reset completo dello stato anche in caso di errore
      isDraggingToCreate.current = false;
      dragAnchorRef.current = null;
      ghostLaneRef.current = null;
      dispatch({ type: "SET_GHOST_CREATE", payload: null });
      return;
    }

    // Controlla che ci sia almeno un giorno di differenza
    if (end.diff(start, "days") < 1) {
      notify("CircleAlert", "Errore: il keyframe deve durare almeno un giorno", "text-red-600");
      // Reset completo dello stato anche in caso di errore
      isDraggingToCreate.current = false;
      dragAnchorRef.current = null;
      ghostLaneRef.current = null;
      dispatch({ type: "SET_GHOST_CREATE", payload: null });
      return;
    }
    const laneIdx = ghostLaneRef.current ?? 0;
    const targetOverride = componentLaneIds[laneIdx];
    if (targetOverride) {
      console.log("Creando keyframe tramite drag:", { start: start.format('DD/MM/YYYY'), end: end.format('DD/MM/YYYY'), targetOverride });
      createKeyframeInstant(start, end, targetOverride);
    }
    isDraggingToCreate.current = false;
    dragAnchorRef.current = null;
    ghostLaneRef.current = null;
    dispatch({ type: "SET_GHOST_CREATE", payload: null });
  }, [mode, ghostCreate, createKeyframeInstant, componentLaneIds]);

  // Funzione per annullare il drag creation
  const cancelDragCreation = useCallback(() => {
    if (isDraggingToCreate.current) {
      console.log("Annullando drag creation");
      isDraggingToCreate.current = false;
      dragAnchorRef.current = null;
      ghostLaneRef.current = null;
      dispatch({ type: "SET_GHOST_CREATE", payload: null });
      notify("X", "Creazione keyframe annullata", "text-orange-600");
    }
  }, [notify]);

  // Funzione per annullare il resize
  const cancelResize = useCallback(() => {
    if (resizeStateRef.current || resizeListenersRef.current) {
      console.log("Annullando resize operation");

      // Rimuovi gli event listeners se esistono
      if (resizeListenersRef.current) {
        window.removeEventListener("mousemove", resizeListenersRef.current.onMove);
        window.removeEventListener("mouseup", resizeListenersRef.current.onUp);
        resizeListenersRef.current = null;
      }

      resizeStateRef.current = null;
      dispatch({ type: "SET_GHOST_CREATE", payload: null });
      notify("X", "Ridimensionamento keyframe annullato", "text-orange-600");
    }
  }, [notify]);

  useHotkeys("esc", (e) => {
    e.preventDefault();
    e.stopPropagation();
    isInteractingWithKeyframe.current = false;
    cancelDragCreation();
    cancelResize();
  });

  // Shortcut per selezionare il keyframe attivo
  useHotkeys("enter", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (mode !== "keyframes" || !selectedKeyframe) return;
    dispatch({ type: "SET_SELECTED_KEYFRAME", payload: selectedKeyframe });
    setActiveKeyframeId?.(selectedKeyframe.id);
    onKeyframeSelect?.(selectedKeyframe);
    dispatch({ type: "SET_INSPECTOR_OPEN", payload: true });
  });

  // Shortcut per duplicare il keyframe selezionato
  useHotkeys("mod+d", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (mode !== "keyframes" || !selectedKeyframe) return;
    const id = duplicateKeyframe(selectedKeyframe.id);
    if (id) notify("Copy", "Keyframe duplicato", "text-blue-600");
  });

  // Shortcut per attivare/disattivare il keyframe selezionato
  useHotkeys("mod+t", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (mode !== "keyframes" || !selectedKeyframe) return;
    toggleKeyframeActive(selectedKeyframe.id);
  });

  // Shortcut per eliminare il keyframe selezionato
  useHotkeys("delete", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (mode !== "keyframes" || !selectedKeyframe) return;
    deleteKeyframe(selectedKeyframe.id);
    dispatch({ type: "SET_SELECTED_KEYFRAME", payload: null });
    dispatch({ type: "SET_INSPECTOR_OPEN", payload: false });
    notify("Trash2", "Keyframe eliminato", "text-red-600");
  });

  // Shortcut per creare un nuovo keyframe
  useHotkeys("mod+n", (e) => {
    console.log("Creando nuovo keyframe tramite shortcut Ctrl+N");
    e.preventDefault();
    e.stopPropagation();
    if (mode !== "keyframes") return;
    const today = dayjs().startOf('day');
    const endDate = today.add(1, 'day');
    const targetOverride = componentLaneIds[0]; // Usa il primo componente disponibile
    if (targetOverride) {
      createKeyframeInstant(today, endDate, targetOverride);
    }
  });

  const handleMouseUp = useCallback(() => endDragCreate(), [endDragCreate]);

  // Funzione di cleanup per pulire il ghost
  const cleanupGhost = useCallback(() => {
    if (isDraggingToCreate.current) {
      console.log("Cleanup ghost - interrompendo drag creation");
      isDraggingToCreate.current = false;
      dragAnchorRef.current = null;
      ghostLaneRef.current = null;
      dispatch({ type: "SET_GHOST_CREATE", payload: null });
    }
  }, []);

  // Cleanup quando cambia la modalità
  useEffect(() => {
    cleanupGhost();
  }, [mode, cleanupGhost]);

  // Cleanup quando il componente viene smontato
  useEffect(() => {
    return () => {
      cleanupGhost();
    };
  }, [cleanupGhost]);
  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (mode !== "keyframes") return;

    // Imposta il flag per indicare che stiamo gestendo un doppio click
    isDoubleClicking.current = true;

    // CONTROLLO PREVENTIVO: Se c'è un context menu aperto, non creare keyframe
    if (contextMenuOpen) {
      console.log("Context menu aperto, non creare keyframe tramite doppio click");
      isDoubleClicking.current = false;
      return;
    }

    // CONTROLLO PREVENTIVO: Se c'è un drag in corso, interrompilo e pulisci il ghost
    if (isDraggingToCreate.current) {
      console.log("Interrompendo drag creation per doppio click");
      cleanupGhost();
      isDoubleClicking.current = false;
      return; // Esci subito dopo il cleanup per evitare interferenze
    }

    const date = getDateFromClientX(e.clientX);
    const laneIdx = getLaneFromClientY(e.clientY);
    const targetOverride = componentLaneIds[laneIdx];

    console.log("Doppio click - Debug:", {
      clientX: e.clientX,
      clientY: e.clientY,
      date: date?.format('DD/MM/YYYY'),
      laneIdx,
      targetOverride,
      componentLaneIds
    });

    if (date && targetOverride) {
      const endDate = date.add(1, 'day');
      console.log("Creando nuovo keyframe tramite doppio click:", {
        start: date.format('DD/MM/YYYY'),
        end: endDate.format('DD/MM/YYYY'),
        targetOverride
      });
      createKeyframeInstant(date, endDate, targetOverride);
    } else {
      console.log("Doppio click fallito - date o targetOverride mancanti");
    }
    isInteractingWithKeyframe.current = false;

    // Reset del flag del doppio click dopo un breve timeout per sicurezza
    setTimeout(() => {
      isDoubleClicking.current = false;
    }, 100);
  }, [mode, getDateFromClientX, getLaneFromClientY, componentLaneIds, createKeyframeInstant, contextMenuOpen]);

  // ======================
  // CONTEXT MENU
  // ======================

  const getKeyframeContextMenu = useCallback((keyframe: Keyframe) => {
    // Trova il componente che contiene questo keyframe
    const componentWithKeyframe = availableComponents.find(comp =>
      comp.keyframes?.some(kf => kf.id === keyframe.id)
    );

    // I componenti ibridi non possono avere più di un keyframe
    const canDuplicate = !componentWithKeyframe?.is_hybrid;

    return [
      {
        type: "item" as const,
        label: "Seleziona keyframe",
        shortcut: "Enter",
        onClick: () => {
          if (mode !== "keyframes") return;
          dispatch({ type: "SET_SELECTED_KEYFRAME", payload: keyframe });
          setActiveKeyframeId?.(keyframe.id);
          onKeyframeSelect?.(keyframe);
          dispatch({ type: "SET_INSPECTOR_OPEN", payload: true });
        }
      },
      { type: "separator" as const },
      {
        type: "item" as const,
        label: "Duplica keyframe",
        shortcut: "Ctrl+D",
        disabled: !canDuplicate,
        onClick: (e: React.MouseEvent<HTMLDivElement>) => {
          e.stopPropagation();
          e.preventDefault();
          if (mode !== "keyframes") return;
          if (!canDuplicate) {
            notify("CircleAlert", "I componenti ibridi possono avere solo un keyframe", "text-red-600");
            return;
          }
          const id = duplicateKeyframe(keyframe.id);
          if (id) notify("Copy", "Keyframe duplicato", "text-blue-600");
        }
      },
      {
        type: "checkbox" as const,
        label: "Keyframe attivo",
        shortcut: "Ctrl+T",
        checked: keyframe.isActive,
        onClick: () => { if (mode === "keyframes") toggleKeyframeActive(keyframe.id); }
      },
      { type: "separator" as const },
      {
        type: "sub" as const,
        label: "Collega a componente",
        items: availableComponents.map(comp => ({
          type: "item" as const,
          label: `${comp.alias ? comp.alias : comp.type}`,
          onClick: (e: React.MouseEvent<HTMLDivElement>) => {
            e.stopPropagation();
            e.preventDefault();
            if (mode === "keyframes") updateKeyframe(keyframe.id, { targetComponentId: comp.id });
          }
        })),
      },
      { type: "separator" as const },
      {
        type: "item" as const,
        label: "Elimina keyframe",
        shortcut: "Delete",
        onClick: (e: React.MouseEvent<HTMLDivElement>) => {
          e.stopPropagation();
          e.preventDefault();
          if (mode !== "keyframes") return;
          deleteKeyframe(keyframe.id);
          if (selectedKeyframe?.id === keyframe.id) {
            dispatch({ type: "SET_SELECTED_KEYFRAME", payload: null });
            dispatch({ type: "SET_INSPECTOR_OPEN", payload: false });
          }
          notify("Trash2", "Keyframe eliminato", "text-red-600");
        },
        variant: "danger" as const
      }
    ];
  }, [mode, availableComponents, deleteKeyframe, duplicateKeyframe, notify, selectedKeyframe?.id, setActiveKeyframeId, toggleKeyframeActive, updateKeyframe, onKeyframeSelect]);

  const getGlobalTimelineContextMenu = useCallback(() => {
    if (mode === "keyframes") {
      return [{
        type: "item" as const,
        label: contextDate ? `Nuovo keyframe qui (${contextDate.format("DD/MM/YYYY")})` : "Nuovo keyframe",
        shortcut: "Ctrl+N",
        onClick: (e: React.MouseEvent<HTMLDivElement>) => {
          e.stopPropagation();
          e.preventDefault();
          const base = contextDate || dayjs();
          const start = base, end = base.add(1, "day");
          const targetOverride = componentLaneIds[contextLaneIndex];
          if (targetOverride) {
            createKeyframeInstant(start, end, targetOverride);
          }
        },
      }];
    }
    return [{
      type: "item" as const,
      label: contextDate ? `Imposta data: ${contextDate.format("DD/MM/YYYY")}` : "Imposta data qui",
      shortcut: "Ctrl+D",
      onClick: (e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
        e.preventDefault();
        const base = contextDate || dayjs();
        dispatch({ type: "SET_SELECTED_DATE", payload: base.startOf("day") });
        notify("Calendar", `Data impostata: ${base.format("DD/MM/YYYY")}`, "text-blue-600");
      },
    }];
  }, [mode, contextDate, createKeyframeInstant, componentLaneIds, contextLaneIndex, notify]);

  // ======================
  // RENDER
  // ======================

  return (
    <AnimatePresence>
      {isVisible && (
        <div
          className="fixed bottom-0 left-0 right-0 z-50 bg-white border border-slate-300 overflow-hidden transform-gpu"
          style={{ height: `${timelineHeight}px` }}
        >
          {/* Resize handle */}
          {onResize && (
            <div
              className={clsx(
                "absolute top-0 left-0 right-0 h-1 transition-all duration-200 z-20",
                "cursor-row-resize hover:bg-primary/50",
                isResizing && "bg-primary"
              )}
              onMouseDown={onResize}
              title="Ridimensiona timeline"
            />
          )}

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-slate-300">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Timeline Componenti</h3>
              {mode === "keyframes" && (
                <p className="text-xs text-slate-500 mt-1">
                  Clicca su un keyframe per selezionarlo • Doppio click per creare un nuovo keyframe
                </p>
              )}
              {selectedDate && (
                <div className="flex items-center gap-2 mt-1">
                  <Lucide icon="Calendar" className="w-3 h-3 text-blue-500" />
                  <span className="text-xs text-blue-600 font-medium">
                    Data selezionata: {selectedDate.format("DD/MM/YYYY")}
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex rounded-lg overflow-hidden border border-slate-300">
                <button
                  className={clsx("px-3 py-1.5 text-sm flex items-center", mode === "date" ? "bg-primary text-white" : "bg-white hover:bg-slate-50")}
                  onClick={() => dispatch({ type: "SET_MODE", payload: "date" })}
                  title="Modalità Data"
                >
                  <Lucide icon="Calendar" className="w-4 h-4 mr-1.5" /> Data
                </button>
                <button
                  className={clsx("px-3 py-1.5 text-sm flex items-center", mode === "keyframes" ? "bg-primary text-white" : "bg-white hover:bg-slate-50")}
                  onClick={() => dispatch({ type: "SET_MODE", payload: "keyframes" })}
                  title="Modalità Keyframes"
                >
                  <Lucide icon="Key" className="w-4 h-4 mr-1.5" /> Keyframes
                </button>
              </div>
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => {
                  const today = dayjs().startOf("day");
                  dispatch({ type: "SET_SELECTED_DATE", payload: today });
                  setSelectedDate(today);
                  notify("Calendar", `Data impostata a oggi: ${today.format("DD/MM/YYYY")}`, "text-blue-600");
                }}
                title="Imposta data a oggi"
              >
                <Lucide icon="Calendar" className="w-4 h-4" />
              </Button>
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => {
                  // Test: simula una modifica per il primo componente con keyframe
                  const componentWithKeyframe = availableComponents.find(comp =>
                    comp.keyframes && comp.keyframes.length > 0
                  );
                  if (componentWithKeyframe && selectedDate) {
                    console.log("🧪 Test: Simulando modifica per componente con keyframe:", componentWithKeyframe.id);
                    notify("Check", `Componente ${componentWithKeyframe.id} ha keyframe attivo`);
                  } else {
                    notify("CircleAlert", "Nessun componente con keyframe trovato o data non selezionata");
                  }
                }}
                title="Test modifica keyframe"
              >
                <Lucide icon="TestTube" className="w-4 h-4" />
              </Button>
              <Button variant="outline-secondary" size="sm" onClick={onToggle}>
                <Lucide icon="X" className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Body */}
          <div className="relative flex" style={{ height: `calc(${timelineHeight}px - 77px)` }}>
            {/* Timeline Area */}
            <div className="flex-1" style={{ width: selectedKeyframe && inspectorOpen ? '60%' : '100%' }}>
              <div ref={scrollContainerRef} className="h-full overflow-x-auto" style={{ scrollbarWidth: "thin" }}>
                <div
                  ref={timelineRef}
                  className="relative"
                  style={{
                    width: LANE_LABEL_WIDTH + timelineWidth + TIMELINE_PADDING * 2,
                    height: HEADER_HEIGHT + totalLanesCount * LANE_HEIGHT
                  }}
                >
                  {/* GUTTER */}
                  <div
                    className="absolute top-0 left-0 bg-white/95 border-r border-slate-200 z-20"
                    style={{ width: LANE_LABEL_WIDTH, height: "100%" }}
                  >
                    {/* header spacer */}
                    <div className="border-b border-slate-200 bg-slate-50/80" style={{ height: HEADER_HEIGHT }} />

                    {/* righe */}
                    <div className="relative" style={{ height: totalLanesCount * LANE_HEIGHT }}>
                      {allLaneItems.map((item, i) => {
                        const top = i * LANE_HEIGHT;

                        if (item.kind === "promo") {
                          const promo = promoById(item.id);
                          return (
                            <div
                              key={`promo-${item.id}`}
                              className="absolute left-0 right-0 px-3 border-b border-orange-200/50 bg-white/90 flex items-center justify-between"
                              style={{ top, height: LANE_HEIGHT }}
                            >
                              <div className="flex items-center min-w-0 gap-2">
                                <div
                                  className="rounded-full border-2 shadow-sm flex-shrink-0"
                                  style={{ width: 12, height: 12, backgroundColor: COLORS[promo.stato], borderColor: COLORS[promo.stato] }}
                                />
                                <Lucide icon="Tag" className="w-5 h-5 text-orange-500" />
                                <span className="text-xs font-medium text-slate-700 truncate" title={promo.nome}>
                                  {promo.nome}
                                </span>
                              </div>
                            </div>
                          );
                        }

                        const meta = laneMetaComponent(item.id);
                        const isHybrid = meta.type === "hybrid";
                        const color = isHybrid ? "#ec4899" : laneColorFor(item.id);
                        const kCount = keyframes.filter(k =>
                          k.targetComponentId === item.id
                        ).length;

                        const activeCount = keyframes.filter(k =>
                          k.isActive && k.targetComponentId === item.id
                        ).length;

                        const activeToday = keyframes.filter(k => {
                          const today = dayjs();
                          return k.isActive &&
                            k.targetComponentId === item.id &&
                            today.isBetween(dayjs(k.startDate), dayjs(k.endDate), "day", "[]");
                        }).length;

                        return (
                          <div
                            key={`comp-${item.id}`}
                            className={clsx(
                              "absolute left-0 right-0 px-3 border-b flex items-center justify-between group",
                              isHybrid
                                ? "border-pink-200/50 bg-pink-50/30"
                                : "border-blue-200/50",
                              selectedComponent?.id === item.id && "bg-primary/10 border-primary/30",
                            )}
                            style={{ top, height: LANE_HEIGHT }}
                          >
                            <div className="flex items-center min-w-0 gap-2">
                              <div className="w-3 h-3 rounded-full border-2 border-blue-200 shadow-sm" style={{ backgroundColor: color }} />
                              <Lucide icon={iconForType(meta.type)} className={clsx("w-5 h-5", isHybrid ? "text-pink-500" : "text-blue-500")} />
                              {editingAliasId === item.id ? (
                                <FormInput
                                  type="text"
                                  value={editingAliasValue}
                                  onChange={(e) => dispatch({ type: "SET_EDITING_ALIAS_VALUE", payload: e.target.value })}
                                  onBlur={() => {
                                    if (editingAliasValue.trim()) {
                                      updateComponentAlias(item.id, editingAliasValue.trim());
                                    }
                                    dispatch({ type: "END_EDIT_ALIAS" });
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      if (editingAliasValue.trim()) {
                                        updateComponentAlias(item.id, editingAliasValue.trim());
                                      }
                                      dispatch({ type: "END_EDIT_ALIAS" });
                                    } else if (e.key === "Escape") {
                                      dispatch({ type: "END_EDIT_ALIAS" });
                                    }
                                  }}
                                  className="text-xs font-medium bg-white border border-blue-300 rounded px-1 py-0.5 min-w-0 flex-1"
                                  autoFocus
                                />
                              ) : (
                                <span
                                  className={clsx(
                                    "text-xs font-medium truncate cursor-pointer px-1 py-0.5 rounded transition-colors",
                                    selectedComponent?.id === item.id ? "text-primary" : "text-slate-700",
                                    isHybrid ? "hover:bg-pink-50" : "hover:bg-blue-50"
                                  )}
                                  title="Clicca per modificare l'alias"
                                  onClick={() => {
                                    const comp = availableComponents.find(c => c.id === item.id);
                                    dispatch({ type: "START_EDIT_ALIAS", payload: { id: item.id, value: comp?.alias || "" } });
                                  }}
                                >
                                  {laneLabelComponent(item.id)}
                                </span>
                              )}
                            </div>

                            {/* Indicatori keyframe */}
                            {kCount > 0 && (
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                                  {activeCount}/{kCount}
                                </span>
                              </div>
                            )}

                            {/* LINEA CON PULSANTE PER INSERIRE COMPONENTI IBRIDI */}
                            <div className={clsx("absolute bottom-0 left-0 right-0 h-0.5 bg-primary/20 ",
                              openPopoverId && openPopoverId === `popover-${i}` ? "z-50" : "z-0"
                            )}>
                              <div className={clsx(
                                "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-200",
                                (openPopoverId === `popover-${i}` || (!openPopoverId && "group-hover:opacity-100")) ? "opacity-100" : "opacity-0"
                              )}>
                                <Popover data-popover className="z-[9999]">
                                  {({ open, close }) => {
                                    React.useEffect(() => {
                                      if (open) {
                                        dispatch({ type: "SET_OPEN_POPOVER", payload: `popover-${i}` });
                                      } else if (openPopoverId === `popover-${i}`) {
                                        dispatch({ type: "SET_OPEN_POPOVER", payload: null });
                                      }
                                    }, [open, i]);
                                    return (
                                      <>
                                        <Popover.Button
                                          as={Button}
                                          variant="primary"
                                          className="w-6 h-6 rounded-md shadow-lg flex items-center justify-center text-xs font-bold"
                                          title="Scegli tipo componente ibrido"
                                          disabled={!!(openPopoverId && openPopoverId !== `popover-${i}`)}
                                        >
                                          +
                                        </Popover.Button>
                                        <Popover.Panel placement="bottom-start" className="w-64 z-[99999]">
                                          <div className="p-2">
                                            <h4 className="text-sm font-semibold text-slate-700 mb-2">Scegli tipo componente</h4>
                                            <div className="space-y-1">
                                              <div className="grid grid-cols-2 gap-2">
                                                {HYBRID_COMPONENT_TYPES.map((compType) => (
                                                  <button
                                                    key={compType.type}
                                                    className="w-full flex flex-col items-start gap-1 p-2 rounded-md hover:bg-slate-50 transition-colors text-left h-full"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      e.preventDefault();
                                                      createHybridComponent(i, compType.type);
                                                      dispatch({ type: "SET_OPEN_POPOVER", payload: null });
                                                      close();
                                                    }}
                                                  >
                                                    <Lucide icon={compType.icon as any} className="w-4 h-4 text-blue-500 mb-1" />
                                                    <div className="flex-1">
                                                      <div className="text-sm font-medium text-slate-700">{compType.label}</div>
                                                    </div>
                                                  </button>
                                                ))}
                                              </div>
                                            </div>
                                          </div>
                                        </Popover.Panel>
                                      </>
                                    );
                                  }}
                                </Popover>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* chip overlay */}
                    </div>
                  </div>

                  {/* AREA TIMELINE */}
                  <ContextMenu onOpenChange={(open) => dispatch({ type: "SET_CONTEXT_MENU_OPEN", payload: open })}>
                    <ContextMenuTrigger>
                      <div
                        className={clsx("absolute top-0", mode === "keyframes" ? "cursor-crosshair" : "cursor-cell")}
                        style={{ left: LANE_LABEL_WIDTH, width: timelineWidth + TIMELINE_PADDING * 2, height: "100%" }}
                        onContextMenu={(e) => {
                          const d = getDateFromClientX(e.clientX);
                          dispatch({ type: "SET_CONTEXT", payload: { date: d, laneIndex: getLaneFromClientY(e.clientY) } });
                        }}
                        onClick={handleTimelineClick}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onDoubleClick={handleDoubleClick}
                      >
                        {/* Header date */}
                        <div className="bg-slate-50 border-b border-slate-200 relative z-[9999]" >
                          <div className="flex border-b border-slate-200">
                            {timelineDates.map((date, idx) => (
                              <div key={idx} className="flex-shrink-0 border-r border-slate-200 text-center" style={{ width: DAY_WIDTH }}>
                                <div className="text-xs text-slate-500 py-1">{date.format("DD")}</div>
                                <div className="text-xs text-slate-400">{date.format("MMM")}</div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Griglia giorni */}
                        <div className="absolute top-0 bottom-0 -z-10" style={{ paddingLeft: TIMELINE_PADDING }}>
                          {timelineDates.map((_, index) => (
                            <div key={index} className="absolute top-0 bottom-0 border-r border-slate-100" style={{ left: index * DAY_WIDTH }} />
                          ))}
                        </div>

                        {/* Sfondo corsie */}
                        <div className="absolute left-0 right-0" style={{ top: lanesTop, height: totalLanesCount * LANE_HEIGHT }}>
                          {Array.from({ length: totalLanesCount }).map((_, i) => (
                            <div
                              key={`row-${i}`}
                              className="absolute left-0 right-0 border-b"
                              style={{
                                top: i * LANE_HEIGHT,
                                height: LANE_HEIGHT,
                                borderColor: i < promoCount ? "rgba(251,146,60,0.3)" : "rgba(59,130,246,0.3)",
                                background: i % 2 === 0
                                  ? (i < promoCount ? "rgba(255,237,213,0.2)" : "rgba(219,234,254,0.2)")
                                  : "transparent"
                              }}
                            />
                          ))}
                        </div>

                        {/* Separatore tra sezioni */}
                        <div className="absolute left-0 right-0 border-t-2 border-dashed"
                          style={{ top: laneTopY(promoCount), borderColor: "rgba(156,163,175,0.5)" }} />

                        {/* PROMO */}
                        <div className="absolute left-0 right-0">
                          {promos.map((promo, i) => {
                            const startPos = getDatePosition(dayjs(promo.validita_dal));
                            const endPos = getDatePosition(dayjs(promo.validita_al));
                            const width = Math.max(endPos - startPos, 6);
                            const top = laneTopY(i, true) + V_MARGIN;
                            const h = innerHeight(LANE_HEIGHT);
                            return (
                              <div
                                key={promo.id}
                                className="absolute rounded-md shadow-sm"
                                style={{
                                  top,
                                  left: startPos + TIMELINE_PADDING,
                                  width,
                                  height: h,
                                  backgroundColor: COLORS[promo.stato] + "20",
                                  border: `2px solid ${COLORS[promo.stato]}`
                                }}
                                title={`${promo.nome} – ${promo.stato}`}
                              >
                                <div className="flex items-center h-full px-2">
                                  <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: COLORS[promo.stato] }} />
                                  <span className="text-xs font-medium text-slate-700 truncate">{promo.nome}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* GHOST creazione (solo keyframes) */}
                        {mode === "keyframes" && ghostCreate && ghostLaneRef.current !== null && (
                          <div
                            className="absolute z-30"
                            style={{
                              top: laneCenterY(promoCount + (ghostLaneRef.current ?? 0)) - 1,
                              left: getDatePosition(ghostCreate.start) + TIMELINE_PADDING,
                              width: Math.max(getDatePosition(ghostCreate.end) - getDatePosition(ghostCreate.start), 2),
                              height: 2,
                              background: KEYFRAME_COLORS[0],
                              opacity: 0.6,
                            }}
                          />
                        )}

                        {/* KEYFRAMES */}
                        <div className="absolute top-0 left-0 right-0 bottom-0">
                          {keyframes.map((keyframe) => {
                            const targetComponent = availableComponents.find(c => c.id === keyframe.targetComponentId);
                            const isHybrid = targetComponent?.is_hybrid || false;
                            const startX = getDatePosition(dayjs(keyframe.startDate)) + TIMELINE_PADDING;
                            const endX = getDatePosition(dayjs(keyframe.endDate)) + TIMELINE_PADDING;
                            const left = Math.min(startX, endX);
                            const width = Math.max(Math.abs(endX - startX), 2);

                            const componentIdx = laneIndexOf(keyframe);
                            const visualIdx = promoCount + componentIdx;

                            const kfClickable = mode === "keyframes";
                            const isKeyframeActive = keyframe.isActive;
                            const diamondClass = clsx(
                              "absolute w-[14px] h-[14px] -translate-x-1/2 -translate-y-1/2 rotate-45 border-2",
                            );

                            const attachResize = (edge: 'start' | 'end') => (e: React.MouseEvent<HTMLDivElement>) => {
                              if (!kfClickable) return;
                              if (contextMenuOpen) {
                                console.log("Context menu aperto, non avviare resize");
                                return;
                              }
                              e.stopPropagation();
                              e.preventDefault();

                              // Salva lo stato iniziale del keyframe
                              const initialStart = dayjs(keyframe.startDate);
                              const initialEnd = dayjs(keyframe.endDate);

                              resizeStateRef.current = { kfId: keyframe.id, edge };

                              const onMove = (ev: MouseEvent) => {
                                const d = getDateFromClientX(ev.clientX);
                                if (!d || !resizeStateRef.current) return;

                                // Calcola le nuove date basandosi sull'edge che viene ridimensionato
                                let newStart, newEnd;
                                if (edge === "start") {
                                  newStart = d;
                                  newEnd = initialEnd;
                                  // Assicurati che start sia prima di end
                                  if (newStart.isAfter(newEnd)) {
                                    newStart = newEnd.subtract(1, 'day');
                                  }
                                } else {
                                  newStart = initialStart;
                                  newEnd = d;
                                  // Assicurati che end sia dopo start
                                  if (newEnd.isBefore(newStart)) {
                                    newEnd = newStart.add(1, 'day');
                                  }
                                }

                                dispatch({
                                  type: "SET_GHOST_CREATE",
                                  payload: { start: newStart, end: newEnd }
                                });
                              };

                              const onUp = () => {
                                if (resizeStateRef.current) {
                                  const currentGhost = ghostCreate;
                                  if (currentGhost) {
                                    if (edge === "start") {
                                      updateKeyframe(keyframe.id, { startDate: currentGhost.start.format("YYYY-MM-DD") });
                                    } else {
                                      updateKeyframe(keyframe.id, { endDate: currentGhost.end.format("YYYY-MM-DD") });
                                    }
                                    notify("Move", `Keyframe ridimensionato`, "text-blue-600");
                                  }
                                }
                                resizeStateRef.current = null;
                                resizeListenersRef.current = null;
                                dispatch({ type: "SET_GHOST_CREATE", payload: null });
                                window.removeEventListener("mousemove", onMove);
                                window.removeEventListener("mouseup", onUp);
                              };

                              // Salva i riferimenti agli event listeners per poterli rimuovere con ESC
                              resizeListenersRef.current = { onMove, onUp };

                              window.addEventListener("mousemove", onMove);
                              window.addEventListener("mouseup", onUp);
                            };

                            return (
                              <ContextMenu key={keyframe.id} onOpenChange={(open) => dispatch({ type: "SET_CONTEXT_MENU_OPEN", payload: open })}>
                                <ContextMenuTrigger>
                                  <div
                                    className={clsx(
                                      "absolute group",
                                      kfClickable ? "cursor-pointer" : "cursor-default",
                                      selectedKeyframe?.id === keyframe.id && "ring-2 ring-blue-500 ring-opacity-50",
                                      !isKeyframeActive && "opacity-50"
                                    )}
                                    style={{ top: laneCenterY(visualIdx), transform: "translateY(-50%)", left, width }}
                                    title={`${keyframe.name || 'Keyframe'} ${!isKeyframeActive ? '(Disattivo)' : ''}: ${dayjs(keyframe.startDate).format('DD/MM')} → ${dayjs(keyframe.endDate).format('DD/MM')}`}
                                    onClick={(e) => {
                                      if (!kfClickable) return;
                                      e.stopPropagation(); // FONDAMENTALE: ferma la propagazione
                                      e.preventDefault();  // Previeni comportamenti default
                                      isInteractingWithKeyframe.current = true; // Setta il flag
                                      console.log("Selezionando keyframe:", keyframe);
                                      dispatch({ type: "SET_SELECTED_KEYFRAME", payload: keyframe });
                                      dispatch({ type: "SET_INSPECTOR_OPEN", payload: true });
                                      setActiveKeyframeId?.(keyframe.id);
                                      onKeyframeSelect?.(keyframe);
                                    }}
                                  >
                                    {/* HITBOX */}
                                    <div className="absolute left-0 right-0 -translate-y-1/2" style={{ top: 0, height: HITBOX_HEIGHT }} />

                                    {/* Linea */}
                                    <div
                                      className={clsx(
                                        "absolute top-1/2 -translate-y-1/2 transition-[height] shadow-sm",
                                        isKeyframeActive ? "h-0.5" : "h-1",
                                        kfClickable && "group-hover:h-1"
                                      )}
                                      style={{
                                        left: DIAMOND_SIZE / 2,
                                        right: DIAMOND_SIZE / 2,
                                        backgroundColor: keyframe.color,
                                        opacity: isKeyframeActive ? (kfClickable ? 0.95 : 0.6) : 0.4,
                                        borderStyle: !isKeyframeActive ? "dashed" : "solid",
                                        borderWidth: !isKeyframeActive ? "1px" : "0",
                                        borderColor: !isKeyframeActive ? keyframe.color : "transparent"
                                      }}
                                    />

                                    {/* Rombo start */}
                                    <div
                                      className={clsx(
                                        diamondClass,
                                        !isKeyframeActive && "border-dashed"
                                      )}
                                      style={{
                                        top: 0,
                                        left: 0,
                                        backgroundColor: isKeyframeActive ? keyframe.color : "transparent",
                                        borderColor: keyframe.color,
                                        opacity: isKeyframeActive ? 1 : 0.6
                                      }}
                                      onMouseDown={
                                        (e) => {
                                          if (!kfClickable) return;
                                          e.stopPropagation();
                                          attachResize('start')(e);
                                        }
                                      }
                                    />
                                    {/* Rombo end */}
                                    <div
                                      className={clsx(
                                        diamondClass,
                                        !isKeyframeActive && "border-dashed"
                                      )}
                                      style={{
                                        top: 0,
                                        left: width,
                                        backgroundColor: isKeyframeActive ? keyframe.color : "transparent",
                                        borderColor: keyframe.color,
                                        opacity: isKeyframeActive ? 1 : 0.6
                                      }}
                                      onMouseDown={
                                        (e) => {
                                          if (!kfClickable) return;
                                          e.stopPropagation();
                                          attachResize('end')(e);
                                        }
                                      }
                                    />
                                    {keyframe.name && (
                                      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 max-w-[120px]">
                                        <span className={clsx(
                                          "text-[10px] px-1.5 border border-slate-400 py-0.5 rounded shadow-sm truncate block text-center",
                                          isKeyframeActive ? "text-slate-700 bg-white" : "text-slate-600 bg-slate-100"
                                        )}>
                                          {keyframe.name}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </ContextMenuTrigger>

                                <ContextMenuContent>
                                  {getKeyframeContextMenu(keyframe).map((item, index) => {
                                    if (item.type === "item") {
                                      const itemData = item as any;
                                      return (
                                        <ContextMenuItem
                                          key={index}
                                          onClick={itemData.onClick}
                                          className={itemData.variant === "danger" ? "text-red-600" : ""}
                                        >
                                          {itemData.label}
                                          {itemData.shortcut && <ContextMenuShortcut>{itemData.shortcut}</ContextMenuShortcut>}
                                        </ContextMenuItem>
                                      );
                                    }
                                    if (item.type === "checkbox") {
                                      const itemData = item as any;
                                      return (
                                        <ContextMenuCheckboxItem key={index} checked={itemData.checked} onClick={itemData.onClick}>
                                          {itemData.label}
                                          {itemData.shortcut && <ContextMenuShortcut>{itemData.shortcut}</ContextMenuShortcut>}
                                        </ContextMenuCheckboxItem>
                                      );
                                    }
                                    if (item.type === "separator") return <ContextMenuSeparator key={index} />;
                                    if (item.type === "sub") {
                                      return (
                                        <ContextMenuSub key={index}>
                                          <ContextMenuSubTrigger>{(item as any).label}</ContextMenuSubTrigger>
                                          <ContextMenuSubContent>
                                            {(item as any).items?.map((subItem: any, subIndex: number) => (
                                              <ContextMenuItem key={subIndex} onClick={subItem.onClick}>
                                                {subItem.label}
                                                {subItem.shortcut && <ContextMenuShortcut>{subItem.shortcut}</ContextMenuShortcut>}
                                              </ContextMenuItem>
                                            ))}
                                          </ContextMenuSubContent>
                                        </ContextMenuSub>
                                      );
                                    }
                                    return null;
                                  })}
                                </ContextMenuContent>
                              </ContextMenu>
                            );
                          })}
                        </div>
                        {/* Indicatore data selezionata */}
                        {selectedDate && (
                          <div className="absolute top-0 bottom-0 w-0.5 bg-blue-500 z-40 pointer-events-none" style={{ left: getDatePosition(selectedDate) + TIMELINE_PADDING }} />
                        )}
                      </div>
                    </ContextMenuTrigger>

                    <ContextMenuContent>
                      {getGlobalTimelineContextMenu().map((item, index) => {
                        if (item.type === "item") {
                          const itemData = item as any;
                          return (
                            <ContextMenuItem key={index} onClick={itemData.onClick}>
                              {itemData.label}
                              {itemData.shortcut && <ContextMenuShortcut>{itemData.shortcut}</ContextMenuShortcut>}
                            </ContextMenuItem>
                          );
                        }
                        if (item.type === "separator") return <ContextMenuSeparator key={index} />;
                        return null;
                      })}
                    </ContextMenuContent>
                  </ContextMenu>
                </div>
              </div>
            </div>

            {/* Editor Keyframe - Integrato nella Timeline */}
            {selectedKeyframe && inspectorOpen && (
              <div className="w-96 bg-white border-l border-slate-300 shadow-lg flex flex-col">
                {/* Header Editor */}
                <div className="flex items-center justify-between p-3 border-b border-slate-200 bg-slate-50">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">Editor Keyframe</h3>
                    <p className="text-xs text-slate-500">
                      {selectedKeyframe.name || 'Keyframe senza nome'}
                    </p>
                    {selectedKeyframe.promoId && (
                      <p className="text-xs text-blue-600 font-medium">
                        {promos.find(p => p.id === selectedKeyframe.promoId)?.nome || 'Promozione selezionata'}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={() => {
                      dispatch({ type: "SET_INSPECTOR_OPEN", payload: false });
                      dispatch({ type: "SET_SELECTED_KEYFRAME", payload: null });
                    }}
                  >
                    <Lucide icon="X" className="w-3 h-3" />
                  </Button>
                </div>

                {/* Contenuto Editor */}
                <div className="flex-1 overflow-y-auto p-3 space-y-4">
                  {/* Nome Keyframe */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Nome
                    </label>
                    <FormInput
                      type="text"
                      value={selectedKeyframe.name || ''}
                      onChange={(e) => {
                        const newName = e.target.value;
                        updateKeyframe(selectedKeyframe.id, { name: newName });
                        // Aggiorna anche lo stato locale del keyframe selezionato
                        dispatch({
                          type: "SET_SELECTED_KEYFRAME",
                          payload: { ...selectedKeyframe, name: newName }
                        });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.currentTarget.blur();
                        }
                      }}
                      placeholder="Inserisci nome keyframe..."
                      autoComplete="off"
                      formInputSize="sm"
                    />
                    <div className="text-xs text-slate-500 mt-1">
                      Premi Enter per confermare
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Nome
                    </label>
                    <FormSelect
                      value={selectedKeyframe.promoId || ''}
                      onChange={(e) => {
                        const newPromoId = e.target.value;
                        const promo = promos.find(p => p.id === newPromoId);
                        if (promo) {
                          const updatedKeyframe = {
                            ...selectedKeyframe,
                            startDate: dayjs(promo?.validita_dal).format('YYYY-MM-DD'),
                            endDate: dayjs(promo?.validita_al).format('YYYY-MM-DD'),
                            promoId: newPromoId
                          };
                          updateKeyframe(selectedKeyframe.id, {
                            startDate: updatedKeyframe.startDate,
                            endDate: updatedKeyframe.endDate,
                            promoId: updatedKeyframe.promoId
                          });
                          dispatch({ type: "SET_SELECTED_KEYFRAME", payload: updatedKeyframe });
                          notify("Check", `Promozione "${promo.nome}" selezionata`, "text-green-600");
                        } else {
                          const updatedKeyframe = {
                            ...selectedKeyframe,
                            startDate: dayjs().format('YYYY-MM-DD'),
                            endDate: dayjs().format('YYYY-MM-DD'),
                            promoId: newPromoId
                          };
                          updateKeyframe(selectedKeyframe.id, {
                            startDate: updatedKeyframe.startDate,
                            endDate: updatedKeyframe.endDate,
                            promoId: updatedKeyframe.promoId
                          });
                          dispatch({ type: "SET_SELECTED_KEYFRAME", payload: updatedKeyframe });
                          notify("X", "Promozione deselezionata", "text-orange-600");
                        }
                      }}
                    >
                      <option value="">Seleziona una promozione...</option>
                      {promos.map((promo) => (
                        <option key={promo.id} value={promo.id}>
                          {promo.nome} ({dayjs(promo.validita_dal).format("DD/MM/YYYY")} - {dayjs(promo.validita_al).format("DD/MM/YYYY")})
                        </option>
                      ))}
                    </FormSelect>
                  </div>
                  {/* Date */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Inizio
                      </label>
                      <FormInput
                        type="date"
                        value={selectedKeyframe.startDate}
                        min={dayjs().subtract(1, 'year').format('YYYY-MM-DD')}
                        max={dayjs().add(2, 'years').format('YYYY-MM-DD')}
                        onChange={(e) => {
                          const newStartDate = e.target.value;
                          const endDate = dayjs(selectedKeyframe.endDate);
                          const startDate = dayjs(newStartDate);

                          // Se la data di inizio è dopo la data di fine, aggiusta automaticamente
                          if (startDate.isAfter(endDate)) {
                            const newEndDate = startDate.add(1, 'day').format('YYYY-MM-DD');
                            updateKeyframe(selectedKeyframe.id, {
                              startDate: newStartDate,
                              endDate: newEndDate,
                              promoId: selectedKeyframe.promoId
                            });
                            // Aggiorna anche lo stato locale
                            dispatch({
                              type: "SET_SELECTED_KEYFRAME",
                              payload: { ...selectedKeyframe, startDate: newStartDate, endDate: newEndDate }
                            });
                            notify("Calendar", "Data di fine aggiustata automaticamente", "text-blue-600");
                          } else {
                            updateKeyframe(selectedKeyframe.id, { startDate: newStartDate });
                            // Aggiorna anche lo stato locale
                            dispatch({
                              type: "SET_SELECTED_KEYFRAME",
                              payload: { ...selectedKeyframe, startDate: newStartDate }
                            });
                          }
                        }}
                        className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 hover:border-slate-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Fine
                      </label>
                      <FormInput
                        type="date"
                        value={selectedKeyframe.endDate}
                        min={selectedKeyframe.startDate}
                        max={dayjs().add(2, 'years').format('YYYY-MM-DD')}
                        onChange={(e) => {
                          const newEndDate = e.target.value;
                          const startDate = dayjs(selectedKeyframe.startDate);
                          const endDate = dayjs(newEndDate);

                          // Se la data di fine è prima della data di inizio, aggiusta automaticamente
                          if (endDate.isBefore(startDate)) {
                            const newStartDate = endDate.subtract(1, 'day').format('YYYY-MM-DD');
                            updateKeyframe(selectedKeyframe.id, {
                              startDate: newStartDate,
                              endDate: newEndDate,
                              promoId: selectedKeyframe.promoId
                            });
                            // Aggiorna anche lo stato locale
                            dispatch({
                              type: "SET_SELECTED_KEYFRAME",
                              payload: { ...selectedKeyframe, startDate: newStartDate, endDate: newEndDate }
                            });
                            notify("Calendar", "Data di inizio aggiustata automaticamente", "text-blue-600");
                          } else {
                            updateKeyframe(selectedKeyframe.id, { endDate: newEndDate });
                            // Aggiorna anche lo stato locale
                            dispatch({
                              type: "SET_SELECTED_KEYFRAME",
                              payload: { ...selectedKeyframe, endDate: newEndDate }
                            });
                          }
                        }}
                        className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 hover:border-slate-400"
                        formInputSize="sm"
                      />
                    </div>
                  </div>

                  {/* Durata calcolata con controlli rapidi */}
                  <div className="bg-blue-50 p-2 rounded text-xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-slate-600">Durata:</span>
                      <span className="font-medium text-blue-700">
                        {dayjs(selectedKeyframe.endDate).diff(dayjs(selectedKeyframe.startDate), 'days')} giorni
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          const start = dayjs(selectedKeyframe.startDate);
                          const end = start.add(1, 'day');
                          const newEndDate = end.format('YYYY-MM-DD');
                          updateKeyframe(selectedKeyframe.id, { endDate: newEndDate });
                          // Aggiorna anche lo stato locale
                          dispatch({
                            type: "SET_SELECTED_KEYFRAME",
                            payload: { ...selectedKeyframe, endDate: newEndDate, promoId: selectedKeyframe.promoId }
                          });
                        }}
                        className="flex-1 px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-xs transition-colors"
                        title="Imposta durata a 1 giorno"
                      >
                        1g
                      </button>
                      <button
                        onClick={() => {
                          const start = dayjs(selectedKeyframe.startDate);
                          const end = start.add(7, 'days');
                          const newEndDate = end.format('YYYY-MM-DD');
                          updateKeyframe(selectedKeyframe.id, { endDate: newEndDate });
                          // Aggiorna anche lo stato locale
                          dispatch({
                            type: "SET_SELECTED_KEYFRAME",
                            payload: { ...selectedKeyframe, endDate: newEndDate, promoId: selectedKeyframe.promoId }
                          });
                        }}
                        className="flex-1 px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-xs transition-colors"
                        title="Imposta durata a 1 settimana"
                      >
                        1s
                      </button>
                      <button
                        onClick={() => {
                          const start = dayjs(selectedKeyframe.startDate);
                          const end = start.add(30, 'days');
                          const newEndDate = end.format('YYYY-MM-DD');
                          updateKeyframe(selectedKeyframe.id, { endDate: newEndDate });
                          // Aggiorna anche lo stato locale
                          dispatch({
                            type: "SET_SELECTED_KEYFRAME",
                            payload: { ...selectedKeyframe, endDate: newEndDate }
                          });
                        }}
                        className="flex-1 px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-xs transition-colors"
                        title="Imposta durata a 1 mese"
                      >
                        1m
                      </button>
                    </div>
                  </div>

                  {/* Colore */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Colore
                    </label>
                    <div className="space-y-2">
                      {/* Color picker personalizzato */}
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={selectedKeyframe.color}
                          onChange={(e) => {
                            const newColor = e.target.value;
                            updateKeyframe(selectedKeyframe.id, { color: newColor });
                            // Aggiorna anche lo stato locale
                            dispatch({
                              type: "SET_SELECTED_KEYFRAME",
                              payload: { ...selectedKeyframe, color: newColor }
                            });
                          }}
                          className="w-8 h-8 border border-slate-300 rounded cursor-pointer hover:border-slate-400 transition-colors"
                          title="Scegli colore personalizzato"
                        />
                        <div className="flex-1 px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded font-mono">
                          {selectedKeyframe.color.toUpperCase()}
                        </div>
                      </div>

                      {/* Palette colori predefiniti */}
                      <div>
                        <div className="text-xs text-slate-500 mb-1">Colori predefiniti:</div>
                        <div className="grid grid-cols-6 gap-1">
                          {KEYFRAME_COLORS.map((color) => (
                            <button
                              key={color}
                              onClick={() => {
                                updateKeyframe(selectedKeyframe.id, { color });
                                // Aggiorna anche lo stato locale
                                dispatch({
                                  type: "SET_SELECTED_KEYFRAME",
                                  payload: { ...selectedKeyframe, color }
                                });
                              }}
                              className={`w-6 h-6 rounded border-2 transition-all duration-200 hover:scale-110 ${selectedKeyframe.color === color
                                ? 'border-slate-600 shadow-md'
                                : 'border-slate-200 hover:border-slate-400'
                                }`}
                              style={{ backgroundColor: color }}
                              title={`Usa ${color.toUpperCase()}`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Toggle Attivo */}
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-medium text-slate-700">
                        Attivo
                      </label>
                    </div>
                    <button
                      onClick={() => {
                        toggleKeyframeActive(selectedKeyframe.id);
                        // Aggiorna anche lo stato locale
                        dispatch({
                          type: "SET_SELECTED_KEYFRAME",
                          payload: { ...selectedKeyframe, isActive: !selectedKeyframe.isActive }
                        });
                      }}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${selectedKeyframe.isActive ? 'bg-primary' : 'bg-slate-300'
                        }`}
                    >
                      <span
                        className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${selectedKeyframe.isActive ? 'translate-x-5' : 'translate-x-1'
                          }`}
                      />
                    </button>
                  </div>

                  {/* Tipo Override */}


                  {/* Componente Target */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Componente Target
                    </label>
                    <select
                      value={selectedKeyframe.targetComponentId || ''}
                      onChange={(e) => {
                        const newTargetComponentId = e.target.value;
                        updateKeyframe(selectedKeyframe.id, { targetComponentId: newTargetComponentId });
                        // Aggiorna anche lo stato locale
                        dispatch({
                          type: "SET_SELECTED_KEYFRAME",
                          payload: { ...selectedKeyframe, targetComponentId: newTargetComponentId }
                        });
                      }}
                      className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 hover:border-slate-400"
                    >
                      <option value="">🔍 Seleziona componente...</option>
                      {availableComponents.map((comp) => (
                        <option key={comp.id} value={comp.id}>
                          {comp.is_hybrid ? '🔀' : '📦'} {comp.alias || comp.type} {comp.is_hybrid ? '(Ibrido)' : ''}
                        </option>
                      ))}
                    </select>
                    {selectedKeyframe.targetComponentId && (
                      <div className="text-xs text-slate-500 mt-1">
                        Target: {availableComponents.find(c => c.id === selectedKeyframe.targetComponentId)?.alias || selectedKeyframe.targetComponentId}
                      </div>
                    )}
                  </div>

                  {/* Statistiche e Info */}
                  <div className="bg-slate-50 p-2 rounded text-xs space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-slate-500">Durata</div>
                        <div className="font-medium">
                          {dayjs(selectedKeyframe.endDate).diff(dayjs(selectedKeyframe.startDate), 'days')} giorni
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500">Modifiche</div>
                        <div className="font-medium">
                          {selectedKeyframe.modification ? 1 : 0}
                        </div>
                      </div>
                    </div>

                    {/* Info aggiuntive */}
                    <div className="border-t border-slate-200 pt-2">
                      <div className="text-slate-500 mb-1">Periodo:</div>
                      <div className="font-medium text-slate-700">
                        {dayjs(selectedKeyframe.startDate).format('DD/MM/YYYY')} → {dayjs(selectedKeyframe.endDate).format('DD/MM/YYYY')}
                      </div>
                    </div>

                    {/* Stato attivo */}
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Stato:</span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${selectedKeyframe.isActive
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                        }`}>
                        {selectedKeyframe.isActive ? '✅ Attivo' : '❌ Inattivo'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer con Azioni */}
                <div className="border-t border-slate-200 p-2 bg-slate-50">
                  <div className="flex gap-1">
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={() => {
                        const id = duplicateKeyframe(selectedKeyframe.id);
                        if (id) notify("Copy", "Keyframe duplicato", "text-blue-600");
                      }}
                      className="flex-1 text-xs"
                    >
                      <Lucide icon="Copy" className="w-3 h-3 mr-1" />
                      Duplica
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        deleteKeyframe(selectedKeyframe.id);
                        dispatch({ type: "SET_SELECTED_KEYFRAME", payload: null });
                        dispatch({ type: "SET_INSPECTOR_OPEN", payload: false });
                        notify("Trash2", "Keyframe eliminato", "text-red-600");
                      }}
                      className="flex-1 text-xs"
                    >
                      <Lucide icon="Trash2" className="w-3 h-3 mr-1" />
                      Elimina
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      )}

    </AnimatePresence>
  );
};

export default PromotionTimeline;
